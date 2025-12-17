import cv2
import numpy as np
import matplotlib.pyplot as plt
from skimage.segmentation import slic, mark_boundaries
from skimage import graph
from skimage import img_as_float

class ImageGraphProcessor:
    def __init__(self, n_segments=100, compactness=10, sigma=1):
        """
        Initialize the processor with SLIC parameters.
        :param n_segments: Approximate number of superpixels.
        :param compactness: Balances color proximity and space proximity.
        :param sigma: Width of Gaussian smoothing kernel.
        """
        self.n_segments = n_segments
        self.compactness = compactness
        self.sigma = sigma

    def load_and_preprocess(self, image_path=None, image_array=None):
        """
        Load an image from path or use provided array, and normalize it.
        """
        if image_path:
            # Load image in RGB
            img = cv2.imread(image_path)
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        elif image_array is not None:
            img = image_array
        else:
            raise ValueError("Either image_path or image_array must be provided")

        # Normalize to 0-1 range
        img_float = img_as_float(img)
        return img, img_float

    def generate_superpixels(self, img_float):
        """
        Apply SLIC algorithm to generate superpixels.
        Returns the label mask (segments).
        """
        segments = slic(img_float, 
                        n_segments=self.n_segments, 
                        compactness=self.compactness, 
                        sigma=self.sigma,
                        start_label=1)
        return segments

    def build_rag(self, img_float, segments):
        """
        Build Region Adjacency Graph (RAG) from superpixels.
        Nodes are superpixels, edges connect adjacent superpixels.
        """
        # rag_mean_color returns a RAG where nodes have 'mean color' and 'pixel count'
        rag = graph.rag_mean_color(img_float, segments, mode='distance')
        return rag

    def visualize_pipeline(self, img, segments, rag, output_path):
        """
        Create a visualization of the original image, superpixels, and the graph.
        """
        fig, ax = plt.subplots(1, 3, figsize=(18, 6))

        # 1. Original Image
        ax[0].imshow(img)
        ax[0].set_title("Original Image")
        ax[0].axis('off')

        # 2. Superpixels
        # mark_boundaries overlays the segment boundaries on the image
        vis_segments = mark_boundaries(img, segments)
        ax[1].imshow(vis_segments)
        ax[1].set_title(f"SLIC Superpixels (n={self.n_segments})")
        ax[1].axis('off')

        # 3. Region Adjacency Graph
        # Draw the RAG on top of the superpixel image
        # We use the original image as a base
        lc = graph.show_rag(segments, rag, img, ax=ax[2])
        # Add a colorbar to show edge weights (color difference)
        fig.colorbar(lc, ax=ax[2], fraction=0.046, pad=0.04)
        ax[2].set_title("Region Adjacency Graph (RAG)")
        ax[2].axis('off')

        plt.tight_layout()
        plt.savefig(output_path)
        plt.close()
        print(f"Visualization saved to {output_path}")

