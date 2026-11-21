import cv2
import os

frames_dir = r"C:\Users\nellu\.gemini\antigravity\brain\f18e5355-96b9-4564-bbb4-645704269d87\scratch\video_frames"
test_dir = r"C:\Users\nellu\.gemini\antigravity\brain\f18e5355-96b9-4564-bbb4-645704269d87\scratch\test_coords"
os.makedirs(test_dir, exist_ok=True)

f1 = cv2.imread(os.path.join(frames_dir, "frame_01.jpg"))
liver = f1[80:295, 535:780]
cv2.imwrite(os.path.join(test_dir, "liver.jpg"), liver)

f11 = cv2.imread(os.path.join(frames_dir, "frame_11.jpg"))
thighs = f11[445:665, 535:780]
breast = f11[445:665, 795:1040]
cv2.imwrite(os.path.join(test_dir, "thighs.jpg"), thighs)
cv2.imwrite(os.path.join(test_dir, "breast.jpg"), breast)

print("Saved test coords.")
