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
  { id: "prod_1", name: "SpinBot IceDot Mag v1 Mobile Cooler", sku: "SB-ICEDOT-MAG1" },
  { id: "prod_2", name: "SpinBot BattleMods Apex Gaming Trigger", sku: "SB-BM-APEX" },
  { id: "prod_3", name: "SpinBot BattleBudz C10 Type-C Earphone", sku: "SB-BB-C10" },
  { id: "prod_4", name: "SpinBot Airflow X10 Laptop Cooling Pad", sku: "SB-AF-X10" },
  { id: "prod_5", name: "SpinBot Rage MK87 Mechanical Keyboard", sku: "SB-MK87" },
  { id: "prod_6", name: "SpinBot HX500 Gaming Headset", sku: "SB-HX500" }
];

async function testNewLogic() {
  let fsList = [];
  const deletedIds = new Set();
  const deletedSkus = new Set();

  const snap = await getDocs(collection(db, 'products'));
  snap.forEach(d => fsList.push({ id: d.id, ...d.data() }));
  console.log(`Firestore products: ${snap.size}`);

  const remSnap = await getDocs(collection(db, 'deleted_products'));
  remSnap.forEach(d => {
    const data = d.data();
    deletedIds.add(d.id.toLowerCase());
    if (data.id) deletedIds.add(String(data.id).toLowerCase());
    if (data.sku) deletedSkus.add(String(data.sku).toLowerCase());
    if (Array.isArray(data.keys)) {
      data.keys.forEach(k => {
        const kLower = String(k).toLowerCase().trim();
        if (kLower) deletedIds.add(kLower);
      });
    }
  });
  console.log(`Deleted IDs: ${deletedIds.size}, Deleted SKUs: ${deletedSkus.size}`);

  const isDeleted = (p) => {
    if (!p) return true;
    const id = (p.id || '').toLowerCase().trim();
    const sku = (p.sku || '').toLowerCase().trim();
    return (id && deletedIds.has(id)) || (sku && deletedSkus.has(sku));
  };

  const map = new Map();

  DEFAULT_CATALOG_PRODUCTS.forEach(p => {
    if (!isDeleted(p)) map.set(p.id, { ...p });
  });

  fsList.forEach(p => {
    if (!isDeleted(p)) map.set(p.id, { ...p });
  });

  const final = Array.from(map.values());
  console.log(`\n=== FINAL PRODUCT COUNT: ${final.length} ===`);
  final.forEach((p, i) => {
    console.log(`${i + 1}. [${p.id}] ${p.name} (SKU: ${p.sku || 'N/A'})`);
  });

  // Check for any products that were incorrectly filtered
  const fsNotShown = fsList.filter(p => !map.has(p.id));
  if (fsNotShown.length > 0) {
    console.log(`\n⚠️ ${fsNotShown.length} Firestore products filtered out:`);
    fsNotShown.forEach(p => console.log(`  - [${p.id}] ${p.name} (deleted: ${isDeleted(p)})`));
  }
}

testNewLogic().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
