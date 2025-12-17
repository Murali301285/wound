import torch
from torch_geometric.data import Data
import numpy as np
import networkx as nx

def convert_to_pyg_data(node_features, rag, label_mask=None):
    """
    Convert our extracted features and NetworkX RAG into a PyTorch Geometric Data object.
    
    :param node_features: Numpy array (Num_Nodes, Num_Features)
    :param rag: NetworkX Graph (RAG)
    :param label_mask: Optional (Num_Nodes,) array of ground truth labels
    :return: torch_geometric.data.Data object
    """
    # 1. Node Features (x)
    x = torch.tensor(node_features, dtype=torch.float)

    # 2. Edge Index
    # NetworkX graph to edge_index format (2, Num_Edges)
    # We need to ensure the graph is directed or undirected as expected by GAT.
    # Usually GAT works on directed edges, so for undirected RAG, we add both directions.
    edges = list(rag.edges())
    
    # Create a mapping from RAG node labels to 0-indexed integers
    # The node_features array is already ordered by unique_labels from the feature extraction step.
    # We assume the RAG nodes correspond to these labels.
    nodes = list(rag.nodes())
    nodes.sort() # Ensure sorted order to match feature extraction order
    
    node_mapping = {node_label: i for i, node_label in enumerate(nodes)}

    # Create bidirectional edges with mapped indices
    source_nodes = []
    target_nodes = []
    
    for u, v in edges:
        if u in node_mapping and v in node_mapping:
            u_idx = node_mapping[u]
            v_idx = node_mapping[v]
            source_nodes.extend([u_idx, v_idx])
            target_nodes.extend([v_idx, u_idx])
        
    edge_index = torch.tensor([source_nodes, target_nodes], dtype=torch.long)

    # 3. Labels (y) if available
    y_nodes = None
    if label_mask is not None:
        y_nodes = torch.tensor(label_mask, dtype=torch.long)

    # Create Data object
    data = Data(x=x, edge_index=edge_index, y=y_nodes)
    
    return data
