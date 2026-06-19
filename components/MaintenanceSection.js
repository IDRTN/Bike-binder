import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ScrollView,
} from 'react-native';
import { updateMotorcycle } from '../storage';
import { COLORS } from '../theme';

const PRESETS = [
  { name: 'Oil Change', intervalMiles: 5000, intervalMonths: 6 },
  { name: 'Chain Adjustment', intervalMiles: 500, intervalMonths: '' },
  { name: 'Chain Replacement', intervalMiles: 20000, intervalMonths: '' },
  { name: 'Tire Check', intervalMiles: 5000, intervalMonths: '' },
  { name: 'Brake Pad Inspection', intervalMiles: 10000, intervalMonths: 12 },
  { name: 'Brake Fluid Flush', intervalMiles: 20000, intervalMonths: 24 },
  { name: 'Valve Clearance Check', intervalMiles: 24000, intervalMonths: 24 },
  { name: 'Air Filter Replacement', intervalMiles: 12000, intervalMonths: 12 },
  { name: 'Spark Plugs', intervalMiles: 16000, intervalMonths: 24 },
  { name: 'Coolant Flush', intervalMiles: 24000, intervalMonths: 24 },
  { name: 'Cable Lubrication', intervalMiles: 6000, intervalMonths: 6 },
  { name: 'Battery Check', intervalMiles: 12000, intervalMonths: 12 },
];

export default function MaintenanceSection({ motorcycle, onUpdate }) {
  const [showForm, setShowForm] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [name, setName] = useState('');
  const [intervalMiles, setIntervalMiles] = useState('');
  const [intervalMonths, setIntervalMonths] = useState('');
  const [notes, setNotes] = useState('');

  const items = motorcycle.maintenanceItems || [];
  const currentMileage = parseInt(motorcycle.mileageCurrent || motorcycle.mileageBought || '0', 10);
  const mileageBought = parseInt(motorcycle.mileageBought || '0', 10);

  const resetForm = () => {
    setName('');
    setIntervalMiles('');
    setIntervalMonths('');
    setNotes('');
  };

  const openFormWithPreset = (preset) => {
    const exists = items.find(
      (i) => i.name.toLowerCase() === preset.name.toLowerCase()
    );
    if (exists) {
      Alert.alert('Already Added', `${preset.name} is already in your schedule.`);
      return;
    }
    setName(preset.name);
    setIntervalMiles(preset.intervalMiles.toString());
    setIntervalMonths(preset.intervalMonths ? preset.intervalMonths.toString() : '');
    setNotes('');
    setShowPresets(false);
    setShowForm(true);
  };

  const getNextDueMileage = (item) => {
    const interval = parseInt(item.intervalMiles, 10);
    if (!interval) return null;
    if (item.lastDoneMileage) {
      return parseInt(item.lastDoneMileage, 10) + interval;
    }
    return mileageBought ? mileageBought + interval : interval;
  };

  const getNextDueDate = (item) => {
    const months = parseInt(item.intervalMonths, 10);
    if (!months || !item.lastDoneDate) return null;
    const last = new Date(item.lastDoneDate);
    if (isNaN(last.getTime())) return null;
    last.setMonth(last.getMonth() + months);
    return last;
  };

  const getStatus = (item) => {
    const nextMiles = getNextDueMileage(item);
    const nextDate = getNextDueDate(item);

    let mileStatus = 'ok';
    let dateStatus = 'ok';

    if (nextMiles !== null && currentMileage >= nextMiles) mileStatus = 'overdue';
    else if (nextMiles !== null && nextMiles - currentMileage <= 500) mileStatus = 'soon';

    if (nextDate !== null && nextDate <= new Date()) dateStatus = 'overdue';
    else if (nextDate !== null) {
      const daysUntil = Math.ceil((nextDate - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 14) dateStatus = 'soon';
    }

    if (mileStatus === 'overdue' || dateStatus === 'overdue') return 'overdue';
    if (mileStatus === 'soon' || dateStatus === 'soon') return 'soon';
    return 'ok';
  };

  const handleAddCustom = async () => {
    if (!name.trim()) {
      Alert.alert('Missing Info', 'Maintenance name is required.');
      return;
    }
    if (!intervalMiles.trim() && !intervalMonths.trim()) {
      Alert.alert('Missing Info', 'At least a mile or month interval is required.');
      return;
    }
    const newItem = {
      id: Date.now().toString(),
      name: name.trim(),
      intervalMiles: intervalMiles.trim() || '',
      intervalMonths: intervalMonths.trim() || '',
      lastDoneMileage: null,
      lastDoneDate: null,
      notes: notes.trim(),
    };
    const updated = { ...motorcycle };
    updated.maintenanceItems = [...items, newItem];
    await saveAndRefresh(updated);
    resetForm();
    setShowForm(false);
  };

  const handleMarkDone = (item) => {
    const msg = intervalMonths
      ? `Record "${item.name}" as completed at ${currentMileage.toLocaleString()} miles (today's date)?`
      : `Record "${item.name}" as completed at ${currentMileage.toLocaleString()} miles?`;
    Alert.alert('Log Service', msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes, Log It',
        onPress: async () => {
          const updated = { ...motorcycle };
          updated.maintenanceItems = items.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  lastDoneMileage: currentMileage.toString(),
                  lastDoneDate: new Date().toLocaleDateString(),
                }
              : i
          );
          await saveAndRefresh(updated);
        },
      },
    ]);
  };

  const handleReset = (item) => {
    Alert.alert('Reset', `Reset "${item.name}" last-done record?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        onPress: async () => {
          const updated = { ...motorcycle };
          updated.maintenanceItems = items.map((i) =>
            i.id === item.id ? { ...i, lastDoneMileage: null, lastDoneDate: null } : i
          );
          await saveAndRefresh(updated);
        },
      },
    ]);
  };

  const handleDelete = (id) => {
    Alert.alert('Remove', 'Remove this maintenance item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const updated = { ...motorcycle };
          updated.maintenanceItems = items.filter((i) => i.id !== id);
          await saveAndRefresh(updated);
        },
      },
    ]);
  };

  const saveAndRefresh = async (updated) => {
    await updateMotorcycle(updated);
    onUpdate(updated);
  };

  const statusColor = (status) => {
    switch (status) {
      case 'overdue': return COLORS.red;
      case 'soon': return COLORS.yellow;
      default: return COLORS.green;
    }
  };

  const statusLabel = (status) => {
    switch (status) {
      case 'overdue': return 'Overdue';
      case 'soon': return 'Due Soon';
      default: return 'OK';
    }
  };

  const countOverdue = items.filter((i) => getStatus(i) === 'overdue').length;
  const countSoon = items.filter((i) => getStatus(i) === 'soon').length;

  const renderItem = ({ item }) => {
    const status = getStatus(item);
    const nextMiles = getNextDueMileage(item);
    const nextDate = getNextDueDate(item);

    const intervalParts = [];
    if (item.intervalMiles) intervalParts.push(`${parseInt(item.intervalMiles).toLocaleString()} mi`);
    if (item.intervalMonths) intervalParts.push(`${item.intervalMonths} mo`);

    return (
      <View style={styles.item}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemName}>{item.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor(status) + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor(status) }]}>
              {statusLabel(status)}
            </Text>
          </View>
        </View>
        <View style={styles.itemDetails}>
          <Text style={styles.detailText}>
            Interval: <Text style={styles.detailBold}>{intervalParts.join(' / ') || 'Not set'}</Text>
          </Text>
          {item.lastDoneMileage ? (
            <Text style={styles.detailText}>
              Last done: <Text style={styles.detailBold}>{parseInt(item.lastDoneMileage).toLocaleString()} mi</Text>
              {item.lastDoneDate ? ` on ${item.lastDoneDate}` : ''}
            </Text>
          ) : (
            <Text style={[styles.detailText, { color: COLORS.textSecondary, fontStyle: 'italic' }]}>Never done</Text>
          )}
          {nextMiles !== null && (
            <Text style={styles.detailText}>
              Next due (mi): <Text style={[styles.detailBold, { color: statusColor(status) }]}>{nextMiles.toLocaleString()} mi</Text>
              {nextMiles - currentMileage > 0
                ? ` (${(nextMiles - currentMileage).toLocaleString()} mi left)`
                : ` (${(currentMileage - nextMiles).toLocaleString()} mi past)`}
            </Text>
          )}
          {nextDate !== null && (
            <Text style={styles.detailText}>
              Next due (date): <Text style={[styles.detailBold, { color: statusColor(status) }]}>{nextDate.toLocaleDateString()}</Text>
            </Text>
          )}
          {item.notes ? <Text style={styles.notesText}>{item.notes}</Text> : null}
        </View>
        <View style={styles.itemActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleMarkDone(item)}>
            <Text style={styles.actionBtnText}>✓ Log Done</Text>
          </TouchableOpacity>
          {item.lastDoneMileage && (
            <TouchableOpacity style={styles.actionBtnSecondary} onPress={() => handleReset(item)}>
              <Text style={styles.actionBtnSecondaryText}>↺ Reset</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.actionBtnSecondary} onPress={() => handleDelete(item.id)}>
            <Text style={[styles.actionBtnSecondaryText, { color: COLORS.bronze }]}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Maintenance Schedule</Text>
        <TouchableOpacity onPress={() => { resetForm(); setShowForm(!showForm); setShowPresets(false); }}>
          <Text style={styles.addBtn}>{showForm ? 'Cancel' : '+ Add'}</Text>
        </TouchableOpacity>
      </View>

      {/* Summary bar */}
      {items.length > 0 && (
        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>
            {countOverdue > 0
              ? `⚠ ${countOverdue} overdue`
              : countSoon > 0
              ? `⏳ ${countSoon} due soon`
              : '✓ All maintenance up to date'}
          </Text>
        </View>
      )}

      {/* Add form */}
      {showForm && (
        <View style={styles.form}>
          {/* Show preset picker above the form */}
          <TouchableOpacity
            style={styles.presetsToggle}
            onPress={() => setShowPresets(!showPresets)}
          >
            <Text style={styles.presetsToggleText}>
              {showPresets ? 'Hide Presets' : 'Browse Common Maintenance'}
            </Text>
          </TouchableOpacity>

          {showPresets && (
            <View style={styles.presetsContainer}>
              <Text style={styles.presetsTitle}>Tap a preset to customize it</Text>
              <ScrollView style={styles.presetsList} nestedScrollEnabled>
                {PRESETS.map((preset, i) => {
                  const alreadyAdded = items.find(
                    (p) => p.name.toLowerCase() === preset.name.toLowerCase()
                  );
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[styles.presetItem, alreadyAdded && styles.presetItemDisabled]}
                      onPress={() => { if (!alreadyAdded) openFormWithPreset(preset); }}
                      disabled={!!alreadyAdded}
                    >
                      <View>
                        <Text style={[styles.presetName, alreadyAdded && { color: COLORS.textSecondary }]}>
                          {preset.name}
                        </Text>
                        <Text style={styles.presetInterval}>
                          {preset.intervalMiles.toLocaleString()} mi
                          {preset.intervalMonths ? ` / ${preset.intervalMonths} mo` : ''}
                        </Text>
                      </View>
                      <Text style={[styles.presetAdd, alreadyAdded && { color: COLORS.textSecondary }]}>
                        {alreadyAdded ? '✓' : '+'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <Text style={styles.formLabel}>Maintenance Item Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Oil Change"
            value={name}
            onChangeText={setName}
          />
          <View style={styles.intervalRow}>
            <View style={styles.intervalField}>
              <Text style={styles.formLabel}>Interval (miles)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 5000"
                value={intervalMiles}
                onChangeText={setIntervalMiles}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.intervalField}>
              <Text style={styles.formLabel}>Interval (months)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 6"
                value={intervalMonths}
                onChangeText={setIntervalMonths}
                keyboardType="number-pad"
              />
            </View>
          </View>
          <Text style={styles.formLabel}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="e.g. Use 10W-40"
            value={notes}
            onChangeText={setNotes}
            multiline
          />
          <TouchableOpacity style={styles.submitBtn} onPress={handleAddCustom}>
            <Text style={styles.submitText}>Add to Schedule</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Items list */}
      {items.length > 0 && (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          scrollEnabled={false}
        />
      )}
      {items.length === 0 && !showForm && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No maintenance schedule yet.</Text>
          <Text style={styles.emptySub}>Tap "+ Add" to set up reminders by miles, months, or both.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  addBtn: { fontSize: 15, fontWeight: '600', color: COLORS.bronze },
  summaryBar: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  summaryText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, textAlign: 'center' },
  presetsContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    maxHeight: 220,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  presetsTitle: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8, textAlign: 'center' },
  presetsList: { maxHeight: 180 },
  presetItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  presetItemDisabled: { opacity: 0.5 },
  presetName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  presetInterval: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  presetAdd: { fontSize: 22, fontWeight: '600', color: COLORS.bronze },
  form: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  presetsToggle: { marginBottom: 12 },
  presetsToggleText: { fontSize: 14, fontWeight: '600', color: COLORS.bronze, textAlign: 'center' },
  formLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  multiline: { minHeight: 60 },
  intervalRow: { flexDirection: 'row', gap: 12 },
  intervalField: { flex: 1 },
  submitBtn: { backgroundColor: COLORS.bronze, padding: 14, borderRadius: 8, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  item: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: { fontSize: 16, fontWeight: '700', color: COLORS.text, flex: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '700' },
  itemDetails: { marginBottom: 10 },
  detailText: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 2 },
  detailBold: { fontWeight: '600', color: COLORS.text },
  notesText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
    backgroundColor: COLORS.bg,
    padding: 6,
    borderRadius: 6,
  },
  itemActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: {
    backgroundColor: COLORS.green,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  actionBtnSecondary: {
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  actionBtnSecondaryText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  empty: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  emptySub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, textAlign: 'center' },
});
