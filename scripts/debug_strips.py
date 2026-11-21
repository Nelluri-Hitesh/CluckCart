import cv2
import os

frames_dir = r"C:\Users\nellu\.gemini\antigravity\brain\f18e5355-96b9-4564-bbb4-645704269d87\scratch\video_frames"
debug_dir = r"C:\Users\nellu\.gemini\antigravity\brain\f18e5355-96b9-4564-bbb4-645704269d87\scratch\debug_crops"
os.makedirs(debug_dir, exist_ok=True)

# Let's inspect frame_01 for liver
f1 = cv2.imread(os.path.join(frames_dir, "frame_01.jpg"))
# Let's crop full row 1
cv2.imwrite(os.path.join(debug_dir, "f1_row1.jpg"), f1[80:360, :])

# Let's inspect frame_11 for thighs and breast
f11 = cv2.imread(os.path.join(frames_dir, "frame_11.jpg"))
# The bottom cards row: let's save y from 650 to 970
cv2.imwrite(os.path.join(debug_dir, "f11_bottom.jpg"), f11[650:970, :])

# Let's inspect frame_13
f13 = cv2.imread(os.path.join(frames_dir, "frame_13.jpg"))
cv2.imwrite(os.path.join(debug_dir, "f13_bottom.jpg"), f13[650:970, :])

print("Debug strips saved.")
