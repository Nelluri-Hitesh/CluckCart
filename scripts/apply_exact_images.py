import cv2
import os

frames_dir = r"C:\Users\nellu\.gemini\antigravity\brain\f18e5355-96b9-4564-bbb4-645704269d87\scratch\video_frames"
public_dir = r"C:\Users\nellu\OneDrive\Desktop\CluckCart\public\images"
os.makedirs(public_dir, exist_ok=True)

# Load frames
f0 = cv2.imread(os.path.join(frames_dir, "frame_00.jpg"))
f1 = cv2.imread(os.path.join(frames_dir, "frame_01.jpg"))
f3 = cv2.imread(os.path.join(frames_dir, "frame_03.jpg"))
f4 = cv2.imread(os.path.join(frames_dir, "frame_04.jpg"))
f5 = cv2.imread(os.path.join(frames_dir, "frame_05.jpg"))
f7 = cv2.imread(os.path.join(frames_dir, "frame_07.jpg"))
f11 = cv2.imread(os.path.join(frames_dir, "frame_11.jpg"))

# 1. hero.jpg
hero = f0[95:692, 20:1120]
cv2.imwrite(os.path.join(public_dir, "hero.jpg"), hero)

# 2. whole.jpg
whole = f4[418:682, 21:372]
cv2.imwrite(os.path.join(public_dir, "whole.jpg"), whole)

# 3. fry-cut.jpg
fry_cut = f11[445:665, 30:280]
cv2.imwrite(os.path.join(public_dir, "fry-cut.jpg"), fry_cut)

# 4. curry-cut.jpg
curry_cut = f7[578:842, 21:372]
cv2.imwrite(os.path.join(public_dir, "curry-cut.jpg"), curry_cut)

# 5. boneless.jpg
boneless = f3[418:682, 21:372]
cv2.imwrite(os.path.join(public_dir, "boneless.jpg"), boneless)

# 6. wings.jpg
wings = f5[418:682, 21:372]
cv2.imwrite(os.path.join(public_dir, "wings.jpg"), wings)

# 7. legs.jpg
legs = f7[578:842, 392:743]
cv2.imwrite(os.path.join(public_dir, "legs.jpg"), legs)

# 8. thighs.jpg
thighs = f11[445:665, 606:854]
cv2.imwrite(os.path.join(public_dir, "thighs.jpg"), thighs)

# 9. breast.jpg
breast = f11[445:665, 874:1122]
cv2.imwrite(os.path.join(public_dir, "breast.jpg"), breast)

# 10. liver.jpg
liver = f1[80:295, 615:860]
cv2.imwrite(os.path.join(public_dir, "liver.jpg"), liver)

print("All exact images successfully written to public/images/")
