// Cấu hình Firebase (project chi-tieu-gia-dinh-a8be5)
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCMHgykNHGUIyFmP61GUOWHM2YgtOmZcKs",
  authDomain: "chi-tieu-gia-dinh-a8be5.firebaseapp.com",
  databaseURL: "https://chi-tieu-gia-dinh-a8be5-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "chi-tieu-gia-dinh-a8be5",
  storageBucket: "chi-tieu-gia-dinh-a8be5.firebasestorage.app",
  messagingSenderId: "740347248296",
  appId: "1:740347248296:web:1f9eaebf97745446464c9d"
};

// Tài khoản admin — vì nhà chỉ có 1 người trả, prefill email để khỏi nhập lại.
export const ADMIN_EMAIL = "chitieu@gmail.com";
export const DEFAULT_LOGIN_EMAIL = ADMIN_EMAIL;

export function isFirebaseConfigured() {
  return Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.databaseURL && FIREBASE_CONFIG.authDomain);
}