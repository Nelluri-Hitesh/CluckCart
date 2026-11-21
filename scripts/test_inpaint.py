import cv2
import numpy as np

img = cv2.imread(r"C:\Users\nellu\.gemini\antigravity\brain\f18e5355-96b9-4564-bbb4-645704269d87\scratch\test_crops\test_whole.jpg")
h, w, _ = img.shape

# Mask for badge (top left)
mask = np.zeros((h, w), dtype=np.uint8)
mask[10:45, 0:85] = 255 # 12% OFF badge
mask[8:55, w-55:w-5] = 255 # Heart circle

inpainted = cv2.inpaint(img, mask, inpaintRadius=7, flags=cv2.INPAINT_TELEA)

cv2.imwrite(r"C:\Users\nellu\.gemini\antigravity\brain\f18e5355-96b9-4564-bbb4-645704269d87\scratch\test_crops\inpainted_whole.jpg", inpainted)
print("Inpainted saved.")
