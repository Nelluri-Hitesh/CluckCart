import cv2
import os

video_path = r"C:\Users\nellu\OneDrive\Desktop\WhatsApp Video 2026-11-21 at 12.46.40 PM.mp4"
output_dir = r"C:\Users\nellu\.gemini\antigravity\brain\f18e5355-96b9-4564-bbb4-645704269d87\scratch\video_frames"
os.makedirs(output_dir, exist_ok=True)

cap = cv2.VideoCapture(video_path)
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
fps = cap.get(cv2.CAP_PROP_FPS)
duration = total_frames / fps if fps > 0 else 0
print(f"Total frames: {total_frames}, FPS: {fps:.2f}, Duration: {duration:.2f}s")

num_samples = 15
step = max(1, total_frames // num_samples)

saved_frames = []
for i in range(num_samples):
    frame_idx = min(i * step, total_frames - 1)
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
    ret, frame = cap.read()
    if ret:
        out_path = os.path.join(output_dir, f"frame_{i:02d}.jpg")
        cv2.imwrite(out_path, frame)
        saved_frames.append(out_path)

cap.release()
print(f"Saved {len(saved_frames)} frames to {output_dir}")
