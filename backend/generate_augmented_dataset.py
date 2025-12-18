import os
import cv2
import numpy as np
import shutil

# --- Configuration ---
SOURCE_DIRS = [
    r"D:\16 12\WoundCare\backend\data\kaggle",
    r"D:\16 12\WoundCare\backend\data\kaggle2"
]
OUTPUT_DIR = r"D:\16 12\WoundCare\backend\data\Agument"
OUTPUT_IMAGES_DIR = os.path.join(OUTPUT_DIR, "images")
OUTPUT_MASKS_DIR = os.path.join(OUTPUT_DIR, "masks")

# Create output directories if they don't exist
os.makedirs(OUTPUT_IMAGES_DIR, exist_ok=True)
os.makedirs(OUTPUT_MASKS_DIR, exist_ok=True)

# Global Counter
global_counter = 1

def save_image(img, path):
    cv2.imwrite(path, img)

def process_and_save(image, mask, base_name):
    global global_counter
    
    # --- 1. Original ---
    img_name = f"Aug17122025_{global_counter:04d}.png" # Save everything as PNG for consistency
    mask_name = f"Aug17122025_{global_counter:04d}.png"
    
    save_image(image, os.path.join(OUTPUT_IMAGES_DIR, img_name))
    save_image(mask, os.path.join(OUTPUT_MASKS_DIR, mask_name))
    global_counter += 1

    # --- 2. Rotate 90 Degrees Clockwise ---
    img_rot90 = cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)
    mask_rot90 = cv2.rotate(mask, cv2.ROTATE_90_CLOCKWISE)
    
    img_name = f"Aug17122025_{global_counter:04d}.png"
    mask_name = f"Aug17122025_{global_counter:04d}.png"
    
    save_image(img_rot90, os.path.join(OUTPUT_IMAGES_DIR, img_name))
    save_image(mask_rot90, os.path.join(OUTPUT_MASKS_DIR, mask_name))
    global_counter += 1

    # --- 3. Horizontal Flip ---
    img_flip = cv2.flip(image, 1) # 1 = Horizontal
    mask_flip = cv2.flip(mask, 1)
    
    img_name = f"Aug17122025_{global_counter:04d}.png"
    mask_name = f"Aug17122025_{global_counter:04d}.png"
    
    save_image(img_flip, os.path.join(OUTPUT_IMAGES_DIR, img_name))
    save_image(mask_flip, os.path.join(OUTPUT_MASKS_DIR, mask_name))
    global_counter += 1

    # --- 4. Rotate 45 Degrees ---
    # Need to handle rotation while keeping the whole image or cropping? 
    # Usually easier to keep original size and pad with black.
    (h, w) = image.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, 45, 1.0)
    
    # Calculate new bounding box to avoid cropping
    cos = np.abs(M[0, 0])
    sin = np.abs(M[0, 1])
    new_w = int((h * sin) + (w * cos))
    new_h = int((h * cos) + (w * sin))
    M[0, 2] += (new_w / 2) - center[0]
    M[1, 2] += (new_h / 2) - center[1]

    img_rot45 = cv2.warpAffine(image, M, (new_w, new_h), borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0))
    # Be careful with masks! Interpolation should be NEAREST for masks to avoid creating new classes (e.g. 0.5)
    # However, since these are likely RGB masks or grayscale masks, bilinear is okay IF we re-threshold later.
    # But safe bet: NEAREST for class indices, or standard for visual masks.
    # Assuming these are standard segmentation masks (black/white or colored regions).
    mask_rot45 = cv2.warpAffine(mask, M, (new_w, new_h), borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0), flags=cv2.INTER_NEAREST)

    img_name = f"Aug17122025_{global_counter:04d}.png"
    mask_name = f"Aug17122025_{global_counter:04d}.png"
    
    save_image(img_rot45, os.path.join(OUTPUT_IMAGES_DIR, img_name))
    save_image(mask_rot45, os.path.join(OUTPUT_MASKS_DIR, mask_name))
    global_counter += 1

def main():
    print("Starting Data Augmentation...")
    
    for source_dir in SOURCE_DIRS:
        images_dir = os.path.join(source_dir, "images")
        masks_dir = os.path.join(source_dir, "masks")
        
        if not os.path.exists(images_dir) or not os.path.exists(masks_dir):
            print(f"Skipping {source_dir}: 'images' or 'masks' folder missing.")
            continue
            
        files = sorted(os.listdir(images_dir))
        print(f"Processing {len(files)} files from {source_dir}...")
        
        for f in files:
            if not (f.endswith(".png") or f.endswith(".jpg") or f.endswith(".jpeg")):
                continue
                
            img_path = os.path.join(images_dir, f)
            # Try to match mask file (assuming same name)
            mask_path = os.path.join(masks_dir, f)
            
            # If png vs jpg mismatch, try switching extension
            if not os.path.exists(mask_path):
                base_name = os.path.splitext(f)[0]
                possible_names = [f"{base_name}.png", f"{base_name}.jpg", f"{base_name}.jpeg"]
                found = False
                for p_name in possible_names:
                    temp_path = os.path.join(masks_dir, p_name)
                    if os.path.exists(temp_path):
                        mask_path = temp_path
                        found = True
                        break
                if not found:
                    print(f"Warning: Mask not found for {f}, skipping.")
                    continue

            image = cv2.imread(img_path)
            mask = cv2.imread(mask_path) # Read mask as-is (could be color or grayscale)
            
            if image is None:
                print(f"Error reading image: {img_path}")
                continue
            if mask is None:
                print(f"Error reading mask: {mask_path}")
                continue
                
            process_and_save(image, mask, f)

    print(f"Done! Generated {global_counter - 1} images in {OUTPUT_DIR}")

if __name__ == "__main__":
    main()
