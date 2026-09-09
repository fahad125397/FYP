import os
import pandas as pd
import numpy as np
import pickle
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score
import xgboost as xgb  # Explicitly importing the alias here

# ==========================================
# PHASE 1: DATA PREPROCESSING
# ==========================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
dataset_path = os.path.join(BASE_DIR, 'data', 'Diseases_and_Symptoms_dataset.csv')

print("Executing Phase 1.5: Data Preprocessing...")

# Load the Dataset
try:
    df = pd.read_csv(dataset_path)
except FileNotFoundError as e:
    print(f"Error: Could not find the file at {dataset_path}")
    print("Please ensure your 'data' folder and CSV file are inside the backend directory.")
    exit()

# Separate Features (X) and Target Label (y)
X = df.drop(columns=['diseases'])  
y = df['diseases'] 
print(y.value_counts())             

print(f"Total rows (samples): {X.shape[0]}")
print(f"Total symptoms (features): {X.shape[1]}")
print(f"Total unique diseases to predict: {y.nunique()}")

# Encode Target Labels
label_encoder = LabelEncoder()
y_encoded = label_encoder.fit_transform(y)

# Split Data into Training (80%) and Testing (20%) sets
X_train, X_test, y_train, y_test = train_test_split(
    X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
)

print("\nData successfully split:")
print(f"Training samples: {X_train.shape[0]}")
print(f"Testing samples: {X_test.shape[0]}")
print("\n[SUCCESS] Phase 1 Completed. Ready for XGBoost training!")


# ==========================================
# PHASE 2: MODEL TRAINING & EVALUATION
# ==========================================
print("\nInitializing XGBoost Classifier...")

# Configure the XGBoost Model
model = xgb.XGBClassifier(
    objective='multi:softprob',
    num_class=100,
    max_depth=6,
    learning_rate=0.1,
    n_estimators=100,
    random_state=42,
    tree_method='hist'  # Optimized for large data sets
)

# Train the Model
print("Training the model (this might take a minute or two)...")
model.fit(X_train, y_train)
print("Training complete!")

# Evaluate the Model
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred) * 100
print(f"\n==========================================")
print(f"       MODEL ACCURACY: {accuracy:.2f}%")
print(f"==========================================")

# Save artifacts for the Full-Stack Backend
print("\nSaving model and preprocessing artifacts...")

artifacts_dir = os.path.join(BASE_DIR, 'artifacts')
os.makedirs(artifacts_dir, exist_ok=True)

# Save the trained model
with open(os.path.join(artifacts_dir, 'xgboost_model.pkl'), 'wb') as f:
    pickle.dump(model, f)

# Save the label encoder
with open(os.path.join(artifacts_dir, 'label_encoder.pkl'), 'wb') as f:
    pickle.dump(label_encoder, f)

# Save the symptom features list
symptom_features = X.columns.tolist()
with open(os.path.join(artifacts_dir, 'symptom_features.pkl'), 'wb') as f:
    pickle.dump(symptom_features, f)

print("[SUCCESS] All artifacts saved in backend/artifacts/ folder!")