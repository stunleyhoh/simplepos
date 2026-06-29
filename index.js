const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");

admin.initializeApp();

const POS_ADMIN_EMAIL = "stanleyhoh79@gmail.com";
const SIMPLEPAY_PROJECT_ID = "oneminpay";
const AFFILIATE_PROJECT_ID = "amsystem-faafb";
const posDb = admin.firestore();
const simplePayDb = admin.firestore(
  admin.initializeApp({ projectId: SIMPLEPAY_PROJECT_ID }, "simplepay")
);
const affiliateDb = admin.firestore(
  admin.initializeApp({ projectId: AFFILIATE_PROJECT_ID }, "affiliate")
);

class IntegrationError extends Error {
  constructor(code, message, retryable = false) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

function text(value) {
  return String(value || "").trim();
}

function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function serverTimestamp() {
  return admin.firestore.FieldValue.serverTimestamp();
}

function assertAdmin(request) {
  const email = text(request.auth && request.auth.token && request.auth.token.email).toLowerCase();
  if (!request.auth || email !== POS_ADMIN_EMAIL) {
    throw new HttpsError("permission-denied", "Only the Simple POS administrator can retry integration jobs.");
  }
}

async function claimJob(jobRef) {
  return posDb.runTransaction(async (tx) => {
    const snapshot = await tx.get(jobRef);
    if (!snapshot.exists) return null;
    const job = snapshot.data();
    if (!["pending", "retry"].includes(job.status)) return null;
    const attempts = Number(job.attempts || 0) + 1;
    tx.update(jobRef, {
      status: "processing",
      attempts,
      lastAttemptAt: serverTimestamp(),
      cloudUpdatedAt: serverTimestamp()
    });
    return { id: snapshot.id, ...job, attempts };
  });
}

async function getBranchMerchant(job) {
  const branchId = text(job.branchId || "hq");
  const snapshot = await posDb.collection("branches").doc(branchId).get();
  const merchantId = text(snapshot.exists && snapshot.data().simplePayMerchantId);
  if (!merchantId) {
    throw new IntegrationError(
      "simplepay-merchant-not-configured",
      `Branch ${branchId} has no SimplePay merchant ID.`
    );
  }
  return {
    branchId,
    branchName: text(snapshot.data().name || job.branchName),
    merchantId
  };
}

async function findMerchantOrder(reference) {
  const value = text(reference);
  if (!value) return null;
  const direct = await simplePayDb.collection("merchantOrders").doc(value).get();
  if (direct.exists) return { id: direct.id, ...direct.data() };
  const byReference = await simplePayDb
    .collection("merchantOrders")
    .where("paymentReference", "==", value)
    .limit(2)
    .get();
  if (byReference.size === 1) {
    const doc = byReference.docs[0];
    return { id: doc.id, ...doc.data() };
  }
  return null;
}

async function simplePayAmountPoints(job) {
  const config = await simplePayDb.collection("systemConfig").doc("main").get();
  const pointsPerMyr = Number(config.exists && config.data().pointsPerMyr) || 100;
  return {
    pointsPerMyr,
    amountPoints: Math.round(money(job.amount && job.amount.value) * pointsPerMyr)
  };
}

async function processSimplePayPayment(job) {
  const merchant = await getBranchMerchant(job);
  const amount = await simplePayAmountPoints(job);

  if (job.action === "verify-payment") {
    const order = await findMerchantOrder(job.paymentReference);
    if (!order) throw new IntegrationError("payment-not-found", "SimplePay payment was not found.", true);
    if (order.status !== "approved") {
      throw new IntegrationError("payment-not-approved", `SimplePay payment status is ${order.status}.`, true);
    }
    if (text(order.merchantId) !== merchant.merchantId) {
      throw new IntegrationError("merchant-mismatch", "SimplePay payment belongs to another merchant.");
    }
    if (Number(order.amount || 0) !== amount.amountPoints) {
      throw new IntegrationError("amount-mismatch", "SimplePay payment amount does not match the POS order.");
    }
    return {
      status: "completed",
      targetReference: `merchantOrders/${order.id}`,
      result: {
        paymentReference: text(order.paymentReference || order.id),
        merchantId: merchant.merchantId,
        amountPoints: amount.amountPoints
      }
    };
  }

  const intentRef = simplePayDb.collection("paymentIntents").doc(job.id);
  await intentRef.set({
    id: job.id,
    idempotencyKey: job.id,
    sourceSystem: "simple-pos",
    posOrderId: text(job.posOrderId),
    branchId: merchant.branchId,
    branchName: merchant.branchName,
    merchantId: merchant.merchantId,
    amountMyr: money(job.amount && job.amount.value),
    amountPoints: amount.amountPoints,
    pointsPerMyr: amount.pointsPerMyr,
    currency: "MYR",
    customer: job.customer || {},
    status: "awaiting-customer-authorization",
    createdAt: text(job.createdAt) || new Date().toISOString(),
    updatedAt: serverTimestamp()
  }, { merge: true });
  return {
    status: "awaiting-customer-authorization",
    targetReference: `paymentIntents/${intentRef.id}`,
    result: {
      merchantId: merchant.merchantId,
      amountPoints: amount.amountPoints
    }
  };
}

async function processSimplePayRefund(job) {
  const merchant = await getBranchMerchant(job);
  const order = await findMerchantOrder(job.originalPaymentReference);
  if (!order) throw new IntegrationError("payment-not-found", "Original SimplePay payment was not found.", true);
  if (text(order.merchantId) !== merchant.merchantId) {
    throw new IntegrationError("merchant-mismatch", "Original payment belongs to another merchant.");
  }
  if (order.status === "refunded") {
    return {
      status: "completed",
      targetReference: `merchantOrders/${order.id}`,
      result: { refundReference: text(order.refundRequestId || `RF-${order.id}`) }
    };
  }
  const requestId = `RF-${order.id}`;
  const refundRef = simplePayDb.collection("merchantRefundIntents").doc(requestId);
  await refundRef.set({
    id: requestId,
    idempotencyKey: job.id,
    sourceSystem: "simple-pos",
    posJobId: job.id,
    posOrderId: text(job.posOrderId),
    orderId: order.id,
    paymentReference: text(order.paymentReference || order.id),
    merchantId: merchant.merchantId,
    reason: text(job.reason || "POS order voided"),
    status: "awaiting-merchant-approval",
    createdAt: text(job.createdAt) || new Date().toISOString(),
    updatedAt: serverTimestamp()
  }, { merge: true });
  return {
    status: "awaiting-refund-approval",
    targetReference: `merchantRefundIntents/${refundRef.id}`,
    result: { refundReference: refundRef.id }
  };
}

async function blockerResult(job) {
  if (!text(job.blockedBy)) return null;
  const snapshot = await posDb.collection("integrationJobs").doc(job.blockedBy).get();
  if (!snapshot.exists) {
    throw new IntegrationError("blocker-not-found", `Blocking job ${job.blockedBy} was not found.`);
  }
  const blocker = snapshot.data();
  if (blocker.status !== "completed") {
    return { blocked: true, status: blocker.status };
  }
  return { blocked: false, ...blocker.result };
}

async function processAffiliate(job) {
  const blocker = await blockerResult(job);
  if (blocker && blocker.blocked) {
    return {
      status: "blocked",
      result: { blockedBy: job.blockedBy, blockerStatus: blocker.status }
    };
  }

  const operation = job.operation === "affiliate.reverse" ? "reversePosOrder" : "ingestPosOrder";
  const commandRef = affiliateDb.collection("amsystemIntegrationCommands").doc(job.id);
  const payload = operation === "reversePosOrder"
    ? {
        externalOrderId: text(job.originalExternalOrderId),
        refundReference: text(blocker && blocker.refundReference) || `POS-VOID-${job.posOrderId}`,
        reason: text(job.reason || "POS order refunded")
      }
    : {
        externalOrderId: job.id,
        posOrderId: text(job.posOrderId),
        branchId: text(job.branchId),
        paymentStatus: "confirmed",
        paymentReference: text(blocker && blocker.paymentReference) || `POS-${job.posOrderId}`,
        paymentMethod: text(blocker && blocker.paymentReference) ? "SimplePay" : "POS",
        amount: money(job.amount && job.amount.value),
        planId: text(job.planId || "plan_rm180"),
        referralCode: text(job.referralCode),
        customer: job.customer || {},
        createdAt: text(job.createdAt)
      };
  await commandRef.set({
    id: job.id,
    idempotencyKey: job.id,
    sourceSystem: "simple-pos",
    posProjectId: process.env.GCLOUD_PROJECT || "simplepos-2900e",
    posJobId: job.id,
    operation,
    payload,
    status: "pending",
    attempts: 0,
    createdAt: text(job.createdAt) || new Date().toISOString(),
    updatedAt: serverTimestamp()
  }, { merge: true });
  return {
    status: "dispatched",
    targetReference: `amsystemIntegrationCommands/${commandRef.id}`,
    result: { operation }
  };
}

async function runJob(jobRef) {
  const job = await claimJob(jobRef);
  if (!job) return;
  try {
    let outcome;
    if (job.operation === "simplepay.payment") outcome = await processSimplePayPayment(job);
    else if (job.operation === "simplepay.refund") outcome = await processSimplePayRefund(job);
    else if (["affiliate.fulfill", "affiliate.reverse"].includes(job.operation)) {
      outcome = await processAffiliate(job);
    } else {
      throw new IntegrationError("unsupported-operation", `Unsupported operation: ${job.operation}`);
    }
    await jobRef.set({
      ...outcome,
      lastError: admin.firestore.FieldValue.delete(),
      cloudUpdatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Integration job failed", job.id, error);
    await jobRef.set({
      status: error.retryable && job.attempts < 5 ? "retry" : "needs-attention",
      lastError: {
        code: text(error.code || "integration-error"),
        message: text(error.message || "Integration job failed"),
        retryable: Boolean(error.retryable),
        at: new Date().toISOString()
      },
      cloudUpdatedAt: serverTimestamp()
    }, { merge: true });
  }
}

async function releaseDependents(completedJobId) {
  const snapshot = await posDb
    .collection("integrationJobs")
    .where("blockedBy", "==", completedJobId)
    .where("status", "==", "blocked")
    .get();
  await Promise.all(snapshot.docs.map((doc) => doc.ref.set({
    status: "pending",
    cloudUpdatedAt: serverTimestamp()
  }, { merge: true })));
}

async function cancelTargetIntent(jobId, job) {
  if (job.operation !== "simplepay.payment") return;
  await simplePayDb.collection("paymentIntents").doc(jobId).set({
    status: "canceled",
    cancelReason: text(job.cancelReason || "pos-order-canceled"),
    canceledAt: text(job.canceledAt) || new Date().toISOString(),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

exports.processIntegrationJob = onDocumentWritten("integrationJobs/{jobId}", async (event) => {
  const before = event.data && event.data.before.exists ? event.data.before.data() : null;
  const after = event.data && event.data.after.exists ? event.data.after.data() : null;
  if (!after) return;
  if (["pending", "retry"].includes(after.status)) {
    await runJob(event.data.after.ref);
  }
  if (after.status === "completed" && before && before.status !== "completed") {
    await releaseDependents(event.params.jobId);
  }
  if (after.status === "canceled" && (!before || before.status !== "canceled")) {
    await cancelTargetIntent(event.params.jobId, after);
  }
});

exports.retryIntegrationJob = onCall(async (request) => {
  assertAdmin(request);
  const jobId = text(request.data && request.data.jobId);
  if (!jobId) throw new HttpsError("invalid-argument", "jobId is required.");
  const jobRef = posDb.collection("integrationJobs").doc(jobId);
  const snapshot = await jobRef.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Integration job not found.");
  await jobRef.set({
    status: "pending",
    lastError: admin.firestore.FieldValue.delete(),
    cloudUpdatedAt: serverTimestamp()
  }, { merge: true });
  return { ok: true, jobId };
});
