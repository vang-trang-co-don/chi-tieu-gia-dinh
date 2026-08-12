export function fmtMoney(n) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n);
}

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function fmtDate(dateStr) {
  const [y, m, d] = dateStr.split("-");
  const date = new Date(y, m - 1, d);
  const wd = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][date.getDay()];
  return `${wd}, ${d}/${m}`;
}

export function toast(msg, ms = 2200) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), ms);
}

export function confirmAction(msg, cb) {
  if (window.confirm(msg)) cb();
}

export function groupByDay(expenses) {
  const map = new Map();
  for (const e of [...expenses].sort((a, b) => b.date.localeCompare(a.date))) {
    if (!map.has(e.date)) map.set(e.date, []);
    map.get(e.date).push(e);
  }
  return map;
}

export function memberById(members, id) {
  return members.find((m) => m.id === id) || { id, name: id };
}