import pytest
import os
import cv2
import io
from app.main import create_app
from test_pipeline import create_synthetic_wound_image

@pytest.fixture
def client():
    app = create_app()
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_health_check(client):
    rv = client.get('/api/health')
    assert rv.status_code == 200
    assert rv.json['status'] == 'healthy'

def test_predict_endpoint(client):
    # Generate synthetic image
    img = create_synthetic_wound_image()
    # Encode to JPEG
    _, buffer = cv2.imencode('.jpg', cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
    
    data = {
        'image': (io.BytesIO(buffer.tobytes()), 'test_wound.jpg')
    }
    
    rv = client.post('/api/predict', data=data, content_type='multipart/form-data')
    
    assert rv.status_code == 200
    json_data = rv.json
    
    print("\nAPI Response Keys:", json_data.keys())
    print("Depth Assessment:", json_data['depth_assessment'])
    print("Tissue Stats:", json_data['tissue_statistics'])
    
    assert 'depth_assessment' in json_data
    assert 'tissue_statistics' in json_data
    assert 'segmentation_map' in json_data
    assert json_data['segmentation_map'].startswith('data:image/jpeg;base64,')

if __name__ == "__main__":
    # Manual run without pytest
    client_obj = create_app().test_client()
    
    print("1. Testing Health...")
    resp = client_obj.get('/api/health')
    print(resp.json)
    
    print("2. Testing Predict...")
    img = create_synthetic_wound_image()
    _, buffer = cv2.imencode('.jpg', cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
    data = {'image': (io.BytesIO(buffer.tobytes()), 'test_wound.jpg')}
    
    resp = client_obj.post('/api/predict', data=data, content_type='multipart/form-data')
    print("Status:", resp.status_code)
    if resp.status_code == 200:
        print("Success! Response received.")
        print(resp.json.keys())
    else:
        print("Failed:", resp.data)
