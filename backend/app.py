import os
import pickle
import pandas as pd
import numpy as np
import io
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

# --- PDF GENERATION IMPORTS ---
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle, Frame, PageTemplate
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT

# Setup Absolute Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ARTIFACTS_DIR = os.path.join(BASE_DIR, 'artifacts')
DATA_DIR = os.path.join(BASE_DIR, 'data')

# Global variables to hold model assets and dictionary metadata mappings
model = None
label_encoder = None
symptom_features = []
meta_database: Dict[str, Dict[str, Any]] = {}

# 1. Modern Lifespan Handler (Replaces deprecated @app.on_event)
@asynccontextmanager
async def lifespan(app: FastAPI):
    global model, label_encoder, symptom_features, meta_database
    print("\n--- [STARTUP] Initializing AI Systems & Metadata Mappings ---")
    
    # Create required directories if they are missing
    os.makedirs(ARTIFACTS_DIR, exist_ok=True)
    os.makedirs(DATA_DIR, exist_ok=True)
    
    try:
        # Load Machine Learning Artifacts
        xgboost_path = os.path.join(ARTIFACTS_DIR, 'xgboost_model.pkl')
        if os.path.exists(xgboost_path):
            with open(xgboost_path, 'rb') as f:
                model = pickle.load(f)
        else:
            print(f"[WARNING] ML Model file missing: {xgboost_path}")

        encoder_path = os.path.join(ARTIFACTS_DIR, 'label_encoder.pkl')
        if os.path.exists(encoder_path):
            with open(encoder_path, 'rb') as f:
                label_encoder = pickle.load(f)
        else:
            print(f"[WARNING] Label Encoder file missing: {encoder_path}")

        symptom_path = os.path.join(ARTIFACTS_DIR, 'symptom_features.pkl')
        if os.path.exists(symptom_path):
            with open(symptom_path, 'rb') as f:
                symptom_features = pickle.load(f)
        else:
            print(f"[WARNING] Symptom features file missing: {symptom_path}")
        
        # 2. Load Mapping Dataframes Safely (Case and whitespace agnostic)
        def load_and_map_csv(filename, default_col):
            filepath = os.path.join(DATA_DIR, filename)
            if not os.path.exists(filepath):
                print(f"[WARNING] Reference file missing: {filename}")
                return {}
                
            df_temp = pd.read_csv(filepath)
            # Clean column headers (strip spaces and convert to lowercase)
            df_temp.columns = [c.strip().lower() for c in df_temp.columns]
            
            # Identify the target text column (anything that isn't the 'disease' key)
            data_cols = [c for c in df_temp.columns if c != 'disease']
            target_col = data_cols[0] if data_cols else default_col.lower()
            
            # Ensure the disease index column itself is lowercase and stripped
            df_temp['disease'] = df_temp['disease'].astype(str).str.strip().str.lower()
            return df_temp.set_index('disease')[target_col].to_dict()

        desc_map = load_and_map_csv('description.csv', 'description')
        med_map = load_and_map_csv('medications.csv', 'medication')
        workout_map = load_and_map_csv('workout.csv', 'workout')
        diet_map = load_and_map_csv('diet.csv', 'diet')
        
        # Load precautions dataset columns structurally
        precautions_path = os.path.join(DATA_DIR, 'precautions.csv')
        if os.path.exists(precautions_path):
            precaution_df = pd.read_csv(precautions_path)
            precaution_df.columns = [c.strip().lower() for c in precaution_df.columns]
            precaution_df['disease'] = precaution_df['disease'].astype(str).str.strip().str.lower()
            precaution_df = precaution_df.set_index('disease')
        else:
            precaution_df = None
        
        # Merge metadata mapping frames by disease key for 1-step JSON construction
        if label_encoder is not None:
            all_diseases = label_encoder.classes_
            for disease in all_diseases:
                d_key = disease.strip().lower()
                
                # Extract precautions arrays safely
                prec_list = []
                if precaution_df is not None and d_key in precaution_df.index:
                    row = precaution_df.loc[d_key]
                    if isinstance(row, pd.Series):
                        prec_list = row.dropna().astype(str).tolist()
                    elif isinstance(row, pd.DataFrame): 
                        prec_list = row.iloc[0].dropna().astype(str).tolist()
                    # Remove the disease name if it accidentally leaked into the values list
                    prec_list = [p for p in prec_list if p.strip().lower() != d_key]
                
                meta_database[d_key] = {
                    "description": desc_map.get(d_key, "No overview description data available for this condition."),
                    "medication": med_map.get(d_key, "Consult a clinical practitioner for tailored medication prescriptions."),
                    "workout": workout_map.get(d_key, "Rest and light recovery tracking advised."),
                    "diet": diet_map.get(d_key, "Balanced programmatic nutrition hydration intake."),
                    "precautions": prec_list if prec_list else ["Consult a healthcare specialist for primary medical guidance."]
                }
            
            print("[SUCCESS] All AI ML Models and Meta Matrices compiled successfully.\n")
        else:
            print("[CRITICAL WARNING] Label Encoder missing, could not build meta matrices.\n")

    except Exception as e:
        print(f"[CRITICAL ERROR] Failed compiled setup initialization: {e}")
    
    yield
    print("\n--- [SHUTDOWN] Releasing allocated memory resources ---")

app = FastAPI(title="AI Diagnostic Health Matrix Engine", lifespan=lifespan)

# Enable Cross-Origin Resource Sharing (CORS) for full-stack client components
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"] # Expose this header for browser download
)

# --- PYDANTIC INPUT SCHEMAS ---

# Validation layout for symptom arrays
class SymptomInput(BaseModel):
    symptoms: List[str]

# Detailed details container for PDF generation
class DiagnosticDetails(BaseModel):
    description: str
    medication: str
    workout: str
    diet: str
    precautions: List[str]

# Full diagnostic structure needed for PDF generation
class PDFReportInput(BaseModel):
    prediction: str
    confidence: str
    matchedSymptoms: List[str] # Frontend sends the list of selected tokens
    details: DiagnosticDetails

# --- HELPER: PDF GENERATION FUNCTION ---
def generate_report_pdf(buffer: io.BytesIO, report_data: PDFReportInput):
    """
    Constructs a formalized clinical analytic report using ReportLab canvas.
    Maps data arrays structurally line-by-line for options and precautions.
    """
    p = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    
    # 1. Branding & Header block
    p.setFillColor(colors.HexColor('#F8FAFC')) # Background color
    p.rect(0, height - 3.5*inch, width, 3.5*inch, fill=1)
    
    p.setFillColor(colors.HexColor('#1E293B'))
    p.setFont("Helvetica-Bold", 32)
    p.drawString(1*inch, height - 1.25*inch, "ALGOMEDIX")
    
    p.setFillColor(colors.HexColor('#334155'))
    p.setFont("Helvetica-Bold", 14)
    p.drawString(1*inch, height - 1.6*inch, "PREDICTIVE ANALYTICS DIAGNOSTIC REPORT")
    
    p.setFillColor(colors.HexColor('#64748B'))
    p.setFont("Helvetica", 10)
    p.drawString(1*inch, height - 1.9*inch, "Generated: " + datetime.now().strftime("%Y-%m-%d // %H:%M:%S"))
    p.drawString(1*inch, height - 2.1*inch, "Confidential Diagnostic Pipeline telemetry data.")

    # 2. Main Title Line
    p.setFillColor(colors.black)
    p.setFont("Helvetica-Bold", 11)
    p.drawString(1*inch, height - 2.6*inch, "PATIENT SYMPTOM VECTOR")

    # 3. Symptoms Section
    y_pos = height - 2.85*inch
    
    # Draw symptoms as tag-like tokens structurally
    p.setFont("Helvetica-Bold", 9)
    # Join symptoms and wrap them across lines dynamically
    symptoms_text = Paragraph(
        "• " + " • ".join([s.replace('_',' ').upper() for s in report_data.matchedSymptoms]),
        ParagraphStyle(name='SymptomsToken', fontName='Helvetica-Bold', fontSize=9, textColor=colors.black, leading=14)
    )
    symptoms_w, symptoms_h = symptoms_text.wrap(width - 2*inch, 200)
    symptoms_text.drawOn(p, 1*inch, y_pos - symptoms_h)
    
    # Move y_pos down past the symptoms token box
    y_pos -= (symptoms_h + 20)

    # 4. Core Metrics Highlight Grid
    p.setFillColor(colors.white)
    p.rect(1*inch, y_pos - 50, width - 2*inch, 50, fill=1)
    
    # ACCURACY METRIC LABEL
    p.setFillColor(colors.HexColor('#64748B'))
    p.setFont("Helvetica-Bold", 8)
    p.drawString(1.3*inch, y_pos - 15, "DIAGNOSTIC TARGET CLASSIFICATION")
    
    # PREDICTED DISEASE STRING
    p.setFillColor(colors.HexColor('#1E293B'))
    p.setFont("Helvetica-Bold", 20)
    # Truncate disease name if it's too long
    disease_name = report_data.prediction
    if len(disease_name) > 30:
        disease_name = disease_name[:27] + "..."
    p.drawString(1.3*inch, y_pos - 38, disease_name.upper())

    # mathematical confidence block
    p.setFillColor(colors.HexColor('#22C55E')) # Accuracy Green
    p.rect(width - 2.6*inch, y_pos - 42, 1.4*inch, 34, fill=1)
    
    p.setFillColor(colors.white)
    p.setFont("Helvetica-Bold", 18)
    p.drawCentredString(width - 1.9*inch, y_pos - 30, report_data.confidence)
    
    p.setFont("Helvetica-Bold", 8)
    p.drawCentredString(width - 1.9*inch, y_pos - 38, "CONFIDENCE METRIC")

    y_pos -= 85

    # --- MAIN ANALYTICS MATRIX GRID ---
    p.setFillColor(colors.black)
    
    # A. PRESCRIBED MEDICINE
    p.setFont("Helvetica-Bold", 10)
    p.drawString(1*inch, y_pos, "Prescribed Medicine")
    
    y_pos -= 16
    med_text = Paragraph(
        report_data.details.medication,
        ParagraphStyle(name='MedicationBody', fontName='Helvetica', fontSize=9, leading=14)
    )
    med_w, med_h = med_text.wrap(width - 2*inch, 200)
    med_text.drawOn(p, 1*inch, y_pos - med_h)
    y_pos -= (med_h + 20)
    
    # B. WORKOUT
    p.setFont("Helvetica-Bold", 10)
    p.drawString(1*inch, y_pos, "Workout")
    
    y_pos -= 16
    workout_text = Paragraph(
        report_data.details.workout,
        ParagraphStyle(name='WorkoutBody', fontName='Helvetica', fontSize=9, leading=14)
    )
    w_w, w_h = workout_text.wrap(width - 2*inch, 200)
    workout_text.drawOn(p, 1*inch, y_pos - w_h)
    y_pos -= (w_h + 20)
    
    # C. DISEASE DESCRIPTION
    p.setFont("Helvetica-Bold", 10)
    p.drawString(1*inch, y_pos, "Disease Description")
    
    y_pos -= 16
    desc_text = Paragraph(
        report_data.details.description,
        ParagraphStyle(name='DescriptionBody', fontName='Helvetica', fontSize=9, leading=14)
    )
    d_w, d_h = desc_text.wrap(width - 2*inch, 200)
    desc_text.drawOn(p, 1*inch, y_pos - d_h)
    y_pos -= (d_h + 20)

    # D. MANDATORY PREVENTION (Mapped Array Options Line-by-Line)
    p.setFont("Helvetica-Bold", 10)
    p.drawString(1*inch, y_pos, "Mandatory Prevention")
    
    y_pos -= 18
    
    # Loop over precautions structurally in the PDF Stack
    # If the page ends before these, you might need Platypus flows instead of Canvas drawing
    p.setFont("Helvetica", 9)
    for precaution in report_data.details.precautions:
        p.drawString(1.2*inch, y_pos, "• " + precaution.upper())
        y_pos -= 16
        if y_pos < 1*inch: # Check page break
            p.showPage()
            y_pos = height - 1*inch
            p.setFont("Helvetica", 9) # Restore font settings

    # Finalizer: Compliance Disclaimer Footer (Pinned to bottom viewport)
    p.setFillColor(colors.HexColor('#64748B'))
    p.setFont("Helvetica-Bold", 8)
    p.drawCentredString(width/2, 0.6*inch, "ALGOMEDIX CO. ANALYTICS PIPELINE ENGINE // REPORT ID: AMD-" + datetime.now().strftime("%Y%m%d%H%M%S"))
    p.drawCentredString(width/2, 0.45*inch, "CONFIDENTIAL DOCUMENT // AUTHORIZED MEDICAL PROFESSIONAL USE ONLY.")

    p.showPage()
    p.save()

# --- STANDARD API ROUTES ---

@app.get("/")
def health_check():
    return {"status": "active", "engine": "XGBoost Core Pipeline"}

@app.get("/api/symptoms")
def get_available_symptoms():
    return {"symptoms": symptom_features}

@app.post("/api/predict")
def predict_disease(input_data: SymptomInput):
    if model is None or label_encoder is None:
        raise HTTPException(status_code=503, detail="AI Core engine offline or uninitialized.")
    
    # Initialize a clean matrix array of 230 zeros
    input_vector = np.zeros(len(symptom_features))
    
    # Flip index values from 0 to 1 for each input symptom matched
    matched_any = False
    for symptom in input_data.symptoms:
        normalized_symptom = symptom.strip()
        if normalized_symptom in symptom_features:
            idx = symptom_features.index(normalized_symptom)
            input_vector[idx] = 1
            matched_any = True
            
    if not matched_any and input_data.symptoms:
        raise HTTPException(status_code=400, detail="Provided symptoms do not map to training framework definitions.")

    # Format vector into a DataFrame structural frame match for XGBoost evaluation 
    features_df = pd.DataFrame([input_vector], columns=symptom_features)
    
    # Compute the mathematical probabilities matrix across all target classes
    probabilities = model.predict_proba(features_df)[0]
    top_index = np.argmax(probabilities)
    confidence = probabilities[top_index] * 100
    
    # Reverse numeric target class back to clinical disease title string
    predicted_disease_name = label_encoder.inverse_transform([top_index])[0]
    lookup_key = predicted_disease_name.strip().lower()
    
    # Extract mapped content metrics
    meta_info = meta_database.get(lookup_key, {
        "description": "Information pending clinical categorization review.",
        "medication": "Symptomatic treatment per practitioner oversight.",
        "workout": "General programmatic rehabilitation pacing.",
        "diet": "Hydration monitoring optimization metrics.",
        "precautions": ["Consult primary physician for diagnostic assessment validation."]
    })
    
    return {
        "prediction": predicted_disease_name,
        "confidence": f"{confidence:.2f}%",
        "details": meta_info
      }

# --- NEW API ROUTE: GENERATE DOWNLOADABLE PDF REPORT ---
@app.post("/api/generate-pdf")
def create_diagnostic_report_file(input_report: PDFReportInput):
    """
    FastAPI endpoint that accepts prediction telemetry data, runs the PDF generator stack,
    and returns a StreamingResponse file blob direct to browser.
    """
    buffer = io.BytesIO()
    
    try:
        generate_report_pdf(buffer, input_report)
        # Move pointer back to start after writing stream
        buffer.seek(0)
        
        filename = f"report-{datetime.now().strftime('%Y%m%d-%H%M')}.pdf"
        headers = {
            'Content-Disposition': f'attachment; filename="{filename}"'
        }
        
        return StreamingResponse(buffer, media_type="application/pdf", headers=headers)
        
    except Exception as e:
        print(f"[PDF_ERROR] Generation flow failed on canvas stack traversal: {e}")
        raise HTTPException(status_code=500, detail="Document generation flow uninitialized or failed.")

# Run command (powershell/Git Bash):
# uvicorn app:app --reload --host 127.0.0.1 --port 8000