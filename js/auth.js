import { FIREBASE_CONFIG, isFirebaseConfigured } from "./config.js";

let auth = null;
let signedIn = false;
let listeners = [];

export async function initAuth() {
  if (!isFirebaseConfigured()) return;
  const { initializeApp } = await import("firebase/app");
  const { getAuth, onAuthStateChanged } = await import("firebase/auth");
  const app = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  onAuthStateChanged(auth, (u) => {
    signedIn = !!u;
    emit();
  });
}

export function isUnlocked() {
  return signedIn;
}

export function isAuthConfigured() {
  return isFirebaseConfigured();
}

export async function login(email, password) {
  if (!auth) throw new Error("Firebase chưa được cấu hình trong js/config.js");
  const { signInWithEmailAndPassword } = await import("firebase/auth");
  await signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  if (!auth) return;
  const { signOut } = await import("firebase/auth");
  await signOut(auth);
}

export function subscribeAuth(cb) {
  listeners.push(cb);
  return () => { listeners = listeners.filter((l) => l !== cb); };
}

function emit() {
  for (const cb of listeners) cb(signedIn);
}