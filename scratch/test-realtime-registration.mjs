// Test script to verify real-time data submission
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDummyKeyForSpinBot2026Testing",
  authDomain: "spinbot-warranty.firebaseapp.com",
  projectId: "spinbot-warranty",
  storageBucket: "spinbot-warranty.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abc123def456"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testSubmit() {
  const testReg = {
    warrantyId: "WR-2026-LIVE99",
    fullName: "Rohit Verma (Live Test)",
    email: "rohit.verma@example.com",
    phone: "+91 98112 23344",
    product: "SpinBot IceDot Mag v1 Mobile Cooler",
    sku: "SB-ICEDOT-MAG1",
    brand: "SpinBot",
    purchaseDate: "2026-08-01",
    purchasePlatform: "Amazon India",
    serialNumber: "SN-LIVE-9900",
    invoiceNumber: "INV-AMZ-9900",
    invoiceUrl: "https://spinbot-upload.product-register.workers.dev/file/invoices/1785561670298-qhu3c3.png",
    warrantyPeriod: "12 Months",
    startDate: "2026-08-01",
    endDate: "2027-08-01",
    daysRemaining: 365,
    status: "Pending",
    termsAccepted: true,
    createdAt: new Date().toISOString()
  };

  try {
    const docRef = await addDoc(collection(db, 'registrations'), testReg);
    console.log('Successfully written live registration to Firestore! ID:', docRef.id);
  } catch (err) {
    console.warn('Firestore write failed (offline fallback active):', err.message);
  }
}

testSubmit();
