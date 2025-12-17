import cv2
import numpy as np
import os

def analyze_mask_colors():
    mask_path = 'backend/data/WoundTissue/label/img (1).png'
    if not os.path.exists(mask_path):
        print(f"File not found: {mask_path}")
        return

    # Read as BGR
    mask = cv2.imread(mask_path)
    # Convert to RGB
    mask_rgb = cv2.cvtColor(mask, cv2.COLOR_BGR2RGB)
    
    # Get unique colors
    # Reshape to list of pixels
    pixels = mask_rgb.reshape(-1, 3)
    unique_colors, counts = np.unique(pixels, axis=0, return_counts=True)
    
    print(f"Unique Colors in {mask_path}:")
    for color, count in zip(unique_colors, counts):
        print(f"RGB: {color} - Count: {count}")

if __name__ == "__main__":
    analyze_mask_colors()
