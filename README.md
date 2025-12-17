# Automated Wound Tissue Classification

## Project Overview
This project uses Graph Neural Networks (GNNs) to classify wound tissue types (Granulation, Slough, Eschar) from 2D images.

## Setup

1. **Backend Setup**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Run Test Pipeline**
   ```bash
   python test_pipeline.py
   ```
   This will generate a synthetic image and run the SLIC + Graph construction pipeline, saving the result to `backend/data/pipeline_test_result.png`.

## Directory Structure
- `backend/`: Python code for Image Processing and GNN.
- `frontend/`: React Web App (Planned).
- `notebooks/`: Jupyter notebooks for experiments.
