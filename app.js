const STORAGE_KEYS = {
  products: "simple-herbal-pos-products",
  sales: "simple-herbal-pos-sales",
  adminEmail: "simple-herbal-pos-admin-email",
  branchId: "simple-herbal-pos-branch-id",
  branches: "simple-herbal-pos-branches",
  authorizedUsers: "simple-herbal-pos-authorized-users",
  operatorEmail: "simple-herbal-pos-operator-email",
  pendingSales: "simple-herbal-pos-pending-sales",
  pendingProducts: "simple-herbal-pos-pending-products",
  settings: "simple-herbal-pos-settings"
};

const ADMIN_EMAIL = "stanleyhoh79@gmail.com";
const APP_VERSION = "v0.23";
const defaultBranches = [
  { id: "hq", name: "总店" },
  { id: "branch-1", name: "分行 1" },
  { id: "branch-2", name: "分行 2" }
];
const defaultAuthorizedUsers = [
  { id: "admin-user", name: "Stanley Hoh", email: ADMIN_EMAIL, branchId: "hq", role: "管理员" }
];
const defaultSettings = {
  businessName: "简单草本减脂计划",
  defaultServiceName: "简单草本减脂计划第一阶段",
  serviceDays: 21,
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
let pendingProducts = load(STORAGE_KEYS.pendingProducts, []);
let appSettings = load(STORAGE_KEYS.settings, defaultSettings);
let cart = [];
let deferredInstallPrompt = null;
let adminEmail = localStorage.getItem(STORAGE_KEYS.adminEmail) || "";
let currentBranchId = localStorage.getItem(STORAGE_KEYS.branchId) || "hq";
let operatorEmail = localStorage.getItem(STORAGE_KEYS.operatorEmail) || "";
let cloudSessionActive = false;
let currentCloudUser = null;

const els = {
  networkStatus: document.querySelector("#networkStatus"),
  cloudStatus: document.querySelector("#cloudStatus"),
  branchStatus: document.querySelector("#branchStatus"),
  operatorStatus: document.querySelector("#operatorStatus"),
  adminStatus: document.querySelector("#adminStatus"),
  versionStatus: document.querySelector("#versionStatus"),
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
  backupBtn: document.querySelector("#backupBtn"),
  restoreBtn: document.querySelector("#restoreBtn"),
  restoreInput: document.querySelector("#restoreInput"),
  resetDataBtn: document.querySelector("#resetDataBtn"),
  globalRevenueText: document.querySelector("#globalRevenueText"),
  globalOrdersText: document.querySelector("#globalOrdersText"),
  globalCustomersText: document.querySelector("#globalCustomersText"),
  globalStockText: document.querySelector("#globalStockText"),
  branchOverview: document.querySelector("#branchOverview"),
  syncOverview: document.querySelector("#syncOverview"),
  followUpList: document.querySelector("#followUpList"),
  lowStockList: document.querySelector("#lowStockList"),
  settingsForm: document.querySelector("#settingsForm"),
  businessNameInput: document.querySelector("#businessNameInput"),
  defaultServiceNameInput: document.querySelector("#defaultServiceNameInput"),
  serviceDaysInput: document.querySelector("#serviceDaysInput"),
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
  const pendingCount = pendingSales.length + pendingProducts.length;
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

function isAdmin() {
  return adminEmail.toLowerCase() === ADMIN_EMAIL;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
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
  if (!branches.length) branches = structuredClone(defaultBranches);
  if (!authorizedUsers.length) authorizedUsers = structuredClone(defaultAuthorizedUsers);
  if (!authorizedUsers.some((user) => normalizeEmail(user.email) === ADMIN_EMAIL)) {
    authorizedUsers.unshift(structuredClone(defaultAuthorizedUsers[0]));
  }
  if (!branches.some((branch) => branch.id === currentBranchId)) {
    currentBranchId = "hq";
    localStorage.setItem(STORAGE_KEYS.branchId, currentBranchId);
  }
  save(STORAGE_KEYS.branches, branches);
  save(STORAGE_KEYS.authorizedUsers, authorizedUsers);
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
    els.adminLoginMessage.textContent = `已授权：${ADMIN_EMAIL}`;
  }
}

function getOperator() {
  const email = normalizeEmail(operatorEmail);
  return authorizedUsers.find((user) => normalizeEmail(user.email) === email) || null;
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
    if (window.cloudPOS.saveCheckout) {
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
      if (window.cloudPOS.saveCheckout) {
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

async function syncPendingChanges() {
  await syncPendingProducts();
  await syncPendingSales();
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
    receiptFooter: els.receiptFooterInput.value.trim()
  };
  save(STORAGE_KEYS.settings, appSettings);
  if (hasCloud()) {
    window.cloudPOS.saveSettings(appSettings).catch((error) => console.warn("Settings cloud sync failed", error));
  }
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

  if (normalizeEmail(appUser.email) === ADMIN_EMAIL || appUser.role === "admin") {
    adminEmail = ADMIN_EMAIL;
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
  return currentCloudUser && (normalizeEmail(currentCloudUser.email) === ADMIN_EMAIL || currentCloudUser.role === "admin");
}

function requireCloudAdmin() {
  if (isCloudAdmin()) return true;
  alert("这个操作需要 Google 管理员登录。请点击 Google 管理员登录。");
  return false;
}

function loginAdmin(event) {
  event.preventDefault();
  const email = normalizeEmail(els.adminEmailInput.value);
  if (email !== ADMIN_EMAIL) {
    els.adminLoginMessage.textContent = "邮箱不匹配，无法进入后台。";
    els.adminLoginMessage.classList.add("error");
    return;
  }
  adminEmail = email;
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
  for (const user of authorizedUsers) {
    const row = document.createElement("div");
    row.className = "management-row";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(user.name)}</strong>
        <small>${escapeHtml(user.email)} · ${escapeHtml(getBranchName(user.branchId))} · ${escapeHtml(user.role || "POS用户")}</small>
      </div>
      <button class="ghost danger" type="button" ${normalizeEmail(user.email) === ADMIN_EMAIL ? "disabled" : ""}>移除</button>
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
      <strong>${pendingSales.length} 单订单、${pendingProducts.length} 个库存待同步</strong>
      <small>${pendingSales.length || pendingProducts.length ? "恢复网络后会自动补传，也可以手动补传。" : "所有本机变更已处理。"}</small>
    </div>
  `;
  els.syncOverview.append(syncRow);
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
  els.userForm.reset();
  renderAll();
}

function removeAuthorizedUser(userId) {
  if (!requireAdmin()) return;
  authorizedUsers = authorizedUsers.filter((user) => user.id !== userId || normalizeEmail(user.email) === ADMIN_EMAIL);
  if (!getOperator()) logoutOperator();
  save(STORAGE_KEYS.authorizedUsers, authorizedUsers);
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

function renderAll() {
  els.versionStatus.textContent = APP_VERSION;
  renderBranchSelect();
  renderCategoryFilter();
  renderProducts();
  renderCart();
  renderSales();
  renderSettingsForm();
  renderFollowUps();
  renderLowStock();
  renderGlobalDashboard();
  renderManagementLists();
  renderAdminAccess();
  renderOperatorAccess();
  updateNetworkStatus();
}

function renderSettingsForm() {
  if (!isAdmin()) return;
  els.businessNameInput.value = appSettings.businessName;
  els.defaultServiceNameInput.value = appSettings.defaultServiceName;
  els.serviceDaysInput.value = appSettings.serviceDays;
  els.receiptFooterInput.value = appSettings.receiptFooter;
}

function daysUntil(dateValue) {
  const target = new Date(dateValue);
  const today = new Date();
  target.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / 86400000);
}

function renderFollowUps() {
  if (!isAdmin()) return;
  els.followUpList.innerHTML = "";
  const activePlans = sales
    .filter((sale) => sale.service?.endDate)
    .map((sale) => ({ ...sale, daysLeft: daysUntil(sale.service.endDate) }))
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
    const status = sale.daysLeft < 0 ? `已到期 ${Math.abs(sale.daysLeft)} 天` : sale.daysLeft === 0 ? "今天到期" : `${sale.daysLeft} 天后到期`;
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(sale.customer?.name || "未填写姓名")}</strong>
        <small>${escapeHtml(sale.customer?.phone || "-")} · ${escapeHtml(sale.branchName || getBranchName(sale.branchId || "hq"))} · ${escapeHtml(status)}</small>
      </div>
      <small>${money(sale.total)}</small>
    `;
    els.followUpList.append(row);
  }
}

function renderLowStock() {
  if (!isAdmin()) return;
  els.lowStockList.innerHTML = "";
  const lowStockItems = [];
  for (const product of products) {
    for (const branch of branches) {
      const stock = getBranchStock(product, branch.id);
      if (stock <= 5) {
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
      <small>库存 ${item.stock}</small>
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
  const total = Math.max(0, subtotal - discount);
  const paid = Number(els.paidInput.value || 0);
  return { subtotal, discount, total, paid, change: Math.max(0, paid - total) };
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
  lines.push(appSettings.receiptFooter);
  return lines.join("\n");
}

function renderSales() {
  const today = new Date().toDateString();
  const todaySales = sales.filter((sale) => new Date(sale.createdAt).toDateString() === today);
  const total = todaySales.reduce((sum, sale) => sum + sale.total, 0);
  els.salesSummary.textContent = todaySales.length
    ? `${todaySales.length} 单，共 ${money(total)}`
    : "暂无销售";
  els.salesList.innerHTML = "";

  if (!todaySales.length) {
    els.salesList.innerHTML = '<div class="empty">完成收款后这里会出现销售记录</div>';
    return;
  }

  for (const sale of todaySales.slice(0, 8)) {
    const row = document.createElement("div");
    row.className = "sale-item";
    row.innerHTML = `
      <div class="sale-item-top">
        <strong>${money(sale.total)}</strong>
        <span>${new Date(sale.createdAt).toLocaleTimeString()}</span>
      </div>
      <span class="product-meta">分行：${escapeHtml(sale.branchName || getBranchName(sale.branchId || "hq"))}</span>
      <span class="product-meta">收银员：${escapeHtml(sale.operator?.name || "-")}</span>
      <span class="product-meta">同步：${pendingSales.some((item) => item.id === sale.id) ? "待同步" : "已处理"}</span>
      <span class="product-meta">客户：${escapeHtml(sale.customer?.name || "-")} ${escapeHtml(sale.customer?.phone || "")}</span>
      <span class="product-meta">${sale.items.map((item) => `${item.name} x${item.qty}`).join("，")}</span>
    `;
    els.salesList.append(row);
  }
}

function renderGlobalDashboard() {
  if (!isAdmin()) return;
  const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const customers = new Set(
    sales
      .map((sale) => `${sale.customer?.phone || ""}-${sale.customer?.name || ""}`.trim())
      .filter(Boolean)
  );

  els.globalRevenueText.textContent = money(totalRevenue);
  els.globalOrdersText.textContent = String(sales.length);
  els.globalCustomersText.textContent = String(customers.size);
  els.globalStockText.textContent = String(getTotalStock());
  els.branchOverview.innerHTML = "";

  for (const branch of branches) {
    const branchSales = sales.filter((sale) => (sale.branchId || "hq") === branch.id);
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
  els.productForm.reset();
  renderAll();
}

function exportSales() {
  if (!requireAdmin()) return;
  if (!sales.length) {
    alert("还没有销售记录可以导出。");
    return;
  }
  const rows = [["订单号", "分行", "收银员", "收银员邮箱", "同步状态", "时间", "客户姓名", "电话", "计划名称", "服务天数", "计划开始", "计划结束", "商品", "小计", "折扣", "应收", "实收", "找零"]];
  for (const sale of sales) {
    rows.push([
      sale.id,
      sale.branchName || getBranchName(sale.branchId || "hq"),
      sale.operator?.name || "",
      sale.operator?.email || "",
      pendingSales.some((item) => item.id === sale.id) ? "待同步" : "已处理",
      new Date(sale.createdAt).toLocaleString(),
      sale.customer?.name || "",
      sale.customer?.phone || "",
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
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `sales-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
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
    pendingProducts
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
      pendingProducts = Array.isArray(backup.pendingProducts) ? backup.pendingProducts : [];
      appSettings = backup.settings || defaultSettings;

      save(STORAGE_KEYS.branches, branches);
      save(STORAGE_KEYS.authorizedUsers, authorizedUsers);
      save(STORAGE_KEYS.products, products);
      save(STORAGE_KEYS.sales, sales);
      savePendingSales();
      savePendingProducts();
      save(STORAGE_KEYS.settings, appSettings);
      migrateManagementData();
      migrateProductsForBranches();
      renderAll();
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
  products = cloneSampleProductsForBranches();
  sales = [];
  pendingSales = [];
  cart = [];
  branches = structuredClone(defaultBranches);
  authorizedUsers = structuredClone(defaultAuthorizedUsers);
  save(STORAGE_KEYS.products, products);
  save(STORAGE_KEYS.sales, sales);
  savePendingSales();
  pendingProducts = [];
  savePendingProducts();
  save(STORAGE_KEYS.branches, branches);
  save(STORAGE_KEYS.authorizedUsers, authorizedUsers);
  renderAll();
}

els.searchInput.addEventListener("input", renderProducts);
els.categoryFilter.addEventListener("change", renderProducts);
els.refreshCloudBtn.addEventListener("click", loadCloudData);
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
  renderCart();
});
els.discountInput.addEventListener("input", renderCart);
els.paidInput.addEventListener("input", renderCart);
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

migrateManagementData();
migrateProductsForBranches();
renderAll();
