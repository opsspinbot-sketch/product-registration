// Firestore & Pure Real-Time Data Services (Fault-Tolerant)
import { db, RESEND_API_KEY } from './firebase-config.js?v=16.0.0';
import { 
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, setDoc, query, where, orderBy, limit, serverTimestamp, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Helper: HTML Escaper for XSS Prevention
export function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helper: LocalStorage Backup Keys (Quota-Safe)
const LOCAL_REGS_KEY = 'sb_local_registrations';
const LOCAL_CUSTS_KEY = 'sb_local_customers';
const LOCAL_PRODS_KEY = 'sb_local_products';

function getLocalData(key) {
  try { 
    const data = localStorage.getItem(key);
    const parsed = data ? JSON.parse(data) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) { return []; }
}

function saveLocalData(key, item) {
  try {
    const list = getLocalData(key);
    list.unshift(item);
    if (list.length > 50) list.length = 50; // Cap local cache to 50 items
    localStorage.setItem(key, JSON.stringify(list));
  } catch (e) {
    console.warn(`LocalStorage save warning for ${key}:`, e);
  }
}

// Helper: Generate Clean Ticket IDs (e.g. Ticket #1234)
export function generateUniqueId(prefix = 'SB-') {
  const d = new Date();
  const dateStr = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  if (prefix === 'SB-') {
    return `SB-${dateStr}-${randomNum}`;
  }
  return `${prefix}${randomNum}`;
}

// Helper: Safely Format Date Strings without UTC Timezone Drift
export function formatDateSafely(dateInput, options = { day: '2-digit', month: 'long', year: 'numeric' }) {
  if (!dateInput) return 'N/A';
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    const [year, month, day] = dateInput.trim().split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    return dateObj.toLocaleDateString('en-IN', options);
  }
  const dObj = new Date(dateInput);
  if (isNaN(dObj.getTime())) return String(dateInput);
  return dObj.toLocaleDateString('en-IN', options);
}

// Helper: Calculate Start & End Date and Validity
export function calculateWarrantyDates(purchaseDateStr, warrantyMonths = 12) {
  // Parse date-only values in local time. `new Date('YYYY-MM-DD')` is UTC and
  // can otherwise move the displayed date back a day in western timezones.
  let startDate;
  if (typeof purchaseDateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(purchaseDateStr.trim())) {
    const [year, month, day] = purchaseDateStr.trim().split('-').map(Number);
    startDate = new Date(year, month - 1, day);
  } else {
    startDate = new Date(purchaseDateStr);
  }
  if (isNaN(startDate.getTime())) {
    startDate = new Date();
  }
  const months = Math.max(1, parseInt(warrantyMonths, 10) || 12);
  const endDate = new Date(startDate);
  // Clamp to the last valid day of the target month (e.g. Jan 31 + one month
  // is Feb 28/29, not a date in March).
  const startDay = startDate.getDate();
  endDate.setDate(1);
  endDate.setMonth(endDate.getMonth() + months);
  const lastDayOfTargetMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();
  endDate.setDate(Math.min(startDay, lastDayOfTargetMonth));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = endDate.getTime() - today.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  const isExpired = daysRemaining === 0;

  const rawMonthsLeft = isExpired ? 0 : Math.ceil(daysRemaining / 30.4375);
  const monthsLeft = Math.min(months, Math.max(0, rawMonthsLeft));

  const toLocalIsoDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const startIso = toLocalIsoDate(startDate);
  const endIso = toLocalIsoDate(endDate);

  return {
    startDate: startIso,
    endDate: endIso,
    months,
    daysRemaining,
    monthsLeft,
    isExpired
  };
}

// Log Activity Event
export async function logActivity(title, description, type = 'info', metadata = {}) {
  if (!db) return;
  try {
    await addDoc(collection(db, 'activity'), {
      title,
      description,
      type,
      metadata,
      createdAt: serverTimestamp ? serverTimestamp() : new Date().toISOString()
    });
  } catch (e) {
    console.warn('Failed to log activity:', e);
  }
}

// Official Product Catalog Defaults (for dropdowns & catalog management)
export const DEFAULT_CATALOG_PRODUCTS = [
  { id: "prod_1", name: "SpinBot IceDot Mag v1 Mobile Cooler", sku: "SB-ICEDOT-MAG1", brand: "SpinBot", warrantyPeriod: "12 Months", status: "Active", category: "Coolers", image: "https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=150&auto=format&fit=crop&q=80" },
  { id: "prod_2", name: "SpinBot BattleMods Apex Gaming Trigger", sku: "SB-BM-APEX", brand: "SpinBot", warrantyPeriod: "6 Months", status: "Active", category: "Gaming Triggers", image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=150&auto=format&fit=crop&q=80" },
  { id: "prod_3", name: "SpinBot BattleBudz C10 Type-C Earphone", sku: "SB-BB-C10", brand: "SpinBot", warrantyPeriod: "12 Months", status: "Active", category: "Earphones & Headphones", image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=150&auto=format&fit=crop&q=80" },
  { id: "prod_4", name: "SpinBot Airflow X10 Laptop Cooling Pad", sku: "SB-AF-X10", brand: "SpinBot", warrantyPeriod: "12 Months", status: "Active", category: "Laptop Cooling", image: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=150&auto=format&fit=crop&q=80" },
  { id: "prod_5", name: "SpinBot Rage MK87 Mechanical Keyboard", sku: "SB-MK87", brand: "SpinBot", warrantyPeriod: "24 Months", status: "Active", category: "Keyboards", image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=150&auto=format&fit=crop&q=80" },
  { id: "prod_6", name: "SpinBot HX500 Gaming Headset", sku: "SB-HX500", brand: "SpinBot", warrantyPeriod: "12 Months", status: "Active", category: "Earphones & Headphones", image: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=150&auto=format&fit=crop&q=80" }
];
export const DEFAULT_MARKETPLACES = [
  "Amazon",
  "Flipkart",
  "SpinBot Official Store",
  "Retail Store / Dealer",
  "Other Online Store"
];
// -------------------------------------------------------------
// 1. REGISTRATIONS COLLECTION (REAL-TIME & LIVE DATA)
// -------------------------------------------------------------
export async function createWarrantyRegistration(data, invoiceFile = null) {
  let invoiceUrl = data.invoiceUrl || '';

  if (!invoiceUrl && invoiceFile) {
    try {
      invoiceUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result || '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(invoiceFile);
      });
    } catch (e) { }
  }

  const warrantyId = generateUniqueId('SB-');
  const warrantyMonths = data.warrantyMonths || 12;
  const dates = calculateWarrantyDates(data.purchaseDate, warrantyMonths);

  const regData = {
    warrantyId,
    customerUid: data.customerUid || data.googleUid || '',
    fullName: data.fullName,
    email: data.email || '',
    phone: data.phone,
    product: data.product,
    productImage: data.productImage || '',
    sku: data.sku || 'SKU-GENERIC',
    brand: data.brand || 'SpinBot',
    purchaseDate: data.purchaseDate,
    purchasePlatform: data.purchasePlatform || 'Direct Store',
    serialNumber: data.serialNumber || 'N/A',
    invoiceNumber: data.invoiceNumber || 'N/A',
    invoiceUrl: invoiceUrl,
    warrantyPeriod: `${warrantyMonths} Months`,
    startDate: dates.startDate,
    endDate: dates.endDate,
    daysRemaining: dates.daysRemaining,
    status: 'Pending',
    termsAccepted: true,
    createdAt: new Date().toISOString()
  };

  const localId = 'loc_' + Date.now();
  regData.id = localId;

  // Compact backup for localStorage to prevent QuotaExceededError on large Base64 images
  const localBackup = { ...regData };
  if (localBackup.invoiceUrl && localBackup.invoiceUrl.startsWith('data:')) {
    if (localBackup.invoiceUrl.length > 50000) {
      localBackup.invoiceUrl = localBackup.invoiceUrl.slice(0, 200) + '...[local_preview_truncated]';
    }
  }
  saveLocalData(LOCAL_REGS_KEY, localBackup);

  if (db) {
    try {
      const fsPromise = addDoc(collection(db, 'registrations'), regData);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore Sync Timeout')), 2500));
      const docRef = await Promise.race([fsPromise, timeoutPromise]);
      regData.id = docRef.id;
      // Keep the offline record in sync with its cloud document so subsequent
      // status updates target the correct Firestore registration.
      try {
        const localList = getLocalData(LOCAL_REGS_KEY);
        localStorage.setItem(LOCAL_REGS_KEY, JSON.stringify(localList.map(item =>
          item.id === localId ? { ...item, id: docRef.id } : item
        )));
      } catch (e) { }
    } catch (e) {
      console.warn('Firestore write fallback active:', e);
      regData.id = 'loc_' + Date.now();
    }
  } else {
    regData.id = 'loc_' + Date.now();
  }

  upsertCustomer({
    name: data.fullName,
    email: data.email || '',
    phone: data.phone
  }).catch(() => { });

  logActivity('New Warranty Registration', `Warranty ${warrantyId} submitted by ${data.fullName}`).catch(() => { });

  // Send confirmation email (non-blocking — never fails the registration)
  sendRegistrationConfirmationEmail(regData).catch(() => {});

  return regData;
}

// -------------------------------------------------------------
// EMAIL CONFIRMATION — Firebase "Trigger Email" Extension
// Writes to `mail` collection → Firebase Extension picks it up
// and sends via your configured SMTP / SendGrid / Gmail
// -------------------------------------------------------------
export async function sendRegistrationConfirmationEmail(reg) {
  if (!reg.email) return; // No email provided — skip silently

  const endDateFormatted = reg.endDate
    ? new Date(reg.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'N/A';
  const purchaseDateFormatted = reg.purchaseDate
    ? new Date(reg.purchaseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'N/A';

  const mailDoc = {
    to: reg.email,
    message: {
      subject: `✅ Product Registration Received — ${reg.warrantyId} | SpinBot`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;">

  <!-- Outer Wrapper (Portal Light Gray Background) -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:36px 16px;">
    <tr><td align="center">

      <!-- Pre-header text (hidden) -->
      <div style="display:none;max-height:0;overflow:hidden;color:#f8fafc;font-size:1px;">
        Your SpinBot product registration has been received. Registration ID: ${reg.warrantyId}.
      </div>

      <!-- Main Card Container (Portal White Card with Rounded Corners) -->
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 10px 25px -5px rgba(15,23,42,0.06);">

        <!-- ═══════ BRAND HEADER — Portal Dark Slate ═══════ -->
        <tr>
          <td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:32px 40px;text-align:center;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <div style="font-size:30px;font-weight:900;letter-spacing:-1px;color:#ffffff;line-height:1;">Spin<span style="color:#76D300;">Bot</span></div>
                  <div style="font-size:10px;color:rgba(255,255,255,0.45);margin-top:6px;letter-spacing:0.2em;text-transform:uppercase;font-weight:700;">Product Registration Portal</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ═══════ HERO — Success Accent Banner ═══════ -->
        <tr>
          <td style="background:#f7fee7;border-bottom:2px solid #76D300;padding:36px 40px;text-align:center;">
            <div style="width:60px;height:60px;margin:0 auto 16px;background:#76D300;border-radius:50%;line-height:60px;font-size:30px;color:#0f172a;font-weight:bold;box-shadow:0 6px 20px rgba(118,211,0,0.3);">
              ✓
            </div>
            <h1 style="font-size:23px;font-weight:800;color:#0f172a;margin:0 0 8px;letter-spacing:-0.5px;">
              Product Registration Received!
            </h1>
            <p style="font-size:14px;color:#475569;margin:0;line-height:1.5;">
              Hi <strong style="color:#0f172a;">${reg.fullName}</strong>, thank you for registering your SpinBot product. Your details have been successfully recorded.
            </p>
          </td>
        </tr>

        <!-- ═══════ REGISTRATION ID HIGHLIGHT CARD ═══════ -->
        <tr>
          <td style="padding:28px 40px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:14px;overflow:hidden;">
              <tr>
                <td style="padding:22px 28px;text-align:center;">
                  <div style="font-size:10px;font-weight:800;color:#76D300;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px;">Registration ID</div>
                  <div style="font-size:26px;font-weight:900;color:#ffffff;letter-spacing:3px;font-family:'Courier New',monospace;">${reg.warrantyId}</div>
                  <div style="font-size:11px;color:#94a3b8;margin-top:6px;">Keep this Registration ID for all future support queries</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ═══════ REGISTRATION DETAILS GRID ═══════ -->
        <tr>
          <td style="padding:28px 40px 0;">
            <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid #f1f5f9;">Registration Details</div>

            <table width="100%" cellpadding="0" cellspacing="0">
              <!-- Row 1: Product + SKU -->
              <tr>
                <td width="50%" style="padding:0 6px 12px 0;vertical-align:top;">
                  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;">
                    <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">📦 Product</div>
                    <div style="font-size:13.5px;font-weight:700;color:#0f172a;line-height:1.4;">${reg.product}</div>
                  </div>
                </td>
                <td width="50%" style="padding:0 0 12px 6px;vertical-align:top;">
                  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;">
                    <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">🏷️ SKU / Model</div>
                    <div style="font-size:13.5px;font-weight:700;color:#0f172a;font-family:'Courier New',monospace;">${reg.sku || 'N/A'}</div>
                  </div>
                </td>
              </tr>
              <!-- Row 2: Purchase Date + Platform -->
              <tr>
                <td width="50%" style="padding:0 6px 12px 0;vertical-align:top;">
                  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;">
                    <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">📅 Purchase Date</div>
                    <div style="font-size:13.5px;font-weight:700;color:#0f172a;">${purchaseDateFormatted}</div>
                  </div>
                </td>
                <td width="50%" style="padding:0 0 12px 6px;vertical-align:top;">
                  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;">
                    <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">🛒 Purchase Platform</div>
                    <div style="font-size:13.5px;font-weight:700;color:#0f172a;">${reg.purchasePlatform || 'N/A'}</div>
                  </div>
                </td>
              </tr>
              <!-- Row 3: Registration Period + Valid Until -->
              <tr>
                <td width="50%" style="padding:0 6px 12px 0;vertical-align:top;">
                  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;">
                    <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">⏱️ Registration Period</div>
                    <div style="font-size:13.5px;font-weight:700;color:#0f172a;">${reg.warrantyPeriod}</div>
                  </div>
                </td>
                <td width="50%" style="padding:0 0 12px 6px;vertical-align:top;">
                  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 16px;">
                    <div style="font-size:10px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">🛡️ Coverage Until</div>
                    <div style="font-size:14px;font-weight:800;color:#166534;">${endDateFormatted}</div>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ═══════ STATUS BADGE BANNER ═══════ -->
        <tr>
          <td style="padding:4px 40px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;">
              <tr>
                <td style="padding:16px 20px;text-align:center;">
                  <div style="display:inline-block;background:#f59e0b;color:#ffffff;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;padding:4px 14px;border-radius:16px;margin-bottom:6px;">Pending Verification</div>
                  <div style="font-size:12.5px;color:#92400e;line-height:1.5;margin-top:4px;">
                    Our team will verify your product purchase details within <strong>24–48 hours</strong>.
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ═══════ WHAT'S NEXT ═══════ -->
        <tr>
          <td style="padding:0 40px 28px;">
            <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid #f1f5f9;">What Happens Next?</div>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:6px 0;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width:32px;vertical-align:top;">
                        <div style="width:24px;height:24px;background:rgba(118,211,0,0.15);border:1px solid rgba(118,211,0,0.4);border-radius:6px;text-align:center;line-height:24px;font-size:12px;color:#529400;font-weight:800;">1</div>
                      </td>
                      <td style="padding-left:10px;vertical-align:top;">
                        <div style="font-size:13px;font-weight:700;color:#0f172a;">Document Verification</div>
                        <div style="font-size:12px;color:#64748b;margin-top:2px;">Our team checks your invoice and product registration proof.</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width:32px;vertical-align:top;">
                        <div style="width:24px;height:24px;background:rgba(118,211,0,0.15);border:1px solid rgba(118,211,0,0.4);border-radius:6px;text-align:center;line-height:24px;font-size:12px;color:#529400;font-weight:800;">2</div>
                      </td>
                      <td style="padding-left:10px;vertical-align:top;">
                        <div style="font-size:13px;font-weight:700;color:#0f172a;">Confirmation Update</div>
                        <div style="font-size:12px;color:#64748b;margin-top:2px;">You will receive an email once your registration is verified.</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width:32px;vertical-align:top;">
                        <div style="width:24px;height:24px;background:rgba(118,211,0,0.15);border:1px solid rgba(118,211,0,0.4);border-radius:6px;text-align:center;line-height:24px;font-size:12px;color:#529400;font-weight:800;">3</div>
                      </td>
                      <td style="padding-left:10px;vertical-align:top;">
                        <div style="font-size:13px;font-weight:700;color:#0f172a;">Customer Support Access</div>
                        <div style="font-size:12px;color:#64748b;margin-top:2px;">Easily access support and service using your Registration ID.</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ═══════ FOOTER ═══════ -->
        <tr>
          <td style="background:#f8fafc;padding:28px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <div style="font-size:22px;font-weight:900;letter-spacing:-1px;color:#0f172a;margin-bottom:2px;">Spin<span style="color:#76D300;">Bot</span></div>
            <div style="font-size:10px;color:#94a3b8;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:16px;">Product Registration Portal</div>

            <div style="margin-bottom:16px;">
              <a href="mailto:support@spinbot.co.in" style="display:inline-block;background:#0f172a;color:#76D300;font-size:12px;font-weight:700;text-decoration:none;padding:8px 20px;border-radius:8px;">📧 support@spinbot.co.in</a>
            </div>

            <div style="font-size:11px;color:#94a3b8;line-height:1.6;">
              <span>© ${new Date().getFullYear()} SpinBot. All rights reserved.</span><br/>
              <span>This is an automated confirmation message for product registration.</span>
            </div>
          </td>
        </tr>

      </table>

    </td></tr>
  </table>

</body>
</html>
      `,
      text: `
SpinBot — Product Registration Received

Hi ${reg.fullName},

Thank you for registering your SpinBot product. Your details have been recorded:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  REGISTRATION ID: ${reg.warrantyId}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Product:             ${reg.product}
  SKU / Model:         ${reg.sku || 'N/A'}
  Purchase Date:       ${purchaseDateFormatted}
  Purchase Platform:   ${reg.purchasePlatform || 'N/A'}
  Registration Period: ${reg.warrantyPeriod}
  Coverage Until:      ${endDateFormatted}

  Status: Pending Verification

What Happens Next?
  1. Document Verification (our team checks your invoice)
  2. Confirmation Update (you will receive an email once verified)
  3. Easy Support Access using your Registration ID

Need support? Email: support@spinbot.co.in

© ${new Date().getFullYear()} SpinBot Product Registration Portal
      `.trim()
    },
    createdAt: new Date().toISOString()
  };

  // Send email directly to customer email using verified domain (noreply@spinbot.co.in)
  if (RESEND_API_KEY) {
    try {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'SpinBot Warranty Desk <onboarding@resend.dev>',
          to: [reg.email],
          subject: mailDoc.message.subject,
          html: mailDoc.message.html,
          text: mailDoc.message.text
        })
      });
      const resendData = await resendRes.json();
      if (resendRes.ok) {
        console.log('✅ Confirmation email dispatched directly to customer:', reg.email, resendData);
      } else {
        console.warn('Resend API notice:', resendData);
      }
    } catch (err) {
      console.warn('Resend API call notice:', err);
    }
  }

  // Backup: Write to Firestore `mail` collection
  if (db) {
    try {
      await addDoc(collection(db, 'mail'), mailDoc);
      console.log('✅ Confirmation email queued in Firestore mail collection for:', reg.email);
    } catch (e) {
      console.warn('Firebase mail queue failed:', e);
    }
  }
}

// -------------------------------------------------------------
// EMAIL STATUS UPDATE NOTIFICATION
// -------------------------------------------------------------
export async function sendStatusUpdateEmail(reg, newStatus) {
  if (!reg || !reg.email) return;
  const isApproved = newStatus === 'Approved' || newStatus === 'Active';
  const subject = isApproved 
    ? `🎉 Product Registration Approved — ${reg.warrantyId || ''} | SpinBot`
    : `ℹ️ Product Registration Status Update (${newStatus}) — ${reg.warrantyId || ''} | SpinBot`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:36px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 10px 25px -5px rgba(15,23,42,0.06);">
        <tr>
          <td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:32px 40px;text-align:center;">
            <div style="font-size:30px;font-weight:900;letter-spacing:-1px;color:#ffffff;">Spin<span style="color:#76D300;">Bot</span></div>
            <div style="font-size:10px;color:rgba(255,255,255,0.45);margin-top:6px;letter-spacing:0.2em;text-transform:uppercase;font-weight:700;">Registration Update</div>
          </td>
        </tr>
        <tr>
          <td style="background:${isApproved ? '#f0fdf4' : '#fffbeb'};border-bottom:2px solid ${isApproved ? '#76D300' : '#f59e0b'};padding:36px 40px;text-align:center;">
            <div style="width:60px;height:60px;margin:0 auto 16px;background:${isApproved ? '#76D300' : '#f59e0b'};border-radius:50%;line-height:60px;font-size:30px;color:${isApproved ? '#0f172a' : '#ffffff'};font-weight:bold;">
              ${isApproved ? '✓' : 'ℹ'}
            </div>
            <h1 style="font-size:22px;font-weight:800;color:#0f172a;margin:0 0 8px;">
              ${isApproved ? 'Registration Approved & Verified!' : `Status Updated: ${newStatus}`}
            </h1>
            <p style="font-size:14px;color:#475569;margin:0;line-height:1.5;">
              Hi <strong>${reg.fullName || 'Customer'}</strong>, your product registration status for <strong>${reg.product || 'SpinBot Product'}</strong> is now <strong style="color:${isApproved ? '#166534' : '#92400e'}">${newStatus}</strong>.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 40px;text-align:center;">
            <div style="background:#0f172a;border-radius:14px;padding:20px;color:#fff;">
              <div style="font-size:10px;font-weight:800;color:#76D300;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px;">Registration ID</div>
              <div style="font-size:24px;font-weight:900;letter-spacing:2px;font-family:monospace;">${reg.warrantyId || 'SB-REG'}</div>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:28px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <div style="font-size:12px;color:#94a3b8;">Need help? Email <a href="mailto:support@spinbot.co.in" style="color:#76D300;font-weight:700;text-decoration:none;">support@spinbot.co.in</a></div>
            <div style="font-size:11px;color:#cbd5e1;margin-top:8px;">© ${new Date().getFullYear()} SpinBot. All rights reserved.</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `;

  if (RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'SpinBot Care Desk <onboarding@resend.dev>',
          to: [reg.email],
          subject: subject,
          html: html
        })
      });
      console.log('✅ Status update email dispatched to:', reg.email);
    } catch(err) {
      console.warn('Status update email error:', err);
    }
  }
}

// -------------------------------------------------------------
// EMAIL SUPPORT TICKET REPLY NOTIFICATION
// -------------------------------------------------------------
export async function sendSupportReplyEmail(ticketEmail, ticketId, subjectText, replyMessage) {
  if (!ticketEmail) return;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:36px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 10px 25px -5px rgba(15,23,42,0.06);">
        <tr>
          <td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:32px 40px;text-align:center;">
            <div style="font-size:30px;font-weight:900;letter-spacing:-1px;color:#ffffff;">Spin<span style="color:#76D300;">Bot</span></div>
            <div style="font-size:10px;color:rgba(255,255,255,0.45);margin-top:6px;letter-spacing:0.2em;text-transform:uppercase;font-weight:700;">Customer Support Response</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <h2 style="font-size:18px;font-weight:800;color:#0f172a;margin:0 0 12px;">Reply to Ticket #${ticketId || ''}</h2>
            <div style="font-size:13px;color:#64748b;margin-bottom:20px;">Subject: <strong>${subjectText || 'Support Query'}</strong></div>
            <div style="background:#f1f5f9;border-left:4px solid #76D300;padding:20px;border-radius:8px;font-size:14px;color:#334155;line-height:1.6;">
              ${replyMessage.replace(/\n/g, '<br/>')}
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <div style="font-size:12px;color:#94a3b8;">SpinBot Customer Care Team • <a href="mailto:support@spinbot.co.in" style="color:#76D300;font-weight:700;text-decoration:none;">support@spinbot.co.in</a></div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `;

  if (RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'SpinBot Care Desk <onboarding@resend.dev>',
          to: [ticketEmail],
          subject: `📩 Reply to Ticket #${ticketId} | SpinBot Care Desk`,
          html: html
        })
      });
      console.log('✅ Support reply email dispatched to:', ticketEmail);
    } catch(err) {
      console.warn('Support reply email error:', err);
    }
  }
}


export function subscribeToRegistrations(callback) {
  const loadRegistrations = (fsDocs = []) => {
    const localList = getLocalData(LOCAL_REGS_KEY);
    const combinedMap = new Map();

    localList.forEach(r => {
      const key = r.warrantyId || r.id || `loc_${Math.random()}`;
      combinedMap.set(key, { id: r.id || key, warrantyId: key, ...r });
    });

    fsDocs.forEach(d => {
      const data = d.data();
      const dates = calculateWarrantyDates(data.purchaseDate || data.startDate, parseInt(data.warrantyPeriod) || 12);
      const key = data.warrantyId || d.id;
      combinedMap.set(key, { id: d.id, warrantyId: key, ...data, daysRemaining: dates.daysRemaining });
    });

    const resultList = Array.from(combinedMap.values());
    resultList.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    callback(resultList);
  };

  loadRegistrations([]);

  if (db) {
    try {
      return onSnapshot(collection(db, 'registrations'), (snapshot) => {
        loadRegistrations(snapshot.docs);
      }, (err) => {
        console.warn('Real-time registrations listener notice:', err);
        loadRegistrations([]);
      });
    } catch (e) {
      console.warn('Firestore onSnapshot exception:', e);
    }
  }
}

export async function getRegistrationById(id) {
  if (!id) return null;
  const cleanId = String(id).trim();
  const rawCleanId = cleanId.replace(/^#/, '');

  if (db) {
    try {
      // 1. Direct Firestore document ID lookup
      const directRef = doc(db, 'registrations', cleanId);
      const directSnap = await getDoc(directRef);
      if (directSnap.exists()) {
        const data = directSnap.data();
        const dates = calculateWarrantyDates(data.purchaseDate || data.startDate, parseInt(data.warrantyPeriod) || 12);
        return { id: directSnap.id, warrantyId: data.warrantyId || directSnap.id, ...data, ...dates };
      }

      const rawRef = doc(db, 'registrations', rawCleanId);
      const rawSnap = await getDoc(rawRef);
      if (rawSnap.exists()) {
        const data = rawSnap.data();
        const dates = calculateWarrantyDates(data.purchaseDate || data.startDate, parseInt(data.warrantyPeriod) || 12);
        return { id: rawSnap.id, warrantyId: data.warrantyId || rawSnap.id, ...data, ...dates };
      }

      // 2. Query by warrantyId field in Firestore
      const q = query(collection(db, 'registrations'), where('warrantyId', '==', cleanId));
      const qSnap = await getDocs(q);
      if (!qSnap.empty) {
        const d = qSnap.docs[0];
        const data = d.data();
        const dates = calculateWarrantyDates(data.purchaseDate || data.startDate, parseInt(data.warrantyPeriod) || 12);
        return { id: d.id, warrantyId: data.warrantyId || d.id, ...data, ...dates };
      }

      const qRaw = query(collection(db, 'registrations'), where('warrantyId', '==', rawCleanId));
      const qRawSnap = await getDocs(qRaw);
      if (!qRawSnap.empty) {
        const d = qRawSnap.docs[0];
        const data = d.data();
        const dates = calculateWarrantyDates(data.purchaseDate || data.startDate, parseInt(data.warrantyPeriod) || 12);
        return { id: d.id, warrantyId: data.warrantyId || d.id, ...data, ...dates };
      }
    } catch (e) {
      console.warn('Firestore getRegistrationById notice:', e);
    }
  }

  // 3. Fallback to all registrations combined list
  const all = await getRegistrations();
  const targetLower = rawCleanId.toLowerCase();
  return (all || []).find(r => {
    const id1 = (r.id || '').replace(/^#/, '').trim().toLowerCase();
    const id2 = (r.warrantyId || '').replace(/^#/, '').trim().toLowerCase();
    return id1 === targetLower || id2 === targetLower;
  }) || null;
}

export async function getRegistrations() {
  const localList = getLocalData(LOCAL_REGS_KEY);
  let fsList = [];

  if (db) {
    try {
      const snap = await getDocs(collection(db, 'registrations'));
      snap.forEach(d => {
        const data = d.data();
        const dates = calculateWarrantyDates(data.purchaseDate || data.startDate, parseInt(data.warrantyPeriod) || 12);
        fsList.push({ id: d.id, ...data, daysRemaining: dates.daysRemaining });
      });
    } catch (e) {
      console.warn('Firestore getRegistrations notice:', e);
    }
  }

  const combinedMap = new Map();
  localList.forEach(r => {
    const key = r.warrantyId || r.id || `loc_${Math.random()}`;
    combinedMap.set(key, { id: r.id || key, warrantyId: key, ...r });
  });
  fsList.forEach(r => {
    const key = r.warrantyId || r.id;
    combinedMap.set(key, { id: r.id, warrantyId: key, ...r });
  });

  const resultList = Array.from(combinedMap.values());
  resultList.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return resultList;
}

export async function updateRegistrationStatus(id, newStatus) {
  if (!id || !newStatus) throw new Error('Registration ID and status are required.');
  let targetReg = null;
  let updated = false;
  try {
    const list = getLocalData(LOCAL_REGS_KEY);
    const found = list.find(r => r.id === id || r.warrantyId === id);
    if (found) {
      found.status = newStatus;
      localStorage.setItem(LOCAL_REGS_KEY, JSON.stringify(list));
      targetReg = found;
      updated = true;
    }
  } catch (e) { }

  if (db && !id.startsWith('loc_')) {
    try {
      let ref = doc(db, 'registrations', id);
      let snap = await getDoc(ref);
      // The UI may supply the public warranty ID rather than the Firestore
      // document ID. Resolve it before attempting the update.
      if (!snap.exists()) {
        const match = await getDocs(query(collection(db, 'registrations'), where('warrantyId', '==', id), limit(1)));
        if (!match.empty) {
          ref = match.docs[0].ref;
          snap = match.docs[0];
        }
      }
      if (snap.exists()) {
        targetReg = { id: snap.id, ...snap.data() };
        await updateDoc(ref, { status: newStatus, updatedAt: new Date().toISOString() });
        targetReg.status = newStatus;
        updated = true;
      }
    } catch (e) {
      console.warn('Registration status sync failed:', e);
    }
  }

  if (!updated) throw new Error('Registration could not be found or updated.');
  if (targetReg) {
    sendStatusUpdateEmail(targetReg, newStatus).catch(() => {});
  }
  return targetReg;
}

// -------------------------------------------------------------
// 2. CUSTOMERS COLLECTION (REAL-TIME & LIVE DATA)
// -------------------------------------------------------------
export async function upsertCustomer(custData) {
  saveLocalData(LOCAL_CUSTS_KEY, {
    name: custData.name,
    email: custData.email,
    phone: custData.phone,
    totalRegistrations: 1,
    createdDate: new Date().toISOString().split('T')[0],
    status: 'Active'
  });

  if (!db || !query) return;
  try {
    const q = query(collection(db, 'customers'), where('phone', '==', custData.phone));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const existingDoc = snap.docs[0];
      const count = (existingDoc.data().totalRegistrations || 1) + 1;
      await updateDoc(doc(db, 'customers', existingDoc.id), {
        totalRegistrations: count,
        lastActive: new Date().toISOString()
      });
    } else {
      await addDoc(collection(db, 'customers'), {
        name: custData.name,
        email: custData.email,
        phone: custData.phone,
        totalRegistrations: 1,
        createdDate: new Date().toISOString().split('T')[0],
        status: 'Active'
      });
    }
  } catch (e) { }
}

export function deriveCustomers(registrations = [], customList = []) {
  const map = new Map();

  customList.forEach(c => {
    if (c.phone) {
      map.set(c.phone, {
        id: c.id || 'cust_' + c.phone,
        name: c.name || 'Customer',
        email: c.email || '',
        phone: c.phone,
        // Registration records below are the authoritative count when present.
        // Preserve a cloud-only total as a lower bound for older data.
        totalRegistrations: 0,
        storedTotalRegistrations: Number(c.totalRegistrations) || 0,
        createdDate: c.createdDate || c.createdAt || new Date().toISOString().split('T')[0],
        status: c.status || 'Active'
      });
    }
  });

  registrations.forEach(r => {
    const phoneKey = r.phone || r.fullName || r.id;
    if (phoneKey) {
      const existing = map.get(phoneKey);
      if (existing) {
        existing.totalRegistrations += 1;
        if (!existing.email && r.email) existing.email = r.email;
        if ((!existing.name || existing.name === 'Customer') && (r.fullName || r.name)) {
          existing.name = r.fullName || r.name;
        }
      } else {
        map.set(phoneKey, {
          id: 'cust_' + phoneKey,
          name: r.fullName || r.name || 'Customer User',
          email: r.email || '',
          phone: r.phone || 'N/A',
          totalRegistrations: 1,
          storedTotalRegistrations: 0,
          createdDate: (r.createdAt || r.purchaseDate || new Date().toISOString()).split('T')[0],
          status: 'Active'
        });
      }
    }
  });

  return Array.from(map.values()).map(({ storedTotalRegistrations = 0, ...customer }) => ({
    ...customer,
    totalRegistrations: Math.max(customer.totalRegistrations, storedTotalRegistrations)
  }));
}

export function subscribeToCustomers(callback) {
  const loadCustomers = (fsDocs = []) => {
    const localList = getLocalData(LOCAL_CUSTS_KEY);
    const localRegs = getLocalData(LOCAL_REGS_KEY);
    const map = new Map();

    localList.forEach(c => { if (c.phone) map.set(c.phone, c); });
    fsDocs.forEach(d => {
      const data = d.data();
      if (data.phone) map.set(data.phone, { id: d.id, ...data });
    });

    const combinedCusts = deriveCustomers(localRegs, Array.from(map.values()));
    callback(combinedCusts);
  };

  loadCustomers([]);

  if (db) {
    try {
      return onSnapshot(collection(db, 'customers'), (snapshot) => {
        loadCustomers(snapshot.docs);
      }, () => loadCustomers([]));
    } catch (e) { }
  }
}

export async function getCustomers() {
  const localList = getLocalData(LOCAL_CUSTS_KEY);
  const localRegs = getLocalData(LOCAL_REGS_KEY);
  let fsList = [];

  if (db) {
    try {
      const snap = await getDocs(collection(db, 'customers'));
      snap.forEach(d => fsList.push({ id: d.id, ...d.data() }));
    } catch (e) { }
  }

  const combinedMap = new Map();
  localList.forEach(c => { if (c.phone) combinedMap.set(c.phone, c); });
  fsList.forEach(c => { if (c.phone) combinedMap.set(c.phone, { id: c.id, ...c }); });

  return deriveCustomers(localRegs, Array.from(combinedMap.values()));
}

// -------------------------------------------------------------
// 3. PRODUCTS COLLECTION — Clean Rewrite
// -------------------------------------------------------------
const LOCAL_REMOVED_PRODS_KEY = 'sb_removed_products';

/**
 * getProducts() — Returns the full merged product catalog.
 * 
 * Sources (in priority order):
 *   1. DEFAULT_CATALOG_PRODUCTS — hardcoded seed data (lowest priority)
 *   2. LocalStorage products — offline-added items
 *   3. Firestore 'products' collection — cloud source of truth (highest priority)
 * 
 * Each product is keyed by its unique ID. Only explicitly deleted
 * products (tracked by doc ID or SKU in deleted_products) are filtered out.
 */
export async function getProducts() {
  const localList = getLocalData(LOCAL_PRODS_KEY);
  const localRemoved = getLocalData(LOCAL_REMOVED_PRODS_KEY);
  let fsList = [];
  const deletedIds = new Set();

  if (db) {
    try {
      const withTimeout = (promise, ms = 8000) => Promise.race([
        promise,
        new Promise(resolve => setTimeout(() => resolve(null), ms))
      ]);
      const [snapResult, remSnapResult] = await Promise.all([
        withTimeout(getDocs(collection(db, 'products')).catch(() => null)),
        withTimeout(getDocs(collection(db, 'deleted_products')).catch(() => null))
      ]);

      if (snapResult && snapResult.forEach) {
        snapResult.forEach(d => fsList.push({ ...d.data(), id: d.id }));
      }
      if (remSnapResult && remSnapResult.forEach) {
        remSnapResult.forEach(d => {
          deletedIds.add(d.id.toLowerCase());
          const data = d.data();
          if (data.id) deletedIds.add(String(data.id).toLowerCase());
        });
      }
    } catch (e) {
      console.warn('Firestore getProducts read failed:', e);
    }
  }

  // Also add locally-tracked removals
  localRemoved.forEach(k => {
    if (typeof k === 'string' && k.trim()) deletedIds.add(k.toLowerCase().trim());
  });

  // Check if a product has been deleted STRICTLY by its unique product ID
  const isDeleted = (p) => {
    if (!p || !p.id) return false;
    return deletedIds.has(String(p.id).toLowerCase().trim());
  };

  // Build final product list keyed by unique product ID
  const map = new Map();

  // Layer 1: Default catalog seeds
  DEFAULT_CATALOG_PRODUCTS.forEach(p => {
    if (!isDeleted(p)) map.set(p.id, { ...p });
  });

  // Layer 2: LocalStorage products
  localList.forEach(p => {
    if (!isDeleted(p)) {
      const id = p.id || ('loc_' + Math.random().toString(36).slice(2));
      map.set(id, { ...p, id });
    }
  });

  // Layer 3: Firestore products (keyed by Firestore doc ID — always unique)
  fsList.forEach(p => {
    if (!isDeleted(p)) map.set(p.id, { ...p });
  });

  return Array.from(map.values());
}

// Helper: Compress image data URL to max 400x400
export function compressImageDataUrl(dataUrl, maxWidth = 400, maxHeight = 400, quality = 0.8) {
  return new Promise((resolve) => {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) {
      resolve(dataUrl || '');
      return;
    }
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * addProduct() — Adds a product to catalog.
 * Saves to localStorage first, then syncs to Firestore with 3s timeout.
 */
export async function addProduct(pData) {
  if (pData.image && typeof pData.image === 'string' && pData.image.startsWith('data:image')) {
    try { pData.image = await compressImageDataUrl(pData.image, 400, 400, 0.7); } catch(e) {}
  }

  const localId = 'prod_' + Date.now();
  let product = { id: localId, ...pData };
  saveLocalData(LOCAL_PRODS_KEY, product);

  if (db) {
    try {
      const fsPromise = addDoc(collection(db, 'products'), { ...pData, createdAt: new Date().toISOString() });
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 3000));
      const docRef = await Promise.race([fsPromise, timeout]);
      product = { id: docRef.id, ...pData };
      // Update localStorage entry to use real Firestore ID
      try {
        const list = getLocalData(LOCAL_PRODS_KEY);
        const updated = list.map(p => p.id === localId ? { ...p, id: docRef.id } : p);
        localStorage.setItem(LOCAL_PRODS_KEY, JSON.stringify(updated));
      } catch(e) {}
    } catch (e) {
      console.warn('addProduct: Firestore sync skipped (saved locally):', e.message);
    }
  }
  return product;
}

/**
 * updateProduct() — Updates an existing product.
 */
export async function updateProduct(id, pData) {
  if (pData.image && typeof pData.image === 'string' && pData.image.startsWith('data:image')) {
    try { pData.image = await compressImageDataUrl(pData.image, 400, 400, 0.7); } catch(e) {}
  }

  // Update in localStorage
  try {
    const list = getLocalData(LOCAL_PRODS_KEY);
    const updated = list.map(p => p.id === id ? { ...p, ...pData } : p);
    localStorage.setItem(LOCAL_PRODS_KEY, JSON.stringify(updated));
  } catch(e) {}

  // Sync to Firestore (only for real Firestore doc IDs)
  if (db && id && !id.startsWith('prod_') && !id.startsWith('loc_')) {
    try {
      const fsPromise = updateDoc(doc(db, 'products', id), pData);
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 3000));
      await Promise.race([fsPromise, timeout]);
    } catch (e) {
      console.warn('updateProduct: Firestore sync skipped:', e.message);
    }
  }
}

/**
 * deleteProduct() — Deletes a product from catalog strictly by document ID.
 */
export async function deleteProduct(id, pObj = null) {
  try {
    const cleanId = String(id).trim();

    // 1. Remove from local storage
    const localList = getLocalData(LOCAL_PRODS_KEY).filter(p => p.id !== cleanId);
    localStorage.setItem(LOCAL_PRODS_KEY, JSON.stringify(localList));

    // 2. Track in local removed list (ID only)
    saveLocalData(LOCAL_REMOVED_PRODS_KEY, cleanId.toLowerCase());

    // 3. Sync deletion to Firestore (with timeout so UI never hangs)
    if (db) {
      const safeDocId = cleanId.replace(/[\/\.#$\[\]]/g, '_');
      const deletionRecord = { id: cleanId, deletedAt: new Date().toISOString() };

      try {
        const setPromise = setDoc(doc(db, 'deleted_products', safeDocId), deletionRecord, { merge: true });
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 3000));
        await Promise.race([setPromise, timeout]);
      } catch (e) {
        console.warn('[deleteProduct] Firestore deleted_products sync skipped:', e.message);
      }

      // Also delete the actual Firestore product document (only for real Firestore docs)
      if (!cleanId.startsWith('prod_') && !cleanId.startsWith('loc_')) {
        try {
          const delPromise = deleteDoc(doc(db, 'products', cleanId));
          const timeout2 = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 3000));
          await Promise.race([delPromise, timeout2]);
        } catch (e) {
          console.warn('[deleteProduct] Firestore product delete skipped:', e.message);
        }
      }
    }
  } catch(e) {
    console.warn('[deleteProduct] Error:', e);
  }
}

// -------------------------------------------------------------
// 4. SUPPORT MODULE
// -------------------------------------------------------------
export async function getSupportTickets() {
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, 'support'));
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    return list;
  } catch (e) {
    return [];
  }
}

export async function createSupportTicket(tData) {
  const ticketId = generateUniqueId('TKT');
  const newTicket = {
    ticketId,
    customerName: tData.customerName,
    email: tData.email || '',
    phone: tData.phone || '',
    subject: tData.subject,
    message: tData.message,
    status: 'Open',
    createdAt: new Date().toISOString(),
    replies: []
  };
  if (db) {
    try {
      const ref = await addDoc(collection(db, 'support'), newTicket);
      return { id: ref.id, ...newTicket };
    } catch (e) { }
  }
  return { id: 'tkt_' + Date.now(), ...newTicket };
}

export async function replySupportTicket(id, replyText, sender = 'Admin') {
  if (db) {
    try {
      const ticketRef = doc(db, 'support', id);
      const snap = await getDoc(ticketRef);
      if (snap.exists()) {
        const data = snap.data();
        const replies = data.replies || [];
        replies.push({ sender, text: replyText, timestamp: new Date().toISOString() });
        await updateDoc(ticketRef, { replies, status: 'Pending' });

        if (data.email) {
          sendSupportReplyEmail(data.email, data.ticketId || id, data.subject, replyText).catch(() => {});
        }
      }
    } catch (e) { }
  }
}

export async function updateTicketStatus(id, status) {
  if (db) { try { await updateDoc(doc(db, 'support', id), { status }); } catch (e) { } }
}

// -------------------------------------------------------------
// 5. CLAIMS MODULE
// -------------------------------------------------------------
export async function getClaims() {
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, 'claims'));
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    return list;
  } catch (e) {
    return [];
  }
}

export async function createClaim(cData) {
  const claimNumber = generateUniqueId('CLM');
  const claim = {
    claimNumber,
    warrantyId: cData.warrantyId || 'N/A',
    customer: cData.customer,
    product: cData.product,
    issue: cData.issue,
    status: 'Pending',
    createdAt: new Date().toISOString(),
    timeline: [{ event: 'Claim Submitted', timestamp: new Date().toISOString() }]
  };
  if (db) {
    try {
      const ref = await addDoc(collection(db, 'claims'), claim);
      return { id: ref.id, ...claim };
    } catch (e) { }
  }
  return { id: 'clm_' + Date.now(), ...claim };
}

export async function updateClaimStatus(id, status) {
  if (db) {
    try {
      const ref = doc(db, 'claims', id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const timeline = snap.data().timeline || [];
        timeline.push({ event: `Status changed to ${status}`, timestamp: new Date().toISOString() });
        await updateDoc(ref, { status, timeline });
      }
    } catch (e) { }
  }
}

// -------------------------------------------------------------
// 6. ACTIVITY LOGS
// -------------------------------------------------------------
export async function getRecentActivity() {
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, 'activity'));
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    return list;
  } catch (e) {
    return [];
  }
}

// -------------------------------------------------------------
// 7. DYNAMIC MARKETPLACES MODULE (ADMIN MANAGED)
// -------------------------------------------------------------
const LOCAL_MKTS_KEY = 'sb_local_marketplaces';
const LOCAL_REMOVED_MKTS_KEY = 'sb_removed_marketplaces';

export async function getMarketplaces() {
  const localList = getLocalData(LOCAL_MKTS_KEY);
  const localRemoved = getLocalData(LOCAL_REMOVED_MKTS_KEY);
  let fsList = [];
  let fsRemoved = [];
  let hasFirestoreData = false;

  if (db) {
    try {
      const snap = await getDocs(collection(db, 'marketplaces'));
      snap.forEach(d => {
        const name = d.data().name;
        if (name) fsList.push(name.trim());
      });
      if (!snap.empty) hasFirestoreData = true;
    } catch (e) { }

    try {
      const remSnap = await getDocs(collection(db, 'deleted_marketplaces'));
      remSnap.forEach(d => {
        const name = d.id || d.data().name;
        if (name) fsRemoved.push(name.trim());
      });
      if (!remSnap.empty) hasFirestoreData = true;
    } catch (e) { }
  }

  const removedList = [...new Set([...localRemoved, ...fsRemoved])].map(m => m.toLowerCase().trim());
  const baseList = hasFirestoreData ? [...localList, ...fsList] : [...DEFAULT_MARKETPLACES, ...localList, ...fsList];
  const combined = Array.from(new Set(baseList));
  return combined.filter(m => !removedList.includes(m.toLowerCase().trim()));
}

export async function addMarketplace(name) {
  const cleanName = (name || '').trim();
  if (!cleanName) return;

  // Un-remove if previously deleted
  try {
    const localRemoved = getLocalData(LOCAL_REMOVED_MKTS_KEY).filter(m => m.toLowerCase().trim() !== cleanName.toLowerCase());
    localStorage.setItem(LOCAL_REMOVED_MKTS_KEY, JSON.stringify(localRemoved));
  } catch (e) {}

  saveLocalData(LOCAL_MKTS_KEY, cleanName);

  if (db) {
    try {
      const { doc: dDoc, deleteDoc: delDoc, collection: col, addDoc: aDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
      await delDoc(dDoc(db, 'deleted_marketplaces', cleanName)).catch(() => {});
      await aDoc(col(db, 'marketplaces'), { name: cleanName, createdAt: new Date().toISOString() });
    } catch (e) { }
  }
}

export async function deleteMarketplace(name) {
  const cleanName = (name || '').trim();
  if (!cleanName) return;

  try {
    // 1. Remove from local storage list
    const list = getLocalData(LOCAL_MKTS_KEY).filter(m => m.toLowerCase().trim() !== cleanName.toLowerCase());
    localStorage.setItem(LOCAL_MKTS_KEY, JSON.stringify(list));
    saveLocalData(LOCAL_REMOVED_MKTS_KEY, cleanName);

    // 2. Sync deletion to Firestore so all clients filter it out
    if (db) {
      const { doc: dDoc, setDoc: sDoc, deleteDoc: delDoc, collection: col, query: q, where: w, getDocs: gDocs } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
      await sDoc(dDoc(db, 'deleted_marketplaces', cleanName), { name: cleanName, deletedAt: new Date().toISOString() }, { merge: true }).catch(() => {});

      const snap = await gDocs(q(col(db, 'marketplaces'), w('name', '==', cleanName)));
      snap.forEach(async (d) => {
        try { await delDoc(dDoc(db, 'marketplaces', d.id)); } catch (err) {}
      });
    }
  } catch(e) {}
}

export function subscribeToMarketplaces(callback) {
  const loadMkts = (fsDocs = []) => {
    const fsNames = fsDocs.map(d => d.data().name).filter(Boolean);
    const localNames = getLocalData(LOCAL_MKTS_KEY);
    const removedNames = getLocalData(LOCAL_REMOVED_MKTS_KEY);
    const combined = Array.from(new Set([...DEFAULT_MARKETPLACES, ...localNames, ...fsNames]));
    const filtered = combined.filter(m => !removedNames.includes(m));
    callback(filtered);
  };

  loadMkts([]);

  if (db) {
    try {
      return onSnapshot(collection(db, 'marketplaces'), (snapshot) => {
        loadMkts(snapshot.docs);
      }, () => loadMkts([]));
    } catch (e) {}
  }
}

// -------------------------------------------------------------
// 8. TERMS & CONDITIONS MODULE (ADMIN MANAGED)
// -------------------------------------------------------------
const LOCAL_TNC_KEY = 'sb_terms_and_conditions';

export const DEFAULT_TERMS = `**SpinBot Warranty Terms & Conditions**

1. **Eligibility**: This warranty is valid only for products purchased from authorized SpinBot dealers or the official SpinBot store.

2. **Warranty Coverage**: The warranty covers manufacturing defects and hardware failures under normal usage conditions. Physical damage, liquid damage, or misuse is not covered.

3. **Warranty Period**: The warranty period begins from the date of purchase as mentioned on the invoice. Duration varies by product.

4. **Claim Process**: To raise a warranty claim, contact support@spinbot.co.in with your Warranty ID, purchase invoice, and a description of the issue.

5. **Exclusions**: Warranty does not cover consumable parts, cosmetic damage, unauthorized modifications, or damage caused by third-party accessories.

6. **Limitation of Liability**: SpinBot's liability is limited to repair or replacement of the defective product at SpinBot's sole discretion.

7. **Data Accuracy**: By submitting this form, you confirm that all details provided are accurate and true. False information may void your warranty.

8. **Privacy**: Your personal information will be stored securely and used only for warranty purposes. It will not be shared with third parties.

9. **Governing Law**: These terms are governed by the laws of India. Any disputes shall be subject to the jurisdiction of courts in [Your City].

10. **Updates**: SpinBot reserves the right to update these terms at any time. The latest version will always be available on our website.

For support: support@spinbot.co.in`;

export async function getTermsAndConditions() {
  // Try Firestore first
  if (db) {
    try {
      const snap = await getDocs(collection(db, 'settings'));
      let termsDoc = null;
      snap.forEach(d => {
        if (d.data().type === 'terms') termsDoc = d.data();
      });
      if (termsDoc && termsDoc.content) {
        localStorage.setItem(LOCAL_TNC_KEY, termsDoc.content);
        return termsDoc.content;
      }
    } catch (e) {}
  }
  // Fallback to localStorage
  const local = localStorage.getItem(LOCAL_TNC_KEY);
  return local || DEFAULT_TERMS;
}

export async function saveTermsAndConditions(content) {
  localStorage.setItem(LOCAL_TNC_KEY, content);
  if (db) {
    try {
      // Find existing terms doc or create new
      const snap = await getDocs(collection(db, 'settings'));
      let existingId = null;
      snap.forEach(d => {
        if (d.data().type === 'terms') existingId = d.id;
      });
      if (existingId) {
        await updateDoc(doc(db, 'settings', existingId), {
          content,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'settings'), {
          type: 'terms',
          content,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    } catch (e) {
      console.warn('T&C Firestore save failed, kept in localStorage:', e);
    }
  }
}
