import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.72;

export default function SlideMenu({ visible, items, activeItem, onSelect, onClose }) {
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(-DRAWER_WIDTH);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -DRAWER_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const animateAndClose = (callback) => {
    Animated.timing(slideAnim, {
      toValue: -DRAWER_WIDTH,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      if (callback) callback();
      onClose();
    });
  };

  const handleSelect = (item) => {
    onSelect(item);
    animateAndClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        {/* Backdrop */}
        <Pressable style={styles.backdrop} onPress={() => animateAndClose()} />

        {/* Drawer */}
        <Animated.View
          style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}
        >
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>Sections</Text>
            <TouchableOpacity onPress={() => animateAndClose()} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>X</Text>
            </TouchableOpacity>
          </View>

          {items.map((item) => {
            const isActive = item === activeItem;
            return (
              <TouchableOpacity
                key={item}
                style={[styles.menuItem, isActive && styles.menuItemActive]}
                onPress={() => handleSelect(item)}
              >
                <View style={styles.iconCircle}>
                  <Text style={styles.iconLetter}>
                    {item === 'Info' ? 'I' :
                     item === 'Photos' ? 'P' :
                     item === 'Parts' ? 'C' :
                     item === 'Manuals' ? 'M' :
                     item === 'Services' ? 'S' :
                     item === 'Maintenance' ? 'W' : ''}
                  </Text>
                </View>
                <Text style={[styles.menuLabel, isActive && styles.menuLabelActive]}>
                  {item}
                </Text>
                {isActive && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#ffffff',
    paddingTop: 50,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 30,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  drawerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111111',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#666666',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemActive: {
    backgroundColor: '#fde8e8',
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  iconLetter: {
    fontSize: 16,
    fontWeight: '700',
    color: '#c8953a',
  },
  menuLabel: {
    fontSize: 18,
    fontWeight: '500',
    color: '#222222',
    flex: 1,
  },
  menuLabelActive: {
    color: '#c8953a',
    fontWeight: '700',
  },
  checkmark: {
    fontSize: 20,
    color: '#c8953a',
    fontWeight: '700',
  },
});
