import cv2
import os

frames_dir = r"C:\Users\nellu\.gemini\antigravity\brain\f18e5355-96b9-4564-bbb4-645704269d87\scratch\video_frames"
f11 = cv2.imread(os.path.join(frames_dir, "frame_11.jpg"))

# Let's crop fry cut from frame_11: [445:665, 30:298] -> let's test around 50 to 295
fry_test = f11[445:665, 45:295]
cv2.imwrite(r"C:\Users\nellu\.gemini\antigravity\brain\f18e5355-96b9-4564-bbb4-645704269d87\scratch\test_coords3\fry_card.jpg", fry_test)
print("Saved fry_card.")
