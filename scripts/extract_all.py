import cv2
import os

video_path = r"C:\Users\nellu\OneDrive\Desktop\WhatsApp Video 2026-11-21 at 12.46.40 PM.mp4"
cap = cv2.VideoCapture(video_path)
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

# We want 30 frames across the video to catch every page viewed
out_dir = r"C:\Users\nellu\.gemini\antigravity\brain\f18e5355-96b9-4564-bbb4-645704269d87\scratch\all_frames"
os.makedirs(out_dir, exist_ok=True)

step = total_frames // 40
for i in range(40):
    cap.set(cv2.CAP_PROP_POS_FRAMES, i * step)
    ret, frame = cap.read()
    if ret:
        cv2.imwrite(os.path.join(out_dir, f"f_{i:02d}.jpg"), frame)

cap.release()
print(f"Extracted 40 frames to {out_dir}")
