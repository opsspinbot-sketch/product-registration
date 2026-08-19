import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBL8RJ_pabY71EtNq0HjeNWLtUNE6XoPFQ",
  authDomain: "invoice-af966.firebaseapp.com",
  projectId: "invoice-af966",
  storageBucket: "invoice-af966.firebasestorage.app",
  messagingSenderId: "583941270564",
  appId: "1:583941270564:web:ed3d4564c4f444e5e4fcb1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const DEFAULT_CATALOG_PRODUCTS = [
  { id: "prod_1", name: "SpinBot IceDot Mag v1 Mobile Cooler", sku: "SB-ICEDOT-MAG1", brand: "SpinBot", warrantyPeriod: "12 Months", status: "Active", category: "Coolers" },
  { id: "prod_2", name: "SpinBot BattleMods Apex Gaming Trigger", sku: "SB-BM-APEX", brand: "SpinBot", warrantyPeriod: "6 Months", status: "Active", category: "Gaming Triggers" },
  { id: "prod_3", name: "SpinBot BattleBudz C10 Type-C Earphone", sku: "SB-BB-C10", brand: "SpinBot", warrantyPeriod: "12 Months", status: "Active", category: "Earphones & Headphones" },
  { id: "prod_4", name: "SpinBot Airflow X10 Laptop Cooling Pad", sku: "SB-AF-X10", brand: "SpinBot", warrantyPeriod: "12 Months", status: "Active", category: "Laptop Cooling" },
  { id: "prod_5", name: "SpinBot Rage MK87 Mechanical Keyboard", sku: "SB-MK87", brand: "SpinBot", warrantyPeriod: "24 Months", status: "Active", category: "Keyboards" },
  { id: "prod_6", name: "SpinBot HX500 Gaming Headset", sku: "SB-HX500", brand: "SpinBot", warrantyPeriod: "12 Months", status: "Active", category: "Earphones & Headphones" }
];

async function testExactIdFiltering() {
  let fsList = [];
  const deletedIds = new Set();

  const snap = await getDocs(collection(db, 'products'));
  snap.forEach(d => fsList.push({ id: d.id, ...d.data() }));

  const remSnap = await getDocs(collection(db, 'deleted_products'));
  remSnap.forEach(d => {
    deletedIds.add(d.id.toLowerCase());
    const data = d.data();
    if (data.id) deletedIds.add(String(data.id).toLowerCase());
  });

  const isDeleted = (p) => {
    if (!p || !p.id) return false;
    return deletedIds.has(String(p.id).toLowerCase().trim());
  };

  const map = new Map();

  DEFAULT_CATALOG_PRODUCTS.forEach(p => {
    if (!isDeleted(p)) map.set(p.id, { ...p });
  });

  fsList.forEach(p => {
    if (!isDeleted(p)) map.set(p.id, { ...p });
  });

  const final = Array.from(map.values());
  console.log(`\n=== TOTAL PRODUCTS SHOWING: ${final.length} ===`);
  final.forEach((p, i) => {
    console.log(`${i + 1}. [${p.id}] ${p.name} (SKU: ${p.sku || 'N/A'})`);
  });
}

testExactIdFiltering().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
