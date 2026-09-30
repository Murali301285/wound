import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_KEY = '@woundcare_backend_url';

// Default development URL
// Android Emulator uses 10.0.2.2, iOS Simulator uses localhost
const DEFAULT_URL = Platform.select({
  android: 'http://10.0.2.2:3367/api',
  ios: 'http://localhost:3367/api',
  default: 'http://127.0.0.1:3367/api',
});

export const getApiBaseUrl = async () => {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    return saved || DEFAULT_URL;
  } catch {
    return DEFAULT_URL;
  }
};

export const setApiBaseUrl = async (url) => {
  try {
    // Ensure trailing slash is removed and /api is included if missing
    let cleanUrl = url.trim().replace(/\/+$/, '');
    if (!cleanUrl.endsWith('/api')) {
      cleanUrl += '/api';
    }
    await AsyncStorage.setItem(STORAGE_KEY, cleanUrl);
    return cleanUrl;
  } catch (e) {
    console.error('Error saving API URL:', e);
    return DEFAULT_URL;
  }
};

/**
 * Predict / Analyze wound image via multipart/form-data
 */
export const predictWound = async (imageUri) => {
  const baseUrl = await getApiBaseUrl();
  const formData = new FormData();

  const filename = imageUri.split('/').pop() || 'wound_scan.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : 'image/jpeg';

  formData.append('image', {
    uri: Platform.OS === 'ios' ? imageUri.replace('file://', '') : imageUri,
    name: filename,
    type: type,
  });

  const response = await fetch(`${baseUrl}/predict`, {
    method: 'POST',
    body: formData,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'multipart/form-data',
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Analysis failed (${response.status}): ${errText || 'Server error'}`);
  }

  return await response.json();
};

/**
 * Generate AI SOAP Clinical Note
 */
export const generateSoapNote = async ({ tissue_statistics, measurements, depth_assessment, doctor_notes }) => {
  const baseUrl = await getApiBaseUrl();
  const response = await fetch(`${baseUrl}/scribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      tissue_statistics,
      measurements,
      depth_assessment,
      doctor_notes: doctor_notes || '',
    }),
  });

  if (!response.ok) {
    throw new Error(`Scribe failed with status ${response.status}`);
  }

  return await response.json();
};
