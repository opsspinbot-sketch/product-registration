const DEFAULT_CATALOG_PRODUCTS = [
  { id: "prod_1", name: "SpinBot IceDot Mag v1 Mobile Cooler", sku: "SB-ICEDOT-MAG1", brand: "SpinBot", warrantyPeriod: "12 Months", status: "Active", category: "Coolers" },
  { id: "prod_2", name: "SpinBot BattleMods Apex Gaming Trigger", sku: "SB-BM-APEX", brand: "SpinBot", warrantyPeriod: "6 Months", status: "Active", category: "Gaming Triggers" },
  { id: "prod_3", name: "SpinBot BattleBudz C10 Type-C Earphone", sku: "SB-BB-C10", brand: "SpinBot", warrantyPeriod: "12 Months", status: "Active", category: "Earphones & Headphones" },
  { id: "prod_4", name: "SpinBot Airflow X10 Laptop Cooling Pad", sku: "SB-AF-X10", brand: "SpinBot", warrantyPeriod: "12 Months", status: "Active", category: "Laptop Cooling" },
  { id: "prod_5", name: "SpinBot Rage MK87 Mechanical Keyboard", sku: "SB-MK87", brand: "SpinBot", warrantyPeriod: "24 Months", status: "Active", category: "Keyboards" },
  { id: "prod_6", name: "SpinBot HX500 Gaming Headset", sku: "SB-HX500", brand: "SpinBot", warrantyPeriod: "12 Months", status: "Active", category: "Earphones & Headphones" }
];

function normalizeCategory(cat) {
  if (!cat) return 'General';
  const c = String(cat).trim();
  const lower = c.toLowerCase();
  if (lower.includes('mousepad')) return 'Gaming Mousepads';
  if (lower.includes('trigger')) return 'Gaming Triggers';
  if (lower.includes('laptop')) return 'Laptop Cooling';
  if (lower.includes('earphone') || lower.includes('headphone') || lower.includes('headset') || lower.includes('battlebudz') || lower.includes('ranger')) return 'Earphones & Headphones';
  if (lower.includes('cooler')) return 'Coolers';
  if (lower.includes('keyboard')) return 'Keyboards';
  if (lower.includes('mouse')) return 'Gaming Mice';
  if (lower.includes('sleeve')) return 'Finger Sleeves';
  if (lower.includes('controller') || lower.includes('gamepad') || lower.includes('arcade')) return 'Controllers & Gamepads';
  return c;
}

const products = DEFAULT_CATALOG_PRODUCTS;
const activeCategory = 'All';
const searchQuery = '';

const filtered = products.filter(p => {
  const normCat = normalizeCategory(p.category);
  const matchCat = activeCategory === 'All' || normCat === activeCategory;
  const q = searchQuery.toLowerCase();
  const matchQ = !q || (p.name && p.name.toLowerCase().includes(q)) || (p.sku && p.sku.toLowerCase().includes(q));
  return matchCat && matchQ;
});

console.log("Filtered count:", filtered.length);
console.log("Products:", filtered.map(p => p.name));
