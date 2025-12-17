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
    "Maceration": 3, # Map to Epithelial/Other? Let's keep distinct
    "Tendon": 4,     # Map to Muscle/Bone?
    "Bone": 5,
    "Background": 6
}

def rgb_to_mask(mask_rgb):
    """
    Convert RGB mask to 2D integer mask using distance to known colors.
    """
    h, w, _ = mask_rgb.shape
    mask_idx = np.full((h, w), 6, dtype=np.int64) # Default to Background (6)
    
    # Flatten for fast processing
    pixels = mask_rgb.reshape(-1, 3)
    
    # Simple Euclidean distance to find nearest color class
    # (Can be optimized but fine for 13 images)
    min_dist = np.full(len(pixels), float('inf'))
    
    for name, rgb in COLOR_MAP.items():
        if name not in CLASS_INDICES: continue
        idx = CLASS_INDICES[name]
        target = np.array(rgb)
        
        # Calculate distance
        dist = np.linalg.norm(pixels - target, axis=1)
        
        # Update mask where this color is closer
        mask_update = dist < min_dist
        mask_idx.reshape(-1)[mask_update] = idx
        min_dist[mask_update] = dist[mask_update]
        
    return mask_idx

def process_dataset(data_dir):
    img_dir = os.path.join(data_dir, 'image')
    lbl_dir = os.path.join(data_dir, 'label')
    
    processor = ImageGraphProcessor(n_segments=200, compactness=20)
    extractor = FeatureExtractor()
    
    dataset = []
    
    files = os.listdir(img_dir)
    print(f"Found {len(files)} images.")
    
    for fname in files:
        if not fname.endswith('.png'): continue
        
        img_path = os.path.join(img_dir, fname)
        lbl_path = os.path.join(lbl_dir, fname)
        
        if not os.path.exists(lbl_path):
            print(f"Missing label for {fname}, skipping.")
            continue
            
        print(f"Processing {fname}...")
        
        # Load Image
        img, img_float = processor.load_and_preprocess(image_path=img_path)
        
        # Load Mask
        mask_bgr = cv2.imread(lbl_path)
        mask_rgb = cv2.cvtColor(mask_bgr, cv2.COLOR_BGR2RGB)
        mask_idx = rgb_to_mask(mask_rgb)
        
        # Generate Graph
        segments = processor.generate_superpixels(img_float)
        rag = processor.build_rag(img_float, segments)
        node_features = extractor.extract_node_features(img, segments)
        
        # Assign Labels to Nodes
        # For each superpixel, find the most frequent class in the ground truth mask
        unique_segments = np.unique(segments)
        node_labels = []
        
        for seg_val in unique_segments:
            # Get pixels in this segment
            segment_mask = (segments == seg_val)
            gt_pixels = mask_idx[segment_mask]
            
            # Majority vote
            if len(gt_pixels) > 0:
                counts = np.bincount(gt_pixels, minlength=7)
                label = np.argmax(counts)
            else:
                label = 6 # Background
            
            node_labels.append(label)
            
        # Convert to PyG Data
        data = convert_to_pyg_data(node_features, rag, label_mask=node_labels)
        dataset.append(data)
        
    return dataset

def get_pseudo_label(img_rgb, mask_binary):
    """
    Generate pseudo-labels (0-5) for wound pixels based on color.
    mask_binary: 255 for wound, 0 for background.
    """
    h, w, _ = img_rgb.shape
    labels = np.full((h, w), 6, dtype=np.int64) # Default Background
    
    # Only process wound pixels
    wound_pixels = (mask_binary == 255)
    
    if not np.any(wound_pixels):
        return labels
        
    # Convert to HSV
    hsv = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2HSV)
    
    # Define Color Ranges
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
    upper_black = np.array([180, 255, 50]) # Very dark
    
    # Maceration (White) - Optional, hard to distinguish from glare
    # Bone (Cream) - Hard to distinguish from Slough/Skin
    
    # Create Masks
    mask_red = cv2.inRange(hsv, lower_red1, upper_red1) | cv2.inRange(hsv, lower_red2, upper_red2)
    mask_yellow = cv2.inRange(hsv, lower_yellow, upper_yellow)
    mask_black = cv2.inRange(hsv, lower_black, upper_black)
    
    # Assign Labels (Priority: Black > Yellow > Red)
    # We assign inside the wound mask ONLY
    
    # Default wound pixel to Granulation (0) if undefined color
    labels[wound_pixels] = 0 
    
    # Apply specific colors
    labels[wound_pixels & (mask_yellow > 0)] = 1 # Slough
    labels[wound_pixels & (mask_black > 0)] = 2 # Necrosis
    # Red is already default 0, but we can be explicit if needed
    
    return labels

def process_kaggle_dataset(data_dir, limit=200):
    """
    Process a subset of Kaggle data.
    limit: Number of images to use (processing 2000 takes time, let's start with 200)
    """
    img_dir = os.path.join(data_dir, 'images')
    mask_dir = os.path.join(data_dir, 'masks')
    
    processor = ImageGraphProcessor(n_segments=150, compactness=20) # Slightly fewer segments for speed
    extractor = FeatureExtractor()
    
    dataset = []
    
    files = os.listdir(img_dir)
    # Filter for png/jpg
    files = [f for f in files if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
    
    # Shuffle and pick subset
    np.random.shuffle(files)
    files = files[:limit]
    
    print(f"Processing {len(files)} Kaggle images...")
    
    for fname in files:
        img_path = os.path.join(img_dir, fname)
        mask_path = os.path.join(mask_dir, fname)
        
        if not os.path.exists(mask_path):
            continue
            
        try:
            # Load Image
            img, img_float = processor.load_and_preprocess(image_path=img_path)
            
            # Load Mask (Binary)
            mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
            if mask is None: continue
            
            # Resize mask to match image if needed (preprocessing resizes to 512 max dim)
            h, w = img.shape[:2]
            if mask.shape != (h, w):
                mask = cv2.resize(mask, (w, h), interpolation=cv2.INTER_NEAREST)
            
            # Generate Pseudo-Labels
            label_mask = get_pseudo_label(img, mask)
            
            # Generate Graph
            segments = processor.generate_superpixels(img_float)
            rag = processor.build_rag(img_float, segments)
            node_features = extractor.extract_node_features(img, segments)
            
            # Assign Labels to Nodes
            unique_segments = np.unique(segments)
            node_labels = []
            
            for seg_val in unique_segments:
                segment_mask = (segments == seg_val)
                gt_pixels = label_mask[segment_mask]
                
                if len(gt_pixels) > 0:
                    counts = np.bincount(gt_pixels, minlength=7)
                    label = np.argmax(counts)
                else:
                    label = 6
                
                node_labels.append(label)
                
            data = convert_to_pyg_data(node_features, rag, label_mask=node_labels)
            dataset.append(data)
            
        except Exception as e:
            print(f"Error processing {fname}: {e}")
            continue
            
    return dataset

def train():
    # 1. Load Original Labeled Data
    print("1. Loading WoundTissue Data...")
    wt_dataset = process_dataset('backend/data/WoundTissue')
    
    # 2. Load Kaggle Data (Pseudo-labeled)
    print("2. Loading Kaggle Data...")
    kaggle_dataset = process_kaggle_dataset('backend/data/kaggle', limit=600) # Increased to 600
    
    # Combine
    full_dataset = wt_dataset + kaggle_dataset
    print(f"Total Training Samples: {len(full_dataset)}")
    
    if len(full_dataset) == 0:
        print("No data found!")
        return

    train_loader = DataLoader(full_dataset, batch_size=1, shuffle=True)
    
    print("3. Initializing Model...")
    model = WoundGAT(num_node_features=24, num_classes=7)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.005, weight_decay=5e-4)
    criterion = torch.nn.NLLLoss()
    
    print("4. Training...")
    model.train()
    for epoch in range(30): # 30 Epochs
        total_loss = 0
        for batch in train_loader:
            optimizer.zero_grad()
            out_nodes, _ = model(batch)
            loss = criterion(out_nodes, batch.y)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
            
        if epoch % 5 == 0:
            print(f"Epoch {epoch}: Loss {total_loss/len(train_loader):.4f}")
            
    print("5. Saving Model...")
    torch.save(model.state_dict(), 'backend/model_weights.pth')
    print("Done! Weights saved to backend/model_weights.pth")

if __name__ == "__main__":
    train()
