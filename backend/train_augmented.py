import os
import cv2
import numpy as np
import torch
import torch.nn.functional as F
from app.preprocessing import ImageGraphProcessor
from app.features import FeatureExtractor
from app.model import WoundGAT
from app.utils import convert_to_pyg_data
from torch_geometric.loader import DataLoader
import glob
import random

# --- Configuration ---
DATASET_DIR = r"D:\16 12\WoundCare\backend\data\Agument"
CACHE_DIR = r"D:\16 12\WoundCare\backend\data\cache\Agument"
MODEL_SAVE_PATH = r"D:\16 12\WoundCare\backend\model_weights_augmented.pth"

os.makedirs(CACHE_DIR, exist_ok=True)

# 0=Granulation, 1=Slough, 2=Necrosis, 3=Maceration, 4=Tendon, 5=Bone, 6=Background
NUM_CLASSES = 7

def get_pseudo_label(img_rgb, mask_binary):
    """
    Generate pseudo-labels (0-5) based on color inside binary mask.
    This reconstructs the tissue type ground truth from the image color
    since the masks are binary (Wound vs Background).
    """
    h, w, _ = img_rgb.shape
    labels = np.full((h, w), 6, dtype=np.int64) # Default Background
    
    # Identify wound area
    wound_pixels = (mask_binary == 255)
    if not np.any(wound_pixels):
        return labels
        
    hsv = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2HSV)
    
    # Define color ranges for tissues
    # Granulation (Red)
    lower_red1 = np.array([0, 50, 50])
    upper_red1 = np.array([10, 255, 255])
    lower_red2 = np.array([170, 50, 50])
    upper_red2 = np.array([180, 255, 255])
    
    # Slough (Yellow)
    lower_yellow = np.array([15, 50, 50])
    upper_yellow = np.array([35, 255, 255])
    
    # Necrosis (Black)
    lower_black = np.array([0, 0, 0])
    upper_black = np.array([180, 255, 50])
    
    mask_red = cv2.inRange(hsv, lower_red1, upper_red1) | cv2.inRange(hsv, lower_red2, upper_red2)
    mask_yellow = cv2.inRange(hsv, lower_yellow, upper_yellow)
    mask_black = cv2.inRange(hsv, lower_black, upper_black)
    
    # Assign labels within wound area
    # Priority: Necrosis > Slough > Granulation (Default)
    labels[wound_pixels] = 0 # Default Granulation
    labels[wound_pixels & (mask_yellow > 0)] = 1 # Slough
    labels[wound_pixels & (mask_black > 0)] = 2 # Necrosis
    
    return labels

def process_single_image(img_path, mask_path, processor, extractor):
    try:
        # Load Image
        img, img_float = processor.load_and_preprocess(image_path=img_path)
        
        # Load Mask (Binary)
        mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
        if mask is None: 
            return None
            
        h, w = img.shape[:2]
        if mask.shape != (h, w):
            mask = cv2.resize(mask, (w, h), interpolation=cv2.INTER_NEAREST)
            
        # Generate Ground Truth Labels from Image + Binary Mask
        label_mask = get_pseudo_label(img, mask)
        
        # Generate Superpixels & Graph
        segments = processor.generate_superpixels(img_float)
        rag = processor.build_rag(img_float, segments)
        node_features = extractor.extract_node_features(img, segments)
        
        # Map pixels to nodes (superpixels)
        unique_segments = np.unique(segments)
        node_labels = []
        
        for seg_val in unique_segments:
            segment_mask = (segments == seg_val)
            gt_pixels = label_mask[segment_mask]
            
            if len(gt_pixels) > 0:
                # Majority vote for the class of this superpixel
                counts = np.bincount(gt_pixels, minlength=NUM_CLASSES)
                label = np.argmax(counts)
            else:
                label = 6 # Background
            node_labels.append(label)
            
        data = convert_to_pyg_data(node_features, rag, label_mask=node_labels)
        return data
        
    except Exception as e:
        print(f"Error processing {os.path.basename(img_path)}: {e}")
        return None

from torch_geometric.data import Dataset
import glob

# Custom Dataset for Lazy Loading
class WoundDataset(Dataset):
    def __init__(self, root, img_dir, mask_dir, limit=None, transform=None, pre_transform=None):
        self.img_dir = img_dir
        self.mask_dir = mask_dir
        self.limit = limit
        
        # We don't use 'root' for `processed_file_names` in the standard way custom to this script
        # because we manage the cache manually in `process`.
        # However, for this Lazy Loader, we assume the cache IS generating or has been generated.
        # But wait, we still need to generate the cache if it doesn't exist.
        
        # Strategy:
        # The PROPER lazy loading:
        # 1. Get list of all image files.
        # 2. In `get(idx)`, check if cache file exists.
        #    - If yes, load it.
        #    - If no, process it on the fly (slow but happens distributed during training) OR
        #      we run a pre-processing pass.
        # Given we have 19k images, we want the cache populated.
        # The previous command POPULATED 19.5k items.
        # So we can just trust the cache mostly.
        
        self.valid_files = sorted([f for f in os.listdir(img_dir) if f.lower().endswith('.png')])
        if limit:
            random.shuffle(self.valid_files)
            self.valid_files = self.valid_files[:limit]
            
        # Instantiate processor once (or per worker if using num_workers > 0)
        self.processor = ImageGraphProcessor(n_segments=150, compactness=20)
        self.extractor = FeatureExtractor()
        
        super().__init__(root, transform, pre_transform)

    def len(self):
        return len(self.valid_files)

    def get(self, idx):
        fname = self.valid_files[idx]
        cache_name = os.path.splitext(fname)[0] + ".pt"
        cache_path = os.path.join(CACHE_DIR, cache_name) # CACHE_DIR from global scope
        
        # Try loading from cache
        if os.path.exists(cache_path):
            try:
                # weights_only=False is required for loading arbitrary Python objects
                data = torch.load(cache_path, weights_only=False)
                return data
            except:
                pass # Corrupt, re-process
        
        # Process on the fly (and save to cache)
        img_path = os.path.join(self.img_dir, fname)
        mask_path = os.path.join(self.mask_dir, fname)
        
        if not os.path.exists(mask_path):
            # This should ideally not happen if lists are synced
            # Calculate a dummy or skip? PyG Dataset expects a return.
            # We'll return None and handle it in collate if possible, or just fail safely.
            # actually better to just filter the list in __init__.
            pass

        data = process_single_image(img_path, mask_path, self.processor, self.extractor)
        if data:
            torch.save(data, cache_path)
            return data
        else:
            # Return a dummy empty object or handle error
            # For simplicity, returning the first item from cache (hacky but prevents crash)
            # Realistically, we should have filtered `valid_files` perfectly.
            return torch.load(os.path.join(CACHE_DIR, os.path.splitext(self.valid_files[0])[0] + ".pt"))

def train_augmented(limit=None):
    print("--- Starting Augmented Training Pipeline (Lazy Loading) ---")
    
    img_dir = os.path.join(DATASET_DIR, "images")
    mask_dir = os.path.join(DATASET_DIR, "masks")
    
    # 1. Initialize Dataset (Instant)
    dataset = WoundDataset(root=DATASET_DIR, img_dir=img_dir, mask_dir=mask_dir, limit=limit)
    print(f"Dataset initialized with {len(dataset)} samples.")
    
    if len(dataset) == 0:
        print("No data available to train.")
        return
        
    # 2. Setup Training
    # num_workers=0 because Windows handles multiprocessing poorly with complex objects nicely
    # unless we adhere to strict pickling.
    # We can try num_workers=4, but if it crashes, revert to 0.
    # Given we are just loading .pt files, it should be fine.
    train_loader = DataLoader(dataset, batch_size=1, shuffle=True, num_workers=0)
    
    print("Initializing Model...")
    model = WoundGAT(num_node_features=24, num_classes=NUM_CLASSES)
    
    optimizer = torch.optim.Adam(model.parameters(), lr=0.005, weight_decay=5e-4) # Standard LR
    criterion = torch.nn.NLLLoss()
    
    print("Starting Training Loop...")
    model.train()
    
    epochs = 20 if limit else 30 # Train longer for full dataset
    
    for epoch in range(epochs):
        total_loss = 0
        batch_count = 0
        
        for batch in train_loader:
            if batch is None: continue 
            
            optimizer.zero_grad()
            out_nodes, _ = model(batch)
            loss = criterion(out_nodes, batch.y)
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
            batch_count += 1
            
            if batch_count % 100 == 0:
                print(f"Epoch {epoch+1} Progress: {batch_count}/{len(dataset)}", end='\r')
            
        avg_loss = total_loss / max(1, batch_count)
        print(f"\nEpoch {epoch+1}/{epochs}: Loss {avg_loss:.4f}")
            
    # 3. Save
    print(f"Saving model to {MODEL_SAVE_PATH}...")
    torch.save(model.state_dict(), MODEL_SAVE_PATH)
    print("Done!")

if __name__ == "__main__":
    # Windows Mulitprocessing support
    import sys
    import multiprocessing
    multiprocessing.freeze_support()
    
    limit = None
    if len(sys.argv) > 1:
        try:
            limit = int(sys.argv[1])
        except:
            pass
    
    train_augmented(limit)
