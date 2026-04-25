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
        
    is_batch = isinstance(data, list)
    items = data if is_batch else [data]
    
    if not items:
        print(json.dumps({"error": "Empty input data"}))
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

    features_list = []
    trip_ids = []

    for item in items:
        trip = item.get('trip', {})
        sensor_data = item.get('sensorData', {})
        trip_ids.append(trip.get('trip_id', 'unknown'))

        temp_data = sensor_data.get('temperature_data', [])
        motion_data = sensor_data.get('motion_data', [])
        
        avg_temp = np.mean([item.get('avg', 0) for item in temp_data]) if temp_data else 2.0
        max_temp = np.max([item.get('max', 0) for item in temp_data]) if temp_data else 3.5
        min_temp = np.min([item.get('min', 0) for item in temp_data]) if temp_data else 1.0
        
        shock_count = sum([1 for item in motion_data if item.get('harsh_event', False)]) * SHOCK_COUNT_SCALE
        max_accel = np.max([item.get('max_accel', 0) for item in motion_data]) if motion_data else 2.7
        
        weight1 = trip.get('weight1', 0)
        weight2 = trip.get('weight2', weight1)
        if weight1 > 0:
            weight_loss = ((weight1 - weight2) / weight1) * 100 * WEIGHT_LOSS_SCALE
        else:
            weight_loss = 0
            
        trip_duration = item.get('duration_minutes', 165)
        
        max_temp = np.clip(max_temp, -2, 10)
        min_temp = np.clip(min_temp, -5, 8)
        shock_count = np.clip(shock_count, 0, 50)
        weight_loss = np.clip(weight_loss, 0, 30)
        trip_duration = np.clip(trip_duration, 30, 300)
        
        features_list.append({
            'avg_temp': avg_temp,
            'max_temp': max_temp,
            'min_temp': min_temp,
            'shock_count': shock_count,
            'max_accel': max_accel,
            'weight_loss': weight_loss,
            'trip_duration': trip_duration
        })
    
    features = pd.DataFrame(features_list)
    
    try:
        quality_scores = model.predict(features)
        
        if is_batch:
            scores_dict = {trip_ids[i]: float(quality_scores[i]) for i in range(len(trip_ids))}
            print(json.dumps({
                "success": True,
                "scores": scores_dict
            }))
        else:
            print(json.dumps({
                "success": True,
                "quality_score": float(quality_scores[0]),
                "features_used": features.to_dict('records')[0]
            }))
    except Exception as e:
        print(json.dumps({"error": f"Prediction failed: {str(e)}"}))
        sys.exit(1)

if __name__ == '__main__':
    main()
