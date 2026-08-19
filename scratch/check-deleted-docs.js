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

async function testDeletedFiltering() {
  const remSnap = await getDocs(collection(db, 'deleted_products'));
  console.log("=== deleted_products docs ===");
  remSnap.forEach(d => {
    console.log("Doc ID:", d.id, "Data:", d.data());
  });
}

testDeletedFiltering().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
