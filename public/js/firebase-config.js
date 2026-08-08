// Firebase Modular SDK Initialization (Fault-Tolerant & Bulletproof)
let app = null;
let db = null;
let auth = null;

try {
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
  const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const { getAuth } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");

  const firebaseConfig = {
    apiKey: window.__FIREBASE_API_KEY__ || "AIzaSyBL8RJ_pabY71EtNq0HjeNWLtUNE6XoPFQ",
    authDomain: window.__FIREBASE_AUTH_DOMAIN__ || "invoice-af966.firebaseapp.com",
    projectId: window.__FIREBASE_PROJECT_ID__ || "invoice-af966",
    storageBucket: window.__FIREBASE_STORAGE_BUCKET__ || "invoice-af966.firebasestorage.app",
    messagingSenderId: window.__FIREBASE_MESSAGING_SENDER_ID__ || "583941270564",
    appId: window.__FIREBASE_APP_ID__ || "1:583941270564:web:ed3d4564c4f444e5e4fcb1"
  };

  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
} catch (e) {
  console.warn("Firebase CDN unreachable — running local fallback mode:", e);
}

// ── Cloudflare R2 Worker Config (PROD DEPLOYED) ───────────────────
export const R2_WORKER_URL = 'https://spinbot-upload.product-register.workers.dev';
export const R2_API_SECRET = 'spinbot_upload_secret_2026';

// ── Resend.com API Key Config ──────────────────────────────────────
export const RESEND_API_KEY = '';

export { app, db, auth };
