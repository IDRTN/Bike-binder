import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, Alert, StyleSheet, TextInput,
} from 'react-native';
import { updateMotorcycle } from '../storage';
import {
  pickVehicleDocumentPhoto, saveVehicleDocumentPhoto, removeVehicleDocumentPhoto,
} from '../utils/vehicleDocumentStorage';
import ImageViewer from './ImageViewer';
import { COLORS } from '../theme';
import {
  INSURANCE_REMINDER_OPTIONS,
  parseInsuranceDate,
  insuranceWarningText,
  insuranceDaysRemaining,
  scheduleInsuranceReminder,
  cancelInsuranceReminder,
} from '../utils/insuranceReminders';

const TYPES = {
  insurance: { title: 'Insurance', field: 'insuranceDocuments', description: 'Store photos of your CURRENT insurer-issued proof of insurance.' },
  registration: { title: 'Registration', field: 'registrationDocuments', description: 'Store photos of your motorcycle registration for convenient reference.' },
};

export default function VehicleDocumentsSection({ motorcycle, onUpdate, type }) {
  const config = TYPES[type];
  const [side, setSide] = useState('Front');
  const [busy, setBusy] = useState(false);
  const [viewerUri, setViewerUri] = useState(null);
  const [expiryInput, setExpiryInput] = useState(motorcycle.insuranceExpiryDate || '');
  const [reminderDays, setReminderDays] = useState(motorcycle.insuranceReminderDays ?? 30);
  const [savingExpiry, setSavingExpiry] = useState(false);
  if (!config) return null;

  const documents = motorcycle[config.field] || [];

  const saveInsuranceExpiry = async () => {
    if (savingExpiry) return;
    const date = expiryInput.trim();
    if (date && !parseInsuranceDate(date)) {
      Alert.alert('Invalid Date', 'Enter a real date as YYYY-MM-DD, such as 2027-03-15.');
      return;
    }
    setSavingExpiry(true);
    let newNotificationId = null;
    try {
      const result = await scheduleInsuranceReminder(motorcycle, date, reminderDays);
      newNotificationId = result.id;
      const oldNotificationId = motorcycle.insuranceNotificationId;
      const updated = {
        ...motorcycle,
        insuranceExpiryDate: date,
        insuranceReminderDays: reminderDays,
        insuranceNotificationId: newNotificationId,
      };
      await updateMotorcycle(updated);
      onUpdate(updated);
      if (oldNotificationId && oldNotificationId !== newNotificationId) {
        try { await cancelInsuranceReminder(oldNotificationId); }
        catch (error) { console.warn('Unable to cancel old insurance notification', error); }
      }
      const days = insuranceDaysRemaining(date);
      let explanation;
      if (!date) explanation = 'Expiration date cleared. Any previous phone reminder was canceled.';
      else if (reminderDays === 0) explanation = 'Expiration date saved. Phone reminders are off; dashboard expiry warnings remain on.';
      else if (days < 0) explanation = 'Expiration date saved as already expired. Update your digital card and date.';
      else if (!result.permissionGranted) explanation = 'Date saved. Allow BikeBinder notifications in Android settings and save again to schedule a phone reminder. Dashboard alerts still work.';
      else explanation = 'Expiration date saved. A phone reminder is scheduled ' + reminderDays + ' days before expiration, or soon if that date has passed.';
      Alert.alert('Insurance Saved', explanation);
    } catch (error) {
      if (newNotificationId) {
        try { await cancelInsuranceReminder(newNotificationId); } catch {}
      }
      Alert.alert('Unable to Save Reminder', error.message || 'Please try again.');
    } finally {
      setSavingExpiry(false);
    }
  };

  const addPhoto = async (source) => {
    if (busy) return;
    setBusy(true);
    let saved = null;
    try {
      const asset = await pickVehicleDocumentPhoto(source);
      if (!asset) return;
      saved = await saveVehicleDocumentPhoto(asset, motorcycle.id, type);
      const entry = { ...saved, side };
      const updated = {
        ...motorcycle,
        [config.field]: [...documents, entry],
      };
      await updateMotorcycle(updated);
      onUpdate(updated);
    } catch (error) {
      if (saved?.uri) {
        try { await removeVehicleDocumentPhoto(saved.uri); } catch {}
      }
      Alert.alert('Could not save document', error.message || 'Please try another image.');
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = (document) => {
    Alert.alert('Remove Document Photo', 'Remove this copy from BikeBinder? The original photo in your gallery will not be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            const updated = {
              ...motorcycle,
              [config.field]: documents.filter((item) => item.id !== document.id),
            };
            await updateMotorcycle(updated);
            onUpdate(updated);
            await removeVehicleDocumentPhoto(document.uri);
          } catch (error) {
            Alert.alert('Could not remove photo', error.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{config.title}</Text>
      <Text style={styles.hint}>{config.description}</Text>
      <Text style={styles.hint}>Saved locally on this phone for offline viewing. Documents may contain private information.</Text>

      {type === 'insurance' && (
        <View style={styles.renewalCard}>
          <Text style={styles.renewalTitle}>Insurance expiration & renewal reminder</Text>
          <Text style={styles.hint}>Enter the expiration date shown on your current digital insurance card.</Text>
          <TextInput
            style={styles.expiryInput}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            value={expiryInput}
            onChangeText={setExpiryInput}
          />
          <Text style={styles.caption}>Phone notification</Text>
          <View style={styles.reminderRow}>
            {INSURANCE_REMINDER_OPTIONS.map((days) => (
              <TouchableOpacity key={days}
                style={[styles.reminderOption, reminderDays === days && styles.reminderSelected]}
                onPress={() => setReminderDays(days)} disabled={savingExpiry}>
                <Text style={[styles.reminderText, reminderDays === days && styles.reminderTextSelected]}>
                  {days === 0 ? 'Off' : days + ' days'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={[styles.saveExpiryButton, savingExpiry && styles.disabled]}
            onPress={saveInsuranceExpiry} disabled={savingExpiry}>
            <Text style={styles.saveExpiryText}>{savingExpiry ? 'Saving...' : 'Save Expiration & Reminder'}</Text>
          </TouchableOpacity>
          {insuranceWarningText(motorcycle.insuranceExpiryDate) && (
            <Text style={styles.expiryWarning}>⚠ {insuranceWarningText(motorcycle.insuranceExpiryDate)}</Text>
          )}
          <Text style={styles.hint}>Phone notifications require Android permission; timing may vary with battery settings. The Home screen also displays insurance expiry warnings.</Text>
        </View>
      )}

      <Text style={styles.caption}>Which side are you adding?</Text>
      <View style={styles.sideRow}>
        {['Front', 'Back'].map((option) => (
          <TouchableOpacity key={option}
            style={[styles.sideBtn, side === option && styles.sideBtnActive]}
            onPress={() => setSide(option)} disabled={busy}>
            <Text style={[styles.sideText, side === option && styles.sideTextActive]}>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.actionBtn, busy && styles.disabled]} onPress={() => addPhoto('gallery')} disabled={busy}>
          <Text style={styles.actionText}>🖼 Choose Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, busy && styles.disabled]} onPress={() => addPhoto('camera')} disabled={busy}>
          <Text style={styles.actionText}>📷 Take Photo</Text>
        </TouchableOpacity>
      </View>
      {busy && <Text style={styles.hint}>Saving photo to your phone...</Text>}
      {documents.length === 0 ? (
        <View style={styles.empty}><Text style={styles.emptyText}>No {config.title.toLowerCase()} photos saved</Text></View>
      ) : documents.map((document) => (
        <View key={document.id} style={styles.documentCard}>
          <TouchableOpacity onPress={() => setViewerUri(document.uri)} style={styles.previewTap}>
            <Image source={{ uri: document.uri }} resizeMode="contain" style={styles.preview} />
            <Text style={styles.photoLabel}>{config.title} — {document.side || 'Photo'}</Text>
            <Text style={styles.viewHint}>Tap to view full-screen / zoom</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.removeBtn} onPress={() => confirmRemove(document)}>
            <Text style={styles.removeText}>Remove Photo</Text>
          </TouchableOpacity>
        </View>
      ))}
      <Text style={styles.warning}>
        Keep valid original documents available. A saved photo does not by itself guarantee legal acceptance at a traffic stop.
      </Text>
      <ImageViewer visible={!!viewerUri} imageUri={viewerUri} onClose={() => setViewerUri(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 24 },
  heading: { color: COLORS.text, fontSize: 22, fontWeight: '800', marginBottom: 12 },
  renewalCard: { backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 16, marginBottom: 18 },
  renewalTitle: { color: COLORS.text, fontSize: 17, fontWeight: '700', marginBottom: 8 },
  expiryInput: { color: COLORS.text, borderWidth: 1, borderColor: COLORS.bronze, borderRadius: 10, padding: 12, fontSize: 17, marginBottom: 12 },
  reminderRow: { flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' },
  reminderOption: { paddingVertical: 10, paddingHorizontal: 11, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 8, backgroundColor: COLORS.bg },
  reminderSelected: { borderColor: COLORS.bronze },
  reminderText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  reminderTextSelected: { color: COLORS.bronzeLight },
  saveExpiryButton: { backgroundColor: COLORS.bronze, borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 12 },
  saveExpiryText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  expiryWarning: { color: COLORS.yellow, fontSize: 15, fontWeight: '700', marginBottom: 12 },
  hint: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 10 },
  caption: { color: COLORS.text, fontSize: 14, fontWeight: '600', marginTop: 6, marginBottom: 8 },
  sideRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  sideBtn: { flex: 1, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 12, borderRadius: 10, alignItems: 'center', backgroundColor: COLORS.card },
  sideBtnActive: { borderColor: COLORS.bronze, backgroundColor: '#403323' },
  sideText: { color: COLORS.textSecondary, fontWeight: '600' },
  sideTextActive: { color: COLORS.bronzeLight },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', backgroundColor: COLORS.bronze },
  actionText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  empty: { padding: 30, backgroundColor: COLORS.card, borderRadius: 12, marginBottom: 16, alignItems: 'center' },
  emptyText: { color: COLORS.textSecondary },
  documentCard: { backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 14, marginBottom: 12 },
  previewTap: { alignItems: 'center' },
  preview: { width: '100%', height: 230, backgroundColor: COLORS.headerBg, borderRadius: 8 },
  photoLabel: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginTop: 10 },
  viewHint: { color: COLORS.bronzeLight, fontSize: 12, marginTop: 4 },
  removeBtn: { alignItems: 'center', padding: 12, marginTop: 8 },
  removeText: { color: COLORS.red, fontWeight: '700' },
  warning: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 19, marginTop: 10 },
});
