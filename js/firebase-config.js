// Firebase Modular SDK Initialization (Fault-Tolerant & Bulletproof)
let app = null;
let db = null;
let auth = null;

try {
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
  const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const { getAuth } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");

  const firebaseConfig = {
    apiKey: "AIzaSyBL8RJ_pabY71EtNq0HjeNWLtUNE6XoPFQ",
    authDomain: "invoice-af966.firebaseapp.com",
    projectId: "invoice-af966",
    storageBucket: "invoice-af966.firebasestorage.app",
    messagingSenderId: "583941270564",
    appId: "1:583941270564:web:ed3d4564c4f444e5e4fcb1"
  };

  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
} catch (e) {
  console.warn("Firebase CDN unreachable â€” running local fallback mode:", e);
}

// â”€â”€ Cloudflare R2 Worker Config (PROD DEPLOYED) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const R2_WORKER_URL = 'https://spinbot-upload.product-register.workers.dev';
// Secrets must stay on the server; never embed them in browser JavaScript.
export const R2_API_SECRET = '';

// â”€â”€ Resend.com API Key Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Email delivery must be performed by a server-side endpoint.
export const RESEND_API_KEY = '';

export { app, db, auth };
