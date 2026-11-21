import cv2
import os

all_dir = r"C:\Users\nellu\.gemini\antigravity\brain\f18e5355-96b9-4564-bbb4-645704269d87\scratch\all_frames"

# Let's check OCR or match cards by saving crops from various frames
crops_dir = r"C:\Users\nellu\.gemini\antigravity\brain\f18e5355-96b9-4564-bbb4-645704269d87\scratch\final_crops"
os.makedirs(crops_dir, exist_ok=True)

# 1. HERO
f0 = cv2.imread(os.path.join(all_dir, "f_00.jpg"))
hero = f0[95:692, 20:1120]
cv2.imwrite(os.path.join(crops_dir, "hero.jpg"), hero)

# 2. WHOLE
f10 = cv2.imread(os.path.join(all_dir, "f_10.jpg"))
whole = f10[418:682, 21:372]
cv2.imwrite(os.path.join(crops_dir, "whole.jpg"), whole)

# 3. WINGS
f14 = cv2.imread(os.path.join(all_dir, "f_14.jpg"))
wings = f14[418:682, 21:372]
cv2.imwrite(os.path.join(crops_dir, "wings.jpg"), wings)

# 4. BONELESS
boneless = f14[418:682, 763:1114]
cv2.imwrite(os.path.join(crops_dir, "boneless.jpg"), boneless)

# 5. FRY CUT
# Let's check f_30.jpg for the product detail large image
f30 = cv2.imread(os.path.join(all_dir, "f_30.jpg"))
fry_cut = f30[95:645, 21:542]
cv2.imwrite(os.path.join(crops_dir, "fry-cut.jpg"), fry_cut)

# Let's inspect f_02, f_04, f_06, f_18, f_20, f_22, f_24, f_26
for idx in [2, 4, 6, 18, 20, 22, 24, 26, 32, 34]:
    fn = os.path.join(all_dir, f"f_{idx:02d}.jpg")
    if os.path.exists(fn):
        img = cv2.imread(fn)
        # crop row 1 col 1, 2, 3 and row 2 col 1, 2, 3
        c1 = img[418:682, 21:372]
        c2 = img[418:682, 392:743]
        c3 = img[418:682, 763:1114]
        cv2.imwrite(os.path.join(crops_dir, f"cand_{idx:02d}_r1_c1.jpg"), c1)
        cv2.imwrite(os.path.join(crops_dir, f"cand_{idx:02d}_r1_c2.jpg"), c2)
        cv2.imwrite(os.path.join(crops_dir, f"cand_{idx:02d}_r1_c3.jpg"), c3)

print("Batch crops saved.")
