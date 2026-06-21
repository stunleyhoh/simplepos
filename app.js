const STORAGE_KEYS = {
  products: "simple-herbal-pos-products",
  sales: "simple-herbal-pos-sales",
  adminEmail: "simple-herbal-pos-admin-email",
  branchId: "simple-herbal-pos-branch-id",
  branches: "simple-herbal-pos-branches",
  authorizedUsers: "simple-herbal-pos-authorized-users",
  operatorEmail: "simple-herbal-pos-operator-email",
  paymentMethod: "simple-herbal-pos-payment-method",
  pendingSales: "simple-herbal-pos-pending-sales",
  pendingSaleUpdates: "simple-herbal-pos-pending-sale-updates",
  pendingProducts: "simple-herbal-pos-pending-products",
  pendingStockAdjustments: "simple-herbal-pos-pending-stock-adjustments",
  pendingAuditLogs: "simple-herbal-pos-pending-audit-logs",
  stockAdjustments: "simple-herbal-pos-stock-adjustments",
  auditLogs: "simple-herbal-pos-local-audit-logs",
  settings: "simple-herbal-pos-settings"
};

const ADMIN_EMAIL_HASH = "967c8833b2067bcf8ad711b817f9662dc8fd48e79e82992bfd56d5af919a6915";
const APP_VERSION = "v0.40";
const defaultBranches = [
  { id: "hq", name: "总店" },
  { id: "branch-1", name: "分行 1" },
  { id: "branch-2", name: "分行 2" }
];
const defaultAuthorizedUsers = [];
const defaultSettings = {
  businessName: "简单草本减脂计划",
  defaultServiceName: "简单草本减脂计划第一阶段",
  serviceDays: 21,
  lowStockThreshold: 5,
  receiptFooter: "谢谢惠顾"
};

const sampleProducts = [
  { id: createId(), name: "简单草本减脂计划第一阶段", barcode: "SLIM-P1-3W", category: "草本减脂计划", price: 150, stock: 30, branchStock: { hq: 30, "branch-1": 12, "branch-2": 8 } },
  { id: createId(), name: "第一阶段复购包", barcode: "SLIM-P1-REFILL", category: "草本减脂计划", price: 150, stock: 20, branchStock: { hq: 20, "branch-1": 8, "branch-2": 5 } },
  { id: createId(), name: "3星期跟进服务", barcode: "SLIM-COACH-3W", category: "服务", price: 0, stock: 99, branchStock: { hq: 99, "branch-1": 99, "branch-2": 99 } }
];

let products = load(STORAGE_KEYS.products, sampleProducts);
let sales = load(STORAGE_KEYS.sales, []);
let branches = load(STORAGE_KEYS.branches, defaultBranches);
let authorizedUsers = load(STORAGE_KEYS.authorizedUsers, defaultAuthorizedUsers);
let pendingSales = load(STORAGE_KEYS.pendingSales, []);
let pendingSaleUpdates = load(STORAGE_KEYS.pendingSaleUpdates, []);
let pendingProducts = load(STORAGE_KEYS.pendingProducts, []);
let pendingStockAdjustments = load(STORAGE_KEYS.pendingStockAdjustments, []);
let pendingAuditLogs = load(STORAGE_KEYS.pendingAuditLogs, []);
let stockAdjustments = load(STORAGE_KEYS.stockAdjustments, []);
let auditLogs = load(STORAGE_KEYS.auditLogs, []);
let appSettings = load(STORAGE_KEYS.settings, defaultSettings);
let cart = [];
let deferredInstallPrompt = null;
let adminEmail = localStorage.getItem(STORAGE_KEYS.adminEmail) || "";
let currentBranchId = localStorage.getItem(STORAGE_KEYS.branchId) || "hq";
let operatorEmail = localStorage.getItem(STORAGE_KEYS.operatorEmail) || "";
let preferredPaymentMethod = localStorage.getItem(STORAGE_KEYS.paymentMethod) || "现金";
let cloudSessionActive = false;
let currentCloudUser = null;
let reportRangeInitialized = false;
let autoFillPaid = true;
let currentView = "order";
let paymentMethodInitialized = false;
let showMoreSales = false;

const VIEW_META = {
  order: { title: "下单", subtitle: "选择商品并完成当前订单" },
  menu: { title: "菜单管理", subtitle: "新增商品或调整当前分行库存" },
  inventory: { title: "库存", subtitle: "查看库存流水和低库存提醒" },
  transactions: { title: "转账记录", subtitle: "查看销售记录、客户跟进和收款状态" },
  report: { title: "报告", subtitle: "查看全局指标、分行表现和销售趋势" },
  settings: { title: "设置", subtitle: "管理分行、员工、同步、备份和业务设置" }
};

function setAppView(view) {
  currentView = view;
  document.body.dataset.view = view;
  for (const button of document.querySelectorAll("[data-app-view]")) {
    button.classList.toggle("active", button.dataset.appView === view);
  }
  els.appMenu.classList.remove("open");
  els.menuToggleBtn.setAttribute("aria-expanded", "false");
  updateViewHeadings();
  if (view !== "order" && !isAdmin()) {
    els.adminLoginMessage.textContent = `请先进入后台，才能查看「${VIEW_META[view]?.title || "这个功能"}」。`;
    els.adminLoginMessage.classList.remove("error");
  }
}

function updateViewHeadings() {
  const meta = VIEW_META[currentView] || VIEW_META.order;
  if (els.adminTitle) els.adminTitle.textContent = meta.title;
  if (els.adminSubtitle) els.adminSubtitle.textContent = meta.subtitle;
}

const els = {
  networkStatus: document.querySelector("#networkStatus"),
  cloudStatus: document.querySelector("#cloudStatus"),
  branchStatus: document.querySelector("#branchStatus"),
  operatorStatus: document.querySelector("#operatorStatus"),
  adminStatus: document.querySelector("#adminStatus"),
  versionStatus: document.querySelector("#versionStatus"),
  adminTitle: document.querySelector("#adminTitle"),
  adminSubtitle: document.querySelector("#adminSubtitle"),
  appMenu: document.querySelector("#appMenu"),
  menuToggleBtn: document.querySelector("#menuToggleBtn"),
  cashierMenu: document.querySelector("#cashierMenu"),
  cashierToggleBtn: document.querySelector("#cashierToggleBtn"),
  cashierOperatorText: document.querySelector("#cashierOperatorText"),
  quickCheckoutBtn: document.querySelector("#quickCheckoutBtn"),
  installBtn: document.querySelector("#installBtn"),
  seedBtn: document.querySelector("#seedBtn"),
  searchInput: document.querySelector("#searchInput"),
  categoryFilter: document.querySelector("#categoryFilter"),
  branchSelect: document.querySelector("#branchSelect"),
  refreshCloudBtn: document.querySelector("#refreshCloudBtn"),
  productGrid: document.querySelector("#productGrid"),
  cartHint: document.querySelector("#cartHint"),
  cartItems: document.querySelector("#cartItems"),
  clearCartBtn: document.querySelector("#clearCartBtn"),
  operatorLoginForm: document.querySelector("#operatorLoginForm"),
  operatorEmailInput: document.querySelector("#operatorEmailInput"),
  googleLoginBtn: document.querySelector("#googleLoginBtn"),
  operatorLogoutBtn: document.querySelector("#operatorLogoutBtn"),
  operatorMessage: document.querySelector("#operatorMessage"),
  customerNameInput: document.querySelector("#customerNameInput"),
  customerPhoneInput: document.querySelector("#customerPhoneInput"),
  discountInput: document.querySelector("#discountInput"),
  paidInput: document.querySelector("#paidInput"),
  paymentMethodInput: document.querySelector("#paymentMethodInput"),
  paymentReferenceInput: document.querySelector("#paymentReferenceInput"),
  subtotalText: document.querySelector("#subtotalText"),
  totalText: document.querySelector("#totalText"),
  changeText: document.querySelector("#changeText"),
  checkoutBtn: document.querySelector("#checkoutBtn"),
  adminLoginForm: document.querySelector("#adminLoginForm"),
  adminEmailInput: document.querySelector("#adminEmailInput"),
  adminGoogleLoginBtn: document.querySelector("#adminGoogleLoginBtn"),
  adminLoginMessage: document.querySelector("#adminLoginMessage"),
  adminLogoutBtn: document.querySelector("#adminLogoutBtn"),
  adminContent: document.querySelector("#adminContent"),
  productForm: document.querySelector("#productForm"),
  nameInput: document.querySelector("#nameInput"),
  barcodeInput: document.querySelector("#barcodeInput"),
  categoryInput: document.querySelector("#categoryInput"),
  priceInput: document.querySelector("#priceInput"),
  stockInput: document.querySelector("#stockInput"),
  initCloudBtn: document.querySelector("#initCloudBtn"),
  syncPendingBtn: document.querySelector("#syncPendingBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  exportSummaryBtn: document.querySelector("#exportSummaryBtn"),
  exportPaymentSummaryBtn: document.querySelector("#exportPaymentSummaryBtn"),
  exportProductSalesBtn: document.querySelector("#exportProductSalesBtn"),
  exportInventoryBtn: document.querySelector("#exportInventoryBtn"),
  exportCustomersBtn: document.querySelector("#exportCustomersBtn"),
  exportAuditBtn: document.querySelector("#exportAuditBtn"),
  exportStockBtn: document.querySelector("#exportStockBtn"),
  backupBtn: document.querySelector("#backupBtn"),
  restoreBtn: document.querySelector("#restoreBtn"),
  restoreInput: document.querySelector("#restoreInput"),
  resetDataBtn: document.querySelector("#resetDataBtn"),
  reportStartInput: document.querySelector("#reportStartInput"),
  reportEndInput: document.querySelector("#reportEndInput"),
  reportTodayBtn: document.querySelector("#reportTodayBtn"),
  reportMonthBtn: document.querySelector("#reportMonthBtn"),
  reportAllBtn: document.querySelector("#reportAllBtn"),
  globalRevenueText: document.querySelector("#globalRevenueText"),
  globalOrdersText: document.querySelector("#globalOrdersText"),
  globalCustomersText: document.querySelector("#globalCustomersText"),
  globalStockText: document.querySelector("#globalStockText"),
  branchOverview: document.querySelector("#branchOverview"),
  topProductsList: document.querySelector("#topProductsList"),
  dailyTrendList: document.querySelector("#dailyTrendList"),
  paymentSummaryList: document.querySelector("#paymentSummaryList"),
  menuSearchInput: document.querySelector("#menuSearchInput"),
  menuProductList: document.querySelector("#menuProductList"),
  inventorySearchInput: document.querySelector("#inventorySearchInput"),
  inventoryOverviewList: document.querySelector("#inventoryOverviewList"),
  syncOverview: document.querySelector("#syncOverview"),
  auditList: document.querySelector("#auditList"),
  stockAdjustmentList: document.querySelector("#stockAdjustmentList"),
  followUpList: document.querySelector("#followUpList"),
  lowStockList: document.querySelector("#lowStockList"),
  settingsForm: document.querySelector("#settingsForm"),
  businessNameInput: document.querySelector("#businessNameInput"),
  defaultServiceNameInput: document.querySelector("#defaultServiceNameInput"),
  serviceDaysInput: document.querySelector("#serviceDaysInput"),
  lowStockThresholdInput: document.querySelector("#lowStockThresholdInput"),
  receiptFooterInput: document.querySelector("#receiptFooterInput"),
  branchForm: document.querySelector("#branchForm"),
  branchNameInput: document.querySelector("#branchNameInput"),
  branchList: document.querySelector("#branchList"),
  userForm: document.querySelector("#userForm"),
  userNameInput: document.querySelector("#userNameInput"),
  userEmailInput: document.querySelector("#userEmailInput"),
  userBranchSelect: document.querySelector("#userBranchSelect"),
  userList: document.querySelector("#userList"),
  salesSummary: document.querySelector("#salesSummary"),
  salesDateInput: document.querySelector("#salesDateInput"),
  salesSearchInput: document.querySelector("#salesSearchInput"),
  salesPaymentFilter: document.querySelector("#salesPaymentFilter"),
  dailyPaymentSummaryList: document.querySelector("#dailyPaymentSummaryList"),
  exportDailySettlementBtn: document.querySelector("#exportDailySettlementBtn"),
  toggleSalesLimitBtn: document.querySelector("#toggleSalesLimitBtn"),
  todaySalesBtn: document.querySelector("#todaySalesBtn"),
  salesList: document.querySelector("#salesList"),
  receiptDialog: document.querySelector("#receiptDialog"),
  receiptNo: document.querySelector("#receiptNo"),
  receiptText: document.querySelector("#receiptText"),
  closeReceiptBtn: document.querySelector("#closeReceiptBtn"),
  printReceiptBtn: document.querySelector("#printReceiptBtn")
};

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : structuredClone(fallback);
  } catch {
    return structuredClone(fallback);
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function hasCloud() {
  return Boolean(window.cloudPOS);
}

function updateCloudStatus(text, ok = false) {
  const pendingCount = pendingSales.length + pendingSaleUpdates.length + pendingProducts.length + pendingStockAdjustments.length + pendingAuditLogs.length;
  const pendingText = pendingCount ? ` · 待同步 ${pendingCount}` : "";
  els.cloudStatus.textContent = `${text}${pendingText}`;
  els.cloudStatus.style.color = ok ? "#0f766e" : "#66756f";
}

function savePendingSales() {
  save(STORAGE_KEYS.pendingSales, pendingSales);
}

function queuePendingSale(sale) {
  if (!pendingSales.some((item) => item.id === sale.id)) {
    pendingSales.unshift({ ...sale, syncStatus: "pending" });
    savePendingSales();
  }
  updateCloudStatus("订单待同步");
}

function markSaleSynced(saleId) {
  pendingSales = pendingSales.filter((sale) => sale.id !== saleId);
  savePendingSales();
}

function savePendingSaleUpdates() {
  save(STORAGE_KEYS.pendingSaleUpdates, pendingSaleUpdates);
}

function queuePendingSaleUpdate(sale) {
  pendingSaleUpdates = [
    sale,
    ...pendingSaleUpdates.filter((item) => item.id !== sale.id)
  ];
  savePendingSaleUpdates();
  updateCloudStatus("订单更新待同步");
}

function markSaleUpdateSynced(saleId) {
  pendingSaleUpdates = pendingSaleUpdates.filter((sale) => sale.id !== saleId);
  savePendingSaleUpdates();
}

function savePendingProducts() {
  save(STORAGE_KEYS.pendingProducts, pendingProducts);
}

function queuePendingProduct(product) {
  pendingProducts = [
    product,
    ...pendingProducts.filter((item) => item.id !== product.id)
  ];
  savePendingProducts();
  updateCloudStatus("库存待同步");
}

function markProductSynced(productId) {
  pendingProducts = pendingProducts.filter((product) => product.id !== productId);
  savePendingProducts();
}

function savePendingStockAdjustments() {
  save(STORAGE_KEYS.pendingStockAdjustments, pendingStockAdjustments);
}

function queuePendingStockAdjustment(adjustment) {
  pendingStockAdjustments = [
    adjustment,
    ...pendingStockAdjustments.filter((item) => item.id !== adjustment.id)
  ];
  savePendingStockAdjustments();
  updateCloudStatus("库存调整待同步");
}

function markStockAdjustmentSynced(adjustmentId) {
  pendingStockAdjustments = pendingStockAdjustments.filter((item) => item.id !== adjustmentId);
  savePendingStockAdjustments();
}

function recordStockAdjustment(adjustment) {
  stockAdjustments = [
    adjustment,
    ...stockAdjustments.filter((item) => item.id !== adjustment.id)
  ].slice(0, 500);
  save(STORAGE_KEYS.stockAdjustments, stockAdjustments);
}

function savePendingAuditLogs() {
  save(STORAGE_KEYS.pendingAuditLogs, pendingAuditLogs);
}

function getCurrentActor() {
  return currentCloudUser || getOperator() || { email: adminEmail || operatorEmail || "", name: "本机用户" };
}

function queuePendingAuditLog(log) {
  pendingAuditLogs = [
    log,
    ...pendingAuditLogs.filter((item) => item.id !== log.id)
  ];
  savePendingAuditLogs();
}

function markAuditLogSynced(logId) {
  pendingAuditLogs = pendingAuditLogs.filter((item) => item.id !== logId);
  savePendingAuditLogs();
}

async function writeAuditLog(action, detail = {}) {
  const log = {
    id: `AUD${Date.now()}-${Math.random().toString(16).slice(2)}`,
    action,
    detail,
    actor: getCurrentActor(),
    branchId: currentBranchId,
    branchName: getBranchName(currentBranchId),
    createdAt: new Date().toISOString()
  };
  auditLogs = [
    log,
    ...auditLogs.filter((item) => item.id !== log.id)
  ].slice(0, 500);
  save(STORAGE_KEYS.auditLogs, auditLogs);
  if (!hasCloud() || !navigator.onLine) {
    queuePendingAuditLog(log);
    return false;
  }
  try {
    await window.cloudPOS.saveAuditLog(log);
    markAuditLogSynced(log.id);
    return true;
  } catch (error) {
    queuePendingAuditLog(log);
    console.warn("Audit log sync failed", error);
    return false;
  }
}

function isAdmin() {
  return Boolean(adminEmail);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function isConfiguredAdminEmail(email) {
  return sha256Hex(normalizeEmail(email)).then((hash) => hash === ADMIN_EMAIL_HASH);
}

function ensureAdminAuthorized(email) {
  const normalized = normalizeEmail(email);
  if (!authorizedUsers.some((user) => normalizeEmail(user.email) === normalized)) {
    authorizedUsers.unshift({
      id: "admin-user",
      name: "管理员",
      email: normalized,
      branchId: "hq",
      role: "管理员",
      active: true
    });
    save(STORAGE_KEYS.authorizedUsers, authorizedUsers);
  }
}

function getBranchName(branchId) {
  return branches.find((branch) => branch.id === branchId)?.name || "未知分行";
}

function getBranchStock(product, branchId = currentBranchId) {
  if (product.branchStock && Number.isFinite(Number(product.branchStock[branchId]))) {
    return Number(product.branchStock[branchId]);
  }
  if (branchId === "hq") return Number(product.stock || 0);
  return 0;
}

function setBranchStock(product, branchId, stock) {
  return {
    ...product,
    stock: branchId === "hq" ? stock : product.stock,
    branchStock: {
      ...(product.branchStock || {}),
      [branchId]: stock
    }
  };
}

function createBranchStock(initialStock = 0, selectedBranchId = currentBranchId) {
  return Object.fromEntries(
    branches.map((branch) => [branch.id, branch.id === selectedBranchId ? Number(initialStock || 0) : 0])
  );
}

function getTotalStock() {
  return products.reduce((sum, product) => {
    const branchStock = product.branchStock
      ? Object.values(product.branchStock).reduce((total, value) => total + Number(value || 0), 0)
      : Number(product.stock || 0);
    return sum + branchStock;
  }, 0);
}

function migrateProductsForBranches() {
  products = products.map((product) => {
    if (product.branchStock) {
      const nextStock = { ...product.branchStock };
      for (const branch of branches) {
        if (!Object.hasOwn(nextStock, branch.id)) nextStock[branch.id] = 0;
      }
      return { ...product, branchStock: nextStock };
    }
    return {
      ...product,
      branchStock: createBranchStock(product.stock, "hq")
    };
  });
  save(STORAGE_KEYS.products, products);
}

function cloneSampleProductsForBranches() {
  return structuredClone(sampleProducts).map((product) => ({
    ...product,
    branchStock: Object.fromEntries(
      branches.map((branch) => [branch.id, Number(product.branchStock?.[branch.id] || 0)])
    )
  }));
}

function migrateManagementData() {
  appSettings = { ...defaultSettings, ...appSettings };
  if (!branches.length) branches = structuredClone(defaultBranches);
  if (!authorizedUsers.length) authorizedUsers = structuredClone(defaultAuthorizedUsers);
  if (!branches.some((branch) => branch.id === currentBranchId)) {
    currentBranchId = "hq";
    localStorage.setItem(STORAGE_KEYS.branchId, currentBranchId);
  }
  save(STORAGE_KEYS.branches, branches);
  save(STORAGE_KEYS.authorizedUsers, authorizedUsers);
  save(STORAGE_KEYS.settings, appSettings);
}

function renderBranchSelect() {
  els.branchSelect.innerHTML = "";
  for (const branch of branches) {
    const option = document.createElement("option");
    option.value = branch.id;
    option.textContent = branch.name;
    els.branchSelect.append(option);
  }
  els.branchSelect.value = branches.some((branch) => branch.id === currentBranchId) ? currentBranchId : "hq";
  els.branchStatus.textContent = getBranchName(els.branchSelect.value);
}

function renderAdminAccess() {
  const allowed = isAdmin();
  els.adminStatus.textContent = allowed ? "后台管理员" : "后台未登录";
  els.adminStatus.style.color = allowed ? "#0f766e" : "#66756f";
  els.adminLoginForm.classList.toggle("hidden", allowed);
  els.adminLogoutBtn.classList.toggle("hidden", !allowed);
  els.adminContent.classList.toggle("hidden", !allowed);
  if (allowed) {
    els.adminLoginMessage.classList.remove("error");
    els.adminLoginMessage.textContent = isCloudAdmin()
      ? "Google 管理员已授权"
      : "本机管理员已授权";
  }
}

function getOperator() {
  const email = normalizeEmail(operatorEmail);
  return authorizedUsers.find((user) => normalizeEmail(user.email) === email && user.active !== false) || null;
}

function isOperatorAllowedForCurrentBranch() {
  const operator = getOperator();
  return Boolean(operator && operator.branchId === currentBranchId);
}

function renderOperatorAccess() {
  const operator = getOperator();
  const allowed = isOperatorAllowedForCurrentBranch();
  els.operatorStatus.textContent = allowed
    ? `收银：${operator.name}`
    : operator
      ? "收银分行不匹配"
      : "POS未登录";
  els.operatorStatus.style.color = allowed ? "#0f766e" : "#66756f";
  els.cashierOperatorText.textContent = allowed
    ? `${operator.name} · ${getBranchName(operator.branchId)}`
    : operator
      ? `${operator.name} · 分行不匹配`
      : "未登录";
  els.quickCheckoutBtn.textContent = allowed ? (cart.length ? "结算当前订单" : "开始收银") : "员工登录";
  els.operatorLogoutBtn.classList.toggle("hidden", !operator);
  els.operatorMessage.classList.toggle("error", Boolean(operator && !allowed));
  if (allowed) {
    els.operatorMessage.textContent = `${operator.name} 已授权使用 ${getBranchName(operator.branchId)} POS。`;
  } else if (operator) {
    els.operatorMessage.textContent = `${operator.name} 只被授权使用 ${getBranchName(operator.branchId)}，请切换分行或退出。`;
  } else {
    els.operatorMessage.textContent = "请使用管理员授权的邮箱登录后收银。";
  }
}

function requireOperator() {
  if (isOperatorAllowedForCurrentBranch()) return true;
  alert("请先使用当前分行已授权的邮箱登录 POS。");
  els.operatorEmailInput.focus();
  return false;
}

function loginOperator(event) {
  event.preventDefault();
  const email = normalizeEmail(els.operatorEmailInput.value);
  const user = authorizedUsers.find((item) => normalizeEmail(item.email) === email);
  if (!user) {
    els.operatorMessage.textContent = "此邮箱还没有被管理员授权使用 POS。";
    els.operatorMessage.classList.add("error");
    return;
  }
  operatorEmail = user.email;
  currentBranchId = user.branchId;
  localStorage.setItem(STORAGE_KEYS.operatorEmail, operatorEmail);
  localStorage.setItem(STORAGE_KEYS.branchId, currentBranchId);
  els.operatorEmailInput.value = "";
  cart = [];
  renderAll();
}

function logoutCloudIfReady() {
  if (hasCloud()) {
    window.cloudPOS.signOutGoogle().catch((error) => console.warn("Cloud sign out failed", error));
  }
}

function logoutOperator() {
  operatorEmail = "";
  localStorage.removeItem(STORAGE_KEYS.operatorEmail);
  logoutCloudIfReady();
  cart = [];
  renderAll();
}

async function signInWithGoogle() {
  if (!hasCloud()) {
    alert("Firebase 尚未连接。请确认已联网，并通过 http://localhost 或 HTTPS 打开系统。");
    return;
  }
  try {
    updateCloudStatus("正在打开 Google 登录");
    await window.cloudPOS.signInWithGoogle();
  } catch (error) {
    updateCloudStatus("Google 登录失败");
    alert(`Google 登录失败：${error.message}`);
  }
}

async function syncSaleToCloud(sale) {
  if (!hasCloud() || !navigator.onLine) {
    queuePendingSale(sale);
    return { ok: false, queued: true };
  }
  try {
    if (isSaleVoided(sale)) {
      await window.cloudPOS.saveSale(sale);
    } else if (window.cloudPOS.saveCheckout) {
      await window.cloudPOS.saveCheckout(sale);
    } else {
      await window.cloudPOS.saveSale(sale);
    }
    markSaleSynced(sale.id);
    updateCloudStatus("云端已同步", true);
    return { ok: true, queued: false };
  } catch (error) {
    queuePendingSale(sale);
    updateCloudStatus("云端同步失败");
    console.warn("Cloud sync failed", error);
    return { ok: false, queued: true, error };
  }
}

async function syncPendingSales() {
  if (!pendingSales.length || !hasCloud() || !navigator.onLine) {
    updateCloudStatus(hasCloud() ? "云端已连接" : "云端未连接", hasCloud());
    return;
  }

  updateCloudStatus(`正在补传 ${pendingSales.length} 单`);
  for (const sale of [...pendingSales].reverse()) {
    try {
      if (isSaleVoided(sale)) {
        await window.cloudPOS.saveSale(sale);
      } else if (window.cloudPOS.saveCheckout) {
        await window.cloudPOS.saveCheckout(sale);
      } else {
        await window.cloudPOS.saveSale(sale);
      }
      markSaleSynced(sale.id);
    } catch (error) {
      updateCloudStatus("部分订单待同步");
      console.warn("Pending sale sync failed", error);
      return;
    }
  }
  updateCloudStatus("离线订单已同步", true);
}

async function syncPendingSaleUpdates() {
  if (!pendingSaleUpdates.length || !hasCloud() || !navigator.onLine) return;
  updateCloudStatus(`正在补传 ${pendingSaleUpdates.length} 个订单更新`);
  for (const sale of [...pendingSaleUpdates].reverse()) {
    try {
      await window.cloudPOS.saveSale(sale);
      markSaleUpdateSynced(sale.id);
    } catch (error) {
      updateCloudStatus("部分订单更新待同步");
      console.warn("Pending sale update sync failed", error);
      return;
    }
  }
  updateCloudStatus("订单更新已同步", true);
}

async function syncProductToCloud(product) {
  if (!hasCloud() || !navigator.onLine) {
    queuePendingProduct(product);
    return false;
  }
  try {
    await window.cloudPOS.saveProduct(product);
    markProductSynced(product.id);
    updateCloudStatus("商品已同步", true);
    return true;
  } catch (error) {
    queuePendingProduct(product);
    updateCloudStatus("商品同步失败");
    console.warn("Product cloud sync failed", error);
    return false;
  }
}

async function syncPendingProducts() {
  if (!pendingProducts.length || !hasCloud() || !navigator.onLine) return;
  updateCloudStatus(`正在补传 ${pendingProducts.length} 个库存`);
  for (const product of [...pendingProducts].reverse()) {
    try {
      await window.cloudPOS.saveProduct(product);
      markProductSynced(product.id);
    } catch (error) {
      updateCloudStatus("部分库存待同步");
      console.warn("Pending product sync failed", error);
      return;
    }
  }
  updateCloudStatus("库存已同步", true);
}

async function syncStockAdjustmentToCloud(adjustment) {
  if (!hasCloud() || !navigator.onLine) {
    queuePendingStockAdjustment(adjustment);
    return false;
  }
  try {
    await window.cloudPOS.saveStockAdjustment(adjustment);
    markStockAdjustmentSynced(adjustment.id);
    updateCloudStatus("库存调整已同步", true);
    return true;
  } catch (error) {
    queuePendingStockAdjustment(adjustment);
    updateCloudStatus("库存调整同步失败");
    console.warn("Stock adjustment sync failed", error);
    return false;
  }
}

async function syncPendingStockAdjustments() {
  if (!pendingStockAdjustments.length || !hasCloud() || !navigator.onLine) return;
  updateCloudStatus(`正在补传 ${pendingStockAdjustments.length} 条库存调整`);
  for (const adjustment of [...pendingStockAdjustments].reverse()) {
    try {
      await window.cloudPOS.saveStockAdjustment(adjustment);
      markStockAdjustmentSynced(adjustment.id);
    } catch (error) {
      updateCloudStatus("部分库存调整待同步");
      console.warn("Pending stock adjustment sync failed", error);
      return;
    }
  }
  updateCloudStatus("库存调整已同步", true);
}

async function syncPendingAuditLogs() {
  if (!pendingAuditLogs.length || !hasCloud() || !navigator.onLine) return;
  updateCloudStatus(`正在补传 ${pendingAuditLogs.length} 条审计记录`);
  for (const log of [...pendingAuditLogs].reverse()) {
    try {
      await window.cloudPOS.saveAuditLog(log);
      markAuditLogSynced(log.id);
    } catch (error) {
      updateCloudStatus("部分审计记录待同步");
      console.warn("Pending audit log sync failed", error);
      return;
    }
  }
  updateCloudStatus("审计记录已同步", true);
}

async function syncPendingChanges() {
  await syncPendingProducts();
  await syncPendingStockAdjustments();
  await syncPendingAuditLogs();
  await syncPendingSales();
  await syncPendingSaleUpdates();
}

async function initializeCloudData() {
  if (!requireAdmin()) return;
  if (!requireCloudAdmin()) return;
  if (!hasCloud()) {
    alert("云端还没连接。请先用 Google 管理员登录。");
    return;
  }

  try {
    updateCloudStatus("正在初始化云端");
    for (const branch of branches) {
      await window.cloudPOS.saveBranch(branch);
    }
    for (const user of authorizedUsers) {
      await window.cloudPOS.saveAuthorizedUser(user);
    }
    for (const product of products) {
      await window.cloudPOS.saveProduct(product);
    }
    await window.cloudPOS.saveSettings(appSettings);
    await writeAuditLog("cloud.initialize", {
      branches: branches.length,
      users: authorizedUsers.length,
      products: products.length
    });
    updateCloudStatus("云端初始化完成", true);
    alert("云端数据初始化完成。");
  } catch (error) {
    updateCloudStatus("云端初始化失败");
    alert(`云端初始化失败：${error.message}`);
  }
}

function normalizeCloudSales(cloudSales) {
  return cloudSales
    .map((sale) => ({
      ...sale,
      createdAt: sale.createdAt?.toDate ? sale.createdAt.toDate().toISOString() : sale.createdAt
    }))
    .filter((sale) => sale.id && sale.createdAt);
}

function normalizeCloudTimelineItems(items) {
  return items
    .map((item) => ({
      ...item,
      createdAt: item.createdAt?.toDate ? item.createdAt.toDate().toISOString() : item.createdAt
    }))
    .filter((item) => item.id && item.createdAt)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function loadCloudData() {
  if (!hasCloud() || !navigator.onLine) return false;
  try {
    updateCloudStatus("正在读取云端资料");
    const data = await window.cloudPOS.loadUserData(getOperator());
    const cloudSettings = await window.cloudPOS.loadSettings();
    if (cloudSettings) {
      appSettings = { ...appSettings, ...cloudSettings };
      save(STORAGE_KEYS.settings, appSettings);
    }
    if (data.branches.length) {
      branches = data.branches.filter((branch) => branch.active !== false);
      save(STORAGE_KEYS.branches, branches);
    }
    if (data.users.length) {
      authorizedUsers = data.users.filter((user) => user.active !== false);
      save(STORAGE_KEYS.authorizedUsers, authorizedUsers);
    }
    if (data.products.length) {
      products = data.products.filter((product) => product.active !== false);
      save(STORAGE_KEYS.products, products);
    }
    if (data.sales.length) {
      const cloudSales = normalizeCloudSales(data.sales);
      const mergedSales = [...cloudSales, ...sales.filter((sale) => !cloudSales.some((item) => item.id === sale.id))];
      sales = mergedSales.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      save(STORAGE_KEYS.sales, sales);
    }
    if ((data.stockAdjustments || []).length) {
      const cloudAdjustments = normalizeCloudTimelineItems(data.stockAdjustments || []);
      stockAdjustments = [...cloudAdjustments, ...stockAdjustments.filter((item) => !cloudAdjustments.some((cloudItem) => cloudItem.id === item.id))].slice(0, 500);
      save(STORAGE_KEYS.stockAdjustments, stockAdjustments);
    }
    if ((data.auditLogs || []).length) {
      const cloudAuditLogs = normalizeCloudTimelineItems(data.auditLogs || []);
      auditLogs = [...cloudAuditLogs, ...auditLogs.filter((item) => !cloudAuditLogs.some((cloudItem) => cloudItem.id === item.id))].slice(0, 500);
      save(STORAGE_KEYS.auditLogs, auditLogs);
    }
    migrateManagementData();
    migrateProductsForBranches();
    updateCloudStatus("云端资料已更新", true);
    renderAll();
    return true;
  } catch (error) {
    updateCloudStatus("读取云端失败");
    console.warn("Cloud data load failed", error);
    return false;
  }
}

async function saveSettings(event) {
  event.preventDefault();
  if (!requireAdmin()) return;
  appSettings = {
    businessName: els.businessNameInput.value.trim(),
    defaultServiceName: els.defaultServiceNameInput.value.trim(),
    serviceDays: Math.max(1, Number(els.serviceDaysInput.value || 21)),
    lowStockThreshold: Math.max(0, Number(els.lowStockThresholdInput.value || 5)),
    receiptFooter: els.receiptFooterInput.value.trim()
  };
  save(STORAGE_KEYS.settings, appSettings);
  if (hasCloud()) {
    window.cloudPOS.saveSettings(appSettings).catch((error) => console.warn("Settings cloud sync failed", error));
  }
  writeAuditLog("settings.update", { settings: appSettings });
  renderAll();
}

function applyCloudUser(appUser) {
  if (!appUser || appUser.active === false) {
    updateCloudStatus("邮箱未授权");
    return;
  }

  cloudSessionActive = true;
  currentCloudUser = appUser;
  if (!authorizedUsers.some((user) => normalizeEmail(user.email) === normalizeEmail(appUser.email))) {
    authorizedUsers.push({
      id: appUser.id || appUser.email,
      name: appUser.name || appUser.email,
      email: appUser.email,
      branchId: appUser.branchId || "hq",
      role: appUser.role || "POS用户"
    });
    save(STORAGE_KEYS.authorizedUsers, authorizedUsers);
  }

  if (appUser.role === "admin") {
    adminEmail = normalizeEmail(appUser.email);
    ensureAdminAuthorized(adminEmail);
    localStorage.setItem(STORAGE_KEYS.adminEmail, adminEmail);
  }

  operatorEmail = appUser.email;
  currentBranchId = appUser.branchId || "hq";
  localStorage.setItem(STORAGE_KEYS.operatorEmail, operatorEmail);
  localStorage.setItem(STORAGE_KEYS.branchId, currentBranchId);
  updateCloudStatus(`云端已登录：${appUser.email}`, true);
  loadCloudData();
  syncPendingChanges();
  renderAll();
}

function requireAdmin() {
  if (isAdmin()) return true;
  alert("只有唯一管理员可以操作后台。请先输入管理员邮箱。");
  els.adminEmailInput.focus();
  return false;
}

function isCloudAdmin() {
  return currentCloudUser && currentCloudUser.role === "admin";
}

function requireCloudAdmin() {
  if (isCloudAdmin()) return true;
  alert("这个操作需要 Google 管理员登录。请点击 Google 管理员登录。");
  return false;
}

async function loginAdmin(event) {
  event.preventDefault();
  const email = normalizeEmail(els.adminEmailInput.value);
  if (!(await isConfiguredAdminEmail(email))) {
    els.adminLoginMessage.textContent = "邮箱不匹配，无法进入后台。";
    els.adminLoginMessage.classList.add("error");
    return;
  }
  adminEmail = email;
  ensureAdminAuthorized(email);
  localStorage.setItem(STORAGE_KEYS.adminEmail, adminEmail);
  els.adminEmailInput.value = "";
  renderAdminAccess();
  renderGlobalDashboard();
}

function logoutAdmin() {
  adminEmail = "";
  localStorage.removeItem(STORAGE_KEYS.adminEmail);
  els.adminLoginMessage.textContent = "商品管理、导出销售记录和清空数据仅管理员可用。";
  els.adminLoginMessage.classList.remove("error");
  logoutCloudIfReady();
  renderAdminAccess();
}

function createSlug(value) {
  return normalizeEmail(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36) || `branch-${Date.now()}`;
}

function renderManagementLists() {
  if (!isAdmin()) return;
  els.userBranchSelect.innerHTML = "";
  for (const branch of branches) {
    const option = document.createElement("option");
    option.value = branch.id;
    option.textContent = branch.name;
    els.userBranchSelect.append(option);
  }

  els.branchList.innerHTML = "";
  for (const branch of branches) {
    const row = document.createElement("div");
    row.className = "management-row";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(branch.name)}</strong>
        <small>${escapeHtml(branch.id)}</small>
      </div>
      <small>${authorizedUsers.filter((user) => user.branchId === branch.id).length} 位授权用户</small>
    `;
    els.branchList.append(row);
  }

  els.userList.innerHTML = "";
  for (const user of authorizedUsers.filter((item) => item.active !== false)) {
    const row = document.createElement("div");
    row.className = "management-row";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(user.name)}</strong>
        <small>${escapeHtml(user.email)} · ${escapeHtml(getBranchName(user.branchId))} · ${escapeHtml(user.role || "POS用户")}</small>
      </div>
      <button class="ghost danger" type="button" ${user.role === "管理员" || user.role === "admin" ? "disabled" : ""}>移除</button>
    `;
    const button = row.querySelector("button");
    button.addEventListener("click", () => removeAuthorizedUser(user.id));
    els.userList.append(row);
  }

  els.syncOverview.innerHTML = "";
  const syncRow = document.createElement("div");
  syncRow.className = "management-row";
  syncRow.innerHTML = `
    <div>
      <strong>${pendingSales.length} 单订单、${pendingSaleUpdates.length} 个订单更新、${pendingProducts.length} 个库存、${pendingStockAdjustments.length} 条调整、${pendingAuditLogs.length} 条审计待同步</strong>
      <small>${pendingSales.length || pendingSaleUpdates.length || pendingProducts.length || pendingStockAdjustments.length || pendingAuditLogs.length ? "恢复网络后会自动补传，也可以手动补传。" : "所有本机变更已处理。"}</small>
    </div>
  `;
  els.syncOverview.append(syncRow);

  els.auditList.innerHTML = "";
  const auditRows = [...auditLogs].slice(0, 10);
  if (!auditRows.length) {
    els.auditList.innerHTML = '<div class="empty">暂无审计记录</div>';
  } else {
    for (const log of auditRows) {
      const row = document.createElement("div");
      row.className = "management-row";
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(log.action)}</strong>
          <small>${new Date(log.createdAt).toLocaleString()} · ${escapeHtml(log.actor?.email || "-")}</small>
        </div>
        <small>${escapeHtml(log.branchName || "-")}</small>
      `;
      els.auditList.append(row);
    }
  }

  els.stockAdjustmentList.innerHTML = "";
  const stockRows = [...stockAdjustments].slice(0, 10);
  if (!stockRows.length) {
    els.stockAdjustmentList.innerHTML = '<div class="empty">暂无库存流水</div>';
  } else {
    for (const adjustment of stockRows) {
      const row = document.createElement("div");
      row.className = "management-row";
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(adjustment.productName || "-")}</strong>
          <small>${new Date(adjustment.createdAt).toLocaleString()} · ${escapeHtml(adjustment.branchName || getBranchName(adjustment.branchId || "hq"))}</small>
        </div>
        <small>${Number(adjustment.beforeStock || 0)} → ${Number(adjustment.afterStock || 0)} (${Number(adjustment.delta || 0) >= 0 ? "+" : ""}${Number(adjustment.delta || 0)})</small>
      `;
      els.stockAdjustmentList.append(row);
    }
  }
}

function addBranch(event) {
  event.preventDefault();
  if (!requireAdmin()) return;
  const name = els.branchNameInput.value.trim();
  const id = createSlug(name);
  if (branches.some((branch) => branch.id === id || branch.name === name)) {
    alert("这个分行已经存在。");
    return;
  }
  branches.push({ id, name });
  products = products.map((product) => setBranchStock(product, id, 0));
  save(STORAGE_KEYS.branches, branches);
  save(STORAGE_KEYS.products, products);
  if (hasCloud()) window.cloudPOS.saveBranch({ id, name }).catch((error) => console.warn("Branch cloud sync failed", error));
  writeAuditLog("branch.create", { id, name });
  els.branchForm.reset();
  renderAll();
}

function addAuthorizedUser(event) {
  event.preventDefault();
  if (!requireAdmin()) return;
  const email = normalizeEmail(els.userEmailInput.value);
  if (authorizedUsers.some((user) => normalizeEmail(user.email) === email)) {
    alert("这个邮箱已经被授权。");
    return;
  }
  const user = {
    id: createId(),
    name: els.userNameInput.value.trim(),
    email,
    branchId: els.userBranchSelect.value,
    role: "POS用户"
  };
  authorizedUsers.push(user);
  save(STORAGE_KEYS.authorizedUsers, authorizedUsers);
  if (hasCloud()) window.cloudPOS.saveAuthorizedUser(user).catch((error) => console.warn("User cloud sync failed", error));
  writeAuditLog("user.authorize", { email: user.email, name: user.name, branchId: user.branchId });
  els.userForm.reset();
  renderAll();
}

function removeAuthorizedUser(userId) {
  if (!requireAdmin()) return;
  const removedUser = authorizedUsers.find((user) => user.id === userId);
  authorizedUsers = authorizedUsers.map((user) => {
    if (user.id !== userId || user.role === "管理员" || user.role === "admin") return user;
    return { ...user, active: false };
  });
  if (!getOperator()) logoutOperator();
  save(STORAGE_KEYS.authorizedUsers, authorizedUsers);
  if (removedUser && removedUser.role !== "管理员" && removedUser.role !== "admin") {
    if (hasCloud()) {
      window.cloudPOS.saveAuthorizedUser({ ...removedUser, active: false }).catch((error) => console.warn("User deactivate sync failed", error));
    }
    writeAuditLog("user.remove", { email: removedUser.email, name: removedUser.name, branchId: removedUser.branchId });
  }
  renderAll();
}

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function money(value) {
  return `RM ${Number(value || 0).toFixed(2)}`;
}

function formatDate(date) {
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function inputDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthStartDate(date = new Date()) {
  return inputDate(new Date(date.getFullYear(), date.getMonth(), 1));
}

function monthEndDate(date = new Date()) {
  return inputDate(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function setReportRange(startDate, endDate) {
  els.reportStartInput.value = startDate || "";
  els.reportEndInput.value = endDate || "";
  renderGlobalDashboard();
}

function ensureReportRange() {
  if (reportRangeInitialized) return;
  reportRangeInitialized = true;
  setReportRange(monthStartDate(), monthEndDate());
}

function getReportSales() {
  const startDate = els.reportStartInput.value;
  const endDate = els.reportEndInput.value;
  return getActiveSales().filter((sale) => {
    const saleDate = inputDate(new Date(sale.createdAt));
    if (startDate && saleDate < startDate) return false;
    if (endDate && saleDate > endDate) return false;
    return true;
  });
}

function getReportRangeLabel() {
  const startDate = els.reportStartInput.value;
  const endDate = els.reportEndInput.value;
  if (!startDate && !endDate) return "全部";
  if (startDate && endDate) return `${startDate} 至 ${endDate}`;
  if (startDate) return `${startDate} 起`;
  return `${endDate} 前`;
}

function getProductSalesRows(reportSales = getReportSales()) {
  const productMap = new Map();
  for (const sale of reportSales) {
    for (const item of sale.items || []) {
      const key = item.id || item.name;
      const existing = productMap.get(key) || {
        name: item.name,
        qty: 0,
        revenue: 0
      };
      existing.qty += Number(item.qty || 0);
      existing.revenue += Number(item.price || 0) * Number(item.qty || 0);
      productMap.set(key, existing);
    }
  }
  return [...productMap.values()].sort((a, b) => b.revenue - a.revenue || b.qty - a.qty);
}

function getDailySalesRows(reportSales = getReportSales()) {
  const dayMap = new Map();
  for (const sale of reportSales) {
    const day = inputDate(new Date(sale.createdAt));
    const existing = dayMap.get(day) || { day, orders: 0, revenue: 0 };
    existing.orders += 1;
    existing.revenue += Number(sale.total || 0);
    dayMap.set(day, existing);
  }
  return [...dayMap.values()].sort((a, b) => b.day.localeCompare(a.day));
}

function getPaymentSummaryRows(reportSales = getReportSales()) {
  const paymentMap = new Map();
  for (const sale of reportSales) {
    const method = sale.payment?.method || "现金";
    const existing = paymentMap.get(method) || { method, orders: 0, total: 0 };
    existing.orders += 1;
    existing.total += Number(sale.total || 0);
    paymentMap.set(method, existing);
  }
  return [...paymentMap.values()].sort((a, b) => b.total - a.total);
}

function renderAll() {
  els.versionStatus.textContent = APP_VERSION;
  if (!paymentMethodInitialized) {
    els.paymentMethodInput.value = preferredPaymentMethod;
    paymentMethodInitialized = true;
  }
  renderBranchSelect();
  renderCategoryFilter();
  renderProducts();
  renderCart();
  renderSales();
  renderSettingsForm();
  renderFollowUps();
  renderLowStock();
  renderMenuProductList();
  renderInventoryOverview();
  renderGlobalDashboard();
  renderManagementLists();
  renderAdminAccess();
  renderOperatorAccess();
  updateNetworkStatus();
}

function renderMenuProductList() {
  if (!isAdmin()) return;
  els.menuProductList.innerHTML = "";
  const keyword = els.menuSearchInput.value.trim().toLowerCase();
  const filteredProducts = products.filter((product) => {
    if (!keyword) return true;
    return [product.name, product.barcode, product.category]
      .some((value) => String(value || "").toLowerCase().includes(keyword));
  });
  if (!filteredProducts.length) {
    els.menuProductList.innerHTML = '<div class="empty">暂无菜单商品</div>';
    return;
  }
  for (const product of filteredProducts.slice(0, 50)) {
    const row = document.createElement("div");
    row.className = "management-row";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(product.name)}</strong>
        <small>${escapeHtml(product.category || "-")} · SKU ${escapeHtml(product.barcode || "-")}</small>
      </div>
      <small>${money(product.price)} · ${escapeHtml(getBranchName(currentBranchId))}库存 ${getBranchStock(product)}</small>
    `;
    row.addEventListener("click", () => fillProductForm(product));
    els.menuProductList.append(row);
  }
}

function fillProductForm(product) {
  els.nameInput.value = product.name || "";
  els.barcodeInput.value = product.barcode || "";
  els.categoryInput.value = product.category || "";
  els.priceInput.value = Number(product.price || 0);
  els.stockInput.value = getBranchStock(product);
  els.nameInput.focus();
}

function renderInventoryOverview() {
  if (!isAdmin()) return;
  els.inventoryOverviewList.innerHTML = "";
  const keyword = els.inventorySearchInput.value.trim().toLowerCase();
  const filteredProducts = products.filter((product) => {
    if (!keyword) return true;
    return [product.name, product.barcode, product.category]
      .some((value) => String(value || "").toLowerCase().includes(keyword));
  });
  if (!filteredProducts.length) {
    els.inventoryOverviewList.innerHTML = '<div class="empty">暂无库存资料</div>';
    return;
  }
  for (const product of filteredProducts.slice(0, 50)) {
    const branchText = branches
      .map((branch) => `${branch.name}: ${getBranchStock(product, branch.id)}`)
      .join(" · ");
    const currentStock = getBranchStock(product, currentBranchId);
    const row = document.createElement("div");
    row.className = "management-row";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(product.name)}</strong>
        <small>${escapeHtml(branchText)}</small>
      </div>
      <small>${escapeHtml(getBranchName(currentBranchId))} ${currentStock} · 总库存 ${Object.values(product.branchStock || {}).reduce((sum, stock) => sum + Number(stock || 0), 0)}</small>
    `;
    els.inventoryOverviewList.append(row);
  }
}

function renderSettingsForm() {
  if (!isAdmin()) return;
  els.businessNameInput.value = appSettings.businessName;
  els.defaultServiceNameInput.value = appSettings.defaultServiceName;
  els.serviceDaysInput.value = appSettings.serviceDays;
  els.lowStockThresholdInput.value = appSettings.lowStockThreshold ?? 5;
  els.receiptFooterInput.value = appSettings.receiptFooter;
}

function daysUntil(dateValue) {
  const target = new Date(dateValue);
  const today = new Date();
  target.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / 86400000);
}

function getFollowUpStatusText(sale) {
  if (isSaleVoided(sale)) return "已作废";
  const status = sale.followUp?.status || "pending";
  if (status === "contacted") return "已联系";
  if (status === "completed") return "已完成";
  return "待跟进";
}

function getFollowUpDueText(daysLeft) {
  if (daysLeft < 0) return `已到期 ${Math.abs(daysLeft)} 天`;
  if (daysLeft === 0) return "今天到期";
  return `${daysLeft} 天后到期`;
}

function updateSaleFollowUp(saleId, status) {
  if (!requireAdmin()) return;
  const sale = sales.find((item) => item.id === saleId);
  if (!sale) return;
  const nextFollowUp = {
    status,
    updatedAt: new Date().toISOString(),
    updatedBy: getCurrentActor()
  };
  sales = sales.map((item) => item.id === saleId ? { ...item, followUp: nextFollowUp } : item);
  save(STORAGE_KEYS.sales, sales);
  const updatedSale = sales.find((item) => item.id === saleId);
  if (hasCloud() && navigator.onLine) {
    window.cloudPOS.saveSale(updatedSale).catch((error) => console.warn("Follow-up sync failed", error));
  } else {
    queuePendingSaleUpdate(updatedSale);
  }
  writeAuditLog("followup.update", {
    saleId,
    customer: sale.customer?.name || "",
    phone: sale.customer?.phone || "",
    status
  });
  renderAll();
}

function isSaleVoided(sale) {
  return sale.status === "voided";
}

function getSaleStatusText(sale) {
  return isSaleVoided(sale) ? "已作废" : "正常";
}

function getActiveSales(source = sales) {
  return source.filter((sale) => !isSaleVoided(sale));
}

function voidSale(saleId) {
  if (!requireAdmin()) return;
  const sale = sales.find((item) => item.id === saleId);
  if (!sale || isSaleVoided(sale)) return;
  if (!confirm(`确定作废订单 ${sale.id} 并回补库存吗？`)) return;
  if (prompt("请输入 VOID 确认作废订单。") !== "VOID") {
    alert("已取消作废。");
    return;
  }
  const voidedAt = new Date().toISOString();
  const actor = getCurrentActor();
  const changedProducts = [];
  products = products.map((product) => {
    const sold = (sale.items || []).find((item) => item.id === product.id);
    if (!sold) return product;
    const beforeStock = getBranchStock(product, sale.branchId || "hq");
    const afterStock = beforeStock + Number(sold.qty || 0);
    const updatedProduct = setBranchStock(product, sale.branchId || "hq", afterStock);
    changedProducts.push(updatedProduct);
    const adjustment = {
      id: `VOID${Date.now()}-${product.id}`,
      createdAt: voidedAt,
      productId: product.id,
      productName: product.name,
      barcode: product.barcode,
      branchId: sale.branchId || "hq",
      branchName: sale.branchName || getBranchName(sale.branchId || "hq"),
      beforeStock,
      afterStock,
      delta: Number(sold.qty || 0),
      reason: `订单作废回补 ${sale.id}`,
      operator: actor
    };
    recordStockAdjustment(adjustment);
    syncStockAdjustmentToCloud(adjustment);
    return updatedProduct;
  });
  sales = sales.map((item) => item.id === saleId ? {
    ...item,
    status: "voided",
    voidedAt,
    voidedBy: actor,
    syncStatus: "pending-update"
  } : item);
  const updatedSale = sales.find((item) => item.id === saleId);
  pendingSales = pendingSales.filter((item) => item.id !== saleId);
  save(STORAGE_KEYS.products, products);
  save(STORAGE_KEYS.sales, sales);
  savePendingSales();
  for (const product of changedProducts) {
    syncProductToCloud(product);
  }
  if (hasCloud() && navigator.onLine) {
    window.cloudPOS.saveSale(updatedSale).catch((error) => {
      console.warn("Void sale sync failed", error);
      queuePendingSaleUpdate(updatedSale);
    });
  } else {
    queuePendingSaleUpdate(updatedSale);
  }
  writeAuditLog("sale.void", {
    saleId,
    branchId: sale.branchId || "hq",
    total: sale.total
  });
  renderAll();
}

function renderFollowUps() {
  if (!isAdmin()) return;
  els.followUpList.innerHTML = "";
  const activePlans = getActiveSales()
    .filter((sale) => sale.service?.endDate)
    .map((sale) => ({ ...sale, daysLeft: daysUntil(sale.service.endDate) }))
    .filter((sale) => sale.followUp?.status !== "completed")
    .filter((sale) => sale.daysLeft >= -7)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 10);

  if (!activePlans.length) {
    els.followUpList.innerHTML = '<div class="empty">暂无需要跟进的客户</div>';
    return;
  }

  for (const sale of activePlans) {
    const row = document.createElement("div");
    row.className = "management-row";
    const dueStatus = getFollowUpDueText(sale.daysLeft);
    const phone = sale.customer?.phone || "";
    const whatsappNumber = phone.replace(/[^0-9]/g, "");
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(sale.customer?.name || "未填写姓名")}</strong>
        <small>${escapeHtml(phone || "-")} · ${escapeHtml(sale.branchName || getBranchName(sale.branchId || "hq"))} · ${escapeHtml(dueStatus)} · ${escapeHtml(getFollowUpStatusText(sale))}</small>
      </div>
      <div class="row-actions">
        ${whatsappNumber ? `<a class="ghost small-link" href="https://wa.me/${escapeHtml(whatsappNumber)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
        <button class="ghost" type="button" data-followup="contacted">已联系</button>
        <button class="ghost" type="button" data-followup="completed">已完成</button>
      </div>
    `;
    for (const button of row.querySelectorAll("[data-followup]")) {
      button.addEventListener("click", () => updateSaleFollowUp(sale.id, button.dataset.followup));
    }
    els.followUpList.append(row);
  }
}

function renderLowStock() {
  if (!isAdmin()) return;
  els.lowStockList.innerHTML = "";
  const lowStockItems = [];
  const threshold = Number(appSettings.lowStockThreshold ?? 5);
  for (const product of products) {
    for (const branch of branches) {
      const stock = getBranchStock(product, branch.id);
      if (stock <= threshold) {
        lowStockItems.push({ product, branch, stock });
      }
    }
  }

  if (!lowStockItems.length) {
    els.lowStockList.innerHTML = '<div class="empty">暂无低库存商品</div>';
    return;
  }

  for (const item of lowStockItems.slice(0, 12)) {
    const row = document.createElement("div");
    row.className = "management-row";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(item.product.name)}</strong>
        <small>${escapeHtml(item.branch.name)} · SKU ${escapeHtml(item.product.barcode || "-")}</small>
      </div>
      <small>库存 ${item.stock} / 阈值 ${threshold}</small>
    `;
    els.lowStockList.append(row);
  }
}

function renderCategoryFilter() {
  const selected = els.categoryFilter.value || "all";
  const categories = [...new Set(products.map((product) => product.category))].sort();
  els.categoryFilter.innerHTML = '<option value="all">全部分类</option>';
  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    els.categoryFilter.append(option);
  }
  els.categoryFilter.value = categories.includes(selected) ? selected : "all";
}

function renderProducts() {
  const keyword = els.searchInput.value.trim().toLowerCase();
  const category = els.categoryFilter.value;
  const filtered = products.filter((product) => {
    const matchKeyword = [product.name, product.barcode].some((value) =>
      String(value || "").toLowerCase().includes(keyword)
    );
    const matchCategory = category === "all" || product.category === category;
    return matchKeyword && matchCategory;
  });

  els.productGrid.innerHTML = "";
  if (!filtered.length) {
    els.productGrid.innerHTML = '<div class="empty">没有找到商品</div>';
    return;
  }

  for (const product of filtered) {
    const branchStock = getBranchStock(product);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "product-card";
    card.disabled = branchStock <= 0;
    card.innerHTML = `
      <strong>${escapeHtml(product.name)}</strong>
      <span class="product-meta">${escapeHtml(product.category)} · ${escapeHtml(getBranchName(currentBranchId))}库存 ${branchStock}</span>
      <span class="product-meta">条码 ${escapeHtml(product.barcode || "-")}</span>
      <span class="price">${money(product.price)}</span>
    `;
    card.addEventListener("click", () => addToCart(product.id));
    els.productGrid.append(card);
  }
}

function addToCart(productId) {
  const product = products.find((item) => item.id === productId);
  const existing = cart.find((item) => item.id === productId);
  const currentQty = existing ? existing.qty : 0;
  if (!product || currentQty >= getBranchStock(product)) {
    alert("库存不足，不能继续添加。");
    return;
  }
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: product.id, name: product.name, price: product.price, qty: 1, branchId: currentBranchId });
  }
  renderCart();
}

function renderCart() {
  els.cartItems.innerHTML = "";
  els.cartHint.textContent = cart.length ? `${cart.length} 种商品` : "还没有商品";

  if (!cart.length) {
    els.cartItems.innerHTML = '<div class="empty">点击左侧商品开始收银</div>';
  }

  for (const item of cart) {
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <div class="cart-item-top">
        <strong>${escapeHtml(item.name)}</strong>
        <span>${money(item.price * item.qty)}</span>
      </div>
      <div class="qty-row">
        <button type="button" aria-label="减少">-</button>
        <span>${item.qty} x ${money(item.price)}</span>
        <button type="button" aria-label="增加">+</button>
        <button type="button" class="ghost danger">删除</button>
      </div>
    `;
    const [minusBtn, plusBtn, removeBtn] = row.querySelectorAll("button");
    minusBtn.addEventListener("click", () => updateCartQty(item.id, item.qty - 1));
    plusBtn.addEventListener("click", () => updateCartQty(item.id, item.qty + 1));
    removeBtn.addEventListener("click", () => updateCartQty(item.id, 0));
    els.cartItems.append(row);
  }

  if (!cart.length) {
    els.paidInput.value = "";
    autoFillPaid = true;
  } else if (autoFillPaid) {
    els.paidInput.value = getCartDueAmount().toFixed(2);
  }
  const totals = getCartTotals();
  els.subtotalText.textContent = money(totals.subtotal);
  els.totalText.textContent = money(totals.total);
  els.changeText.textContent = money(totals.change);
  els.checkoutBtn.disabled = !cart.length;
}

function updateCartQty(productId, nextQty) {
  const product = products.find((item) => item.id === productId);
  if (nextQty <= 0) {
    cart = cart.filter((item) => item.id !== productId);
  } else if (product && nextQty <= getBranchStock(product)) {
    cart = cart.map((item) => item.id === productId ? { ...item, qty: nextQty } : item);
  } else {
    alert("库存不足。");
  }
  renderCart();
}

function getCartTotals() {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discount = Math.max(0, Number(els.discountInput.value || 0));
  const total = getCartDueAmount();
  const paid = Number(els.paidInput.value || 0);
  return { subtotal, discount, total, paid, change: Math.max(0, paid - total) };
}

function getCartDueAmount() {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discount = Math.max(0, Number(els.discountInput.value || 0));
  return Math.max(0, subtotal - discount);
}

function needsPaymentReference(method) {
  return method !== "现金";
}

async function checkout() {
  if (!cart.length) return;
  if (!requireOperator()) return;
  const totals = getCartTotals();
  if (totals.paid < totals.total) {
    alert("实收金额不足。");
    els.paidInput.focus();
    return;
  }
  const paymentMethod = els.paymentMethodInput.value;
  const paymentReference = els.paymentReferenceInput.value.trim();
  if (needsPaymentReference(paymentMethod) && !paymentReference && !confirm("这个付款方式建议填写参考号。确定继续收款吗？")) {
    els.paymentReferenceInput.focus();
    return;
  }

  const createdAt = new Date();
  const serviceEnd = new Date(createdAt);
  serviceEnd.setDate(serviceEnd.getDate() + Number(appSettings.serviceDays || 21));

  const sale = {
    id: `POS${Date.now()}`,
    createdAt: createdAt.toISOString(),
    branchId: currentBranchId,
    branchName: getBranchName(currentBranchId),
    operator: getOperator(),
    customer: {
      name: els.customerNameInput.value.trim(),
      phone: els.customerPhoneInput.value.trim()
    },
    service: {
      name: appSettings.defaultServiceName,
      startDate: createdAt.toISOString(),
      endDate: serviceEnd.toISOString(),
      durationDays: Number(appSettings.serviceDays || 21)
    },
    items: structuredClone(cart),
    subtotal: totals.subtotal,
    discount: totals.discount,
    total: totals.total,
    paid: totals.paid,
    change: totals.change,
    payment: {
      method: paymentMethod,
      reference: paymentReference
    },
    syncStatus: navigator.onLine && hasCloud() ? "syncing" : "pending"
  };

  const previousProducts = structuredClone(products);
  const previousSales = structuredClone(sales);
  const previousCart = structuredClone(cart);
  const onlineTransaction = hasCloud() && navigator.onLine && window.cloudPOS.saveCheckout;
  const changedProducts = [];
  products = products.map((product) => {
    const sold = cart.find((item) => item.id === product.id);
    if (!sold) return product;
    const updatedProduct = setBranchStock(product, currentBranchId, getBranchStock(product) - sold.qty);
    changedProducts.push(updatedProduct);
    return updatedProduct;
  });
  sales.unshift(sale);
  cart = [];
  els.customerNameInput.value = "";
  els.customerPhoneInput.value = "";
  els.discountInput.value = "0";
  els.paidInput.value = "";
  els.paymentReferenceInput.value = "";
  autoFillPaid = true;
  save(STORAGE_KEYS.products, products);
  save(STORAGE_KEYS.sales, sales);
  if (!hasCloud() || !window.cloudPOS.saveCheckout) {
    for (const product of changedProducts) {
      syncProductToCloud(product);
    }
  }
  const syncResult = await syncSaleToCloud(sale);
  if (onlineTransaction && !syncResult.ok) {
    products = previousProducts;
    sales = previousSales;
    pendingSales = pendingSales.filter((item) => item.id !== sale.id);
    save(STORAGE_KEYS.products, products);
    save(STORAGE_KEYS.sales, sales);
    savePendingSales();
    cart = previousCart;
    renderAll();
    alert(`云端收款失败，订单已撤销：${syncResult.error?.message || "请刷新云端资料后再试。"}`);
    return;
  }
  showReceipt(sale);
  renderAll();
}

function showReceipt(sale) {
  els.receiptNo.textContent = `订单号：${sale.id}`;
  els.receiptText.textContent = buildReceipt(sale);
  els.receiptDialog.showModal();
}

function buildReceipt(sale) {
  const lines = [
    appSettings.businessName,
    `订单号：${sale.id}`,
    `分行：${sale.branchName || getBranchName(sale.branchId || "hq")}`,
    `收银员：${sale.operator?.name || "-"}`,
    `时间：${new Date(sale.createdAt).toLocaleString()}`,
    `客户：${sale.customer?.name || "-"}`,
    `电话：${sale.customer?.phone || "-"}`,
    `计划周期：${formatDate(new Date(sale.service.startDate))} 至 ${formatDate(new Date(sale.service.endDate))}`,
    "------------------------------"
  ];
  for (const item of sale.items) {
    lines.push(`${item.name} x${item.qty}  ${money(item.price * item.qty)}`);
  }
  lines.push("------------------------------");
  lines.push(`小计：${money(sale.subtotal)}`);
  lines.push(`折扣：${money(sale.discount)}`);
  lines.push(`应收：${money(sale.total)}`);
  lines.push(`实收：${money(sale.paid)}`);
  lines.push(`找零：${money(sale.change)}`);
  lines.push(`付款方式：${sale.payment?.method || "现金"}`);
  if (sale.payment?.reference) lines.push(`参考号：${sale.payment.reference}`);
  lines.push(appSettings.receiptFooter);
  return lines.join("\n");
}

function renderSales() {
  if (!els.salesDateInput.value) els.salesDateInput.value = inputDate();
  const selectedDate = els.salesDateInput.value;
  const keyword = els.salesSearchInput.value.trim().toLowerCase();
  const paymentFilter = els.salesPaymentFilter.value;
  const selectedSales = sales.filter((sale) => {
    const matchDate = inputDate(new Date(sale.createdAt)) === selectedDate;
    if (!matchDate) return false;
    if (paymentFilter !== "all" && (sale.payment?.method || "现金") !== paymentFilter) return false;
    if (!keyword) return true;
    const haystack = [
      sale.id,
      sale.customer?.name,
      sale.customer?.phone,
      sale.branchName,
      sale.operator?.name,
      ...(sale.items || []).map((item) => item.name)
    ].join(" ").toLowerCase();
    return haystack.includes(keyword);
  });
  const total = selectedSales.reduce((sum, sale) => sum + (isSaleVoided(sale) ? 0 : sale.total), 0);
  els.salesSummary.textContent = selectedSales.length
    ? `${selectedSales.length} 单，共 ${money(total)}`
    : "暂无销售";
  els.salesList.innerHTML = "";
  renderDailyPaymentSummary(selectedSales);

  if (!selectedSales.length) {
    els.salesList.innerHTML = '<div class="empty">完成收款后这里会出现销售记录</div>';
    els.toggleSalesLimitBtn.classList.add("hidden");
    return;
  }

  const visibleSales = selectedSales.slice(0, showMoreSales ? 50 : 8);
  els.toggleSalesLimitBtn.classList.toggle("hidden", selectedSales.length <= 8);
  els.toggleSalesLimitBtn.textContent = showMoreSales ? "显示较少" : `显示更多（共 ${selectedSales.length} 笔）`;

  for (const sale of visibleSales) {
    const row = document.createElement("div");
    row.className = "sale-item";
    row.classList.toggle("voided", isSaleVoided(sale));
    row.innerHTML = `
      <div class="sale-item-top">
        <strong>${isSaleVoided(sale) ? "已作废" : money(sale.total)}</strong>
        <span>${new Date(sale.createdAt).toLocaleTimeString()}</span>
      </div>
      <span class="product-meta">状态：${getSaleStatusText(sale)}</span>
      <span class="product-meta">分行：${escapeHtml(sale.branchName || getBranchName(sale.branchId || "hq"))}</span>
      <span class="product-meta">收银员：${escapeHtml(sale.operator?.name || "-")}</span>
      <span class="product-meta">同步：${pendingSales.some((item) => item.id === sale.id) ? "待同步" : "已处理"}</span>
      <span class="product-meta">付款：${escapeHtml(sale.payment?.method || "现金")}${sale.payment?.reference ? ` · ${escapeHtml(sale.payment.reference)}` : ""}</span>
      <span class="product-meta">客户：${escapeHtml(sale.customer?.name || "-")} ${escapeHtml(sale.customer?.phone || "")}</span>
      <span class="product-meta">${sale.items.map((item) => `${item.name} x${item.qty}`).join("，")}</span>
      ${isAdmin() && !isSaleVoided(sale) ? '<button class="ghost danger" type="button" data-void-sale>作废并回补库存</button>' : ""}
    `;
    const voidButton = row.querySelector("[data-void-sale]");
    if (voidButton) voidButton.addEventListener("click", () => voidSale(sale.id));
    els.salesList.append(row);
  }
}

function renderDailyPaymentSummary(selectedSales) {
  const activeSelectedSales = getActiveSales(selectedSales);
  const paymentRows = getPaymentSummaryRows(activeSelectedSales);
  els.dailyPaymentSummaryList.innerHTML = "";
  if (!paymentRows.length) {
    els.dailyPaymentSummaryList.innerHTML = '<div class="empty compact-empty">当前筛选没有结算资料</div>';
    return;
  }
  for (const item of paymentRows) {
    const row = document.createElement("div");
    row.className = "management-row";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(item.method)}</strong>
        <small>${item.orders} 单</small>
      </div>
      <small>${money(item.total)}</small>
    `;
    els.dailyPaymentSummaryList.append(row);
  }
}

function renderGlobalDashboard() {
  if (!isAdmin()) return;
  ensureReportRange();
  const reportSales = getReportSales();
  const totalRevenue = reportSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const customers = new Set(
    reportSales
      .map((sale) => `${sale.customer?.phone || ""}-${sale.customer?.name || ""}`.trim())
      .filter(Boolean)
  );

  els.globalRevenueText.textContent = money(totalRevenue);
  els.globalOrdersText.textContent = String(reportSales.length);
  els.globalCustomersText.textContent = String(customers.size);
  els.globalStockText.textContent = String(getTotalStock());
  els.branchOverview.innerHTML = "";

  for (const branch of branches) {
    const branchSales = reportSales.filter((sale) => (sale.branchId || "hq") === branch.id);
    const revenue = branchSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const branchCustomers = new Set(
      branchSales
        .map((sale) => `${sale.customer?.phone || ""}-${sale.customer?.name || ""}`.trim())
        .filter(Boolean)
    );
    const row = document.createElement("div");
    row.className = "branch-row";
    row.innerHTML = `
      <strong>${escapeHtml(branch.name)}</strong>
      <span>销售额 ${money(revenue)}</span>
      <span>订单 ${branchSales.length}</span>
      <span>客户 ${branchCustomers.size}</span>
    `;
    els.branchOverview.append(row);
  }

  const productRows = getProductSalesRows(reportSales).slice(0, 8);
  els.topProductsList.innerHTML = "";
  if (!productRows.length) {
    els.topProductsList.innerHTML = '<div class="empty">当前日期范围暂无商品销售</div>';
  } else {
    for (const item of productRows) {
      const row = document.createElement("div");
      row.className = "management-row";
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <small>销量 ${item.qty}</small>
        </div>
        <small>${money(item.revenue)}</small>
      `;
      els.topProductsList.append(row);
    }
  }

  const dailyRows = getDailySalesRows(reportSales).slice(0, 10);
  els.dailyTrendList.innerHTML = "";
  if (!dailyRows.length) {
    els.dailyTrendList.innerHTML = '<div class="empty">当前日期范围暂无每日趋势</div>';
  } else {
    for (const item of dailyRows) {
      const row = document.createElement("div");
      row.className = "management-row";
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(item.day)}</strong>
          <small>${item.orders} 单</small>
        </div>
        <small>${money(item.revenue)}</small>
      `;
      els.dailyTrendList.append(row);
    }
  }

  const paymentRows = getPaymentSummaryRows(reportSales);
  els.paymentSummaryList.innerHTML = "";
  if (!paymentRows.length) {
    els.paymentSummaryList.innerHTML = '<div class="empty">当前日期范围暂无付款资料</div>';
  } else {
    for (const item of paymentRows) {
      const row = document.createElement("div");
      row.className = "management-row";
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(item.method)}</strong>
          <small>${item.orders} 单</small>
        </div>
        <small>${money(item.total)}</small>
      `;
      els.paymentSummaryList.append(row);
    }
  }
}

function saveProduct(event) {
  event.preventDefault();
  if (!requireAdmin()) return;
  const product = {
    id: createId(),
    name: els.nameInput.value.trim(),
    barcode: els.barcodeInput.value.trim(),
    category: els.categoryInput.value.trim(),
    price: Number(els.priceInput.value),
    stock: Number(els.stockInput.value),
    branchStock: createBranchStock(els.stockInput.value, currentBranchId)
  };
  if (!product.name || !product.category || product.price < 0 || product.stock < 0) {
    alert("请检查商品信息。");
    return;
  }

  const sameBarcode = product.barcode && products.find((item) => item.barcode === product.barcode);
  let savedProduct = product;
  const previousStock = sameBarcode ? getBranchStock(sameBarcode, currentBranchId) : 0;
  if (sameBarcode) {
    products = products.map((item) => {
      if (item.id !== sameBarcode.id) return item;
      savedProduct = {
        ...item,
        name: product.name,
        barcode: product.barcode,
        category: product.category,
        price: product.price,
        stock: currentBranchId === "hq" ? product.stock : item.stock,
        branchStock: {
          ...(item.branchStock || {}),
          [currentBranchId]: product.stock
        }
      };
      return savedProduct;
    });
  } else {
    products.unshift(product);
  }
  save(STORAGE_KEYS.products, products);
  syncProductToCloud(savedProduct);
  const adjustment = {
    id: `ADJ${Date.now()}`,
    createdAt: new Date().toISOString(),
    productId: savedProduct.id,
    productName: savedProduct.name,
    barcode: savedProduct.barcode,
    branchId: currentBranchId,
    branchName: getBranchName(currentBranchId),
    beforeStock: previousStock,
    afterStock: getBranchStock(savedProduct, currentBranchId),
    delta: getBranchStock(savedProduct, currentBranchId) - previousStock,
    reason: sameBarcode ? "管理员调整库存" : "管理员新增商品",
    operator: currentCloudUser || { email: adminEmail || "", name: "管理员" }
  };
  recordStockAdjustment(adjustment);
  syncStockAdjustmentToCloud(adjustment);
  writeAuditLog("product.save", {
    productId: savedProduct.id,
    productName: savedProduct.name,
    barcode: savedProduct.barcode,
    branchId: currentBranchId,
    previousStock,
    nextStock: adjustment.afterStock
  });
  els.productForm.reset();
  renderAll();
}

function exportSales() {
  if (!requireAdmin()) return;
  if (!sales.length) {
    alert("还没有销售记录可以导出。");
    return;
  }
  const rows = [["订单号", "状态", "作废时间", "分行", "收银员", "收银员邮箱", "同步状态", "时间", "客户姓名", "电话", "付款方式", "付款参考号", "跟进状态", "跟进更新时间", "计划名称", "服务天数", "计划开始", "计划结束", "商品", "小计", "折扣", "应收", "实收", "找零"]];
  for (const sale of sales) {
    rows.push([
      sale.id,
      getSaleStatusText(sale),
      sale.voidedAt ? new Date(sale.voidedAt).toLocaleString() : "",
      sale.branchName || getBranchName(sale.branchId || "hq"),
      sale.operator?.name || "",
      sale.operator?.email || "",
      pendingSales.some((item) => item.id === sale.id) ? "待同步" : "已处理",
      new Date(sale.createdAt).toLocaleString(),
      sale.customer?.name || "",
      sale.customer?.phone || "",
      sale.payment?.method || "现金",
      sale.payment?.reference || "",
      getFollowUpStatusText(sale),
      sale.followUp?.updatedAt ? new Date(sale.followUp.updatedAt).toLocaleString() : "",
      sale.service?.name || "",
      sale.service?.durationDays || "",
      sale.service?.startDate ? formatDate(new Date(sale.service.startDate)) : "",
      sale.service?.endDate ? formatDate(new Date(sale.service.endDate)) : "",
      sale.items.map((item) => `${item.name} x${item.qty}`).join("; "),
      sale.subtotal,
      sale.discount,
      sale.total,
      sale.paid,
      sale.change
    ]);
  }
  downloadCsv(`sales-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportBranchSummary() {
  if (!requireAdmin()) return;
  const reportSales = getReportSales();
  const rows = [["日期范围", "统计口径", "分行", "订单数", "客户数", "销售额"]];
  for (const branch of branches) {
    const branchSales = reportSales.filter((sale) => (sale.branchId || "hq") === branch.id);
    const customers = new Set(branchSales.map((sale) => `${sale.customer?.phone || ""}-${sale.customer?.name || ""}`).filter(Boolean));
    const revenue = branchSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    rows.push([getReportRangeLabel(), "不含已作废订单", branch.name, branchSales.length, customers.size, revenue]);
  }
  downloadCsv(`branch-summary-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

function exportProductSales() {
  if (!requireAdmin()) return;
  const rows = [["日期范围", "统计口径", "商品", "销量", "销售额"]];
  for (const item of getProductSalesRows()) {
    rows.push([getReportRangeLabel(), "不含已作废订单", item.name, item.qty, item.revenue]);
  }
  if (rows.length === 1) {
    alert("当前日期范围还没有商品销售记录。");
    return;
  }
  downloadCsv(`product-sales-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

function exportPaymentSummary() {
  if (!requireAdmin()) return;
  const rows = [["日期范围", "统计口径", "付款方式", "订单数", "金额"]];
  for (const item of getPaymentSummaryRows()) {
    rows.push([getReportRangeLabel(), "不含已作废订单", item.method, item.orders, item.total]);
  }
  if (rows.length === 1) {
    alert("当前日期范围还没有付款资料。");
    return;
  }
  downloadCsv(`payment-summary-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

function exportDailySettlement() {
  if (!requireAdmin()) return;
  const selectedDate = els.salesDateInput.value || inputDate();
  const paymentFilter = els.salesPaymentFilter.value;
  const selectedSales = sales.filter((sale) => {
    const matchDate = inputDate(new Date(sale.createdAt)) === selectedDate;
    if (!matchDate || isSaleVoided(sale)) return false;
    return paymentFilter === "all" || (sale.payment?.method || "现金") === paymentFilter;
  });
  const rows = [["类型", "日期", "付款筛选", "付款方式", "订单数", "金额", "订单号", "时间", "参考号", "客户"]];
  for (const item of getPaymentSummaryRows(selectedSales)) {
    rows.push(["汇总", selectedDate, paymentFilter === "all" ? "全部付款" : paymentFilter, item.method, item.orders, item.total, "", "", "", ""]);
  }
  for (const sale of selectedSales) {
    rows.push([
      "明细",
      selectedDate,
      paymentFilter === "all" ? "全部付款" : paymentFilter,
      sale.payment?.method || "现金",
      "",
      sale.total,
      sale.id,
      new Date(sale.createdAt).toLocaleString(),
      sale.payment?.reference || "",
      `${sale.customer?.name || ""} ${sale.customer?.phone || ""}`.trim()
    ]);
  }
  if (rows.length === 1) {
    alert("当前筛选没有结算资料。");
    return;
  }
  downloadCsv(`daily-settlement-${selectedDate}.csv`, rows);
}

function exportInventory() {
  if (!requireAdmin()) return;
  const rows = [["商品", "SKU", "分类", "售价", "分行", "库存"]];
  for (const product of products) {
    for (const branch of branches) {
      rows.push([
        product.name,
        product.barcode || "",
        product.category || "",
        product.price,
        branch.name,
        getBranchStock(product, branch.id)
      ]);
    }
  }
  downloadCsv(`inventory-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

function exportCustomers() {
  if (!requireAdmin()) return;
  if (!sales.length) {
    alert("还没有客户资料可以导出。");
    return;
  }
  const rows = [["客户姓名", "电话", "最近订单号", "最近分行", "最近消费时间", "计划名称", "计划开始", "计划结束", "到期状态", "跟进状态", "消费次数", "累计消费"]];
  const customerMap = new Map();
  for (const sale of [...getActiveSales()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))) {
    const key = `${sale.customer?.phone || ""}-${sale.customer?.name || ""}`.trim() || sale.id;
    const existing = customerMap.get(key) || {
      latestSale: sale,
      orderCount: 0,
      totalSpend: 0
    };
    existing.orderCount += 1;
    existing.totalSpend += Number(sale.total || 0);
    customerMap.set(key, existing);
  }
  for (const customer of customerMap.values()) {
    const sale = customer.latestSale;
    const daysLeft = sale.service?.endDate ? daysUntil(sale.service.endDate) : null;
    rows.push([
      sale.customer?.name || "",
      sale.customer?.phone || "",
      sale.id,
      sale.branchName || getBranchName(sale.branchId || "hq"),
      new Date(sale.createdAt).toLocaleString(),
      sale.service?.name || "",
      sale.service?.startDate ? formatDate(new Date(sale.service.startDate)) : "",
      sale.service?.endDate ? formatDate(new Date(sale.service.endDate)) : "",
      daysLeft === null ? "" : getFollowUpDueText(daysLeft),
      getFollowUpStatusText(sale),
      customer.orderCount,
      customer.totalSpend
    ]);
  }
  downloadCsv(`customers-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

function exportAuditLogs() {
  if (!requireAdmin()) return;
  if (!auditLogs.length) {
    alert("还没有审计日志可以导出。");
    return;
  }
  const rows = [["时间", "动作", "操作者", "操作者邮箱", "分行", "详情"]];
  for (const log of auditLogs) {
    rows.push([
      new Date(log.createdAt).toLocaleString(),
      log.action,
      log.actor?.name || "",
      log.actor?.email || "",
      log.branchName || getBranchName(log.branchId || "hq"),
      JSON.stringify(log.detail || {})
    ]);
  }
  downloadCsv(`audit-logs-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

function exportStockAdjustments() {
  if (!requireAdmin()) return;
  if (!stockAdjustments.length) {
    alert("还没有库存流水可以导出。");
    return;
  }
  const rows = [["时间", "商品", "SKU", "分行", "调整前", "调整后", "变化", "原因", "操作者", "操作者邮箱"]];
  for (const adjustment of stockAdjustments) {
    rows.push([
      new Date(adjustment.createdAt).toLocaleString(),
      adjustment.productName || "",
      adjustment.barcode || "",
      adjustment.branchName || getBranchName(adjustment.branchId || "hq"),
      adjustment.beforeStock,
      adjustment.afterStock,
      adjustment.delta,
      adjustment.reason || "",
      adjustment.operator?.name || "",
      adjustment.operator?.email || ""
    ]);
  }
  downloadCsv(`stock-adjustments-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

function exportBackup() {
  if (!requireAdmin()) return;
  const backup = {
    exportedAt: new Date().toISOString(),
    settings: appSettings,
    branches,
    authorizedUsers,
    products,
    sales,
    pendingSales,
    pendingSaleUpdates,
    pendingProducts,
    pendingStockAdjustments,
    pendingAuditLogs,
    stockAdjustments,
    auditLogs,
    preferences: {
      paymentMethod: preferredPaymentMethod
    }
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `simple-pos-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function restoreBackupFile(file) {
  if (!requireAdmin()) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const backup = JSON.parse(String(reader.result || "{}"));
      if (!Array.isArray(backup.branches) || !Array.isArray(backup.products) || !Array.isArray(backup.sales)) {
        alert("备份文件格式不正确。");
        return;
      }
      if (!confirm("确定从备份恢复吗？这会覆盖当前本机数据。")) return;

      branches = backup.branches;
      authorizedUsers = Array.isArray(backup.authorizedUsers) ? backup.authorizedUsers : defaultAuthorizedUsers;
      products = backup.products;
      sales = backup.sales;
      pendingSales = Array.isArray(backup.pendingSales) ? backup.pendingSales : [];
      pendingSaleUpdates = Array.isArray(backup.pendingSaleUpdates) ? backup.pendingSaleUpdates : [];
      pendingProducts = Array.isArray(backup.pendingProducts) ? backup.pendingProducts : [];
      pendingStockAdjustments = Array.isArray(backup.pendingStockAdjustments) ? backup.pendingStockAdjustments : [];
      pendingAuditLogs = Array.isArray(backup.pendingAuditLogs) ? backup.pendingAuditLogs : [];
      stockAdjustments = Array.isArray(backup.stockAdjustments) ? backup.stockAdjustments : [];
      auditLogs = Array.isArray(backup.auditLogs) ? backup.auditLogs : [];
      appSettings = backup.settings || defaultSettings;
      preferredPaymentMethod = backup.preferences?.paymentMethod || preferredPaymentMethod;
      paymentMethodInitialized = false;

      save(STORAGE_KEYS.branches, branches);
      save(STORAGE_KEYS.authorizedUsers, authorizedUsers);
      save(STORAGE_KEYS.products, products);
      save(STORAGE_KEYS.sales, sales);
      savePendingSales();
      savePendingSaleUpdates();
      savePendingProducts();
      savePendingStockAdjustments();
      savePendingAuditLogs();
      save(STORAGE_KEYS.stockAdjustments, stockAdjustments);
      save(STORAGE_KEYS.auditLogs, auditLogs);
      save(STORAGE_KEYS.settings, appSettings);
      localStorage.setItem(STORAGE_KEYS.paymentMethod, preferredPaymentMethod);
      migrateManagementData();
      migrateProductsForBranches();
      renderAll();
      writeAuditLog("backup.restore", {
        branches: branches.length,
        users: authorizedUsers.length,
        products: products.length,
        sales: sales.length
      });
      alert("备份已恢复到本机。需要同步到云端时，请点击初始化云端数据。");
    } catch (error) {
      alert(`恢复失败：${error.message}`);
    }
  });
  reader.readAsText(file, "utf-8");
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function updateNetworkStatus() {
  els.networkStatus.textContent = navigator.onLine ? "在线" : "离线可用";
  els.networkStatus.style.color = navigator.onLine ? "#0f766e" : "#8a5a00";
}

function resetAllData() {
  if (!requireAdmin()) return;
  if (!confirm("确定清空商品、销售记录和购物车吗？")) return;
  if (prompt('请输入 RESET 确认清空本机数据。') !== "RESET") {
    alert("已取消清空。");
    return;
  }
  products = cloneSampleProductsForBranches();
  sales = [];
  pendingSales = [];
  pendingSaleUpdates = [];
  cart = [];
  branches = structuredClone(defaultBranches);
  authorizedUsers = structuredClone(defaultAuthorizedUsers);
  save(STORAGE_KEYS.products, products);
  save(STORAGE_KEYS.sales, sales);
  savePendingSales();
  savePendingSaleUpdates();
  pendingProducts = [];
  pendingStockAdjustments = [];
  pendingAuditLogs = [];
  stockAdjustments = [];
  auditLogs = [];
  savePendingProducts();
  savePendingStockAdjustments();
  savePendingAuditLogs();
  save(STORAGE_KEYS.stockAdjustments, stockAdjustments);
  save(STORAGE_KEYS.auditLogs, auditLogs);
  save(STORAGE_KEYS.branches, branches);
  save(STORAGE_KEYS.authorizedUsers, authorizedUsers);
  writeAuditLog("data.reset", {});
  renderAll();
}

els.searchInput.addEventListener("input", renderProducts);
els.categoryFilter.addEventListener("change", renderProducts);
els.refreshCloudBtn.addEventListener("click", loadCloudData);
els.menuToggleBtn.addEventListener("click", () => {
  const open = !els.appMenu.classList.contains("open");
  els.appMenu.classList.toggle("open", open);
  els.menuToggleBtn.setAttribute("aria-expanded", String(open));
  if (open) {
    els.cashierMenu.classList.remove("open");
    els.cashierToggleBtn.setAttribute("aria-expanded", "false");
  }
});
els.cashierToggleBtn.addEventListener("click", () => {
  const open = !els.cashierMenu.classList.contains("open");
  els.cashierMenu.classList.toggle("open", open);
  els.cashierToggleBtn.setAttribute("aria-expanded", String(open));
  if (open) {
    els.appMenu.classList.remove("open");
    els.menuToggleBtn.setAttribute("aria-expanded", "false");
  }
});
document.addEventListener("click", (event) => {
  const target = event.target;
  if (!els.appMenu.contains(target) && !els.cashierMenu.contains(target)) {
    els.appMenu.classList.remove("open");
    els.cashierMenu.classList.remove("open");
    els.menuToggleBtn.setAttribute("aria-expanded", "false");
    els.cashierToggleBtn.setAttribute("aria-expanded", "false");
  }
});
for (const button of document.querySelectorAll("[data-app-view]")) {
  button.addEventListener("click", () => setAppView(button.dataset.appView));
}
els.branchSelect.addEventListener("change", () => {
  currentBranchId = els.branchSelect.value;
  localStorage.setItem(STORAGE_KEYS.branchId, currentBranchId);
  cart = [];
  renderAll();
});
els.operatorLoginForm.addEventListener("submit", loginOperator);
els.googleLoginBtn.addEventListener("click", signInWithGoogle);
els.operatorLogoutBtn.addEventListener("click", logoutOperator);
els.clearCartBtn.addEventListener("click", () => {
  cart = [];
  autoFillPaid = true;
  els.paidInput.value = "";
  renderCart();
});
els.discountInput.addEventListener("input", renderCart);
els.paidInput.addEventListener("input", () => {
  autoFillPaid = false;
  renderCart();
});
els.paymentMethodInput.addEventListener("change", () => {
  preferredPaymentMethod = els.paymentMethodInput.value;
  localStorage.setItem(STORAGE_KEYS.paymentMethod, preferredPaymentMethod);
});
els.salesDateInput.addEventListener("change", renderSales);
els.salesSearchInput.addEventListener("input", renderSales);
els.salesPaymentFilter.addEventListener("change", renderSales);
els.exportDailySettlementBtn.addEventListener("click", exportDailySettlement);
els.menuSearchInput.addEventListener("input", renderMenuProductList);
els.inventorySearchInput.addEventListener("input", renderInventoryOverview);
els.toggleSalesLimitBtn.addEventListener("click", () => {
  showMoreSales = !showMoreSales;
  renderSales();
});
els.todaySalesBtn.addEventListener("click", () => {
  els.salesDateInput.value = inputDate();
  renderSales();
});
els.quickCheckoutBtn.addEventListener("click", () => {
  setAppView("order");
  if (!isOperatorAllowedForCurrentBranch()) {
    els.cashierMenu.classList.add("open");
    els.cashierToggleBtn.setAttribute("aria-expanded", "true");
    els.operatorEmailInput.focus();
  } else if (cart.length) {
    checkout();
  } else {
    els.searchInput.focus();
  }
});
els.reportStartInput.addEventListener("change", renderGlobalDashboard);
els.reportEndInput.addEventListener("change", renderGlobalDashboard);
els.reportTodayBtn.addEventListener("click", () => setReportRange(inputDate(), inputDate()));
els.reportMonthBtn.addEventListener("click", () => setReportRange(monthStartDate(), monthEndDate()));
els.reportAllBtn.addEventListener("click", () => setReportRange("", ""));
els.checkoutBtn.addEventListener("click", checkout);
els.adminLoginForm.addEventListener("submit", loginAdmin);
els.adminGoogleLoginBtn.addEventListener("click", signInWithGoogle);
els.adminLogoutBtn.addEventListener("click", logoutAdmin);
els.branchForm.addEventListener("submit", addBranch);
els.userForm.addEventListener("submit", addAuthorizedUser);
els.settingsForm.addEventListener("submit", saveSettings);
els.productForm.addEventListener("submit", saveProduct);
els.initCloudBtn.addEventListener("click", initializeCloudData);
els.syncPendingBtn.addEventListener("click", syncPendingChanges);
els.exportBtn.addEventListener("click", exportSales);
els.exportSummaryBtn.addEventListener("click", exportBranchSummary);
els.exportPaymentSummaryBtn.addEventListener("click", exportPaymentSummary);
els.exportProductSalesBtn.addEventListener("click", exportProductSales);
els.exportInventoryBtn.addEventListener("click", exportInventory);
els.exportCustomersBtn.addEventListener("click", exportCustomers);
els.exportAuditBtn.addEventListener("click", exportAuditLogs);
els.exportStockBtn.addEventListener("click", exportStockAdjustments);
els.backupBtn.addEventListener("click", exportBackup);
els.restoreBtn.addEventListener("click", () => els.restoreInput.click());
els.restoreInput.addEventListener("change", () => {
  const [file] = els.restoreInput.files;
  if (file) restoreBackupFile(file);
  els.restoreInput.value = "";
});
els.resetDataBtn.addEventListener("click", resetAllData);
els.seedBtn.addEventListener("click", () => {
  if (!requireAdmin()) return;
  products = cloneSampleProductsForBranches();
  save(STORAGE_KEYS.products, products);
  renderAll();
});
els.closeReceiptBtn.addEventListener("click", () => els.receiptDialog.close());
els.printReceiptBtn.addEventListener("click", () => window.print());
window.addEventListener("online", () => {
  updateNetworkStatus();
  syncPendingChanges();
});
window.addEventListener("offline", updateNetworkStatus);

window.addEventListener("cloud-ready", (event) => {
  updateCloudStatus(`云端已连接：${event.detail.projectId}`, true);
  syncPendingChanges();
});

window.addEventListener("cloud-auth-change", (event) => {
  const { firebaseUser, appUser } = event.detail;
  if (!firebaseUser) {
    if (cloudSessionActive) {
      adminEmail = "";
      operatorEmail = "";
      currentCloudUser = null;
      localStorage.removeItem(STORAGE_KEYS.adminEmail);
      localStorage.removeItem(STORAGE_KEYS.operatorEmail);
      cloudSessionActive = false;
    }
    updateCloudStatus("云端未登录");
    renderAll();
    return;
  }
  applyCloudUser(appUser);
});

window.addEventListener("cloud-error", (event) => {
  updateCloudStatus("云端错误");
  console.warn("Cloud error", event.detail.message);
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  els.installBtn.classList.remove("hidden");
});

els.installBtn.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  els.installBtn.classList.add("hidden");
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}

setAppView("order");
migrateManagementData();
migrateProductsForBranches();
renderAll();
