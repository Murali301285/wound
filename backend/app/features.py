import numpy as np
import cv2
from skimage.feature import local_binary_pattern
from skimage.color import rgb2hsv

class FeatureExtractor:
    def __init__(self):
        pass

    def extract_color_features(self, img, mask):
        """
        Extract mean and std deviation of RGB and HSV colors for a superpixel.
        :param img: Original RGB image.
        :param mask: Boolean mask for the specific superpixel.
        :return: List of color features.
        """
        # Extract pixels belonging to the superpixel
        pixels_rgb = img[mask]
        
        if len(pixels_rgb) == 0:
            return [0] * 12  # Return zeros if empty

        # RGB Statistics
        mean_rgb = np.mean(pixels_rgb, axis=0)
        std_rgb = np.std(pixels_rgb, axis=0)

        # HSV Statistics
        img_hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV)
        pixels_hsv = img_hsv[mask]
        mean_hsv = np.mean(pixels_hsv, axis=0)
        std_hsv = np.std(pixels_hsv, axis=0)

        # Combine: [R_mean, G_mean, B_mean, R_std, G_std, B_std, H_mean, S_mean, V_mean, H_std, S_std, V_std]
        return np.concatenate([mean_rgb, std_rgb, mean_hsv, std_hsv]).tolist()

    def extract_texture_features(self, img_gray, mask):
        """
        Extract texture features using Local Binary Patterns (LBP).
        :param img_gray: Grayscale image.
        :param mask: Boolean mask for the superpixel.
        :return: Histogram of LBP values (simple texture descriptor).
        """
        # LBP Parameters
        radius = 1
        n_points = 8 * radius
        
        # Compute LBP for the whole image (efficient)
        lbp = local_binary_pattern(img_gray, n_points, radius, method='uniform')
        
        # Extract LBP values for the superpixel
        lbp_values = lbp[mask]
        
        if len(lbp_values) == 0:
            return [0] * 10

        # Create histogram (10 bins for uniform LBP)
        hist, _ = np.histogram(lbp_values, bins=10, range=(0, 10), density=True)
        return hist.tolist()

    def extract_node_features(self, img, segments):
        """
        Iterate over all superpixels and extract features for each.
        Returns a matrix of shape (Num_Nodes, Num_Features).
        """
        num_segments = len(np.unique(segments))
        features = []
        
        img_gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)

        # Iterate through each segment label
        # Note: SLIC labels usually start from 1 or 0. We assume they are contiguous.
        unique_labels = np.unique(segments)
        
        for label in unique_labels:
            mask = (segments == label)
            
            # 1. Color Features (12 dims)
            color_feats = self.extract_color_features(img, mask)
            
            # 2. Texture Features (10 dims)
            texture_feats = self.extract_texture_features(img_gray, mask)
            
            # 3. Spatial Features (2 dims: Centroid X, Y normalized)
            coords = np.argwhere(mask)
            if len(coords) > 0:
                y_center, x_center = coords.mean(axis=0)
                norm_y = y_center / img.shape[0]
                norm_x = x_center / img.shape[1]
            else:
                norm_y, norm_x = 0, 0
            
            # Combine all features
            node_feat = color_feats + texture_feats + [norm_x, norm_y]
            features.append(node_feat)

        return np.array(features, dtype=np.float32)
