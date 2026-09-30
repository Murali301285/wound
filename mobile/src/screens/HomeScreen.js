import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, Ruler, Activity, Settings, RefreshCw, AlertCircle } from 'lucide-react-native';
import ScaleCalibrator from '../components/ScaleCalibrator';
import ServerConfigModal from '../components/ServerConfigModal';
import { predictWound } from '../config/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PREVIEW_WIDTH = SCREEN_WIDTH - 48;

export default function HomeScreen({ onAnalysisComplete }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [pixelsPerCm, setPixelsPerCm] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [error, setError] = useState(null);

  // Take photo using device camera
  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required to capture wound photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedImage(asset.uri);
        setNaturalSize({ width: asset.width || 400, height: asset.height || 400 });
        setPixelsPerCm(null);
        setError(null);
      }
    } catch (err) {
      Alert.alert('Camera Error', err.message);
    }
  };

  // Pick photo from gallery
  const handlePickGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Gallery permission is required to select photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedImage(asset.uri);
        setNaturalSize({ width: asset.width || 400, height: asset.height || 400 });
        setPixelsPerCm(null);
        setError(null);
      }
    } catch (err) {
      Alert.alert('Gallery Error', err.message);
    }
  };

  // Run AI Analysis
  const handleAnalyze = async () => {
    if (!selectedImage) return;

    setLoading(true);
    setError(null);

    try {
      const resultData = await predictWound(selectedImage);
      onAnalysisComplete({
        imageUri: selectedImage,
        pixelsPerCm: pixelsPerCm,
        result: resultData,
      });
    } catch (err) {
      setError(err.message || 'Analysis failed. Check your server connection.');
      Alert.alert('Analysis Failed', err.message || 'Could not connect to server. Check server URL in Settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedImage(null);
    setPixelsPerCm(null);
    setError(null);
  };

  const previewHeight = naturalSize.width > 0
    ? Math.min(360, PREVIEW_WIDTH * (naturalSize.height / naturalSize.width))
    : PREVIEW_WIDTH * 0.75;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>WoundCare AI</Text>
          <Text style={styles.appSubtitle}>Clinical Wound Analysis & 4-Sided Scales</Text>
        </View>
        <TouchableOpacity style={styles.settingsBtn} onPress={() => setShowConfig(true)}>
          <Settings size={20} color="#0284c7" />
        </TouchableOpacity>
      </View>

      {/* Main Action Cards */}
      {!selectedImage ? (
        <View style={styles.pickerCard}>
          <Text style={styles.pickerTitle}>Capture or Upload Wound Image</Text>
          <Text style={styles.pickerSubtitle}>Take a clear photo in good lighting or select from device files.</Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.actionBtnPrimary} onPress={handleTakePhoto}>
              <Camera size={24} color="#ffffff" />
              <Text style={styles.actionBtnTextPrimary}>Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtnSecondary} onPress={handlePickGallery}>
              <ImageIcon size={24} color="#0284c7" />
              <Text style={styles.actionBtnTextSecondary}>Gallery</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.previewCard}>
          {/* Image Container with Calibration Overlay */}
          <View style={[styles.imageWrapper, { width: PREVIEW_WIDTH, height: previewHeight }]}>
            <Image
              source={{ uri: selectedImage }}
              style={{ width: PREVIEW_WIDTH, height: previewHeight }}
              resizeMode="contain"
            />

            {/* Touch Scale Calibrator */}
            <ScaleCalibrator
              isCalibrating={isCalibrating}
              containerWidth={PREVIEW_WIDTH}
              containerHeight={previewHeight}
              naturalWidth={naturalSize.width}
              onCancel={() => setIsCalibrating(false)}
              onConfirmScale={(scale) => {
                setPixelsPerCm(scale);
                setIsCalibrating(false);
              }}
            />
          </View>

          {/* Calibration Action Bar */}
          {!loading && (
            <View style={styles.calibrationRow}>
              <TouchableOpacity
                style={[styles.scaleBtn, pixelsPerCm && styles.scaleBtnActive]}
                onPress={() => setIsCalibrating(true)}
              >
                <Ruler size={16} color={pixelsPerCm ? "#16a34a" : "#0284c7"} />
                <Text style={[styles.scaleBtnText, pixelsPerCm && styles.scaleBtnTextActive]}>
                  {pixelsPerCm ? `Scale: 1cm = ${Math.round(pixelsPerCm)}px` : "Set Reference Scale (Optional)"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Analyze Button */}
          <TouchableOpacity
            style={[styles.analyzeBtn, loading && styles.analyzeBtnDisabled]}
            onPress={handleAnalyze}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Activity size={20} color="#ffffff" />
            )}
            <Text style={styles.analyzeBtnText}>
              {loading ? "Analyzing Tissue Structure..." : "Analyze Wound"}
            </Text>
          </TouchableOpacity>

          {/* Reset Button */}
          {!loading && (
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
              <RefreshCw size={16} color="#64748b" />
              <Text style={styles.resetBtnText}>New Photo</Text>
            </TouchableOpacity>
          )}

          {error && (
            <View style={styles.errorBox}>
              <AlertCircle size={16} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </View>
      )}

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Clinical Guidelines:</Text>
        <Text style={styles.infoItem}>• Position camera parallel to the wound surface.</Text>
        <Text style={styles.infoItem}>• Ensure even lighting to capture true color values.</Text>
        <Text style={styles.infoItem}>• Place a ruler or coin nearby to calibrate real-world dimensions.</Text>
      </View>

      <ServerConfigModal visible={showConfig} onClose={() => setShowConfig(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: 10,
  },
  appName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
  },
  appSubtitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 6,
  },
  pickerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  actionBtnPrimary: {
    flex: 1,
    backgroundColor: '#0284c7',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  actionBtnTextPrimary: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  actionBtnSecondary: {
    flex: 1,
    backgroundColor: '#f0f9ff',
    borderWidth: 1.5,
    borderColor: '#bae6fd',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnTextSecondary: {
    color: '#0284c7',
    fontSize: 15,
    fontWeight: 'bold',
  },
  previewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    marginBottom: 20,
  },
  imageWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000000',
    position: 'relative',
    marginBottom: 12,
  },
  calibrationRow: {
    width: '100%',
    marginBottom: 12,
  },
  scaleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 10,
  },
  scaleBtnActive: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  scaleBtnText: {
    color: '#0284c7',
    fontSize: 13,
    fontWeight: '600',
  },
  scaleBtnTextActive: {
    color: '#16a34a',
  },
  analyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0284c7',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  analyzeBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  analyzeBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
  },
  resetBtnText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    width: '100%',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 12,
    flex: 1,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 6,
  },
  infoItem: {
    fontSize: 12,
    color: '#64748b',
    marginVertical: 2,
    lineHeight: 18,
  },
});
