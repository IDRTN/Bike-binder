import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  Alert,
  AppState,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadMotorcycles, loadRideBikePreference, applyRideMilesToBike } from '../storage';
import { COLORS } from '../theme';
import { loadPendingRides, clearPendingRide } from '../utils/rideTracker';
import { checkForUpdate, promptUpdate } from '../utils/updateChecker';

const STATIC_MILEAGE = 50000; // fallback if no mileage data

function getMaintStatus(item, currentMileage) {
  const interval = parseInt(item.intervalMiles, 10);
  if (!interval) return 'ok';
  const lastDone = parseInt(item.lastDoneMileage, 10);
  const nextDue = lastDone ? lastDone + interval : interval;
  if (currentMileage >= nextDue) return 'overdue';
  if (nextDue - currentMileage <= 500) return 'soon';
  return 'ok';
}

function isRecentService(service) {
  if (!service.date) return false;
  const d = new Date(service.date);
  if (isNaN(d.getTime())) return false;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return d >= thirtyDaysAgo;
}

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [bikes, setBikes] = useState([]);
  const [pendingRides, setPendingRides] = useState([]);
  const [showRidePrompt, setShowRidePrompt] = useState(false);
  const [applyingRide, setApplyingRide] = useState(false);
  const [autoRideNotice, setAutoRideNotice] = useState('');
  const [lockedDocumentBike, setLockedDocumentBike] = useState(null);

  const applyPendingRide = async (ride, selectedBike) => {
    if (applyingRide) return;
    const miles = Math.round(Number(ride.miles));
    if (!Number.isFinite(miles) || miles <= 0) {
      Alert.alert('Ride Too Short', 'This ride rounds to zero whole miles. It will remain pending.');
      return;
    }

    setApplyingRide(true);
    try {
      const updated = await applyRideMilesToBike(ride, selectedBike.id);
      await clearPendingRide(ride.id);
      setBikes(await loadMotorcycles());
      const remaining = (await loadPendingRides()).filter((r) => !r.logged);
      setPendingRides(remaining);
      setShowRidePrompt(remaining.length > 0);
      Alert.alert('Ride Logged', `Added ${miles} miles to ${bike.make} ${bike.model}.`);
    } catch (error) {
      Alert.alert('Unable to Log Ride', error.message || 'The ride was kept pending.');
    } finally {
      setApplyingRide(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let refreshing = false;
      const refresh = async () => {
        if (refreshing) return;
        refreshing = true;
        try {
          let currentBikes = await loadMotorcycles();
          const pref = await loadRideBikePreference();
          const locked = currentBikes.find((bike) => bike.id === pref.lockedBikeId);
          const rides = (await loadPendingRides()).filter((ride) => !ride.logged);
          let loggedCount = 0;
          let loggedMiles = 0;
          if (locked) {
            // Only rides completed with this exact bike locked are auto-assigned.
            for (const ride of rides) {
              if (ride.lockedBikeId !== locked.id) continue;
              try {
                await applyRideMilesToBike(ride, locked.id);
                await clearPendingRide(ride.id);
                loggedCount += 1;
                loggedMiles += Math.round(Number(ride.miles));
              } catch (error) {
                console.error('Could not auto-log locked motorcycle ride:', error);
                // Keep the ride pending so it can be recovered manually.
              }
            }
            currentBikes = await loadMotorcycles();
          }
          const remaining = (await loadPendingRides()).filter((ride) => !ride.logged);
          if (!active) return;
          setBikes(currentBikes);
          setLockedDocumentBike(locked || null);
          setPendingRides(remaining);
          setShowRidePrompt(remaining.length > 0);
          setAutoRideNotice(loggedCount
            ? '✓ Auto-logged ' + loggedMiles + ' mi to ' + locked.make + ' ' + locked.model
            : '');
          try {
            const update = await checkForUpdate();
            if (active && update) promptUpdate(update);
          } catch (error) {
            console.warn('Update check failed:', error);
          }
        } catch (error) {
          console.error('Failed to load BikeBinder dashboard:', error);
          if (active) {
            setBikes(await loadMotorcycles());
            const remaining = (await loadPendingRides()).filter((ride) => !ride.logged);
            setPendingRides(remaining);
            setShowRidePrompt(remaining.length > 0);
          }
        } finally {
          refreshing = false;
        }
      };
      refresh();
      // On Android, returning to an already-focused Home screen does not
      // necessarily fire a navigation focus event. Check saved rides on resume.
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active' && active) refresh();
      });
      return () => { active = false; subscription.remove(); };
    }, [])
  );

  // Compute stats
  const totalBikes = bikes.length;

  let servicesDue = 0;
  let totalParts = 0;
  let recentRepairs = 0;
  let dueBikes = [];

  bikes.forEach((bike) => {
    const mileage = parseInt(bike.mileageCurrent || bike.mileageBought || '0', 10);

    // Maintenance items due/overdue
    const maintItems = bike.maintenanceItems || [];
    const dueCount = maintItems.filter((item) => {
      const status = getMaintStatus(item, mileage);
      return status === 'overdue' || status === 'soon';
    }).length;
    servicesDue += dueCount;
    if (dueCount > 0) dueBikes.push({ id: bike.id, name: `${bike.make} ${bike.model}`, count: dueCount });

    // Parts
    totalParts += (bike.parts || []).length;

    // Recent services
    const services = bike.services || [];
    recentRepairs += services.filter(isRecentService).length;
  });

  const cards = [
    {
      id: 'due',
      label: 'Services Due',
      value: servicesDue,
      icon: '⚠',
      color: servicesDue > 0 ? COLORS.red : COLORS.green,
      onPress: () => navigation.navigate('MotorcyclesTab'),
    },
    {
      id: 'parts',
      label: 'Parts Tracked',
      value: totalParts,
      icon: '🔧',
      color: COLORS.steelLight,
      onPress: () => navigation.navigate('MotorcyclesTab'),
    },
    {
      id: 'repairs',
      label: 'Recent Repairs',
      value: recentRepairs,
      icon: '🛠',
      color: recentRepairs > 0 ? COLORS.bronze : COLORS.textSecondary,
      onPress: () => navigation.navigate('MotorcyclesTab', { screen: 'MotorcyclesList' }),
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appTitle}>Bike Binder</Text>
        <Text style={styles.appSubtitle}>Garage Dashboard</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {autoRideNotice ? (
          <View style={{ backgroundColor: COLORS.card, borderColor: COLORS.green, borderWidth: 1, borderRadius: 10, marginBottom: 14, padding: 12 }}>
            <Text style={{ color: COLORS.green, fontWeight: '700' }}>{autoRideNotice}</Text>
          </View>
        ) : null}
        {lockedDocumentBike && (
          <View style={{ backgroundColor: COLORS.card, borderColor: COLORS.cardBorder, borderWidth: 1, padding: 14, borderRadius: 12, marginBottom: 16 }}>
            <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: 16 }}>Roadside Documents</Text>
            <Text style={{ color: COLORS.textSecondary, marginTop: 4, marginBottom: 10 }}>
              🔒 {lockedDocumentBike.make} {lockedDocumentBike.model}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {['Insurance', 'Registration'].map((section) => (
                <TouchableOpacity key={section} style={{ flex: 1, backgroundColor: COLORS.bronze, padding: 12, borderRadius: 10, alignItems: 'center' }}
                  onPress={() => navigation.navigate('MotorcyclesTab', {
                    screen: 'MotorcycleDetail',
                    params: { motorcycleId: lockedDocumentBike.id, initialTab: section },
                  })}>
                  <Text style={{ color: COLORS.white, fontSize: 14, fontWeight: '700' }}>{section}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Summary Cards */}
        <View style={styles.cardsGrid}>
          {cards.map((card) => (
            <TouchableOpacity key={card.id} style={styles.card} onPress={card.onPress} activeOpacity={0.7}>
              <Text style={styles.cardIcon}>{card.icon}</Text>
              <Text style={[styles.cardValue, { color: card.color }]}>{card.value}</Text>
              <Text style={styles.cardLabel}>{card.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick status bar */}
        {bikes.length > 0 && (
          <View style={styles.statusSection}>
            <Text style={styles.sectionTitle}>Maintenance Overview</Text>
            {dueBikes.length > 0 ? (
              dueBikes.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  style={styles.statusRow}
                  onPress={() => navigation.navigate('MotorcyclesTab', {
                    screen: 'MotorcycleDetail',
                    params: { motorcycleId: b.id },
                  })}
                >
                  <Text style={styles.statusBikeName}>{b.name}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: COLORS.red + '20' }]}>
                    <Text style={[styles.statusBadgeText, { color: COLORS.red }]}>
                      {b.count} due
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.allGood}>✓ All maintenance is up to date</Text>
            )}
          </View>
        )}

        {/* Empty state */}
        {bikes.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏍</Text>
            <Text style={styles.emptyTitle}>No Bikes Yet</Text>
            <Text style={styles.emptySub}>Add your first motorcycle to start tracking!</Text>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => navigation.navigate('Add Motorcycle')}
            >
              <Text style={styles.addBtnText}>+ Add a Motorcycle</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Unlocked and unmatched rides remain pending for manual assignment. */}
      <Modal
        transparent
        visible={showRidePrompt && pendingRides.length > 0}
        animationType="fade"
        onRequestClose={() => setShowRidePrompt(false)}
      >
        <Pressable
          style={ridePromptStyles.modalOverlay}
          onPress={() => setShowRidePrompt(false)}
        >
          <Pressable style={ridePromptStyles.modalContent} onPress={() => {}}>
            <Text style={ridePromptStyles.modalTitle}>Ride Complete</Text>
            <Text style={ridePromptStyles.rideDistance}>
              {pendingRides[0]?.miles ?? 0} mi
            </Text>
            <Text style={ridePromptStyles.rideDate}>
              {pendingRides[0]?.date ? new Date(pendingRides[0].date).toLocaleString() : ''}
            </Text>
            <Text style={ridePromptStyles.ridePrompt}>Add these miles to which motorcycle?</Text>
            {bikes.length ? (
              <ScrollView style={ridePromptStyles.bikeListShort}>
                {bikes.map((bike) => (
                  <TouchableOpacity
                    key={bike.id}
                    style={ridePromptStyles.bikeOption}
                    disabled={applyingRide}
                    onPress={() => applyPendingRide(pendingRides[0], bike)}
                  >
                    <Text style={ridePromptStyles.bikeName}>{bike.make} {bike.model}</Text>
                    <Text style={ridePromptStyles.bikeMiles}>
                      {parseInt(bike.mileageCurrent || bike.mileageBought || '0', 10).toLocaleString()} mi
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <Text style={ridePromptStyles.noBikes}>Add a motorcycle to your garage before logging this ride.</Text>
            )}
            <TouchableOpacity
              style={ridePromptStyles.dismissBtn}
              onPress={() => setShowRidePrompt(false)}
            >
              <Text style={ridePromptStyles.dismissText}>Later (keep pending)</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: COLORS.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  appSubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 4,
    fontWeight: '500',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '47%',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
  },
  cardIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 36,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  statusSection: {
    marginTop: 24,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  statusBikeName: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '500',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  allGood: {
    fontSize: 15,
    color: COLORS.green,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 8,
  },
  emptyState: {
    marginTop: 60,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  addBtn: {
    backgroundColor: COLORS.bronze,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  addBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
});


const ridePromptStyles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: COLORS.card, borderRadius: 16, padding: 24, width: '85%', maxWidth: 360, borderWidth: 1, borderColor: COLORS.cardBorder, alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  rideDistance: { fontSize: 42, fontWeight: '800', color: COLORS.bronze, marginBottom: 4 },
  rideDate: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 20 },
  ridePrompt: { fontSize: 15, color: COLORS.text, marginBottom: 16, fontWeight: '600' },
  noBikes: { color: COLORS.textSecondary, textAlign: 'center', paddingVertical: 16 },
  bikeListShort: { maxHeight: 200, width: '100%' },
  bikeOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10, marginBottom: 4, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.cardBorder, width: '100%' },
  bikeName: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  bikeMiles: { fontSize: 14, color: COLORS.textSecondary },
  dismissBtn: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 24, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 10 },
  dismissText: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '500' },
});
