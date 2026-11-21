import cv2
import os

frames_dir = r"C:\Users\nellu\.gemini\antigravity\brain\f18e5355-96b9-4564-bbb4-645704269d87\scratch\video_frames"
out_dir = r"C:\Users\nellu\.gemini\antigravity\brain\f18e5355-96b9-4564-bbb4-645704269d87\scratch\clean_crops"
os.makedirs(out_dir, exist_ok=True)

# 1. hero.jpg from frame_00.jpg
f0 = cv2.imread(os.path.join(frames_dir, "frame_00.jpg"))
hero = f0[95:692, 20:1120]
cv2.imwrite(os.path.join(out_dir, "hero.jpg"), hero)

# 2. whole.jpg from frame_04.jpg [418:682, 21:372]
f4 = cv2.imread(os.path.join(frames_dir, "frame_04.jpg"))
whole = f4[418:682, 21:372]
cv2.imwrite(os.path.join(out_dir, "whole.jpg"), whole)

# 3. wings.jpg from frame_05.jpg [418:682, 21:372]
f5 = cv2.imread(os.path.join(frames_dir, "frame_05.jpg"))
wings = f5[418:682, 21:372]
cv2.imwrite(os.path.join(out_dir, "wings.jpg"), wings)

# 4. boneless.jpg from frame_03.jpg [418:682, 21:372]
f3 = cv2.imread(os.path.join(frames_dir, "frame_03.jpg"))
boneless = f3[418:682, 21:372]
cv2.imwrite(os.path.join(out_dir, "boneless.jpg"), boneless)

# 5. fry-cut.jpg from frame_12.jpg [95:645, 21:542]
f12 = cv2.imread(os.path.join(frames_dir, "frame_12.jpg"))
fry_cut = f12[95:645, 21:542]
cv2.imwrite(os.path.join(out_dir, "fry-cut.jpg"), fry_cut)

# 6. curry-cut.jpg from frame_07.jpg [578:842, 21:372]
f7 = cv2.imread(os.path.join(frames_dir, "frame_07.jpg"))
curry_cut = f7[578:842, 21:372]
cv2.imwrite(os.path.join(out_dir, "curry-cut.jpg"), curry_cut)

# 7. legs.jpg from frame_07.jpg [578:842, 392:743]
legs = f7[578:842, 392:743]
cv2.imwrite(os.path.join(out_dir, "legs.jpg"), legs)

# 8. liver.jpg from frame_01.jpg [88:352, 763:1114]
f1 = cv2.imread(os.path.join(frames_dir, "frame_01.jpg"))
liver = f1[88:352, 763:1114]
cv2.imwrite(os.path.join(out_dir, "liver.jpg"), liver)

# 9. thighs.jpg and 10. breast.jpg from frame_11.jpg and frame_13.jpg
# In frame_11: bottom row has 4 cards in "You might also like":
# Col 1: Chicken Fry Cut Skinless [753:955, 30:298]
# Col 2: Boneless Chicken Cubes [753:955, 318:586]
# Col 3: Boneless Chicken Thigh [753:955, 606:874]
# Col 4: Chicken Breast Boneless [753:955, 894:1140]
f11 = cv2.imread(os.path.join(frames_dir, "frame_11.jpg"))
thighs = f11[753:955, 606:874]
cv2.imwrite(os.path.join(out_dir, "thighs.jpg"), thighs)

# In frame_13: scrolled slightly left, let's see where breast is
f13 = cv2.imread(os.path.join(frames_dir, "frame_13.jpg"))
# Col 4 in frame_11 is at 894:1140. In frame_13, breast is at [753:955, 874:1142]
breast = f13[753:955, 874:1142]
cv2.imwrite(os.path.join(out_dir, "breast.jpg"), breast)

print("All 10 crops saved.")
