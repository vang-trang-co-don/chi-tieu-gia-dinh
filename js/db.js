import { FIREBASE_CONFIG, isFirebaseConfigured } from "./config.js";

const LS_KEY = "family_expense_data";
const LS_MIGRATED = "family_expense_migrated";

let listeners = [];
let state = null;
let online = false;
let unsub = null;
let app = null;
let db = null;
let loaded = false;

async function getApp() {
  if (app) return app;
  const { initializeApp } = await import("firebase/app");
  app = initializeApp(FIREBASE_CONFIG);
  return app;
}

async function getDb() {
  if (db) return db;
  const { getDatabase } = await import("firebase/database");
  db = getDatabase(await getApp());
  return db;
}

async function seedFromJson() {
  try {
    const res = await fetch("data.json");
    const json = await res.json();
    return { v: json.data.v || 1, members: json.data.members || [], expenses: json.data.expenses || [] };
  } catch {
    return { v: 1, members: [], expenses: [] };
  }
}

// RTDB lưu JSON array thành object { "0": ..., "1": ... }.
// Hàm này đưa lại về array, đồng thời vứt các entry rác (empty/không có title).
function toArray(obj) {
  if (Array.isArray(obj)) return obj;
  if (!obj || typeof obj !== "object") return [];
  const keys = Object.keys(obj).sort((a, b) => (isNaN(a) ? 1 : isNaN(b) ? -1 : Number(a) - Number(b)));
  return keys
    .map((k) => obj[k])
    .filter((v) => v && typeof v === "object" && (v.id || v.title || v.amount));
}

function normalize(raw) {
  if (!raw) return { v: 1, members: [], expenses: [] };
  return {
    v: raw.v === 1 ? 1 : undefined,
    members: toArray(raw.members),
    expenses: toArray(raw.expenses),
  };
}

// Migration dữ liệu cũ: trước đây amount lưu đơn vị ngàn (13 = 13k).
// Neu thiếu cờ v, nhân toàn bộ amount x1000 để đưa về VND, rồi đánh v=1.
function migrate(raw) {
  const n = normalize(raw);
  if (n.v === 1) return n;
  return {
    v: 1,
    members: n.members,
    expenses: n.expenses.map((e) => ({ ...e, amount: Math.round((Number(e.amount) || 0) * 1000) })),
  };
}

function loadLocal() {
  const cached = localStorage.getItem(LS_KEY);
  if (!cached) return null;
  try {
    const m = migrate(JSON.parse(cached));
    return (m.members.length || m.expenses.length) ? m : null;
  } catch {
    return null;
  }
}

function markMigrated() {
  localStorage.setItem(LS_MIGRATED, "1");
}

export async function init() {
  if (loaded) return state;
  loaded = true;

  try {
    if (isFirebaseConfigured()) {
      const { ref, onValue } = await import("firebase/database");
      const dbref = ref(await getDb(), "data");

      const snap = await new Promise((resolve, reject) => {
        onValue(dbref, (s) => resolve(s.exists() ? s.val() : null), (e) => reject(e), { onlyOnce: true });
      });

      online = true;

      // Ưu tiên dữ liệu người dùng đã nhập ở localStorage (bản thật, mới nhất)
      // nếu chưa migrate xong. Sau khi push lên Firebase thành công sẽ đánh dấu migrated.
      const local = localStorage.getItem(LS_MIGRATED) ? null : loadLocal();

      if (local) {
        state = local;
      } else if (snap) {
        state = migrate(snap);
        if (state.v !== 1) await save(state);
      } else {
        state = await seedFromJson();
        await save(state);
      }

      unsub = onValue(dbref, (s) => {
        const v = s.exists() ? s.val() : null;
        if (v) {
          state = migrate(v);
          emit();
        }
      });
      emit();
      return state;
    }
  } catch (e) {
    console.warn("Firebase init failed, falling back to offline:", e);
    online = false;
  }

  const cached = localStorage.getItem(LS_KEY);
  if (cached) {
    try {
      const raw = JSON.parse(cached);
      state = migrate(raw);
      if (state.v !== 1 && state.v !== undefined) await save(state);
    } catch { state = null; }
  }
  if (!state) state = await seedFromJson();
  emit();
  return state;
}

export async function save(data) {
  state = { v: 1, members: data.members || [], expenses: data.expenses || [] };
  if (online) {
    try {
      const { ref, set } = await import("firebase/database");
      await set(ref(await getDb(), "data"), state);
    } catch (e) {
      console.warn("Firebase write failed:", e);
    }
  } else {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }
  emit();
}

export function getState() {
  return state;
}

export function isOnline() {
  return online;
}

// Đẩy state hiện tại (có thể từ localStorage) lên Firebase — gọi sau khi login.
// Thành công thì đánh dấu đã migrate để lần sau không override lại Firebase.
export async function syncToServer() {
  if (online && state) {
    try {
      const { ref, set } = await import("firebase/database");
      const payload = { v: 1, members: state.members || [], expenses: state.expenses || [] };
      await set(ref(await getDb(), "data"), payload);
      markMigrated();
      localStorage.removeItem(LS_KEY);
    } catch (e) {
      console.warn("Firebase sync failed:", e);
      throw e;
    }
  }
}

export function subscribe(cb) {
  listeners.push(cb);
  return () => { listeners = listeners.filter((l) => l !== cb); };
}

function emit() {
  for (const cb of listeners) cb(state);
}