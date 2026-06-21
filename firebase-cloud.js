import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

let configModule;
try {
  configModule = await import("./firebase-config.local.js");
} catch {
  configModule = await import("./firebase-config.js");
}

const { adminEmail, firebaseConfig } = configModule;

if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("YOUR_")) {
  window.dispatchEvent(new CustomEvent("cloud-error", {
    detail: { message: "Firebase config is missing. Create firebase-config.local.js." }
  }));
  throw new Error("Firebase config is missing. Create firebase-config.local.js.");
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function emit(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

async function getCloudUser(email) {
  const normalized = normalizeEmail(email);
  const snapshot = await getDoc(doc(db, "users", normalized));
  if (snapshot.exists()) return { id: snapshot.id, ...snapshot.data() };
  if (normalized === adminEmail) {
    const adminUser = {
      email: adminEmail,
      name: "Stanley Hoh",
      role: "admin",
      branchId: "hq",
      active: true,
      createdAt: serverTimestamp()
    };
    await setDoc(doc(db, "users", adminEmail), adminUser, { merge: true });
    return { id: adminEmail, ...adminUser };
  }
  return null;
}

async function loadCollection(name) {
  const snapshot = await getDocs(collection(db, name));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

async function loadAllData() {
  const [branches, users, products, sales] = await Promise.all([
    loadCollection("branches"),
    loadCollection("users"),
    loadCollection("products"),
    loadCollection("sales")
  ]);
  return { branches, users, products, sales };
}

async function loadUserData(appUser) {
  if (!appUser) return { branches: [], users: [], products: [], sales: [] };
  if (appUser.role === "admin" || normalizeEmail(appUser.email) === adminEmail) {
    return loadAllData();
  }

  const [branches, products, salesSnapshot] = await Promise.all([
    loadCollection("branches"),
    loadCollection("products"),
    getDocs(query(collection(db, "sales"), where("branchId", "==", appUser.branchId)))
  ]);
  return {
    branches,
    users: [appUser],
    products,
    sales: salesSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
  };
}

async function saveBranch(branch) {
  await setDoc(doc(db, "branches", branch.id), {
    ...branch,
    active: branch.active ?? true,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function saveAuthorizedUser(user) {
  const email = normalizeEmail(user.email);
  await setDoc(doc(db, "users", email), {
    ...user,
    email,
    active: user.active ?? true,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function saveProduct(product) {
  await setDoc(doc(db, "products", product.id), {
    ...product,
    active: product.active ?? true,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function saveStockAdjustment(adjustment) {
  await setDoc(doc(db, "stockAdjustments", adjustment.id), {
    ...adjustment,
    syncedAt: serverTimestamp()
  }, { merge: true });
}

async function saveAuditLog(log) {
  await setDoc(doc(db, "auditLogs", log.id), {
    ...log,
    syncedAt: serverTimestamp()
  }, { merge: true });
}

async function saveSettings(settings) {
  await setDoc(doc(db, "settings", "app"), {
    ...settings,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function loadSettings() {
  const snapshot = await getDoc(doc(db, "settings", "app"));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

async function saveSale(sale) {
  await setDoc(doc(db, "sales", sale.id), {
    ...sale,
    syncStatus: "synced",
    syncedAt: serverTimestamp()
  }, { merge: true });
}

async function saveCheckout(sale) {
  await runTransaction(db, async (transaction) => {
    const productRefs = sale.items.map((item) => doc(db, "products", item.id));
    const snapshots = [];
    for (const productRef of productRefs) {
      snapshots.push(await transaction.get(productRef));
    }

    snapshots.forEach((snapshot, index) => {
      if (!snapshot.exists()) {
        throw new Error(`商品不存在：${sale.items[index].name}`);
      }
      const item = sale.items[index];
      const product = snapshot.data();
      const branchStock = { ...(product.branchStock || {}) };
      const currentStock = Number(branchStock[sale.branchId] || 0);
      if (currentStock < item.qty) {
        throw new Error(`${item.name} 库存不足，当前库存 ${currentStock}`);
      }
      branchStock[sale.branchId] = currentStock - item.qty;
      transaction.update(snapshot.ref, {
        branchStock,
        stock: sale.branchId === "hq" ? branchStock[sale.branchId] : product.stock,
        updatedAt: serverTimestamp()
      });
    });

    transaction.set(doc(db, "sales", sale.id), {
      ...sale,
      syncStatus: "synced",
      syncedAt: serverTimestamp()
    }, { merge: true });
  });
}

async function signInWithGoogle() {
  await signInWithPopup(auth, provider);
}

async function signOutGoogle() {
  await signOut(auth);
}

window.cloudPOS = {
  auth,
  db,
  signInWithGoogle,
  signOutGoogle,
  getCloudUser,
  loadCollection,
  loadAllData,
  loadUserData,
  saveBranch,
  saveAuthorizedUser,
  saveProduct,
  saveStockAdjustment,
  saveAuditLog,
  saveSettings,
  loadSettings,
  saveSale,
  saveCheckout
};

onAuthStateChanged(auth, async (firebaseUser) => {
  if (!firebaseUser) {
    emit("cloud-auth-change", { firebaseUser: null, appUser: null });
    return;
  }

  try {
    const appUser = await getCloudUser(firebaseUser.email);
    emit("cloud-auth-change", { firebaseUser, appUser });
  } catch (error) {
    emit("cloud-error", { message: error.message });
  }
});

emit("cloud-ready", { projectId: firebaseConfig.projectId });
