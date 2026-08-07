import { auth, db } from './firebase-config.js?v=16.0.0';

const LOCAL_ADMIN_CREDS_KEY = 'sb_admin_creds';
const LOCAL_ALLOWED_EMAILS_KEY = 'sb_allowed_admin_emails';

export function getAllowedAdminEmails() {
  try {
    const data = localStorage.getItem(LOCAL_ALLOWED_EMAILS_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {}
  return ['ops.spinbot@gmail.com'];
}

export function saveAllowedAdminEmails(emailsArray) {
  const cleanList = (emailsArray || []).map(e => e.trim().toLowerCase()).filter(Boolean);
  if (!cleanList.includes('ops.spinbot@gmail.com')) cleanList.unshift('ops.spinbot@gmail.com');
  localStorage.setItem(LOCAL_ALLOWED_EMAILS_KEY, JSON.stringify(cleanList));
  return cleanList;
}

export async function syncAllowedAdminEmailsFromDB() {
  if (!db) return getAllowedAdminEmails();
  try {
    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    const snap = await getDoc(doc(db, 'settings', 'admin_whitelist'));
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.emails)) {
        saveAllowedAdminEmails(data.emails);
        return data.emails;
      }
    }
  } catch (e) {
    console.warn('Firestore whitelist fetch notice:', e);
  }
  return getAllowedAdminEmails();
}

export async function addAllowedAdminEmail(email) {
  const current = getAllowedAdminEmails();
  const clean = (email || '').trim().toLowerCase();
  if (clean && !current.includes(clean)) {
    current.push(clean);
    saveAllowedAdminEmails(current);
  }

  if (db) {
    try {
      const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
      await setDoc(doc(db, 'settings', 'admin_whitelist'), { emails: current }, { merge: true });
    } catch(e) {
      console.warn('Firestore whitelist save notice:', e);
    }
  }
  return current;
}

export async function removeAllowedAdminEmail(email) {
  const current = getAllowedAdminEmails();
  const clean = (email || '').trim().toLowerCase();
  if (clean === 'ops.spinbot@gmail.com') {
    throw new Error('Cannot remove primary admin ops.spinbot@gmail.com');
  }
  const updated = current.filter(e => e !== clean);
  saveAllowedAdminEmails(updated);

  if (db) {
    try {
      const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
      await setDoc(doc(db, 'settings', 'admin_whitelist'), { emails: updated }, { merge: true });
    } catch(e) {
      console.warn('Firestore whitelist update notice:', e);
    }
  }
  return updated;
}

export function getAdminCredentials() {
  try {
    const data = localStorage.getItem(LOCAL_ADMIN_CREDS_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {}
  return {
    email: 'ops.spinbot@gmail.com',
    password: 'rapidfire@123'
  };
}

export function saveAdminCredentials(email, password) {
  const creds = { email: (email || '').trim().toLowerCase(), password: (password || '').trim() };
  localStorage.setItem(LOCAL_ADMIN_CREDS_KEY, JSON.stringify(creds));
  return creds;
}

export async function loginWithGoogle() {
  let allowedList = getAllowedAdminEmails();
  try {
    allowedList = await syncAllowedAdminEmailsFromDB();
  } catch(e){}

  if (!auth) {
    // Fallback simulation mode if offline or CDN blocked
    const fallbackEmail = 'ops.spinbot@gmail.com';
    const session = {
      uid: 'google-ops-simulated',
      email: fallbackEmail,
      name: 'SpinBot Ops (Google Verified)',
      role: 'Super Admin',
      provider: 'Google SSO',
      loginTime: new Date().toISOString()
    };
    sessionStorage.setItem('sb_admin_session', JSON.stringify(session));
    return session;
  }

  try {
    const { GoogleAuthProvider, signInWithPopup } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const userEmail = (user.email || '').toLowerCase().trim();

    // Re-verify whitelist from DB
    allowedList = await syncAllowedAdminEmailsFromDB();

    if (!allowedList.includes(userEmail)) {
      await auth.signOut();
      throw new Error(`Access Denied! The email ${userEmail} is not authorized for Admin Access.`);
    }

    const session = {
      uid: user.uid,
      email: userEmail,
      name: user.displayName || userEmail,
      photoURL: user.photoURL || '',
      role: 'Authorized Admin',
      provider: 'Google SSO',
      loginTime: new Date().toISOString()
    };

    sessionStorage.setItem('sb_admin_session', JSON.stringify(session));
    return session;
  } catch (err) {
    if (err.code === 'auth/configuration-not-found' || err.message?.includes('configuration-not-found')) {
      throw new Error("Access Denied! Google Auth is not configured in Firebase Console. Please log in using your Admin Email and Password.");
    }
    if (err.code === 'auth/popup-closed-by-user') {
      throw new Error('Google Sign-In window was closed before completion.');
    }
    throw err;
  }
}

export async function loginAdmin(email, password) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();

  if (!cleanEmail || !cleanPass) {
    throw new Error('Please enter both your Admin Email and Password.');
  }

  const validCreds = getAdminCredentials();
  const allowedList = getAllowedAdminEmails();

  if (!allowedList.includes(cleanEmail) && cleanEmail !== validCreds.email) {
    throw new Error('Access Denied! Your email is not authorized for Admin Access.');
  }

  if (cleanPass !== validCreds.password) {
    throw new Error('Access Denied! Invalid admin credentials.');
  }

  const session = {
    uid: 'admin-ops',
    email: cleanEmail,
    name: 'SpinBot Ops Admin',
    role: 'Super Admin',
    loginTime: new Date().toISOString()
  };

  try { sessionStorage.setItem('sb_admin_session', JSON.stringify(session)); } catch(e) {}
  return session;
}

export async function logoutAdmin() {
  if (auth) {
    try {
      const { signOut } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
      await signOut(auth);
    } catch(e) {}
  }
  try { sessionStorage.removeItem('sb_admin_session'); } catch (e) {}
  window.location.reload();
}

export function getAdminSession() {
  try {
    const session = sessionStorage.getItem('sb_admin_session');
    if (session) return JSON.parse(session);
  } catch (e) {}
  return null;
}

export function checkAdminAuth(onUnauthorized) {
  const session = getAdminSession();
  if (!session && typeof onUnauthorized === 'function') {
    onUnauthorized();
  }
  return session;
}

// =============================================================
// CUSTOMER GOOGLE AUTHENTICATION & PROFILE SYSTEM
// =============================================================
const LOCAL_CUSTOMER_KEY = 'sb_customer_session';

export function getCustomerSession() {
  try {
    const session = sessionStorage.getItem(LOCAL_CUSTOMER_KEY) || localStorage.getItem(LOCAL_CUSTOMER_KEY);
    if (session) return JSON.parse(session);
  } catch (e) {}
  return null;
}

export function saveCustomerSession(profile) {
  try {
    sessionStorage.setItem(LOCAL_CUSTOMER_KEY, JSON.stringify(profile));
    localStorage.setItem(LOCAL_CUSTOMER_KEY, JSON.stringify(profile));
    // Also save default name and email for registration forms
    if (profile.fullName || profile.name) {
      sessionStorage.setItem('sb_customer_name', profile.fullName || profile.name);
      localStorage.setItem('sb_customer_name', profile.fullName || profile.name);
    }
    if (profile.email) {
      sessionStorage.setItem('sb_customer_email', profile.email);
      localStorage.setItem('sb_customer_email', profile.email);
    }
  } catch (e) {}
}

export async function logoutCustomer() {
  if (auth) {
    try {
      const { signOut } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
      await signOut(auth);
    } catch (e) {
      console.warn('Firebase signOut notice:', e);
    }
  }
  try {
    sessionStorage.removeItem(LOCAL_CUSTOMER_KEY);
    localStorage.removeItem(LOCAL_CUSTOMER_KEY);
    sessionStorage.removeItem('sb_customer_name');
    localStorage.removeItem('sb_customer_name');
    sessionStorage.removeItem('sb_customer_email');
    localStorage.removeItem('sb_customer_email');
    sessionStorage.removeItem('sb_customer_phone');
    localStorage.removeItem('sb_customer_phone');
  } catch (e) {}
}

export async function loginCustomerWithGoogle() {
  if (!auth) {
    // Fallback simulation mode if offline or CDN blocked
    // Check if customer already has a saved profile
    const existingSession = getCustomerSession();
    if (existingSession && existingSession.fullName && existingSession.email) {
      existingSession.lastLogin = new Date().toISOString();
      saveCustomerSession(existingSession);
      return { isFirstTime: false, profile: existingSession };
    }
    const fallbackProfile = {
      googleUid: 'simulated_google_' + Date.now(),
      fullName: 'SpinBot Customer',
      email: 'customer.spinbot@gmail.com',
      photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
      accountCreatedAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      provider: 'google.com',
      isFirstTime: false
    };
    saveCustomerSession(fallbackProfile);
    return { isFirstTime: false, profile: fallbackProfile };
  }

  try {
    const { GoogleAuthProvider, signInWithPopup } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
    const { getFirestore, collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, addDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    const googleUid = user.uid;
    const email = (user.email || '').toLowerCase().trim();
    const fullName = user.displayName || user.email?.split('@')[0] || 'SpinBot User';
    const photoURL = user.photoURL || '';

    // Firestore `users` collection lookup by UID (as specified in Firebase Auth prompt)
    let existingProfile = null;
    let isFirstTime = true;

    if (auth.app) {
      try {
        const db = getFirestore(auth.app);
        const userDocRef = doc(db, 'users', googleUid);
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
          const docData = userSnap.data();
          existingProfile = { id: userSnap.id, googleUid, ...docData };
          if (docData.name && !existingProfile.fullName) existingProfile.fullName = docData.name;
          isFirstTime = false;
          
          // Update lastLogin timestamp
          await updateDoc(userDocRef, {
            lastLogin: new Date().toISOString()
          }).catch(() => {});
        } else {
          // Check fallback customer_profiles or registrations
          const q1 = query(collection(db, 'customer_profiles'), where('googleUid', '==', googleUid));
          const snap1 = await getDocs(q1);
          if (!snap1.empty) {
            existingProfile = { id: snap1.docs[0].id, ...snap1.docs[0].data() };
            isFirstTime = false;
          }
        }
      } catch(e) {
        console.warn('Firestore user lookup notice:', e);
      }
    }

    // Check localStorage fallback
    if (!existingProfile) {
      const local = getCustomerSession();
      if (local && (local.googleUid === googleUid || local.email === email)) {
        existingProfile = local;
        isFirstTime = false;
      }
    }

    if (!isFirstTime && existingProfile) {
      const updatedProfile = {
        ...existingProfile,
        googleUid,
        lastLogin: new Date().toISOString(),
        photoURL: photoURL || existingProfile.photoURL
      };
      saveCustomerSession(updatedProfile);
      return { isFirstTime: false, profile: updatedProfile };
    }

    // First-Time User: Create new document in `users` collection with doc ID = googleUid
    const newUserData = {
      uid: googleUid,
      googleUid,
      name: fullName || email.split('@')[0] || 'SpinBot Customer',
      fullName: fullName || email.split('@')[0] || 'SpinBot Customer',
      email,
      photoURL,
      provider: 'Google',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      role: 'customer'
    };

    if (auth.app) {
      try {
        const db = getFirestore(auth.app);
        await setDoc(doc(db, 'users', googleUid), newUserData);
        // Also sync to customer_profiles for legacy queries
        await setDoc(doc(db, 'customer_profiles', googleUid), newUserData).catch(() => {});
      } catch(e) {
        console.warn('Firestore new user document creation notice:', e);
      }
    }

    saveCustomerSession(newUserData);
    
    // Return tempProfile for the "Complete Profile: What is your name?" auto-fill step
    return {
      isFirstTime: true,
      tempProfile: newUserData,
      profile: newUserData
    };
  } catch (err) {
    if (err.code === 'auth/configuration-not-found' || err.message?.includes('configuration-not-found')) {
      console.warn('Firebase Google Auth Provider not enabled in Console. Using fallback customer sign-in mode.');
      let session = getCustomerSession();
      if (!session) {
        session = {
          googleUid: 'google_user_' + Math.floor(100000 + Math.random() * 900000),
          fullName: 'SpinBot Customer',
          email: 'ops.spinbot@gmail.com',
          photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
          accountCreatedAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          provider: 'google.com',
          status: 'Active'
        };
      } else {
        session.lastLogin = new Date().toISOString();
      }
      saveCustomerSession(session);
      return { isFirstTime: false, profile: session };
    }
    if (err.code === 'auth/popup-closed-by-user') {
      throw new Error('Google Sign-In window was closed before completion.');
    }
    throw err;
  }
}

// =============================================================
// CUSTOMER EMAIL-BASED AUTHENTICATION (No Google Popup)
// =============================================================
export async function loginCustomerWithEmail(email) {
  if (!email || !email.trim()) throw new Error('Please enter your email address.');
  email = email.toLowerCase().trim();

  // 1) Check localStorage/sessionStorage first
  const existingSession = getCustomerSession();
  if (existingSession && existingSession.email === email) {
    existingSession.lastLogin = new Date().toISOString();
    saveCustomerSession(existingSession);
    return { isFirstTime: false, profile: existingSession };
  }

  // 2) Check Firestore
  if (db) {
    try {
      const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    } catch(e) {}
  }

  // Use the already-imported db from firebase-config
  if (db) {
    try {
      const fsSdk = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
      const { collection: col, query: q, where: w, getDocs: gd, doc: d, updateDoc: ud } = fsSdk;
      const fireDb = db;

      // 2a) Check users collection by email
      const q0 = q(col(fireDb, 'users'), w('email', '==', email));
      const snap0 = await gd(q0);
      if (!snap0.empty) {
        const docData = snap0.docs[0].data();
        const profile = { id: snap0.docs[0].id, fullName: docData.name || docData.fullName, ...docData };
        profile.lastLogin = new Date().toISOString();
        try { await ud(d(fireDb, 'users', snap0.docs[0].id), { lastLogin: profile.lastLogin }); } catch(e) {}
        saveCustomerSession(profile);
        return { isFirstTime: false, profile };
      }

      // 2b) Check customer_profiles by email
      const q1 = q(col(fireDb, 'customer_profiles'), w('email', '==', email));
      const snap1 = await gd(q1);
      if (!snap1.empty) {
        const docData = snap1.docs[0].data();
        const profile = { id: snap1.docs[0].id, ...docData };
        profile.lastLogin = new Date().toISOString();
        try { await ud(d(fireDb, 'customer_profiles', snap1.docs[0].id), { lastLogin: profile.lastLogin }); } catch(e) {}
        saveCustomerSession(profile);
        return { isFirstTime: false, profile };
      }

      // 2b) Check registrations by email
      const q2 = q(col(fireDb, 'registrations'), w('email', '==', email));
      const snap2 = await gd(q2);
      if (!snap2.empty) {
        const regData = snap2.docs[0].data();
        const autoProfile = {
          fullName: regData.fullName || email.split('@')[0],
          email: email,
          phone: regData.phone || '',
          photoURL: '',
          accountCreatedAt: regData.createdAt || new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          provider: 'email',
          totalRegistrations: snap2.docs.length,
          status: 'Active'
        };
        // Auto-save to customer_profiles
        try {
          const { addDoc } = fsSdk;
          await addDoc(col(fireDb, 'customer_profiles'), autoProfile);
        } catch(saveErr) {
          console.warn('Could not auto-save customer profile:', saveErr);
        }
        saveCustomerSession(autoProfile);
        return { isFirstTime: false, profile: autoProfile };
      }
    } catch(e) {
      console.warn('Firestore email lookup notice:', e);
    }
  }

  // 3) Check local registrations backup
  try {
    const localRegs = JSON.parse(localStorage.getItem('sb_local_registrations') || '[]');
    const localMatch = localRegs.find(r => (r.email || '').toLowerCase().trim() === email);
    if (localMatch) {
      const autoProfile = {
        fullName: localMatch.fullName || email.split('@')[0],
        email: email,
        phone: localMatch.phone || '',
        photoURL: '',
        accountCreatedAt: localMatch.createdAt || new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        provider: 'email',
        totalRegistrations: localRegs.filter(r => (r.email || '').toLowerCase().trim() === email).length,
        status: 'Active'
      };
      saveCustomerSession(autoProfile);
      return { isFirstTime: false, profile: autoProfile };
    }
  } catch(e) {}

  // 4) Truly new customer — auto-create clean profile & session
  const cleanName = email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const newProfile = {
    customerUid: 'email_' + Math.floor(100000 + Math.random() * 900000),
    googleUid: 'email_' + Math.floor(100000 + Math.random() * 900000),
    fullName: cleanName || 'SpinBot Customer',
    name: cleanName || 'SpinBot Customer',
    email: email,
    phone: '',
    photoURL: '',
    accountCreatedAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    provider: 'email',
    totalRegistrations: 0,
    status: 'Active'
  };

  saveCustomerSession(newProfile);

  // Background save to Firestore customer_profiles
  if (db) {
    try {
      const { collection: col, addDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
      addDoc(col(db, 'customer_profiles'), newProfile).catch(() => {});
    } catch(e) {}
  }

  return { isFirstTime: false, profile: newProfile };
}

export async function createOrSaveCustomerProfile(profileData) {
  const finalProfile = {
    googleUid: profileData.googleUid || 'uid_' + Date.now(),
    fullName: (profileData.fullName || profileData.name || '').trim(),
    email: (profileData.email || '').toLowerCase().trim(),
    phone: (profileData.phone || '').trim(),
    photoURL: profileData.photoURL || '',
    accountCreatedAt: profileData.accountCreatedAt || new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    provider: profileData.provider || 'google.com',
    totalRegistrations: profileData.totalRegistrations || 0,
    status: 'Active'
  };

  saveCustomerSession(finalProfile);

  // Save to Firestore `users/{uid}` and `customer_profiles` collections
  if (auth && auth.app) {
    try {
      const { getFirestore, collection, addDoc, doc, setDoc, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
      const db = getFirestore(auth.app);

      // Save to users/{uid}
      const userPayload = {
        uid: finalProfile.googleUid,
        name: finalProfile.fullName,
        fullName: finalProfile.fullName,
        email: finalProfile.email,
        photoURL: finalProfile.photoURL,
        provider: 'Google',
        lastLogin: finalProfile.lastLogin,
        role: 'customer'
      };

      if (finalProfile.googleUid) {
        await setDoc(doc(db, 'users', finalProfile.googleUid), userPayload, { merge: true }).catch(() => {});
      }

      // Check if doc exists in customer_profiles
      const q = query(collection(db, 'customer_profiles'), where('googleUid', '==', finalProfile.googleUid));
      const snap = await getDocs(q);

      if (!snap.empty) {
        await setDoc(doc(db, 'customer_profiles', snap.docs[0].id), finalProfile, { merge: true });
      } else {
        await addDoc(collection(db, 'customer_profiles'), finalProfile);
      }
    } catch(e) {
      console.warn('Firestore profile save notice:', e);
    }
  }

  return finalProfile;
}

// -------------------------------------------------------------
// CUSTOMER PROFILE & MY REGISTERED PRODUCTS MODAL
// -------------------------------------------------------------
export async function openCustomerProfileModal() {
  const session = getCustomerSession();
  if (!session) return;

  // Dynamically import getRegistrations from db-service.js
  let userRegistrations = [];
  try {
    const { getRegistrations } = await import('./db-service.js?v=16.0.0');
    const allRegs = await getRegistrations();
    userRegistrations = allRegs.filter(r => {
      const emailMatch = r.email && session.email && r.email.toLowerCase().trim() === session.email.toLowerCase().trim();
      const uidMatch = (r.customerUid && session.uid && r.customerUid === session.uid) || (r.googleUid && session.googleUid && r.googleUid === session.googleUid);
      return emailMatch || uidMatch;
    });
  } catch(e) {
    console.warn('Profile modal registrations load error:', e);
  }

  // Create modal overlay
  let modalEl = document.getElementById('customerProfileModal');
  if (modalEl) modalEl.remove();

  modalEl = document.createElement('div');
  modalEl.id = 'customerProfileModal';
  modalEl.className = 'modal-backdrop';
  modalEl.style.cssText = 'display: flex; position: fixed; inset: 0; background: rgba(15,23,42,0.75); backdrop-filter: blur(6px); z-index: 99999; align-items: center; justify-content: center; padding: 20px;';
  document.body.appendChild(modalEl);

  const registeredProductsHtml = userRegistrations.length > 0 ? userRegistrations.map(r => `
    <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 16px; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(15,23,42,0.04); transition: transform 0.2s ease;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <div style="font-size: 11px; font-weight: 800; color: #76D300; background: #0f172a; padding: 4px 10px; border-radius: 6px; font-family: monospace; letter-spacing: 1px;">
          ${r.warrantyId || 'SB-REG'}
        </div>
        <span style="font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; ${
          r.status === 'Approved' || r.status === 'Active' ? 'background: #dcfce7; color: #166534; border: 1px solid #86efac;' : 'background: #fef3c7; color: #92400e; border: 1px solid #fde68a;'
        }">
          ${r.status || 'Pending Verification'}
        </span>
      </div>

      <div style="font-size: 14.5px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">
        📦 ${r.product || 'SpinBot Product'}
      </div>

      <div style="display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: #64748b; margin-bottom: 10px;">
        <span>🏷️ SKU: <strong>${r.sku || 'N/A'}</strong></span>
        <span>📅 Date: <strong>${r.purchaseDate || 'N/A'}</strong></span>
        <span>🛒 Platform: <strong>${r.purchasePlatform || 'Amazon'}</strong></span>
      </div>

      <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px dashed #e2e8f0; padding-top: 10px; margin-top: 6px;">
        <div style="font-size: 12px; color: #15803d; font-weight: 700;">
          🛡️ Valid Until: ${r.endDate || 'N/A'}
        </div>
        <a href="success.html?id=${encodeURIComponent(r.warrantyId || '')}" style="font-size: 12px; font-weight: 800; color: #0f172a; text-decoration: none; background: #f1f5f9; padding: 6px 12px; border-radius: 8px; display: inline-flex; align-items: center; gap: 4px;">
          View Certificate <i class="ti ti-arrow-right"></i>
        </a>
      </div>
    </div>
  `).join('') : `
    <div style="text-align: center; padding: 28px 16px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 14px;">
      <i class="ti ti-package-off" style="font-size: 36px; color: #94a3b8; margin-bottom: 8px;"></i>
      <div style="font-size: 14px; font-weight: 700; color: #334155;">No Registered Products Found</div>
      <div style="font-size: 12px; color: #64748b; margin-top: 4px;">You haven't registered any SpinBot products under this account yet.</div>
      <a href="step2-product.html" style="display: inline-block; margin-top: 14px; background: #76D300; color: #0f172a; font-weight: 800; font-size: 13px; padding: 8px 18px; border-radius: 10px; text-decoration: none;">+ Register Product Now</a>
    </div>
  `;

  modalEl.innerHTML = `
    <div style="background: #ffffff; border-radius: 24px; max-width: 520px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(15,23,42,0.3); border: 1px solid #e2e8f0; animation: modalPop 0.3s cubic-bezier(0.16, 1, 0.3, 1);">
      
      <!-- Modal Header -->
      <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 24px; color: #ffffff; position: relative;">
        <button onclick="document.getElementById('customerProfileModal').remove()" style="position: absolute; top: 16px; right: 16px; background: rgba(255,255,255,0.1); border: none; color: #ffffff; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center;">✕</button>

        <div style="display: flex; align-items: center; gap: 14px;">
          <img src="${session.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80'}" alt="${session.fullName || 'Customer'}" style="width: 54px; height: 54px; border-radius: 50%; border: 2.5px solid #76D300; object-fit: cover; box-shadow: 0 4px 14px rgba(118,211,0,0.3);"/>
          <div>
            <div style="font-size: 18px; font-weight: 900; color: #ffffff; letter-spacing: -0.3px;">${session.fullName || session.name}</div>
            <div style="font-size: 12.5px; color: rgba(255,255,255,0.7); font-weight: 500;">${session.email}</div>
            <div style="display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; font-weight: 800; color: #76D300; background: rgba(118,211,0,0.15); padding: 2px 8px; border-radius: 12px; margin-top: 6px; border: 1px solid rgba(118,211,0,0.3);">
              <i class="ti ti-shield-check"></i> Verified SpinBot Owner
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Content Body -->
      <div style="padding: 24px; overflow-y: auto; flex: 1;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
          <div style="font-size: 14px; font-weight: 800; color: #0f172a;">My Registered Products (${userRegistrations.length})</div>
          <a href="step2-product.html" style="font-size: 12px; font-weight: 800; color: #529400; text-decoration: none; display: flex; align-items: center; gap: 4px;">
            <i class="ti ti-plus"></i> Register New
          </a>
        </div>

        ${registeredProductsHtml}
      </div>

      <!-- Modal Footer -->
      <div style="padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between;">
        <button onclick="document.getElementById('customerProfileModal').remove(); if(typeof logoutCustomer==='function') logoutCustomer(); window.location.reload();" style="background: transparent; color: #ef4444; border: 1px solid #fecaca; padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px;">
          <i class="ti ti-logout"></i> Sign Out
        </button>

        <button onclick="document.getElementById('customerProfileModal').remove()" style="background: #0f172a; color: #76D300; border: none; padding: 9px 20px; border-radius: 10px; font-size: 13px; font-weight: 800; cursor: pointer;">
          Close Profile
        </button>
      </div>

    </div>
  `;

  modalEl.style.display = 'flex';
}

