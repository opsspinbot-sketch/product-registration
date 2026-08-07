import os

parent_folder = r"C:\Users\spinb\OneDrive\Desktop\Faulty-product-videos"

products = [
    "Arcade",
    "ASTRO",
    "HX500",
    "HX300",
    "MK87",
    "MK61",
    "GT900",
    "GT500",
    "GT500wireless",
    "x20",
    "X50",
    "MagV1"
]

months = [
    "June2026",
    "July2026",
    "August2026",
    "September2026",
    "October2026",
    "November2026",
    "December2026"
]

for product in products:
    for month in months:
        folder_path = os.path.join(parent_folder, product, month)
        os.makedirs(folder_path, exist_ok=True)

print("✅ All folders created successfully!")