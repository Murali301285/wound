import cv2
import numpy as np
import os

def analyze_kaggle_masks():
    mask_dir = 'backend/data/kaggle/masks'
    files = os.listdir(mask_dir)[:5] # Check first 5
    
    for fname in files:
        path = os.path.join(mask_dir, fname)
        mask = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
        if mask is None:
            print(f"Could not read {fname}")
            continue
            
        unique = np.unique(mask)
        print(f"File: {fname}, Unique Values: {unique}")

if __name__ == "__main__":
    analyze_kaggle_masks()
