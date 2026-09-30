import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Server, Check, X, RefreshCw } from 'lucide-react-native';
import { getApiBaseUrl, setApiBaseUrl } from '../config/api';

export default function ServerConfigModal({ visible, onClose }) {
  const [url, setUrl] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (visible) {
      getApiBaseUrl().then(setUrl);
    }
  }, [visible]);

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      let testUrl = url.trim().replace(/\/+$/, '');
      if (!testUrl.endsWith('/api')) testUrl += '/api';
      const res = await fetch(`${testUrl}/health`, { method: 'GET' });
      if (res.ok) {
        Alert.alert('Success', 'Connected to WoundCare backend successfully!');
      } else {
        Alert.alert('Connection Warning', `Server responded with status ${res.status}`);
      }
    } catch (e) {
      Alert.alert('Connection Failed', `Could not reach server: ${e.message}`);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    await setApiBaseUrl(url);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Server size={20} color="#0284c7" />
            <Text style={styles.title}>Backend Server Settings</Text>
          </View>
          <Text style={styles.subtitle}>Enter your VPS IP address or local server URL:</Text>

          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="http://192.168.1.100:3367/api"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity style={styles.testBtn} onPress={handleTestConnection} disabled={testing}>
            <RefreshCw size={14} color="#0284c7" />
            <Text style={styles.testBtnText}>{testing ? 'Testing...' : 'Test Connection'}</Text>
          </TouchableOpacity>

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveText}>Save URL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    marginBottom: 12,
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#e0f2fe',
    marginBottom: 16,
  },
  testBtnText: {
    color: '#0284c7',
    fontWeight: '600',
    fontSize: 13,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  cancelText: {
    color: '#64748b',
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#0284c7',
  },
  saveText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
});
