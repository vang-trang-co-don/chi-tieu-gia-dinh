import { init, subscribe, getState, syncToServer } from "./db.js";
import { addExpense, updateExpense, removeExpense, togglePaid, addMember, removeMember } from "./store.js";
import { isUnlocked, login, logout, initAuth, subscribeAuth, isAuthConfigured } from "./auth.js";
import { ADMIN_EMAIL, DEFAULT_LOGIN_EMAIL } from "./config.js";
import { computeBalance, availableMonths, monthStats } from "./calc.js";
import { fmtMoney, esc, todayStr, fmtDate, groupByDay, memberById, toast, confirmAction } from "./ui.js";

let view = "overview";
let selMonth = null;
let editingId = null;

function pickUnit(amount) {
  if (amount && amount % 1000000 === 0) return { by: 1000000, label: "triệu" };
  if (amount && amount % 1000 === 0) return { by: 1000, label: "ngàn" };
  return { by: 1, label: "đ" };
}

const $view = document.getElementById("view");

// ---------------- rendering ----------------
function render() {
  renderLock();
  if (view === "overview") renderOverview();
  else if (view === "expenses") renderExpenses();
  else renderMembers();
}

function renderLock() {
  const btn = document.getElementById("lockBtn");
  const icon = document.getElementById("lockIcon");
  btn.classList.toggle("unlocked", isUnlocked());
  icon.textContent = isUnlocked() ? "🔓" : "🔒";
  btn.title = isUnlocked() ? "Khoá lại" : "Mở khoá để chỉnh sửa";
}

// ---------------- overview ----------------
function renderOverview() {
  const s = getState();
  const { expenses, members } = s;
  const months = availableMonths(expenses);
  if (selMonth && !months.includes(selMonth)) selMonth = null;
  if (!selMonth) selMonth = months[0] || todayStr().slice(0, 7);

  const st = monthStats(expenses, selMonth);
  const net = computeBalance(st.list, members);

  const paidBy = {};
  for (const e of st.list) paidBy[e.payer] = (paidBy[e.payer] || 0) + e.amount;

  let netHtml = `<div class="empty">🎉 Không có khoản nợ nào trong tháng này</div>`;
  if (net.length) {
    netHtml = net.map((n) => `
      <div class="debt-item">
        <span><b>${esc(n.from.name)}</b> nợ <b>${esc(n.to.name)}</b></span>
        <span class="amt">${fmtMoney(n.amount)}</span>
      </div>`).join("");
  }

  let paidHtml = "";
  if (members.length && st.list.length) {
    paidHtml = members.map((m) => {
      const v = paidBy[m.id] || 0;
      return `
      <div class="debt-item">
        <span>${esc(m.name)} đã chi</span>
        <span class="amt">${v ? fmtMoney(v) : "—"}</span>
      </div>`;
    }).join("");
  }

  $view.innerHTML = `
    <div class="day-filter">
      <select class="input" id="monthSel">
        ${months.map((m) => `<option value="${m}" ${m === selMonth ? "selected" : ""}>Tháng ${m.slice(5)}/${m.slice(0, 4)}</option>`).join("")}
      </select>
    </div>
    <div class="stat-grid">
      <div class="stat total"><div class="v">${fmtMoney(st.total)}</div><div class="k">Tổng chi</div></div>
      <div class="stat"><div class="v">${st.count}</div><div class="k">Giao dịch</div></div>
      <div class="stat debt"><div class="v">${net.length}</div><div class="k">Khoản nợ</div></div>
    </div>

    <div class="card">
      <h3 class="card-title">Chi theo người</h3>
      ${paidHtml || '<div class="empty">Chưa có dữ liệu</div>'}
    </div>

    <div class="card">
      <h3 class="card-title">Nợ ròng chưa thanh toán</h3>
      ${netHtml}
    </div>
  `;
}

// ---------------- expenses ----------------
function renderExpenses() {
  const s = getState();
  const { expenses, members } = s;
  const unlocked = isUnlocked();
  const form = unlocked ? renderForm() : "";

  const groups = groupByDay(expenses);
  let listHtml = `<div class="empty">Chưa có khoản chi nào</div>`;
  if (groups.size) {
    listHtml = [...groups].map(([date, items]) => `
      <div class="day-group">
        <h3 class="day-title">${esc(fmtDate(date))}</h3>
        ${items.map((e) => renderExpense(e, members, unlocked)).join("")}
      </div>`).join("");
  }

  $view.innerHTML = `${form}
    ${listHtml}`;

  if (unlocked) {
    document.getElementById("expenseForm").addEventListener("submit", onFormSubmit);
    const tgl = document.getElementById("splitEqual");
    if (tgl) {
      tgl.addEventListener("click", () => setSplit("equal"));
      document.getElementById("splitOne").addEventListener("click", () => setSplit("one"));
    }
    document.getElementById("pickGroup").addEventListener("click", (ev) => {
      const btn = ev.target.closest(".pick-btn");
      if (btn) btn.classList.toggle("on");
    });
    document.getElementById("fPayer").addEventListener("change", (ev) => {
      const s = getState();
      document.getElementById("pickGroup").innerHTML = pickButtons(s.members, ev.target.value, editingId ? getState().expenses.find((x) => x.id === editingId)?.target : "");
    });
  }
}

function renderForm() {
  const s = getState();
  const members = s.members;
  const editing = editingId ? s.expenses.find((e) => e.id === editingId) : null;
  const e = editing || {};
  const split = e.split || "one";
  const payer = e.payer || members[0]?.id || "";
  const target = e.target || "";
  const unit = editing ? pickUnit(e.amount) : { by: 1000, label: "ngàn" };
  const amountVal = editing ? e.amount / unit.by : "";

  const nameSel = (val) =>
    members.map((m) => `<option value="${m.id}" ${m.id === val ? "selected" : ""}>${esc(m.name)}</option>`).join("");

  return `
  <form class="expense-form" id="expenseForm">
    <div class="field">
      <label for="fTitle">Tên khoản chi</label>
      <input class="input" id="fTitle" required placeholder="VD: phở, chợ..." value="${esc(e.title || "")}">
    </div>
    <div class="field">
      <label for="fAmount">Số tiền</label>
      <div style="display:flex; gap:6px;">
        <input class="input" id="fAmount" type="number" min="0" step="1" required placeholder="35" value="${amountVal}" style="flex:1;">
        <select class="input" id="fUnit" style="width:90px;">
          <option value="1000" ${unit.by === 1000 ? "selected" : ""}>ngàn</option>
          <option value="1000000" ${unit.by === 1000000 ? "selected" : ""}>triệu</option>
          <option value="1" ${unit.by === 1 ? "selected" : ""}>đ</option>
        </select>
      </div>
    </div>
    <div class="field">
      <label for="fDate">Ngày</label>
      <input class="input" id="fDate" type="date" value="${e.date || todayStr()}">
    </div>
    <div class="field">
      <label for="fPayer">Người trả</label>
      <select class="input" id="fPayer">${nameSel(payer)}</select>
    </div>
    <div class="field">
      <label>Chia kiểu</label>
      <div class="split-toggle">
        <button type="button" class="btn ${split === "equal" ? "on" : ""}" id="splitEqual">Chia đều</button>
        <button type="button" class="btn ${split === "one" ? "on" : ""}" id="splitOne">Cho 1 người</button>
      </div>
    </div>
    <div class="field ${split === "one" ? "" : "hidden"}" id="targetField">
      <label>Người nợ (chọn nhiều được)</label>
      <div class="pick-group" id="pickGroup">${pickButtons(members, payer, target)}</div>
    </div>
    <div class="field" style="grid-column: span 2; display:flex; gap:8px;">
      <button class="btn primary" type="submit">${editing ? "Cập nhật" : "+ Thêm"}</button>
      ${editing ? '<button class="btn" type="button" id="cancelEdit">Huỷ</button>' : ""}
    </div>
  </form>`;
}

function pickButtons(members, payerId, target) {
  return members
    .filter((m) => m.id !== payerId)
    .map((m) => `<button type="button" class="pick-btn ${m.id === target ? "on" : ""}" data-mid="${m.id}">${esc(m.name)}</button>`)
    .join("");
}

function setSplit(kind) {
  document.getElementById("splitEqual").classList.toggle("on", kind === "equal");
  document.getElementById("splitOne").classList.toggle("on", kind === "one");
  document.getElementById("targetField").classList.toggle("hidden", kind !== "one");
}

async function onFormSubmit(ev) {
  ev.preventDefault();
  const unit = parseInt(ev.target.fUnit.value || "1000", 10);
  const money = Math.round(parseFloat(ev.target.fAmount.value || "0") * unit * 100) / 100;
  if (!money || isNaN(money) || money < 0) return toast("Số tiền không hợp lệ", 2000);

  const split = document.getElementById("splitOne").classList.contains("on") ? "one" : "equal";
  const title = ev.target.fTitle.value.trim();
  const date = ev.target.fDate.value;
  const payer = ev.target.fPayer.value;

  if (editingId) {
    const selected = selectedMembers();
    const target = selected.length ? selected[0] : getState().expenses.find((x) => x.id === editingId)?.target;
    await updateExpense(editingId, { title, amount: money, date, payer, split, target: split === "one" ? target : undefined });
    toast("Đã cập nhật");
    editingId = null;
    render();
    return;
  }

  if (split === "one") {
    const ids = selectedMembers();
    if (!ids.length) return toast("Chọn ít nhất 1 người nợ", 2200);
    for (const target of ids) {
      await addExpense({ title, amount: money, date, payer, split, target });
    }
    toast(`Đã thêm ${ids.length} khoản chi`);
  } else {
    await addExpense({ title, amount: money, date, payer, split });
    toast("Đã thêm");
  }
  render();
}

function selectedMembers() {
  return [...document.querySelectorAll("#pickGroup .pick-btn.on")].map((b) => b.dataset.mid);
}

function renderExpense(e, members, unlocked) {
  const payer = memberById(members, e.payer);
  const debtors = e.split === "one"
    ? (e.target ? [{ member: memberById(members, e.target), amount: e.amount, paid: !!(e.paid && e.paid[e.target]) }] : [])
    : members.filter((m) => m.id !== e.payer).map((m) => ({
        member: m,
        amount: members.length ? e.amount / members.length : 0,
        paid: !!(e.paid && e.paid[m.id]),
      }));

  const chips = debtors.length ? debtors.map((d) => {
    const btn = unlocked
      ? `<button class="pay-btn ${d.paid ? "done" : ""}" data-pay="${e.id}" data-mem="${d.member.id}" title="${d.paid ? "Huỷ đã trả" : "Đánh dấu đã trả"}">${d.paid ? "✓" : "○"}</button>`
      : "";
    return `<span class="debtor ${d.paid ? "paid" : ""}">${esc(d.member.name)} <span class="amt">${fmtMoney(d.amount)}</span>${btn}</span>`;
  }).join("") : "";

  const actions = unlocked ? `
    <div class="expense-actions">
      <button class="btn" data-edit="${e.id}">Sửa</button>
      <button class="btn danger" data-del="${e.id}">Xoá</button>
    </div>` : "";

  return `
    <div class="expense" data-id="${e.id}">
      <div class="expense-head">
        <span class="expense-title">${esc(e.title)}</span>
        <span class="expense-amount">${fmtMoney(e.amount)}</span>
      </div>
      <div class="expense-meta">
        <span class="badge">${e.split === "one" ? "Cho 1 người" : "Chia đều"}</span>
        <span>${esc(payer.name)} trả</span>
      </div>
      ${chips ? `<div class="debtors">${chips}</div>` : ""}
      ${actions}
    </div>`;
}

// ---------------- members ----------------
function renderMembers() {
  const s = getState();
  const unlocked = isUnlocked();

  const rows = s.members.map((m) => {
    const spent = s.expenses.filter((e) => e.payer === m.id).reduce((t, e) => t + e.amount, 0);
    const removeBtn = unlocked ? `<button class="btn danger" data-mdel="${m.id}">Xoá</button>` : "";
    return `
      <div class="member-row">
        <span><span class="member-avatar">${esc(m.name[0] || "?")}</span>${esc(m.name)} <span style="color:var(--text-dim);font-size:12px">· đã chi ${fmtMoney(spent)}</span></span>
        ${removeBtn}
      </div>`;
  }).join("") || '<div class="empty">Chưa có thành viên</div>';

  const add = unlocked ? `
    <form class="member-add expense-form" id="memberForm">
      <div class="field" style="flex:1;">
        <label for="mName">Tên thành viên</label>
        <input class="input" id="mName" required placeholder="VD: cuba">
      </div>
      <div class="field">
        <button class="btn primary" type="submit">Thêm</button>
      </div>
    </form>` : "";

  $view.innerHTML = `
    ${add}
    <div class="card">
      <h3 class="card-title">Thành viên (${s.members.length})</h3>
      ${rows}
    </div>`;

  const form = document.getElementById("memberForm");
  if (form) form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    await addMember(ev.target.mName.value.trim());
    toast("Đã thêm thành viên");
    render();
  });
}

// ---------------- events ----------------
function bindEvents() {
  document.getElementById("tabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;
    view = btn.dataset.view;
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === btn));
    render();
  });

  document.getElementById("lockBtn").addEventListener("click", () => {
    if (isUnlocked()) {
      logout().then(() => {
        render();
        toast("Đã đăng xuất");
      });
    } else {
      openLoginModal();
    }
  });

  $view.addEventListener("click", async (e) => {
    const payBtn = e.target.closest("[data-pay]");
    if (payBtn) {
      await togglePaid(payBtn.dataset.pay, payBtn.dataset.mem);
      render();
      return;
    }
    const del = e.target.closest("[data-del]");
    if (del) {
      confirmAction("Xoá khoản chi này?", async () => {
        await removeExpense(del.dataset.del);
        if (editingId === del.dataset.del) editingId = null;
        render();
      });
      return;
    }
    const edit = e.target.closest("[data-edit]");
    if (edit) {
      editingId = edit.dataset.edit;
      view = "expenses";
      document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === "expenses"));
      render();
      return;
    }
    const mdel = e.target.closest("[data-mdel]");
    if (mdel) {
      confirmAction("Xoá thành viên này? (chi tiêu của họ vẫn còn)", async () => {
        await removeMember(mdel.dataset.mdel);
        render();
      });
      return;
    }
    const cancel = e.target.closest("#cancelEdit");
    if (cancel) {
      editingId = null;
      render();
    }
  });

  document.addEventListener("change", async (e) => {
    if (e.target && e.target.id === "monthSel") {
      selMonth = e.target.value;
      render();
    }
  });
}

// ---------------- Login modal ----------------
function openLoginModal() {
  const existing = document.getElementById("loginModal");
  if (existing) existing.remove();

  const configured = isAuthConfigured();
  const modal = document.createElement("div");
  modal.id = "loginModal";
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal">
      <h3>Đăng nhập để chỉnh sửa</h3>
      <p class="hint">${configured ? "Chỉ admin có tài khoản được cấu hình trên Firebase mới sửa được." : "Chưa cấu hình Firebase trong js/config.js — đăng nhập chưa hoạt động."}</p>
      <input class="input" id="loginEmail" type="email" value="${esc(DEFAULT_LOGIN_EMAIL)}" autocomplete="email" ${configured ? "" : "disabled"}>
      <input class="input" id="loginPass" type="password" placeholder="Mật khẩu" autocomplete="current-password" ${configured ? "" : "disabled"}>
      <p class="err" id="loginErr"></p>
      <div class="modal-actions">
        <button class="btn" id="loginCancel">Huỷ</button>
        <button class="btn primary" id="loginOk" ${configured ? "" : "disabled"}>Đăng nhập</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  if (!configured) return;

  const emailEl = modal.querySelector("#loginEmail");
  const passEl = modal.querySelector("#loginPass");
  const err = modal.querySelector("#loginErr");
  passEl.disabled = false;
  if (emailEl.value) passEl.focus();
  else emailEl.focus();

  async function submit() {
    const email = emailEl.value.trim();
    const pass = passEl.value;
    if (!email || !pass) return (err.textContent = "Nhập email và mật khẩu.");
    err.textContent = "";
    loginOk.disabled = true;
    try {
      await login(email, pass);
      close();
      toast("Đã đăng nhập");
      render();
      try {
        await syncToServer();
      } catch (e) {
        console.warn("sync failed", e);
      }
    } catch (e) {
      err.textContent = e.code === "auth/invalid-credential" ? "Email hoặc mật khẩu sai" : "Đăng nhập thất bại";
      loginOk.disabled = false;
    }
  }

  function close() {
    modal.remove();
    document.removeEventListener("keydown", onKey);
  }
  function onKey(ev) {
    if (ev.key === "Enter") submit();
    if (ev.key === "Escape") close();
  }
  document.addEventListener("keydown", onKey);

  const loginOk = modal.querySelector("#loginOk");
  loginOk.addEventListener("click", submit);
  modal.querySelector("#loginCancel").addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
}

// ---------------- boot ----------------
(async () => {
  await init();
  render();
  bindEvents();
  subscribe(() => render());
  subscribeAuth(() => render());
  initAuth().catch((e) => console.warn("auth init failed", e));
})();