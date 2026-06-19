import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Linking,
  ActivityIndicator,
  Modal,
  Pressable,
  Alert,
  ScrollView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { loadMotorcycles, updateMotorcycle } from '../storage';
import {
  startMonitoring,
  stopTracking,
  setStatusCallback,
  loadPendingRides,
} from '../utils/rideTracker';
import { COLORS } from '../theme';

const QUICK_DESTINATIONS = [
  { label: 'Gas Station', query: 'gas station near me' },
  { label: 'Motorcycle Shop', query: 'motorcycle shop near me' },
  { label: 'Repair Shop', query: 'motorcycle repair near me' },
  { label: 'Scenic Route', query: 'best motorcycle roads near me' },
];

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
  const webRef = useRef(null);
  const [destination, setDestination] = useState('');
  const [mapLoaded, setMapLoaded] = useState(false);

  // Bike selection & ride logging
  const [bikes, setBikes] = useState([]);
  const [selectedBike, setSelectedBike] = useState(null);
  const [showBikePicker, setShowBikePicker] = useState(false);
  const [showLogRide, setShowLogRide] = useState(false);
  const [rideMiles, setRideMiles] = useState('');

  // Ride tracker state
  const [trackerStatus, setTrackerStatus] = useState('idle'); // idle | monitoring | tracking
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
      // Cleanup: stop tracking when leaving screen
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

  const searchMap = (query) => {
    const q = query || destination.trim();
    if (!q) return;
    const encoded = encodeURIComponent(q);
    const url = `https://www.google.com/maps/search/${encoded}`;
    if (webRef.current) {
      webRef.current.injectJavaScript(`window.location.href = '${url}'; true;`);
    }
  };

  const getDirections = () => {
    const q = destination.trim();
    if (!q) { searchMap(''); return; }
    const encoded = encodeURIComponent(q);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`;
    if (webRef.current) {
      webRef.current.injectJavaScript(`window.location.href = '${url}'; true;`);
    }
  };

  const openInMapsApp = () => {
    const q = destination.trim() || 'motorcycle shop near me';
    const encoded = encodeURIComponent(q);
    const url = Platform.select({
      ios: `https://maps.apple.com/?q=${encoded}`,
      android: `https://maps.google.com/maps?q=${encoded}`,
    });
    Linking.canOpenURL(url).then((ok) => {
      if (ok) Linking.openURL(url);
    });
  };

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
        <Text style={styles.headerTitle}>Directions</Text>
        <Text style={styles.headerSub}>Navigate & track rides</Text>
      </View>

      {/* Bike selector + Log Ride */}
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
            <Text style={styles.logRideBtnText}>+ Log Ride</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Ride Tracker Panel */}
      <View style={[styles.trackerPanel, isTrackingActive && styles.trackerPanelActive]}>
        <View style={styles.trackerRow}>
          <View style={styles.trackerInfo}>
            <Text style={styles.trackerTitle}>
              {trackerStatus === 'tracking'
                ? '🏁 Tracking Ride'
                : trackerStatus === 'monitoring'
                ? '⏳ Monitoring...'
                : '📍 Ride Tracker'}
            </Text>
            {trackerEvent ? (
              <Text style={styles.trackerEvent}>{trackerEvent}</Text>
            ) : (
              !isTrackingActive && (
                <Text style={styles.trackerHint}>
                  Auto-detects when you ride above 10 mph
                </Text>
              )
            )}
          </View>
          {!isTrackingActive ? (
            <TouchableOpacity style={styles.startTrackBtn} onPress={handleStartTracker}>
              <Text style={styles.startTrackBtnText}>Start</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.stopTrackBtn} onPress={handleStopTracker}>
              <Text style={styles.stopTrackBtnText}>Stop</Text>
            </TouchableOpacity>
          )}
        </View>

        {isTrackingActive && (
          <View style={styles.trackerStats}>
            <View style={styles.trackerStat}>
              <Text style={styles.trackerStatValue}>{trackerMiles}</Text>
              <Text style={styles.trackerStatLabel}>miles</Text>
            </View>
            <View style={styles.trackerStat}>
              <Text style={styles.trackerStatValue}>{formatDuration(trackerDuration)}</Text>
              <Text style={styles.trackerStatLabel}>duration</Text>
            </View>
            <View style={styles.trackerStat}>
              <Text style={[styles.trackerStatStatus, {
                color: trackerStatus === 'tracking' ? COLORS.green : COLORS.yellow,
              }]}>
                {trackerStatus === 'tracking' ? 'Riding' : 'Waiting'}
              </Text>
              <Text style={styles.trackerStatLabel}>status</Text>
            </View>
          </View>
        )}
      </View>

      {/* Search controls */}
      <View style={styles.controls}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Search places..."
            placeholderTextColor={COLORS.textSecondary}
            value={destination}
            onChangeText={setDestination}
            onSubmitEditing={() => searchMap(null)}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.goBtn} onPress={() => searchMap(null)}>
            <Text style={styles.goBtnText}>Search</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dirBtn} onPress={getDirections}>
            <Text style={styles.dirBtnText}>Route</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickScroll}>
          {QUICK_DESTINATIONS.map((item) => (
            <TouchableOpacity
              key={item.query}
              style={styles.quickBtn}
              onPress={() => {
                setDestination(item.query);
                searchMap(item.query);
              }}
            >
              <Text style={styles.quickBtnText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity style={styles.openAppBtn} onPress={openInMapsApp}>
          <Text style={styles.openAppBtnText}>Open in Google Maps App</Text>
        </TouchableOpacity>
      </View>

      {/* Map WebView */}
      <View style={styles.mapContainer}>
        {!mapLoaded && (
          <View style={styles.mapLoading}>
            <ActivityIndicator size="large" color={COLORS.bronze} />
            <Text style={styles.loadingText}>Loading map...</Text>
          </View>
        )}
        <WebView
          ref={webRef}
          style={styles.map}
          source={{ uri: 'https://www.google.com/maps' }}
          onLoad={() => setMapLoaded(true)}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          geolocationEnabled
        />
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

      {/* Manual Log Ride Modal */}
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

  // Tracker panel
  trackerPanel: {
    backgroundColor: COLORS.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  trackerPanelActive: {
    backgroundColor: COLORS.headerBg,
  },
  trackerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trackerInfo: { flex: 1, marginRight: 12 },
  trackerTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  trackerEvent: { fontSize: 12, color: COLORS.bronze, marginTop: 2 },
  trackerHint: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  startTrackBtn: {
    backgroundColor: COLORS.green,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  startTrackBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  stopTrackBtn: {
    backgroundColor: COLORS.red,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  stopTrackBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  trackerStats: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12,
  },
  trackerStat: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  trackerStatValue: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  trackerStatLabel: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2, textTransform: 'uppercase' },
  trackerStatStatus: { fontSize: 16, fontWeight: '700' },

  // Controls
  controls: {
    backgroundColor: COLORS.card,
    padding: 12,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  input: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: COLORS.text,
  },
  goBtn: {
    backgroundColor: COLORS.bronze,
    paddingHorizontal: 18,
    borderRadius: 10,
    justifyContent: 'center',
  },
  goBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  dirBtn: {
    backgroundColor: '#aeaeb2',
    paddingHorizontal: 14,
    borderRadius: 10,
    justifyContent: 'center',
  },
  dirBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  quickScroll: { marginBottom: 8 },
  quickBtn: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginRight: 8,
  },
  quickBtnText: { color: COLORS.text, fontSize: 12, fontWeight: '500' },
  openAppBtn: { alignItems: 'center', paddingVertical: 4 },
  openAppBtnText: { color: COLORS.bronze, fontSize: 13, fontWeight: '600' },

  // Map
  mapContainer: { flex: 1 },
  map: { flex: 1 },
  mapLoading: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.bg, zIndex: 10,
  },
  loadingText: { color: COLORS.textSecondary, marginTop: 12, fontSize: 14 },

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
