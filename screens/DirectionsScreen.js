import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Alert,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { loadMotorcycles, updateMotorcycle } from '../storage';
import {
  startMonitoring,
  stopTracking,
  setStatusCallback,
} from '../utils/rideTracker';
import { COLORS } from '../theme';

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function DirectionsScreen() {
  const insets = useSafeAreaInsets();

  // Bike selection
  const [bikes, setBikes] = useState([]);
  const [selectedBike, setSelectedBike] = useState(null);
  const [showBikePicker, setShowBikePicker] = useState(false);
  const [showLogRide, setShowLogRide] = useState(false);
  const [rideMiles, setRideMiles] = useState('');

  // Ride tracker state
  const [trackerStatus, setTrackerStatus] = useState('idle');
  const [trackerMiles, setTrackerMiles] = useState('0.0');
  const [trackerDuration, setTrackerDuration] = useState(0);
  const [trackerEvent, setTrackerEvent] = useState('');

  useEffect(() => {
    setStatusCallback((status) => {
      setTrackerStatus(status.status);
      setTrackerMiles(status.miles || '0.0');
      setTrackerDuration(status.duration || 0);

      if (status.event === 'ride_started') {
        setTrackerEvent('Ride detected! Tracking...');
      } else if (status.event === 'ride_ended') {
        setTrackerEvent('Ride ended!');
        Alert.alert('Ride Complete', `You rode ${status.miles} miles! Log it from the Home screen.`);
      } else if (status.event === 'monitoring') {
        setTrackerEvent('Waiting for speed > 10 mph...');
      } else if (status.event === 'stopped') {
        setTrackerEvent('');
      }
    });

    return () => {
      stopTracking();
      setStatusCallback(null);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const all = await loadMotorcycles();
        setBikes(all);
        if (selectedBike) {
          const stillThere = all.find((b) => b.id === selectedBike.id);
          if (!stillThere) setSelectedBike(null);
        }
      })();
    }, [])
  );

  const handleStartTracker = async () => {
    try {
      await startMonitoring();
    } catch (e) {
      Alert.alert('Permission Needed', e.message || 'Location access is required for ride tracking.');
    }
  };

  const handleStopTracker = () => {
    stopTracking();
  };

  const handleLogRide = async () => {
    const miles = parseInt(rideMiles, 10);
    if (!miles || miles <= 0) {
      Alert.alert('Invalid', 'Please enter a valid number of miles.');
      return;
    }
    if (!selectedBike) {
      Alert.alert('No Bike Selected', 'Select a bike first.');
      return;
    }
    const currentMileage = parseInt(selectedBike.mileageCurrent || selectedBike.mileageBought || '0', 10);
    const updatedBike = { ...selectedBike, mileageCurrent: (currentMileage + miles).toString() };
    await updateMotorcycle(updatedBike);
    setSelectedBike(updatedBike);
    setBikes((prev) => prev.map((b) => (b.id === updatedBike.id ? updatedBike : b)));
    setRideMiles('');
    setShowLogRide(false);
    Alert.alert('Miles Logged', `Added ${miles} mi to ${updatedBike.make} ${updatedBike.model}.`);
  };

  const isTrackingActive = trackerStatus === 'monitoring' || trackerStatus === 'tracking';
  const selectedBikeLabel = selectedBike
    ? `${selectedBike.make} ${selectedBike.model}`
    : 'Select a bike';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ride Tracker</Text>
        <Text style={styles.headerSub}>GPS mileage tracking</Text>
      </View>

      {/* Bike selector */}
      <View style={styles.bikeBar}>
        <TouchableOpacity
          style={styles.bikeSelector}
          onPress={() => setShowBikePicker(true)}
        >
          <Text style={styles.bikeIcon}>🏍</Text>
          <View style={styles.bikeInfo}>
            <Text style={styles.bikeLabel}>{selectedBikeLabel}</Text>
            {selectedBike && (
              <Text style={styles.bikeMileage}>
                {parseInt(selectedBike.mileageCurrent || selectedBike.mileageBought || '0').toLocaleString()} mi
              </Text>
            )}
          </View>
          <Text style={styles.dropdownArrow}>▼</Text>
        </TouchableOpacity>

        {selectedBike && !isTrackingActive && (
          <TouchableOpacity style={styles.logRideBtn} onPress={() => setShowLogRide(true)}>
            <Text style={styles.logRideBtnText}>+ Log</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Main content area */}
      <View style={styles.mainContent}>
        {/* Tracker Panel */}
        <View style={[styles.trackerPanel, isTrackingActive && styles.trackerPanelActive]}>
          <View style={styles.trackerIcon}>
            <Text style={styles.trackerIconText}>
              {trackerStatus === 'tracking' ? '🏁' : trackerStatus === 'monitoring' ? '⏳' : '📍'}
            </Text>
          </View>

          <Text style={styles.trackerTitle}>
            {trackerStatus === 'tracking'
              ? 'Tracking Ride'
              : trackerStatus === 'monitoring'
              ? 'Monitoring...'
              : 'Ready'}
          </Text>

          {trackerEvent ? (
            <Text style={styles.trackerEvent}>{trackerEvent}</Text>
          ) : (
            !isTrackingActive && (
              <Text style={styles.trackerHint}>
                Auto-detects riding above 10 mph
              </Text>
            )
          )}

          {/* Stats */}
          {(isTrackingActive || trackerMiles !== '0.0') && (
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{trackerMiles}</Text>
                <Text style={styles.statLabel}>miles</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{formatDuration(trackerDuration)}</Text>
                <Text style={styles.statLabel}>duration</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statStatus, {
                  color: trackerStatus === 'tracking' ? COLORS.green : COLORS.yellow,
                }]}>
                  {trackerStatus === 'tracking' ? 'Riding' : 'Waiting'}
                </Text>
                <Text style={styles.statLabel}>status</Text>
              </View>
            </View>
          )}

          {/* Start/Stop button */}
          <TouchableOpacity
            style={[styles.actionBtn, isTrackingActive ? styles.stopBtn : styles.startBtn]}
            onPress={isTrackingActive ? handleStopTracker : handleStartTracker}
          >
            <Text style={styles.actionBtnText}>
              {isTrackingActive ? '■ Stop Tracking' : '▶ Start Tracking'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Instructions */}
        {!isTrackingActive && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>How it works</Text>
            <Text style={styles.infoText}>
              1. Select your bike above{'\n'}
              2. Tap "Start Tracking"{'\n'}
              3. Ride! GPS detects speed > 10 mph{'\n'}
              4. Tracking starts after 15 seconds{'\n'}
              5. Stops automatically after 5 min idle{'\n'}
              6. Log miles from the Home screen
            </Text>
          </View>
        )}
      </View>

      {/* Bike Picker Modal */}
      <Modal visible={showBikePicker} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowBikePicker(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Your Bike</Text>
            {bikes.length === 0 ? (
              <Text style={styles.noBikesText}>No bikes in garage.</Text>
            ) : (
              <ScrollView style={styles.bikeList}>
                {bikes.map((bike) => {
                  const isActive = selectedBike?.id === bike.id;
                  return (
                    <TouchableOpacity
                      key={bike.id}
                      style={[styles.bikeOption, isActive && styles.bikeOptionActive]}
                      onPress={() => { setSelectedBike(bike); setShowBikePicker(false); }}
                    >
                      <View>
                        <Text style={[styles.bikeOptionName, isActive && styles.bikeOptionNameActive]}>
                          {bike.make} {bike.model}
                        </Text>
                        <Text style={styles.bikeOptionSub}>
                          {bike.year} · {parseInt(bike.mileageCurrent || bike.mileageBought || '0').toLocaleString()} mi
                        </Text>
                      </View>
                      {isActive && <Text style={styles.selectedCheck}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowBikePicker(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Log Ride Modal */}
      <Modal visible={showLogRide} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowLogRide(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Log Ride</Text>
            {selectedBike && (
              <Text style={styles.logRideBike}>{selectedBike.make} {selectedBike.model}</Text>
            )}
            <Text style={styles.logRideCurrent}>
              Current: {parseInt(selectedBike?.mileageCurrent || selectedBike?.mileageBought || '0').toLocaleString()} mi
            </Text>
            <TextInput
              style={styles.rideInput}
              placeholder="Miles ridden"
              placeholderTextColor={COLORS.textSecondary}
              value={rideMiles}
              onChangeText={setRideMiles}
              keyboardType="number-pad"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowLogRide(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleLogRide}>
                <Text style={styles.saveBtnText}>Log Miles</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: COLORS.white },
  headerSub: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2 },

  // Bike bar
  bikeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    gap: 10,
  },
  bikeSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  bikeIcon: { fontSize: 20, marginRight: 10 },
  bikeInfo: { flex: 1 },
  bikeLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  bikeMileage: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  dropdownArrow: { fontSize: 10, color: COLORS.textSecondary, marginLeft: 4 },
  logRideBtn: {
    backgroundColor: COLORS.bronze,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  logRideBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },

  // Main content
  mainContent: {
    flex: 1,
    padding: 20,
  },

  // Tracker panel
  trackerPanel: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  trackerPanelActive: {
    borderColor: COLORS.bronze,
    borderWidth: 2,
  },
  trackerIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
  },
  trackerIconText: { fontSize: 36 },
  trackerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 8,
  },
  trackerEvent: {
    fontSize: 14,
    color: COLORS.bronze,
    fontWeight: '600',
    marginBottom: 16,
  },
  trackerHint: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    width: '100%',
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  statLabel: { fontSize: 10, color: COLORS.textSecondary, marginTop: 4, textTransform: 'uppercase' },
  statStatus: { fontSize: 16, fontWeight: '700' },
  actionBtn: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  startBtn: { backgroundColor: COLORS.green },
  stopBtn: { backgroundColor: COLORS.red },
  actionBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },

  // Info card
  infoCard: {
    marginTop: 24,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },

  // Modals
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.card, borderRadius: 16, padding: 24,
    width: '85%', maxWidth: 360,
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 16, textAlign: 'center' },
  noBikesText: { color: COLORS.textSecondary, textAlign: 'center', paddingVertical: 20 },
  bikeList: { maxHeight: 250 },
  bikeOption: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10, marginBottom: 4,
  },
  bikeOptionActive: { backgroundColor: COLORS.bronze + '20' },
  bikeOptionName: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  bikeOptionNameActive: { color: COLORS.bronze },
  bikeOptionSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  selectedCheck: { fontSize: 20, color: COLORS.bronze, fontWeight: '700' },
  modalCloseBtn: {
    marginTop: 12, paddingVertical: 12, alignItems: 'center',
    borderTopWidth: 1, borderTopColor: COLORS.cardBorder,
  },
  modalCloseText: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '500' },

  // Log ride modal
  logRideBike: { fontSize: 16, color: COLORS.bronze, fontWeight: '600', textAlign: 'center', marginBottom: 4 },
  logRideCurrent: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 16 },
  rideInput: {
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.cardBorder,
    borderRadius: 10, padding: 14, fontSize: 24, fontWeight: '700',
    color: COLORS.text, textAlign: 'center', marginBottom: 16,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 10, padding: 14, alignItems: 'center' },
  cancelBtnText: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '600' },
  saveBtn: { flex: 1, backgroundColor: COLORS.bronze, borderRadius: 10, padding: 14, alignItems: 'center' },
  saveBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
});
