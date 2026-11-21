import cv2
import os

scratch_dir = r"C:\Users\nellu\.gemini\antigravity\brain\f18e5355-96b9-4564-bbb4-645704269d87\scratch"
frames_dir = os.path.join(scratch_dir, "video_frames")
crops_dir = os.path.join(scratch_dir, "test_crops")
os.makedirs(crops_dir, exist_ok=True)

# 1. fry-cut from frame_12.jpg
# Large image on left side of product detail page
img12 = cv2.imread(os.path.join(frames_dir, "frame_12.jpg"))
h, w, _ = img12.shape
print(f"frame_12 size: {w}x{h}")

# Let's crop candidate region for fry-cut
# In frame_12: left column image is roughly x: 20 to 540, y: 140 to 650
crop_fry = img12[150:645, 20:542]
cv2.imwrite(os.path.join(crops_dir, "test_fry_cut.jpg"), crop_fry)

# 2. boneless from frame_03.jpg
img03 = cv2.imread(os.path.join(frames_dir, "frame_03.jpg"))
# Card in frame_03: Boneless Chicken Cubes
# x: 20 to 370, y: 415 to 685
crop_boneless = img03[415:685, 20:373]
cv2.imwrite(os.path.join(crops_dir, "test_boneless.jpg"), crop_boneless)

# 3. whole chicken from frame_04.jpg
img04 = cv2.imread(os.path.join(frames_dir, "frame_04.jpg"))
# Card 1: Whole chicken with skin
crop_whole = img04[415:685, 20:373]
cv2.imwrite(os.path.join(crops_dir, "test_whole.jpg"), crop_whole)

# 4. wings from frame_05.jpg
img05 = cv2.imread(os.path.join(frames_dir, "frame_05.jpg"))
crop_wings = img05[415:685, 20:373]
cv2.imwrite(os.path.join(crops_dir, "test_wings.jpg"), crop_wings)

# 5. liver from frame_01.jpg
img01 = cv2.imread(os.path.join(frames_dir, "frame_01.jpg"))
# Card 3 is Chicken Liver
crop_liver = img01[85:300, 538:778] # card image in row
cv2.imwrite(os.path.join(crops_dir, "test_liver.jpg"), crop_liver)

# 6. curry-cut from frame_07.jpg
img07 = cv2.imread(os.path.join(frames_dir, "frame_07.jpg"))
# bottom-left card in frame_07: Chicken Curry Cut with Skin
crop_curry = img07[575:845, 20:373]
cv2.imwrite(os.path.join(crops_dir, "test_curry.jpg"), crop_curry)

# 7. legs from frame_07.jpg
# bottom-middle card in frame_07: legs on wooden board
crop_legs = img07[575:845, 342:625]
cv2.imwrite(os.path.join(crops_dir, "test_legs.jpg"), crop_legs)

# 8. thighs from frame_11.jpg
img11 = cv2.imread(os.path.join(frames_dir, "frame_11.jpg"))
# bottom 3rd card in frame_11: Boneless Chicken Thigh
crop_thighs = img11[445:655, 538:778]
cv2.imwrite(os.path.join(crops_dir, "test_thighs.jpg"), crop_thighs)

# 9. breast from frame_11.jpg
# bottom 4th card in frame_11: Chicken Breast Boneless
crop_breast = img11[445:655, 795:970]
cv2.imwrite(os.path.join(crops_dir, "test_breast.jpg"), crop_breast)

print("Crops generated.")
