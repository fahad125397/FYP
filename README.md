# 🧬 AlgoMedix — AI Disease Prediction System

<p align="center">
  <img src="https://img.shields.io/badge/Model-XGBoost-blue?style=for-the-badge&logo=python" />
  <img src="https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi" />
  <img src="https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB?style=for-the-badge&logo=react" />
  <img src="https://img.shields.io/badge/Styling-TailwindCSS-38B2AC?style=for-the-badge&logo=tailwindcss" />
  <img src="https://img.shields.io/badge/Deploy-Vercel-black?style=for-the-badge&logo=vercel" />
</p>

<p align="center">
  A full-stack AI-powered clinical diagnostic web application that predicts diseases based on patient-reported symptoms using a trained XGBoost machine learning model — with PDF report generation and medical metadata output.
</p>

---

## 📸 Overview

AlgoMedix is a **Final Year Project (FYP)** that uses machine learning to assist in preliminary disease prediction. Users select their symptoms from a comprehensive list, and the system returns:

- 🩺 **Predicted Disease** with confidence score
- 💊 **Prescribed Medication** recommendations
- 🥗 **Diet** plan for recovery
- 🏃 **Workout** guidance
- 🛡️ **Precautionary Measures**
- 📄 **Downloadable PDF Diagnostic Report**

---

## 🏗️ Project Architecture

```
disease-predictor/
├── api/
│   └── index.py          # FastAPI backend (Vercel Serverless)
├── artifacts/
│   ├── xgboost_model.pkl     # Trained XGBoost model
│   ├── label_encoder.pkl     # Label encoder for disease classes
│   └── symptom_features.pkl  # Symptom feature list
├── data/
│   ├── description.csv       # Disease descriptions
│   ├── medications.csv       # Medication mappings
│   ├── diets.csv             # Diet recommendations
│   ├── workout.csv           # Workout plans
│   └── precautions.csv       # Precautionary measures
├── src/                      # React frontend source
├── public/                   # Static assets
├── backend/
│   ├── app.py                # Standalone Flask/FastAPI dev server
│   └── train_model.py        # Model training pipeline
├── vercel.json               # Vercel deployment config
├── vite.config.js            # Vite + API proxy config
└── requirements.txt          # Python dependencies
```

---

## 🤖 ML Model Details

| Property | Value |
|---|---|
| **Algorithm** | XGBoost Classifier |
| **Input** | Binary symptom vector (132 features) |
| **Output** | Disease class + probability scores |
| **Encoder** | Scikit-learn `LabelEncoder` |
| **Training Data** | Diseases & Symptoms Dataset |

---

## 🚀 Getting Started (Local Development)

### Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.9
- **pip** (Python package manager)

---

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/fahad125397/FYP.git
cd FYP
```

---

### 2️⃣ Install Python Dependencies

```bash
pip install fastapi uvicorn pandas numpy scikit-learn xgboost reportlab pydantic
```

---

### 3️⃣ Install Node Dependencies

```bash
npm install
```

---

### 4️⃣ Run the Backend (FastAPI)

```bash
python -m uvicorn api.index:app --host 127.0.0.1 --port 8000 --reload
```

> API will be live at: `http://127.0.0.1:8000`  
> Swagger docs at: `http://127.0.0.1:8000/docs`

---

### 5️⃣ Run the Frontend (React + Vite)

```bash
npm run dev
```

> App will be live at: `http://localhost:5173`

> ✅ Vite automatically proxies `/api/*` calls to the FastAPI backend — no CORS configuration needed.

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `GET` | `/api/symptoms` | Returns full list of valid symptoms |
| `POST` | `/api/predict` | Predicts disease from symptom array |
| `POST` | `/api/generate-pdf` | Generates downloadable PDF diagnostic report |

### `/api/predict` — Request Body

```json
{
  "symptoms": ["itching", "skin_rash", "nodal_skin_eruptions"]
}
```

### `/api/predict` — Response

```json
{
  "prediction": "Fungal infection",
  "confidence": "97.43%",
  "details": {
    "description": "...",
    "medication": "...",
    "workout": "...",
    "diet": "...",
    "precautions": ["..."]
  }
}
```

---

## 🛠️ Tech Stack

### Frontend
- ⚛️ **React 19** — UI framework
- ⚡ **Vite 8** — Build tool & dev server
- 🎨 **TailwindCSS 4** — Utility-first styling
- 📡 **Axios** — HTTP client
- 🎯 **Lucide React** — Icon library

### Backend
- 🐍 **Python 3.9+**
- 🚀 **FastAPI** — High-performance async API framework
- 🤖 **XGBoost** — ML model for disease prediction
- 🧪 **Scikit-learn** — Preprocessing & encoding
- 📊 **Pandas / NumPy** — Data manipulation
- 📄 **ReportLab** — PDF generation engine

### Deployment
- ▲ **Vercel** — Serverless deployment (frontend + Python functions)

---

## 📄 PDF Report

The app generates a branded **ALGOMEDIX Predictive Analytics Diagnostic Report** in PDF format including:
- Patient symptom vector
- Disease classification with confidence score
- Prescribed medication, diet & workout plans
- Mandatory prevention guidelines
- Timestamped report ID

---

## 👨‍💻 Author

**Fahad** — Final Year Project (FYP)  
GitHub: [@fahad125397](https://github.com/fahad125397)

---

## ⚠️ Disclaimer

> This application is built for **educational and research purposes only**. It is **not** a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare professional.

---

<p align="center">Made with ❤️ for FYP | AlgoMedix © 2024</p>
