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
  { id: "prod_seed_1", name: "SpinBot IceDot Mag v1 Mobile Cooler", sku: "SB-ICEDOT-MAG1", brand: "SpinBot", warrantyPeriod: "12 Months", status: "Active", category: "Coolers" },
  { id: "prod_seed_2", name: "SpinBot BattleMods Apex Gaming Trigger", sku: "SB-BM-APEX", brand: "SpinBot", warrantyPeriod: "6 Months", status: "Active", category: "Gaming Triggers" },
  { id: "prod_seed_3", name: "SpinBot BattleBudz C10 Type-C Earphone", sku: "SB-BB-C10", brand: "SpinBot", warrantyPeriod: "12 Months", status: "Active", category: "Earphones & Headphones" },
  { id: "prod_seed_4", name: "SpinBot Airflow X10 Laptop Cooling Pad", sku: "SB-AF-X10", brand: "SpinBot", warrantyPeriod: "12 Months", status: "Active", category: "Laptop Cooling" },
  { id: "prod_seed_5", name: "SpinBot Rage MK87 Mechanical Keyboard", sku: "SB-MK87", brand: "SpinBot", warrantyPeriod: "24 Months", status: "Active", category: "Keyboards" },
  { id: "prod_seed_6", name: "SpinBot HX500 Gaming Headset", sku: "SB-HX500", brand: "SpinBot", warrantyPeriod: "12 Months", status: "Active", category: "Earphones & Headphones" }
];

async function testGetProducts() {
  let fsList = [];
  let fsRemoved = [];

  const snap = await getDocs(collection(db, 'products'));
  snap.forEach(d => fsList.push({ id: d.id, ...d.data() }));

  const remSnap = await getDocs(collection(db, 'deleted_products'));
  remSnap.forEach(d => {
    const data = d.data();
    fsRemoved.push(d.id);
    if (data.id) fsRemoved.push(data.id);
    if (Array.isArray(data.keys)) fsRemoved.push(...data.keys);
  });

  const removedList = [...new Set(fsRemoved)].map(k => String(k).toLowerCase().trim());
  const map = new Map();

  const isRemoved = (p) => {
    if (!p) return false;
    const k1 = (p.id || '').toLowerCase().trim();
    const k2 = (p.sku || '').toLowerCase().trim();
    const k3 = (p.name || '').toLowerCase().trim();
    return (k1 && removedList.includes(k1)) || (k2 && removedList.includes(k2)) || (k3 && removedList.includes(k3));
  };

  DEFAULT_CATALOG_PRODUCTS.forEach(p => {
    const key = (p.id || p.sku || p.name).toLowerCase().trim();
    if (!isRemoved(p)) {
      map.set(key, p);
    }
  });

  fsList.forEach(p => {
    const key = (p.id || p.sku || p.name).toLowerCase().trim();
    if (!isRemoved(p)) {
      map.set(key, { id: p.id, ...p });
    }
  });

  const finalProducts = Array.from(map.values());
  console.log(`Total unique products with ID keying: ${finalProducts.length}`);
}

testGetProducts().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
