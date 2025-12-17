from flask import Blueprint, request, jsonify, send_file
import os
import cv2
import numpy as np
import torch
import base64
import io
from PIL import Image
from app.preprocessing import ImageGraphProcessor
from app.features import FeatureExtractor
from app.model import WoundGAT
from app.utils import convert_to_pyg_data

api_bp = Blueprint('api', __name__)

# Initialize components (Lazy loading or global init)
model = WoundGAT(num_node_features=24, num_classes=7)

# Load trained weights if available
weights_path = os.path.join(os.path.dirname(__file__), '..', 'model_weights.pth')
if os.path.exists(weights_path):
    print(f"Loading trained weights from {weights_path}")
    model.load_state_dict(torch.load(weights_path))
else:
    print("Warning: No trained weights found. Using random initialization.")

model.eval()

processor = ImageGraphProcessor(n_segments=200, compactness=20)
extractor = FeatureExtractor()

def gray_world(img):
    """
    Simple Gray World White Balance to correct color cast (e.g., reddish tint).
    """
    result = img.transpose(2, 0, 1).astype(np.uint32)
    avg = np.mean(result, axis=(1, 2))
    # Avoid division by zero
    if avg[0] == 0: avg[0] = 1
    if avg[1] == 0: avg[1] = 1
    if avg[2] == 0: avg[2] = 1
    
    avg_gray = np.mean(avg)
    result[0] = np.minimum(result[0] * (avg_gray / avg[0]), 255)
    result[1] = np.minimum(result[1] * (avg_gray / avg[1]), 255)
    result[2] = np.minimum(result[2] * (avg_gray / avg[2]), 255)
    return result.transpose(1, 2, 0).astype(np.uint8)

@api_bp.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "Wound Analysis API"})

@api_bp.route('/predict', methods=['POST'])
def predict():
    if 'image' not in request.files:
        return jsonify({"error": "No image provided"}), 400
    
    file = request.files['image']
    
    # Read image
    try:
        # Convert string data to numpy array
        npimg = np.frombuffer(file.read(), np.uint8)
        # Convert numpy array to image
        img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
        
        # APPLY WHITE BALANCE
        # This helps remove reddish tint that confuses the model
        img = gray_world(img)
        
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    except Exception as e:
        return jsonify({"error": f"Invalid image format: {str(e)}"}), 400

    # 1. Pipeline: Preprocessing
    _, img_float = processor.load_and_preprocess(image_array=img_rgb)
    segments = processor.generate_superpixels(img_float)
    rag = processor.build_rag(img_float, segments)
    
    # 2. Pipeline: Feature Extraction
    node_features = extractor.extract_node_features(img_rgb, segments)
    
    # 3. Pipeline: Graph Conversion
    pyg_data = convert_to_pyg_data(node_features, rag)
    
    # 4. Pipeline: Inference
    with torch.no_grad():
        out_nodes, out_graph = model(pyg_data)
        
    # Process Results
    pred_node_labels = out_nodes.argmax(dim=1).numpy()
    pred_graph_label = out_graph.argmax(dim=1).item()
    
    # DEBUG: Check if we only have background
    unique_preds = np.unique(pred_node_labels)
    print(f"DEBUG: Predicted Classes: {unique_preds}")
    
    # FALLBACK: If everything is background (6), try 2nd best guess
    if len(unique_preds) == 1 and unique_preds[0] == 6:
        print("DEBUG: All background detected. Switching to 2nd best class for visualization.")
        # Get top 2 probabilities
        # out_nodes is LogSoftmax. Top 2 values.
        top2_vals, top2_idxs = torch.topk(out_nodes, k=2, dim=1)
        # top2_idxs is [Num_Nodes, 2]. Column 0 is best, Column 1 is 2nd best.
        # We want to use Column 1 (2nd best) IF Column 0 is Background (6)
        
        # Create new labels array
        new_labels = []
        for i in range(len(pred_node_labels)):
            best = top2_idxs[i, 0].item()
            second = top2_idxs[i, 1].item()
            
            if best == 6:
                new_labels.append(second)
            else:
                new_labels.append(best)
        
        pred_node_labels = np.array(new_labels)
        print(f"DEBUG: New Predicted Classes: {np.unique(pred_node_labels)}")

    # Map labels to names (MUST MATCH train.py)
    # 0: Granulation, 1: Slough, 2: Necrosis, 3: Maceration, 4: Tendon, 5: Bone, 6: Background
    tissue_types = ["Granulation", "Slough", "Necrosis", "Maceration", "Tendon", "Bone", "Background"]
    depth_types = ["Superficial", "Partial-Thickness", "Full-Thickness"]
    
    # Calculate Tissue Percentages
    unique, counts = np.unique(pred_node_labels, return_counts=True)
    total_nodes = len(pred_node_labels)
    stats = {}
    for u, c in zip(unique, counts):
        stats[tissue_types[u]] = round((c / total_nodes) * 100, 2)
        
    # Generate Overlay Image & Measurements
    # Define colors for each class (RGB)
    class_colors = [
        (255, 0, 0),    # 0: Granulation (Red)
        (255, 255, 0),  # 1: Slough (Yellow)
        (0, 0, 0),      # 2: Necrosis (Black)
        (255, 255, 255),# 3: Maceration (White)
        (0, 255, 255),  # 4: Tendon (Cyan)
        (255, 200, 124),# 5: Bone (Cream)
        (0, 0, 255)     # 6: Background (Blue - visualization only, usually transparent)
    ]
    
    # Re-logic for overlay to be safe:
    unique_segment_labels = np.unique(segments) # Sorted
    
    # Create a colored mask
    label_map = np.zeros((np.max(unique_segment_labels) + 1, 3), dtype=np.uint8)
    
    # Track wound pixels for bounding box
    wound_mask = np.zeros(segments.shape, dtype=np.uint8)
    
    for i, seg_label in enumerate(unique_segment_labels):
        class_idx = pred_node_labels[i]
        
        # Color the segment
        if class_idx == 6: # Background
             # Make background darker/transparent-ish in visualization? 
             # For now, let's just use the blue color but we will blend it.
             label_map[seg_label] = (0, 0, 0) # Keep background dark/original
        else:
             label_map[seg_label] = class_colors[class_idx]
        
        # Build Wound Mask (Exclude Background)
        if class_idx != 6: 
            wound_mask[segments == seg_label] = 255

    # Clean up the wound mask (Remove noise)
    kernel = np.ones((5,5), np.uint8)
    wound_mask = cv2.morphologyEx(wound_mask, cv2.MORPH_OPEN, kernel)
    
    # Apply mapping
    colored_segments = label_map[segments]
    
    # Blend with original
    # We only want to blend where it's NOT background to keep the image clean
    # But for the "Segment Map" view, seeing the classification is good.
    # Let's blend everything but make background less intrusive.
    alpha = 0.4
    blended = cv2.addWeighted(img_rgb, 1 - alpha, colored_segments, alpha, 0)
    
    # Calculate Bounding Box & Draw Contours
    # Find contours of the wound mask
    contours, _ = cv2.findContours(wound_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    valid_ai_contour = False
    img_area = img.shape[0] * img.shape[1]
    
    if contours:
        max_c = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(max_c)
        
        # Validation Logic:
        # 1. Must be > 500px (not noise)
        # 2. Must be < 90% of image (not the whole frame)
        if area > 500 and area < (img_area * 0.9):
            valid_ai_contour = True
        else:
            print(f"DEBUG: AI contour rejected. Area: {area}, Image Area: {img_area} (Ratio: {area/img_area:.2f})")

    # FALLBACK: If AI failed (empty mask or tiny noise or full image), use HSV Heuristic
    if not valid_ai_contour:
        print("DEBUG: AI failed validation. Using HSV Fallback.")
        # Convert to HSV
        hsv = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2HSV)
        
        # Define ranges for "Wound" colors (Red, Yellow, Black-ish)
        # Red has two ranges in HSV (0-10 and 170-180)
        lower_red1 = np.array([0, 50, 50])
        upper_red1 = np.array([10, 255, 255])
        lower_red2 = np.array([170, 50, 50])
        upper_red2 = np.array([180, 255, 255])
        
        # Yellow (Slough)
        lower_yellow = np.array([15, 50, 50])
        upper_yellow = np.array([35, 255, 255])
        
        # Create masks
        mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
        mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
        mask3 = cv2.inRange(hsv, lower_yellow, upper_yellow)
        
        # Combine
        hsv_mask = mask1 | mask2 | mask3
        
        # Clean up HSV mask
        hsv_mask = cv2.morphologyEx(hsv_mask, cv2.MORPH_CLOSE, kernel)
        hsv_mask = cv2.morphologyEx(hsv_mask, cv2.MORPH_OPEN, kernel)
        
        # Use this as the wound mask
        wound_mask = hsv_mask
        
        # Re-calculate contours with new mask
        contours, _ = cv2.findContours(wound_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    max_width = 0
    max_height = 0
    
    if contours:
        # Find the largest contour (main wound)
        c = max(contours, key=cv2.contourArea)
        
        # Filter: Ignore very small contours (noise)
        if cv2.contourArea(c) > 500: # Min area threshold
            x, y, w, h = cv2.boundingRect(c)
            
            # 1. Draw Contour Line (Cyan, Thickness 3)
            # This marks the exact outer boundary of the wound
            cv2.drawContours(blended, [c], -1, (0, 255, 255), 3)
            
            # 2. Draw Bounding Box (Green, Thinner)
            cv2.rectangle(blended, (x, y), (x + w, y + h), (0, 255, 0), 2)
            
            # Add Text Labels
            label_text = f"{w}px x {h}px"
            cv2.putText(blended, label_text, (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
            
            max_width = w
            max_height = h
    
    # Encode image to base64
    _, buffer = cv2.imencode('.jpg', cv2.cvtColor(blended, cv2.COLOR_RGB2BGR))
    img_str = base64.b64encode(buffer).decode('utf-8')

    response = {
        "depth_assessment": depth_types[pred_graph_label],
        "tissue_statistics": stats,
        "measurements": {
            "width_px": max_width,
            "height_px": max_height,
            "area_px": int(cv2.contourArea(c)) if contours else 0
        },
        "segmentation_map": f"data:image/jpeg;base64,{img_str}"
    }

    return jsonify(response)
