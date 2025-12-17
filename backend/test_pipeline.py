import numpy as np
import cv2
import os
from app.preprocessing import ImageGraphProcessor
from app.features import FeatureExtractor
from app.model import WoundGAT
from app.utils import convert_to_pyg_data
import torch

def create_synthetic_wound_image(height=400, width=400):
    """
    Creates a synthetic image representing skin with a wound.
    Skin: Beige/Pink
    Wound: Red/Dark Red in the center
    """
    # Create blank image (Skin color)
    # RGB for Skin (approx)
    img = np.full((height, width, 3), (220, 190, 170), dtype=np.uint8)

    # Draw a wound (Red circle)
    center = (width // 2, height // 2)
    radius = 80
    # Dark red for wound bed
    cv2.circle(img, center, radius, (180, 20, 20), -1)
    
    # Add some "Slough" (Yellowish patches inside wound)
    cv2.circle(img, (center[0] - 20, center[1] - 20), 20, (200, 200, 50), -1)
    
    # Add some noise to make it look more natural for texture analysis
    noise = np.random.randint(-20, 20, (height, width, 3), dtype=np.int16)
    img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)

    return img

def main():
    # Setup paths
    base_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(base_dir, 'data')
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    output_vis_path = os.path.join(output_dir, 'pipeline_test_result.png')

    print("1. Generating synthetic wound image...")
    img = create_synthetic_wound_image()
    
    # Initialize Processor
    processor = ImageGraphProcessor(n_segments=150, compactness=20)

    print("2. Preprocessing and Normalizing...")
    img_rgb, img_float = processor.load_and_preprocess(image_array=img)

    print("3. Generating SLIC Superpixels...")
    segments = processor.generate_superpixels(img_float)
    print(f"   - Generated {len(np.unique(segments))} unique segments.")

    print("4. Building Region Adjacency Graph (RAG)...")
    rag = processor.build_rag(img_float, segments)
    print(f"   - Graph has {rag.number_of_nodes()} nodes and {rag.number_of_edges()} edges.")

    print("5. Extracting Node Features...")
    extractor = FeatureExtractor()
    node_features = extractor.extract_node_features(img_rgb, segments)
    print(f"   - Extracted features matrix shape: {node_features.shape}")
    print(f"   - Features per node: {node_features.shape[1]} (Color + Texture + Spatial)")

    print("6. Converting to PyTorch Geometric Data...")
    pyg_data = convert_to_pyg_data(node_features, rag)
    print(f"   - PyG Data Object: {pyg_data}")

    print("7. Initializing GAT Model...")
    # 7 Classes: Granulation, Slough, Eschar, Epithelial, Callus, Bone, Muscle
    num_classes = 7 
    num_features = node_features.shape[1]
    
    model = WoundGAT(num_node_features=num_features, num_classes=num_classes)
    print("   - Model initialized successfully.")

    print("8. Running Forward Pass (Inference Test)...")
    model.eval()
    with torch.no_grad():
        out_nodes, out_graph = model(pyg_data)
        
    print(f"   - Node Output Shape: {out_nodes.shape} (Should be [Num_Nodes, 7])")
    print(f"   - Graph Output Shape: {out_graph.shape} (Should be [1, 3])")
    
    # Get predictions
    pred_labels = out_nodes.argmax(dim=1)
    print(f"   - Sample Predictions: {pred_labels[:10].tolist()}")

    print("9. Visualizing results...")
    processor.visualize_pipeline(img_rgb, segments, rag, output_vis_path)
    
    print("Test Complete!")

if __name__ == "__main__":
    main()
