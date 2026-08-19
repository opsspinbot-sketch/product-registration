import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, setDoc, doc, deleteDoc } from "firebase/firestore";

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

async function testDelete() {
  // Test 1: Can we write to deleted_products?
  console.log('=== Testing Firestore write to deleted_products ===');
  try {
    const testId = 'test_delete_' + Date.now();
    await setDoc(doc(db, 'deleted_products', testId), {
      id: testId,
      deletedAt: new Date().toISOString()
    }, { merge: true });
    console.log('✅ Successfully wrote to deleted_products:', testId);
    
    // Clean up - delete the test entry
    await deleteDoc(doc(db, 'deleted_products', testId));
    console.log('✅ Cleaned up test entry');
  } catch (e) {
    console.error('❌ Failed to write to deleted_products:', e.message);
  }

  // Test 2: Check current deleted_products entries
  console.log('\n=== Current deleted_products entries ===');
  try {
    const snap = await getDocs(collection(db, 'deleted_products'));
    console.log(`Total deleted_products entries: ${snap.size}`);
    snap.forEach(d => {
      const data = d.data();
      console.log(`  - DocID: ${d.id}, ProductID: ${data.id || 'N/A'}, SKU: ${data.sku || 'N/A'}`);
    });
  } catch(e) {
    console.error('❌ Failed to read deleted_products:', e.message);
  }

  // Test 3: Check products collection
  console.log('\n=== Firestore products collection ===');
  try {
    const snap = await getDocs(collection(db, 'products'));
    console.log(`Total products: ${snap.size}`);
    snap.docs.slice(0, 5).forEach(d => {
      const data = d.data();
      console.log(`  - [${d.id}] ${data.name} (SKU: ${data.sku || 'N/A'})`);
    });
    if (snap.size > 5) console.log(`  ... and ${snap.size - 5} more`);
  } catch(e) {
    console.error('❌ Failed to read products:', e.message);
  }
}

testDelete().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
