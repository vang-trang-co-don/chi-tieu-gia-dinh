import { getState, save } from "./db.js";

export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function addExpense(data) {
  const s = getState();
  const expense = { id: genId(), ...data, paid: data.paid || {} };
  await save({ ...s, expenses: [...s.expenses, expense] });
  return expense;
}

export async function updateExpense(id, patch) {
  const s = getState();
  await save({
    ...s,
    expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)),
  });
}

export async function removeExpense(id) {
  const s = getState();
  await save({ ...s, expenses: s.expenses.filter((e) => e.id !== id) });
}

export async function togglePaid(expenseId, memberId) {
  const s = getState();
  await save({
    ...s,
    expenses: s.expenses.map((e) => {
      if (e.id !== expenseId) return e;
      const paid = { ...(e.paid || {}) };
      if (paid[memberId]) delete paid[memberId];
      else paid[memberId] = true;
      return { ...e, paid };
    }),
  });
}

export async function addMember(name) {
  const s = getState();
  const member = { id: genId(), name };
  await save({ ...s, members: [...s.members, member] });
  return member;
}

export async function removeMember(id) {
  const s = getState();
  await save({ ...s, members: s.members.filter((m) => m.id !== id) });
}

export async function updateMember(id, name) {
  const s = getState();
  await save({ ...s, members: s.members.map((m) => (m.id === id ? { ...m, name } : m)) });
}