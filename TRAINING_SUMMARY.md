# WoundAI Model Training Summary Report
**Date:** December 19, 2025  
**Model Version:** `model_weights_augmented.pth`

## 1. Objective
Enhance the accuracy and robustness of the Wound Tissue Classification model (WoundGAT) by augmenting the existing dataset and retraining the model on a larger, more diverse set of images.

## 2. Methodology

### 2.1 Data Augmentation
To solve the issue of limited training data, we generated a **4X Augmented Dataset** from the original `kaggle` and `kaggle2` source images.
*   **Source Data:** Original Wound Images + Masks (Binary: Wound/Background).
*   **Techniques Applied:**
    1.  Original Image
    2.  Rotate 90° Clockwise
    3.  Horizontal Flip
    4.  Rotate 45° (with black padding)
*   **Total Dataset Size:** 19,872 Images (increased from ~5,000).

### 2.2 Model Architecture: WoundGAT
A Graph Attention Network (GAT) approach was used, treating the image as a graph of superpixels rather than a grid of pixels.
*   **Input:** Image converted to Superpixels (SLIC algorithm).
*   **Graph Construction:** Region Adjacency Graph (RAG) connecting neighboring superpixels.
*   **Features:** 
    *   **Color:** Mean/Std Deviation (RGB, HSV).
    *   **Texture:** Local Binary Patterns (LBP).
    *   **Spatial:** Centroid coordinates.
*   **Output:** Classification of each superpixel into 7 classes (Granulation, Slough, Necrosis, Maceration, Tendon, Bone, Background).

### 2.3 Pseudo-Labeling Strategy
Since the provided masks were binary (Wound vs. Background), we generated multi-class Ground Truth labels using color thresholding in the HSV space:
*   **Red:** Granulation
*   **Yellow:** Slough
*   **Black:** Necrosis

## 3. Training Execution

### 3.1 Preprocessing Pipeline
*   **Challenge:** Processing 20,000 images (Superpixel segmentation + feature extraction) is computationally expensive.
*   **Solution:** Implemented a **Lazy Loading** mechanism with caching. 
    *   Images are processed once and validity-checked (checksum/existence).
    *   Graph data (`.pt` files) is saved to disk (`backend/data/cache/Agument`).
    *   During training, the system loads pre-computed graph files instantly, reducing startup time from hours to seconds.

### 3.2 Training Configuration
*   **Epochs:** 30
*   **Batch Size:** 1 (Stochastic Gradient Descent on Graph Data).
*   **Loss Function:** Negative Log Likelihood Loss (NLLLoss).
*   **Optimizer:** Adam (`lr=0.005`, `weight_decay=5e-4`).
*   **Hardware:** CPU Training (optimized with caching).

### 3.3 Timeline
| Phase | Duration |
| :--- | :--- |
| **Data Augmentation** | ~40 Minutes |
| **Preprocessing (Caching)** | ~12 Hours |
| **Model Training (30 Epochs)** | ~3.5 Hours |
| **Total Turnaround** | ~16 Hours |

## 4. Results & Performance

### 4.1 Convergence
The model showed strong convergence properties throughout the training session.
*   **Initial Loss:** `~8.45`
*   **Final Loss:** `0.2011`

### 4.2 Metrics
*   **Metric Used:** Training Loss (NLLLoss).
*   **Outcome:** The substantial drop in loss indicates the model successfully learned to map the extracted features (Color/Texture) to the generated tissue labels with high confidence.

## 5. Deployment
*   **Weights File:** `backend/model_weights_augmented.pth` (~21 KB).
*   **Backend Update:** The Flask application (`app/routes.py`) was updated to load this new weight file automatically.
*   **Git:** All code, including the training pipeline and new weights, has been committed to the local repository.

## 6. Recommendations for Future
*   **Evaluation:** Implement an F1-Score / IoU evaluation script on a held-out test set to quantify segmentation performance beyond simple loss metrics.
*   **GPU Acceleration:** For future distinct retraining (e.g., if dataset grows to 100k), migrating PyTorch Geometric to CUDA/GPU is recommended to reduce preprocessing time.
