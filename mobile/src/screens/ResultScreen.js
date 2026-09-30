import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  FileText,
  Activity,
  Lightbulb,
  ArrowLeft,
  Sparkles,
  CheckCircle,
  Share2,
} from 'lucide-react-native';
import WoundRulerFrame from '../components/WoundRulerFrame';
import TissueBar from '../components/TissueBar';
import { generateSoapNote } from '../config/api';

export default function ResultScreen({ data, onBack }) {
  const { imageUri, pixelsPerCm, result } = data;
  const { depth_assessment, tissue_statistics, measurements, segmentation_map } = result;

  const [doctorNotes, setDoctorNotes] = useState('');
  const [soapNote, setSoapNote] = useState(null);
  const [scribeLoading, setScribeLoading] = useState(false);

  // Conversions
  const convertPxToCm = (px) => {
    if (!pixelsPerCm) return `${px} px`;
    return `${(px / pixelsPerCm).toFixed(2)} cm`;
  };

  const convertAreaToCm2 = (pxArea) => {
    if (!pixelsPerCm) return `${pxArea} px²`;
    return `${(pxArea / (pixelsPerCm * pixelsPerCm)).toFixed(2)} cm²`;
  };

  const getRecommendations = (stats) => {
    const recs = [];
    if (stats.Eschar > 10 || stats.Necrosis > 10) {
      recs.push("⚠️ Necrotic tissue detected. Clinical debridement evaluation recommended.");
    }
    if (stats.Slough > 30) {
      recs.push("⚠️ Significant slough present. Cleanse wound and assess for enzymatic/autolytic debridement.");
    }
    if (stats.Granulation > 50) {
      recs.push("✅ Favorable granulation bed. Maintain moist environment to encourage closure.");
    }
    if (recs.length === 0) {
      recs.push("Continue standard wound management and monitor progression.");
    }
    return recs;
  };

  const handleGenerateSoapNote = async () => {
    setScribeLoading(true);
    setSoapNote(null);
    try {
      const res = await generateSoapNote({
        tissue_statistics,
        measurements,
        depth_assessment,
        doctor_notes: doctorNotes,
      });
      setSoapNote(res.soap_note);
    } catch (e) {
      Alert.alert('Scribe Error', e.message || 'Could not generate SOAP note.');
    } finally {
      setScribeLoading(false);
    }
  };

  const depthColor =
    depth_assessment === 'Superficial'
      ? '#16a34a'
      : depth_assessment === 'Partial-Thickness'
      ? '#d97706'
      : '#dc2626';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Navigation */}
      <View style={styles.topNav}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft size={18} color="#0284c7" />
          <Text style={styles.backBtnText}>New Scan</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Analysis Report</Text>
      </View>

      {/* 4-Sided Calibrated Scale Frame */}
      <WoundRulerFrame
        imageUri={segmentation_map || imageUri}
        pixelsPerCm={pixelsPerCm}
        measurements={measurements}
        title="Tissue Segmentation & 4-Sided Scales"
      />

      {/* Clinical Depth Assessment Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <FileText size={18} color="#0284c7" />
          <Text style={styles.cardTitle}>Clinical Depth Assessment</Text>
        </View>
        <View style={styles.depthRow}>
          <View>
            <Text style={styles.depthLabel}>Predicted Depth:</Text>
            <Text style={styles.depthValue}>{depth_assessment}</Text>
          </View>
          <View style={[styles.depthBadge, { backgroundColor: `${depthColor}15`, borderColor: depthColor }]}>
            <Text style={[styles.depthBadgeText, { color: depthColor }]}>
              {depth_assessment === 'Superficial' ? 'Low Risk' : 'Attention Required'}
            </Text>
          </View>
        </View>
      </View>

      {/* Calibrated Dimensions Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Activity size={18} color="#0284c7" />
          <Text style={styles.cardTitle}>
            Wound Dimensions {pixelsPerCm ? "(Calibrated)" : "(Approx)"}
          </Text>
        </View>

        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Max Width</Text>
            <Text style={styles.metricValue}>{convertPxToCm(measurements.width_px)}</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Max Height</Text>
            <Text style={styles.metricValue}>{convertPxToCm(measurements.height_px)}</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Surface Area</Text>
            <Text style={styles.metricValue}>{convertAreaToCm2(measurements.area_px)}</Text>
          </View>
        </View>
      </View>

      {/* Tissue Composition Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Activity size={18} color="#0284c7" />
          <Text style={styles.cardTitle}>Tissue Breakdown</Text>
        </View>
        {Object.entries(tissue_statistics).map(([tissue, pct]) => (
          <TissueBar key={tissue} label={tissue} percentage={pct} />
        ))}
      </View>

      {/* Smart Recommendations */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Lightbulb size={18} color="#eab308" />
          <Text style={styles.cardTitle}>Clinical Recommendations</Text>
        </View>
        <View style={styles.recsBox}>
          {getRecommendations(tissue_statistics).map((rec, i) => (
            <Text key={i} style={styles.recItem}>• {rec}</Text>
          ))}
          <Text style={styles.recFootnote}>AI Assisted • Requires clinical validation</Text>
        </View>
      </View>

      {/* AI SOAP Note Generator */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Sparkles size={18} color="#8b5cf6" />
          <Text style={styles.cardTitle}>AI Clinical Scribe (SOAP Note)</Text>
        </View>

        <Text style={styles.scribePrompt}>Add physician examination notes (optional):</Text>
        <TextInput
          style={styles.doctorInput}
          placeholder="e.g. Mild exudate, periwound erythema, dressing changed..."
          placeholderTextColor="#94a3b8"
          value={doctorNotes}
          onChangeText={setDoctorNotes}
          multiline
        />

        <TouchableOpacity
          style={styles.scribeBtn}
          onPress={handleGenerateSoapNote}
          disabled={scribeLoading}
        >
          {scribeLoading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Sparkles size={16} color="#ffffff" />
          )}
          <Text style={styles.scribeBtnText}>
            {scribeLoading ? "Generating SOAP Note..." : "Generate AI SOAP Note"}
          </Text>
        </TouchableOpacity>

        {soapNote && typeof soapNote === 'object' && (
          <View style={styles.soapResult}>
            <View style={styles.soapSection}>
              <Text style={styles.soapHeading}>S (Subjective):</Text>
              <Text style={styles.soapBody}>{soapNote.subjective || 'None'}</Text>
            </View>
            <View style={styles.soapSection}>
              <Text style={styles.soapHeading}>O (Objective):</Text>
              <Text style={styles.soapBody}>{soapNote.objective_summary || 'None'}</Text>
            </View>
            <View style={styles.soapSection}>
              <Text style={styles.soapHeading}>A (Assessment):</Text>
              <Text style={styles.soapBody}>{soapNote.assessment || 'None'}</Text>
            </View>
            <View style={styles.soapSection}>
              <Text style={styles.soapHeading}>P (Plan):</Text>
              {Array.isArray(soapNote.plan_steps) ? (
                soapNote.plan_steps.map((step, idx) => (
                  <Text key={idx} style={styles.soapBody}>• {step}</Text>
                ))
              ) : (
                <Text style={styles.soapBody}>{soapNote.plan_steps || 'Standard protocol'}</Text>
              )}
            </View>
          </View>
        )}
      </View>
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
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 10,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#e0f2fe',
    borderRadius: 8,
  },
  backBtnText: {
    color: '#0284c7',
    fontSize: 13,
    fontWeight: 'bold',
  },
  screenTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  depthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 10,
  },
  depthLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  depthValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 2,
  },
  depthBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  depthBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  metricItem: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  recsBox: {
    backgroundColor: '#fefce8',
    borderWidth: 1,
    borderColor: '#fef08a',
    borderRadius: 10,
    padding: 12,
  },
  recItem: {
    fontSize: 12,
    color: '#713f12',
    lineHeight: 18,
    marginVertical: 2,
  },
  recFootnote: {
    fontSize: 10,
    color: '#a16207',
    marginTop: 8,
    fontStyle: 'italic',
    borderTopWidth: 0.5,
    borderTopColor: '#fef08a',
    paddingTop: 4,
  },
  scribePrompt: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 6,
  },
  doctorInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    height: 70,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  scribeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#8b5cf6',
    paddingVertical: 12,
    borderRadius: 10,
  },
  scribeBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  soapResult: {
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
  },
  soapSection: {
    marginVertical: 4,
  },
  soapHeading: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6d28d9',
  },
  soapBody: {
    fontSize: 12,
    color: '#4c1d95',
    lineHeight: 17,
    marginTop: 1,
  },
});
