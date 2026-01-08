import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

class ClinicalScribe:
    def __init__(self):
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY"))

    def generate_soap_note(self, stats, measurements, depth_assessment, doctor_notes=""):
        """
        Generates a professional SOAP note based on wound analysis data.
        """
        if not self.client.api_key:
            return "Error: GROQ_API_KEY not configured."

        # Format stats for prompt
        granulation = stats.get('Granulation', 0)
        slough = stats.get('Slough', 0)
        eschar = stats.get('Eschar', 0)
        
        width = measurements.get('width_px', 'Unknown')
        height = measurements.get('height_px', 'Unknown')
        area = measurements.get('area_px', 'Unknown')

        prompt = f"""
        You are an expert Wound Care Nurse Practitioner.
        Generate a comprehensive SOAP Note (Subjective, Objective, Assessment, Plan) for a patient record based on the following automated analysis data.

        PATIENT DATA:
        - Physician's Rough Notes: "{doctor_notes if doctor_notes else 'None provided'}"
        
        AUTOMATED ANALYSIS:
        - Wound Dimensions: {width}x{height} (Area: {area})
        - Tissue Composition: Granulation: {granulation}%, Slough: {slough}%, Necrosis (Eschar): {eschar}%
        - Depth Classification: {depth_assessment}
        
        INSTRUCTIONS:
        1. **Subjective:** Summarize the physician's notes.
        2. **Objective:** Summarize key metrics (Dimensions, Tissue).
        3. **Assessment:** Clinical impression (e.g., "Improving", "Stalled").
        4. **Plan:** A list of specific actionable steps.

        FORMAT:
        You must return a valid JSON object. Do not wrap in markdown code blocks.
        {{
            "subjective": "Patient reports...",
            "objective_summary": "Wound is 4x4cm with 80% granulation...",
            "assessment": "Healing trajectory is positive.",
            "assessment_status": "Improving" | "Stalled" | "Critical",
            "plan_steps": ["Cleanse with saline", "Apply foam dressing", "Re-evaluate in 3 days"]
        }}
        """

        try:
            chat_completion = self.client.chat.completions.create(
                messages=[
                    {
                        "role": "system",
                        "content": "You are a precise medical scribe. Output only valid JSON."
                    },
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
                model="llama-3.3-70b-versatile",
                temperature=0.3, 
                response_format={"type": "json_object"}
            )
            content = chat_completion.choices[0].message.content
            import json
            return json.loads(content)
        except Exception as e:
            # Fallback if JSON fails
            return {
                "subjective": doctor_notes or "No notes provided.",
                "objective_summary": f"Area: {area}, Granulation: {granulation}%",
                "assessment": "Error generating AI assessment.",
                "assessment_status": "Unknown",
                "plan_steps": ["Consult manual protocols."]
            }
