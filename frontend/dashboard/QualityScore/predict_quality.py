import sys
import json
import pickle
import numpy as np
import pandas as pd
import os

# Scaling and Offset parameters (configurable)
WEIGHT_LOSS_SCALE = 1.0  # Adjust if weight loss needs scaling
SHOCK_COUNT_SCALE = 1.0  # Adjust if shock count needs scaling

def main():
    # Read JSON from stdin
    input_data = sys.stdin.read()
    if not input_data:
        print(json.dumps({"error": "No input data provided"}))
        sys.exit(1)
        
    try:
        data = json.loads(input_data)
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON: {str(e)}"}))
        sys.exit(1)
        
    trip = data.get('trip', {})
    sensor_data = data.get('sensorData', {})
    
    if not trip or not sensor_data:
        print(json.dumps({"error": "Missing trip or sensor data"}))
        sys.exit(1)

    # Resolve model path relative to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(script_dir, '..', '..', '..', 'backend', 'model', 'cold_chain_model.pkl')
    
    # Load the model
    try:
        with open(model_path, 'rb') as f:
            model = pickle.load(f)
    except Exception as e:
        print(json.dumps({"error": f"Model loading failed: {str(e)}, Path: {model_path}"}))
        sys.exit(1)

    temp_data = sensor_data.get('temperature_data', [])
    motion_data = sensor_data.get('motion_data', [])
    
    # Feature 1: avg_temp
    avg_temp = np.mean([item.get('avg', 0) for item in temp_data]) if temp_data else 2.0
    
    # Feature 2: max_temp
    max_temp = np.max([item.get('max', 0) for item in temp_data]) if temp_data else 3.5
    
    # Feature 3: min_temp
    min_temp = np.min([item.get('min', 0) for item in temp_data]) if temp_data else 1.0
    
    # Feature 4: shock_count
    # Treating 'harsh_event' == True as a shock
    shock_count = sum([1 for item in motion_data if item.get('harsh_event', False)]) * SHOCK_COUNT_SCALE
    
    # Feature 5: max_accel
    max_accel = np.max([item.get('max_accel', 0) for item in motion_data]) if motion_data else 2.7
    
    # Feature 6: weight_loss
    weight1 = trip.get('weight1', 0)
    weight2 = trip.get('weight2', weight1)
    if weight1 > 0:
        weight_loss = ((weight1 - weight2) / weight1) * 100 * WEIGHT_LOSS_SCALE
    else:
        weight_loss = 0
        
    # Feature 7: trip_duration
    # Extracted from Node layer to simplify parsing
    trip_duration = data.get('duration_minutes', 165)
    
    # Data Preprocessing (Clipping to match model boundaries)
    max_temp = np.clip(max_temp, -2, 10)
    min_temp = np.clip(min_temp, -5, 8)
    shock_count = np.clip(shock_count, 0, 50)
    weight_loss = np.clip(weight_loss, 0, 30)
    trip_duration = np.clip(trip_duration, 30, 300)
    
    # Create DataFrame for prediction (ensure column order matches model)
    features = pd.DataFrame([{
        'avg_temp': avg_temp,
        'max_temp': max_temp,
        'min_temp': min_temp,
        'shock_count': shock_count,
        'max_accel': max_accel,
        'weight_loss': weight_loss,
        'trip_duration': trip_duration
    }])
    
    try:
        quality_score = model.predict(features)[0]
        # Return result as JSON
        print(json.dumps({
            "success": True,
            "quality_score": float(quality_score),
            "features_used": features.to_dict('records')[0]
        }))
    except Exception as e:
        print(json.dumps({"error": f"Prediction failed: {str(e)}"}))
        sys.exit(1)

if __name__ == '__main__':
    main()
