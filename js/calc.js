// Tính toán khoản nợ
// split === "one": target nợ payer toàn bộ amount (nếu chưa paid)
// split === "equal": mỗi member (kể cả payer) chịu amount / N (trả về cho payer phần của họ)

export function expenseDebtors(expense, members) {
  const payer = members.find((m) => m.id === expense.payer);
  const debtors = [];

  if (expense.split === "one") {
    const t = members.find((m) => m.id === expense.target);
    if (t && t.id !== expense.payer && !(expense.paid && expense.paid[t.id])) {
      debtors.push({ member: t, amount: expense.amount });
    }
    return debtors;
  }

  // equal: cả nhà, trừ payer
  const perHead = expense.amount / members.length;
  for (const m of members) {
    if (m.id === expense.payer) continue;
    if (expense.paid && expense.paid[m.id]) continue;
    debtors.push({ member: m, amount: perHead });
  }
  return debtors;
}

// Nợ ròng theo cặp (A nợ B). Trả mảng [{from, to, amount}] amount > 0 (giá làm tròn).
export function computeBalance(expenses, members) {
  const owe = {}; // key "fromId->toId" -> amount

  for (const e of expenses) {
    const payer = members.find((m) => m.id === e.payer);
    if (!payer) continue;
    for (const d of expenseDebtors(e, members)) {
      const key = `${d.member.id}->${payer.id}`;
      owe[key] = (owe[key] || 0) + d.amount;
    }
  }

  // trừ nợ ngược chiều
  const net = [];
  const seen = new Set();
  for (const [key, amt] of Object.entries(owe)) {
    if (seen.has(key)) continue;
    const [a, b] = key.split("->");
    const revKey = `${b}->${a}`;
    seen.add(key);
    seen.add(revKey);
    const diff = Math.round((amt - (owe[revKey] || 0)) * 100) / 100;
    const from = members.find((m) => m.id === a);
    const to = members.find((m) => m.id === b);
    if (!from || !to || diff === 0) continue;
    if (diff > 0) net.push({ from, to, amount: diff });
    else net.push({ from: to, to: from, amount: -diff });
  }

  return net.sort((x, y) => y.amount - x.amount);
}

export function totalsByMonth(expenses, members, month) {
  const list = expenses.filter((e) => e.date.startsWith(month));
  return computeBalance(list, members);
}

export function monthStats(expenses, theMonth) {
  const list = expenses.filter((e) => e.date.startsWith(theMonth));
  const total = list.reduce((s, e) => s + e.amount, 0);
  return { list, total, count: list.length };
}

export function availableMonths(expenses) {
  const set = new Set(expenses.map((e) => e.date.slice(0, 7)));
  return [...set].sort().reverse();
}