const STORAGE_KEYS = {
  products: "simple-herbal-pos-products",
  sales: "simple-herbal-pos-sales",
  adminEmail: "simple-herbal-pos-admin-email",
  branchId: "simple-herbal-pos-branch-id"
};

const ADMIN_EMAIL = "stanleyhoh79@gmail.com";
const BRANCHES = [
  { id: "hq", name: "总店" },
  { id: "branch-1", name: "分行 1" },
  { id: "branch-2", name: "分行 2" }
];

const sampleProducts = [
  { id: createId(), name: "简单草本减脂计划第一阶段", barcode: "SLIM-P1-3W", category: "草本减脂计划", price: 150, stock: 30, branchStock: { hq: 30, "branch-1": 12, "branch-2": 8 } },
  { id: createId(), name: "第一阶段复购包", barcode: "SLIM-P1-REFILL", category: "草本减脂计划", price: 150, stock: 20, branchStock: { hq: 20, "branch-1": 8, "branch-2": 5 } },
  { id: createId(), name: "3星期跟进服务", barcode: "SLIM-COACH-3W", category: "服务", price: 0, stock: 99, branchStock: { hq: 99, "branch-1": 99, "branch-2": 99 } }
];

let products = load(STORAGE_KEYS.products, sampleProducts);
let sales = load(STORAGE_KEYS.sales, []);
let cart = [];
let deferredInstallPrompt = null;
let adminEmail = localStorage.getItem(STORAGE_KEYS.adminEmail) || "";
let currentBranchId = localStorage.getItem(STORAGE_KEYS.branchId) || "hq";

const els = {
  networkStatus: document.querySelector("#networkStatus"),
  branchStatus: document.querySelector("#branchStatus"),
  adminStatus: document.querySelector("#adminStatus"),
  installBtn: document.querySelector("#installBtn"),
  seedBtn: document.querySelector("#seedBtn"),
  searchInput: document.querySelector("#searchInput"),
  categoryFilter: document.querySelector("#categoryFilter"),
  branchSelect: document.querySelector("#branchSelect"),
  productGrid: document.querySelector("#productGrid"),
  cartHint: document.querySelector("#cartHint"),
  cartItems: document.querySelector("#cartItems"),
  clearCartBtn: document.querySelector("#clearCartBtn"),
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
  adminLoginMessage: document.querySelector("#adminLoginMessage"),
  adminLogoutBtn: document.querySelector("#adminLogoutBtn"),
  adminContent: document.querySelector("#adminContent"),
  productForm: document.querySelector("#productForm"),
  nameInput: document.querySelector("#nameInput"),
  barcodeInput: document.querySelector("#barcodeInput"),
  categoryInput: document.querySelector("#categoryInput"),
  priceInput: document.querySelector("#priceInput"),
  stockInput: document.querySelector("#stockInput"),
  exportBtn: document.querySelector("#exportBtn"),
  resetDataBtn: document.querySelector("#resetDataBtn"),
  globalRevenueText: document.querySelector("#globalRevenueText"),
  globalOrdersText: document.querySelector("#globalOrdersText"),
  globalCustomersText: document.querySelector("#globalCustomersText"),
  globalStockText: document.querySelector("#globalStockText"),
  branchOverview: document.querySelector("#branchOverview"),
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

function isAdmin() {
  return adminEmail.toLowerCase() === ADMIN_EMAIL;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function getBranchName(branchId) {
  return BRANCHES.find((branch) => branch.id === branchId)?.name || "未知分行";
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
    if (product.branchStock) return product;
    return {
      ...product,
      branchStock: {
        hq: Number(product.stock || 0),
        "branch-1": Math.floor(Number(product.stock || 0) * 0.4),
        "branch-2": Math.floor(Number(product.stock || 0) * 0.25)
      }
    };
  });
  save(STORAGE_KEYS.products, products);
}

function renderBranchSelect() {
  els.branchSelect.innerHTML = "";
  for (const branch of BRANCHES) {
    const option = document.createElement("option");
    option.value = branch.id;
    option.textContent = branch.name;
    els.branchSelect.append(option);
  }
  els.branchSelect.value = BRANCHES.some((branch) => branch.id === currentBranchId) ? currentBranchId : "hq";
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

function requireAdmin() {
  if (isAdmin()) return true;
  alert("只有唯一管理员可以操作后台。请先输入管理员邮箱。");
  els.adminEmailInput.focus();
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
  renderAdminAccess();
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
  renderBranchSelect();
  renderCategoryFilter();
  renderProducts();
  renderCart();
  renderSales();
  renderGlobalDashboard();
  renderAdminAccess();
  updateNetworkStatus();
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

function checkout() {
  if (!cart.length) return;
  const totals = getCartTotals();
  if (totals.paid < totals.total) {
    alert("实收金额不足。");
    els.paidInput.focus();
    return;
  }

  const createdAt = new Date();
  const serviceEnd = new Date(createdAt);
  serviceEnd.setDate(serviceEnd.getDate() + 21);

  const sale = {
    id: `POS${Date.now()}`,
    createdAt: createdAt.toISOString(),
    branchId: currentBranchId,
    branchName: getBranchName(currentBranchId),
    customer: {
      name: els.customerNameInput.value.trim(),
      phone: els.customerPhoneInput.value.trim()
    },
    service: {
      name: "简单草本减脂计划第一阶段",
      startDate: createdAt.toISOString(),
      endDate: serviceEnd.toISOString(),
      durationDays: 21
    },
    items: structuredClone(cart),
    subtotal: totals.subtotal,
    discount: totals.discount,
    total: totals.total,
    paid: totals.paid,
    change: totals.change
  };

  products = products.map((product) => {
    const sold = cart.find((item) => item.id === product.id);
    if (!sold) return product;
    return setBranchStock(product, currentBranchId, getBranchStock(product) - sold.qty);
  });
  sales.unshift(sale);
  cart = [];
  els.customerNameInput.value = "";
  els.customerPhoneInput.value = "";
  els.discountInput.value = "0";
  els.paidInput.value = "";
  save(STORAGE_KEYS.products, products);
  save(STORAGE_KEYS.sales, sales);
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
    "简单草本减脂计划",
    `订单号：${sale.id}`,
    `分行：${sale.branchName || getBranchName(sale.branchId || "hq")}`,
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
  lines.push("谢谢惠顾");
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

  for (const branch of BRANCHES) {
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
    branchStock: {
      hq: currentBranchId === "hq" ? Number(els.stockInput.value) : 0,
      "branch-1": 0,
      "branch-2": 0,
      [currentBranchId]: Number(els.stockInput.value)
    }
  };
  if (!product.name || !product.category || product.price < 0 || product.stock < 0) {
    alert("请检查商品信息。");
    return;
  }

  const sameBarcode = product.barcode && products.find((item) => item.barcode === product.barcode);
  if (sameBarcode) {
    products = products.map((item) => item.id === sameBarcode.id ? { ...product, id: item.id } : item);
  } else {
    products.unshift(product);
  }
  save(STORAGE_KEYS.products, products);
  els.productForm.reset();
  renderAll();
}

function exportSales() {
  if (!requireAdmin()) return;
  if (!sales.length) {
    alert("还没有销售记录可以导出。");
    return;
  }
  const rows = [["订单号", "分行", "时间", "客户姓名", "电话", "计划开始", "计划结束", "商品", "小计", "折扣", "应收", "实收", "找零"]];
  for (const sale of sales) {
    rows.push([
      sale.id,
      sale.branchName || getBranchName(sale.branchId || "hq"),
      new Date(sale.createdAt).toLocaleString(),
      sale.customer?.name || "",
      sale.customer?.phone || "",
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
  products = structuredClone(sampleProducts).map((product) => ({
    ...product,
    branchStock: { ...product.branchStock }
  }));
  sales = [];
  cart = [];
  save(STORAGE_KEYS.products, products);
  save(STORAGE_KEYS.sales, sales);
  renderAll();
}

els.searchInput.addEventListener("input", renderProducts);
els.categoryFilter.addEventListener("change", renderProducts);
els.branchSelect.addEventListener("change", () => {
  currentBranchId = els.branchSelect.value;
  localStorage.setItem(STORAGE_KEYS.branchId, currentBranchId);
  cart = [];
  renderAll();
});
els.clearCartBtn.addEventListener("click", () => {
  cart = [];
  renderCart();
});
els.discountInput.addEventListener("input", renderCart);
els.paidInput.addEventListener("input", renderCart);
els.checkoutBtn.addEventListener("click", checkout);
els.adminLoginForm.addEventListener("submit", loginAdmin);
els.adminLogoutBtn.addEventListener("click", logoutAdmin);
els.productForm.addEventListener("submit", saveProduct);
els.exportBtn.addEventListener("click", exportSales);
els.resetDataBtn.addEventListener("click", resetAllData);
els.seedBtn.addEventListener("click", () => {
  if (!requireAdmin()) return;
  products = structuredClone(sampleProducts).map((product) => ({
    ...product,
    branchStock: { ...product.branchStock }
  }));
  save(STORAGE_KEYS.products, products);
  renderAll();
});
els.closeReceiptBtn.addEventListener("click", () => els.receiptDialog.close());
els.printReceiptBtn.addEventListener("click", () => window.print());
window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);

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

migrateProductsForBranches();
renderAll();
