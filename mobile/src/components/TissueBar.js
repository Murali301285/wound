import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const TISSUE_COLORS = {
  Granulation: '#ef4444', // Red
  Slough: '#eab308',      // Yellow
  Necrosis: '#0f172a',    // Black
  Eschar: '#0f172a',      // Black
  Maceration: '#f8fafc',  // White
  Tendon: '#06b6d4',      // Cyan
  Bone: '#fed7aa',        // Cream
  Background: '#3b82f6',  // Blue
};

export default function TissueBar({ label, percentage }) {
  const color = TISSUE_COLORS[label] || '#3b82f6';
  const numPct = parseFloat(percentage) || 0;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <View style={styles.dotLabel}>
          <View style={[styles.dot, { backgroundColor: color, borderColor: label === 'Maceration' ? '#cbd5e1' : color }]} />
          <Text style={styles.labelText}>{label}</Text>
        </View>
        <Text style={styles.pctText}>{numPct}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(100, numPct)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  dotLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
  },
  labelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  pctText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  track: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
});
