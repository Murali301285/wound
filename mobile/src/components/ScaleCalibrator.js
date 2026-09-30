import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, PanResponder } from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';
import { Ruler, Check, X } from 'lucide-react-native';

/**
 * Mobile ScaleCalibrator
 * Enables touch-based drag line calibration across a reference marker.
 */
export default function ScaleCalibrator({
  isCalibrating,
  onCancel,
  onConfirmScale,
  containerWidth,
  containerHeight,
  naturalWidth,
}) {
  const [startPoint, setStartPoint] = useState({ x: 50, y: 100 });
  const [endPoint, setEndPoint] = useState({ x: 150, y: 100 });
  const [activeHandle, setActiveHandle] = useState(null); // 'start' | 'end'
  const [showModal, setShowModal] = useState(false);
  const [lengthCm, setLengthCm] = useState('1.0');

  // Handle touch events on the handles
  const handleTouchStart = (handle, e) => {
    setActiveHandle(handle);
  };

  const handleTouchMove = (e) => {
    if (!activeHandle) return;
    const { locationX, locationY } = e.nativeEvent;
    if (activeHandle === 'start') {
      setStartPoint({ x: locationX, y: locationY });
    } else if (activeHandle === 'end') {
      setEndPoint({ x: locationX, y: locationY });
    }
  };

  const handleTouchEnd = () => {
    setActiveHandle(null);
  };

  const handleFinishDrawing = () => {
    setShowModal(true);
  };

  const handleSaveCalibration = () => {
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const distanceScreenPx = Math.sqrt(dx * dx + dy * dy);

    const scaleFactor = (naturalWidth || containerWidth) / containerWidth;
    const distanceNaturalPx = distanceScreenPx * scaleFactor;

    const numCm = parseFloat(lengthCm) || 1.0;
    const pixelsPerCm = distanceNaturalPx / numCm;

    setShowModal(false);
    onConfirmScale(pixelsPerCm);
  };

  if (!isCalibrating) return null;

  return (
    <View
      style={StyleSheet.absoluteFill}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Interactive SVG Line */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Line
          x1={startPoint.x}
          y1={startPoint.y}
          x2={endPoint.x}
          y2={endPoint.y}
          stroke="#38bdf8"
          strokeWidth="3"
          strokeDasharray="5,5"
        />
        <Circle cx={startPoint.x} cy={startPoint.y} r="8" fill="#0284c7" stroke="#ffffff" strokeWidth="2" />
        <Circle cx={endPoint.x} cy={endPoint.y} r="8" fill="#0284c7" stroke="#ffffff" strokeWidth="2" />
      </Svg>

      {/* Draggable Touch Handles */}
      <View
        style={[styles.touchHandle, { left: startPoint.x - 20, top: startPoint.y - 20 }]}
        onTouchStart={(e) => handleTouchStart('start', e)}
      />
      <View
        style={[styles.touchHandle, { left: endPoint.x - 20, top: endPoint.y - 20 }]}
        onTouchStart={(e) => handleTouchStart('end', e)}
      />

      {/* Action Bar Floating Banner */}
      <View style={styles.floatingBanner}>
        <Text style={styles.bannerText}>Drag blue handles across reference mark (e.g. 1cm ruler/coin)</Text>
        <View style={styles.bannerButtons}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <X size={16} color="#ef4444" />
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.doneBtn} onPress={handleFinishDrawing}>
            <Check size={16} color="#ffffff" />
            <Text style={styles.doneText}>Set Length</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Input Modal */}
      <Modal visible={showModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ruler size={20} color="#0284c7" />
              <Text style={styles.modalTitle}>Set Reference Length</Text>
            </View>
            <Text style={styles.modalSubtitle}>Enter real-world length of the line in centimeters:</Text>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.textInput}
                value={lengthCm}
                onChangeText={setLengthCm}
                keyboardType="numeric"
                selectTextOnFocus
              />
              <View style={styles.unitBox}>
                <Text style={styles.unitBoxText}>cm</Text>
              </View>
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowModal(false)}>
                <Text style={styles.modalCancelText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleSaveCalibration}>
                <Text style={styles.modalConfirmText}>Save Scale</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  touchHandle: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(56, 189, 248, 0.4)',
    borderWidth: 2,
    borderColor: '#38bdf8',
    zIndex: 20,
  },
  floatingBanner: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  bannerText: {
    color: '#cbd5e1',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  bannerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  cancelText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#0284c7',
  },
  doneText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 20,
  },
  textInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  unitBox: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#cbd5e1',
  },
  unitBoxText: {
    color: '#64748b',
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  modalCancelText: {
    color: '#64748b',
    fontWeight: '600',
  },
  modalConfirm: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#0284c7',
  },
  modalConfirmText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
});
