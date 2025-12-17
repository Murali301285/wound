import torch
import torch.nn.functional as F
from torch_geometric.nn import GATConv, global_mean_pool

class WoundGAT(torch.nn.Module):
    def __init__(self, num_node_features, num_classes, heads=2, hidden_channels=32):
        super(WoundGAT, self).__init__()
        
        # First GAT Layer
        # Concatenates output of heads, so output dim is hidden_channels * heads
        self.conv1 = GATConv(num_node_features, hidden_channels, heads=heads, dropout=0.6)
        
        # Second GAT Layer
        # We can stack more layers if needed. 
        # Input dim is hidden_channels * heads from prev layer
        self.conv2 = GATConv(hidden_channels * heads, hidden_channels, heads=1, concat=False, dropout=0.6)

        # Node Classification Head
        self.node_classifier = torch.nn.Linear(hidden_channels, num_classes)

        # Graph Classification Head (for Depth Assessment)
        # We pool all node embeddings to get a graph-level embedding
        self.graph_classifier = torch.nn.Linear(hidden_channels, 3) # 3 classes: Superficial, Partial, Full

    def forward(self, data):
        x, edge_index = data.x, data.edge_index
        
        # 1. GNN Layers (Node Embeddings)
        x = F.dropout(x, p=0.6, training=self.training)
        x = self.conv1(x, edge_index)
        x = F.elu(x)
        
        x = F.dropout(x, p=0.6, training=self.training)
        x = self.conv2(x, edge_index)
        
        # Save node embeddings for visualization if needed
        node_embeddings = x
        
        # 2. Node Classification Output
        # Apply classifier to each node
        out_nodes = self.node_classifier(node_embeddings)
        
        # 3. Graph Classification Output
        # Pool node embeddings to get 1 vector for the whole graph
        graph_embedding = global_mean_pool(node_embeddings, data.batch)
        out_graph = self.graph_classifier(graph_embedding)

        return F.log_softmax(out_nodes, dim=1), F.log_softmax(out_graph, dim=1)
