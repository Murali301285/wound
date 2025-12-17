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

# Ensure cache directory exists
CACHE_DIR = "backend/data/cache"
os.makedirs(CACHE_DIR, exist_ok=True)

# Define Color Mapping (RGB)
COLOR_MAP = {
    "Background": (0, 0, 255),
    "Granulation": (255, 0, 0),
    "Slough": (255, 255, 0),
    "Necrosis": (0, 0, 0),
    "Maceration": (255, 255, 255),
    "Tendon": (0, 255, 255), # Cyan/Sky Blue
    "Bone": (255, 200, 124)  # Cream
}

# Class Indices
CLASS_INDICES = {
    "Granulation": 0,
    "Slough": 1,
    "Necrosis": 2,
    "Maceration": 3,
    "Tendon": 4,
    "Bone": 5,
    "Background": 6
}

def rgb_to_mask(mask_rgb):
    """
    Convert RGB mask to 2D integer mask.
    """
    h, w, _ = mask_rgb.shape
    mask_idx = np.full((h, w), 6, dtype=np.int64) # Default Background
    pixels = mask_rgb.reshape(-1, 3)
    min_dist = np.full(len(pixels), float('inf'))
    
    for name, rgb in COLOR_MAP.items():
        if name not in CLASS_INDICES: continue
        idx = CLASS_INDICES[name]
        target = np.array(rgb)
        dist = np.linalg.norm(pixels - target, axis=1)
        
        mask_update = dist < min_dist
        mask_idx.reshape(-1)[mask_update] = idx
        min_dist[mask_update] = dist[mask_update]
        
    return mask_idx

def get_pseudo_label(img_rgb, mask_binary):
    """
    Generate pseudo-labels (0-5) based on color inside binary mask.
    """
    h, w, _ = img_rgb.shape
    labels = np.full((h, w), 6, dtype=np.int64) # Default Background
    
    wound_pixels = (mask_binary == 255)
    if not np.any(wound_pixels):
        return labels
        
    hsv = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2HSV)
    
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
    
    labels[wound_pixels] = 0 # Default Granulation
    labels[wound_pixels & (mask_yellow > 0)] = 1 # Slough
    labels[wound_pixels & (mask_black > 0)] = 2 # Necrosis
    
    return labels

def process_single_image(img_path, mask_path, processor, extractor, is_binary_mask=True):
    # Load Image
    img, img_float = processor.load_and_preprocess(image_path=img_path)
    
    # Load Mask
    if is_binary_mask:
        mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
        if mask is None: return None
        h, w = img.shape[:2]
        if mask.shape != (h, w):
            mask = cv2.resize(mask, (w, h), interpolation=cv2.INTER_NEAREST)
        label_mask = get_pseudo_label(img, mask)
    else:
        # RGB Mask (Original Dataset)
        mask_bgr = cv2.imread(mask_path)
        if mask_bgr is None: return None
        mask_rgb = cv2.cvtColor(mask_bgr, cv2.COLOR_BGR2RGB)
        label_mask = rgb_to_mask(mask_rgb)
    
    # Generate Graph
    segments = processor.generate_superpixels(img_float)
    rag = processor.build_rag(img_float, segments)
    node_features = extractor.extract_node_features(img, segments)
    
    # Assign Labels
    unique_segments = np.unique(segments)
    node_labels = []
    
    for seg_val in unique_segments:
        segment_mask = (segments == seg_val)
        gt_pixels = label_mask[segment_mask]
        
        if len(gt_pixels) > 0:
            counts = np.bincount(gt_pixels, minlength=7)
            label = np.argmax(counts)
        else:
            label = 6 # Background
        node_labels.append(label)
        
    data = convert_to_pyg_data(node_features, rag, label_mask=node_labels)
    return data

def load_dataset_cached(dataset_name, img_dir, mask_dir, is_binary_mask=True, limit=None):
    """
    Load dataset with caching to disk.
    """
    cache_path = os.path.join(CACHE_DIR, dataset_name)
    os.makedirs(cache_path, exist_ok=True)
    
    processor = ImageGraphProcessor(n_segments=150, compactness=20)
    extractor = FeatureExtractor()
    
    dataset = []
    files = os.listdir(img_dir)
    files = [f for f in files if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
    
    if limit:
        np.random.shuffle(files)
        files = files[:limit]
        
    print(f"[{dataset_name}] Found {len(files)} potential images. Checking cache...")
    
    for fname in files:
        cache_file = os.path.join(cache_path, f"{fname}.pt")
        img_path = os.path.join(img_dir, fname)
        mask_path = os.path.join(mask_dir, fname)
        
        if not os.path.exists(mask_path):
            continue
            
        # Check Cache
        if os.path.exists(cache_file):
            try:
                data = torch.load(cache_file)
                dataset.append(data)
                continue
            except Exception as e:
                print(f"Corrupt cache for {fname}, reprocessing...")
        
        # Process New
        try:
            print(f"Processing {fname}...")
            data = process_single_image(img_path, mask_path, processor, extractor, is_binary_mask)
            if data:
                torch.save(data, cache_file)
                dataset.append(data)
        except Exception as e:
            print(f"Error processing {fname}: {e}")
            
    return dataset

def train_full():
    # 1. Original Dataset
    ds1 = load_dataset_cached(
        "WoundTissue", 
        "backend/data/WoundTissue/image", 
        "backend/data/WoundTissue/label", 
        is_binary_mask=False
    )
    
    # 2. Kaggle 1
    ds2 = load_dataset_cached(
        "Kaggle1",
        "backend/data/kaggle/images",
        "backend/data/kaggle/masks",
        is_binary_mask=True,
        limit=600 # Keep using the 600 we likely already cached implicitly or re-process
    )
    
    # 3. Kaggle 2 (New 1000)
    ds3 = load_dataset_cached(
        "Kaggle2",
        "backend/data/kaggle2/images",
        "backend/data/kaggle2/masks",
        is_binary_mask=True
    )
    
    full_dataset = ds1 + ds2 + ds3
    print(f"Total Combined Training Samples: {len(full_dataset)}")
    
    if len(full_dataset) == 0:
        print("No data found!")
        return

    train_loader = DataLoader(full_dataset, batch_size=1, shuffle=True)
    
    print("Initializing Model...")
    model = WoundGAT(num_node_features=24, num_classes=7)
    
    # Check for existing weights to fine-tune
    if os.path.exists('backend/model_weights.pth'):
        print("Loading existing weights for fine-tuning...")
        model.load_state_dict(torch.load('backend/model_weights.pth'))
        
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001, weight_decay=5e-4) # Lower LR for fine-tuning
    criterion = torch.nn.NLLLoss()
    
    print("Starting Training...")
    model.train()
    for epoch in range(20): # 20 Epochs is enough if fine-tuning
        total_loss = 0
        for batch in train_loader:
            optimizer.zero_grad()
            out_nodes, _ = model(batch)
            loss = criterion(out_nodes, batch.y)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
            
        print(f"Epoch {epoch}: Loss {total_loss/len(train_loader):.4f}")
            
    print("Saving Full Model...")
    torch.save(model.state_dict(), 'backend/model_weights.pth')
    print("Done!")

if __name__ == "__main__":
    train_full()
