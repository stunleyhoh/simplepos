const STORAGE_KEYS = {
  products: "simple-herbal-pos-products",
  sales: "simple-herbal-pos-sales"
};

const sampleProducts = [
  { id: createId(), name: "简单草本减脂计划第一阶段", barcode: "SLIM-P1-3W", category: "草本减脂计划", price: 150, stock: 30 },
  { id: createId(), name: "第一阶段复购包", barcode: "SLIM-P1-REFILL", category: "草本减脂计划", price: 150, stock: 20 },
  { id: createId(), name: "3星期跟进服务", barcode: "SLIM-COACH-3W", category: "服务", price: 0, stock: 99 }
];

let products = load(STORAGE_KEYS.products, sampleProducts);
let sales = load(STORAGE_KEYS.sales, []);
let cart = [];
let deferredInstallPrompt = null;

const els = {
  networkStatus: document.querySelector("#networkStatus"),
  installBtn: document.querySelector("#installBtn"),
  seedBtn: document.querySelector("#seedBtn"),
  searchInput: document.querySelector("#searchInput"),
  categoryFilter: document.querySelector("#categoryFilter"),
  productGrid: document.querySelector("#productGrid"),
  cartHint: document.querySelector("#cartHint"),
  cartItems: document.querySelector("#cartItems"),
  clearCartBtn: document.querySelector("#clearCartBtn"),
  discountInput: document.querySelector("#discountInput"),
  paidInput: document.querySelector("#paidInput"),
  subtotalText: document.querySelector("#subtotalText"),
  totalText: document.querySelector("#totalText"),
  changeText: document.querySelector("#changeText"),
  checkoutBtn: document.querySelector("#checkoutBtn"),
  productForm: document.querySelector("#productForm"),
  nameInput: document.querySelector("#nameInput"),
  barcodeInput: document.querySelector("#barcodeInput"),
  categoryInput: document.querySelector("#categoryInput"),
  priceInput: document.querySelector("#priceInput"),
  stockInput: document.querySelector("#stockInput"),
  exportBtn: document.querySelector("#exportBtn"),
  resetDataBtn: document.querySelector("#resetDataBtn"),
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

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function money(value) {
  return `RM ${Number(value || 0).toFixed(2)}`;
}

function renderAll() {
  renderCategoryFilter();
  renderProducts();
  renderCart();
  renderSales();
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
    const card = document.createElement("button");
    card.type = "button";
    card.className = "product-card";
    card.disabled = product.stock <= 0;
    card.innerHTML = `
      <strong>${escapeHtml(product.name)}</strong>
      <span class="product-meta">${escapeHtml(product.category)} · 库存 ${product.stock}</span>
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
  if (!product || currentQty >= product.stock) {
    alert("库存不足，不能继续添加。");
    return;
  }
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: product.id, name: product.name, price: product.price, qty: 1 });
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
  } else if (product && nextQty <= product.stock) {
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

  const sale = {
    id: `POS${Date.now()}`,
    createdAt: new Date().toISOString(),
    items: structuredClone(cart),
    subtotal: totals.subtotal,
    discount: totals.discount,
    total: totals.total,
    paid: totals.paid,
    change: totals.change
  };

  products = products.map((product) => {
    const sold = cart.find((item) => item.id === product.id);
    return sold ? { ...product, stock: product.stock - sold.qty } : product;
  });
  sales.unshift(sale);
  cart = [];
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
    `时间：${new Date(sale.createdAt).toLocaleString()}`,
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
      <span class="product-meta">${sale.items.map((item) => `${item.name} x${item.qty}`).join("，")}</span>
    `;
    els.salesList.append(row);
  }
}

function saveProduct(event) {
  event.preventDefault();
  const product = {
    id: createId(),
    name: els.nameInput.value.trim(),
    barcode: els.barcodeInput.value.trim(),
    category: els.categoryInput.value.trim(),
    price: Number(els.priceInput.value),
    stock: Number(els.stockInput.value)
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
  if (!sales.length) {
    alert("还没有销售记录可以导出。");
    return;
  }
  const rows = [["订单号", "时间", "商品", "小计", "折扣", "应收", "实收", "找零"]];
  for (const sale of sales) {
    rows.push([
      sale.id,
      new Date(sale.createdAt).toLocaleString(),
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
  if (!confirm("确定清空商品、销售记录和购物车吗？")) return;
  products = structuredClone(sampleProducts);
  sales = [];
  cart = [];
  save(STORAGE_KEYS.products, products);
  save(STORAGE_KEYS.sales, sales);
  renderAll();
}

els.searchInput.addEventListener("input", renderProducts);
els.categoryFilter.addEventListener("change", renderProducts);
els.clearCartBtn.addEventListener("click", () => {
  cart = [];
  renderCart();
});
els.discountInput.addEventListener("input", renderCart);
els.paidInput.addEventListener("input", renderCart);
els.checkoutBtn.addEventListener("click", checkout);
els.productForm.addEventListener("submit", saveProduct);
els.exportBtn.addEventListener("click", exportSales);
els.resetDataBtn.addEventListener("click", resetAllData);
els.seedBtn.addEventListener("click", () => {
  products = structuredClone(sampleProducts);
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

renderAll();
