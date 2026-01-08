import cv2
import numpy as np
import base64
import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

class HealingSimulator:
    def __init__(self):
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY"))

    def numpy_to_base64(self, img_np):
        _, buffer = cv2.imencode('.jpg', img_np)
        return f"data:image/jpeg;base64,{base64.b64encode(buffer).decode('utf-8')}"

    def simulate_healing(self, image, segmentation_mask, simulate_infection=False):
        """
        Simulate healing healing (4 stages) and optional infection.
        """
        # Ensure mask is binary (255 = Wound, 0 = Background)
        wound_mask = np.where(segmentation_mask > 0, 255, 0).astype(np.uint8)
        
        simulations = []
        original_b64 = self.numpy_to_base64(image)
        simulations.append({"stage": "Current (Day 0)", "image": original_b64, "day": 0})

        # Kernel for erosion (healing)
        kernel_size = int(min(image.shape[:2]) * 0.02) 
        if kernel_size % 2 == 0: kernel_size += 1
        kernel = np.ones((kernel_size, kernel_size), np.uint8)

        # --- Stage 2: 1 Week (Early Granulation) ---
        # Shrink ~15%
        eroded_mask_1 = cv2.erode(wound_mask, kernel, iterations=2)
        healed_region_1 = cv2.subtract(wound_mask, eroded_mask_1)
        healed_img_1 = cv2.inpaint(image, healed_region_1, inpaintRadius=3, flags=cv2.INPAINT_NS)
        simulations.append({
            "stage": "1 Week",
            "image": self.numpy_to_base64(healed_img_1),
            "day": 7
        })

        # --- Stage 3: 2 Weeks (Significant Closure) ---
        # Shrink ~40-50%
        eroded_mask_2 = cv2.erode(wound_mask, kernel, iterations=5)
        healed_region_2 = cv2.subtract(wound_mask, eroded_mask_2)
        # Use previous healed image as base to maintain continuity?? 
        # Actually inpainting from original is usually cleaner unless we track texture.
        # Let's stick to original Base for now but with larger healed region.
        healed_img_2 = cv2.inpaint(image, healed_region_2, inpaintRadius=3, flags=cv2.INPAINT_NS)
        simulations.append({
            "stage": "2 Weeks",
            "image": self.numpy_to_base64(healed_img_2),
            "day": 14
        })

        # --- Stage 4: 4 Weeks (Near Closure) ---
        # Shrink ~80%
        eroded_mask_3 = cv2.erode(wound_mask, kernel, iterations=10)
        healed_region_3 = cv2.subtract(wound_mask, eroded_mask_3)
        healed_img_3 = cv2.inpaint(image, healed_region_3, inpaintRadius=3, flags=cv2.INPAINT_NS)
        simulations.append({
            "stage": "4 Weeks", 
            "image": self.numpy_to_base64(healed_img_3),
            "day": 30
        })

        # --- Optional: Infection Simulation ---
        if simulate_infection:
            # Spread: Dilate the mask to cover periwound
            infection_kernel = np.ones((kernel_size*2, kernel_size*2), np.uint8)
            infection_area = cv2.dilate(wound_mask, infection_kernel, iterations=2)
            
            # Create a red overlay
            overlay = image.copy()
            # Apply Red tint to the infection area (excluding the open wound center?)
            # Usually infection is red periwound + sloughy wound.
            
            # Mask for Periwound only (Infection Area - Open Wound)
            periwound_mask = cv2.subtract(infection_area, wound_mask)
            
            # Apply redness to periwound
            red_layer = np.zeros_like(image)
            red_layer[:] = [0, 0, 200] # BGR Red
            
            # Blend
            alpha = 0.4
            mask_indices = np.where(periwound_mask > 0)
            
            if len(mask_indices[0]) > 0:
                overlay[mask_indices] = cv2.addWeighted(image[mask_indices], 1-alpha, red_layer[mask_indices], alpha, 0)

            simulations.append({
                "stage": "Risk: Infection",
                "image": self.numpy_to_base64(overlay),
                "day": 7,
                "is_risk": True
            })

        return simulations

    def get_clinical_projection(self, stats):
        """
        Use Groq API to generate a clinical projection narrative.
        """
        if not self.client.api_key:
            return "Error: GROQ_API_KEY not configured."

        prompt = f"""
        You are an expert Wound Care specialist. 
        Analyze the following wound statistics and provide a "Healing Projection" narrative.
        
        Stats:
        - Granulation (Healing): {stats.get('Granulation', 0)}%
        - Slough (Non-viable): {stats.get('Slough', 0)}%
        - Necrosis (Dead): {stats.get('Eschar', 0)}%
        - Size: {stats.get('area_px', 'Unknown')} pixels (approx)

        Output Guidelines:
        1. Projection: Estimate time to closure based on the Granulation %. 
           (Rule of thumb: High granulation = faster healing. High slough/necrosis = delayed).
        2. Next Steps: Brief 1-sentence recommendation.
        3. Tone: Professional, encouraging but realistic.
        4. Length: Max 3 sentences. Do not use markdown bolding.
        """

        try:
            chat_completion = self.client.chat.completions.create(
                messages=[
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
                model="llama-3.3-70b-versatile",
            )
            return chat_completion.choices[0].message.content
        except Exception as e:
            return f"Error generating narrative: {str(e)}"

    def generate_thermal_simulation(self, image):
        """Generates a False Color Thermal Map based on Redness."""
        # Convert RGB to LAB
        lab = cv2.cvtColor(image, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)
        
        # 'a' channel represents Green-Red axis.
        # Normalize to 0-255 scaling
        heatmap = cv2.normalize(a, None, 0, 255, cv2.NORM_MINMAX)
        
        # Apply JET Colormap
        thermal = cv2.applyColorMap(heatmap, cv2.COLORMAP_JET)
        
        return self.numpy_to_base64(thermal)
