import React, { useRef } from 'react';
import {
  Modal,
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Text,
  Dimensions,
  StatusBar,
  Animated,
  PanResponder,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ImageViewer({ visible, imageUri, onClose }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const lastScale = useRef(1);
  const lastDistance = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        lastScale.current = scale.__getValue();
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          // Pinch to zoom
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (lastDistance.current > 0) {
            const newScale = Math.max(0.5, Math.min(5, lastScale.current * (distance / lastDistance.current)));
            scale.setValue(newScale);
          }
          lastDistance.current = distance;
        } else if (touches.length === 1 && lastDistance.current === 0) {
          // Single touch - pan
          pan.setValue({ x: gestureState.dx, y: gestureState.dy });
        }
      },
      onPanResponderRelease: () => {
        lastDistance.current = 0;
        // Snap back if zoomed out
        const currentScale = scale.__getValue();
        if (currentScale < 1) {
          Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <StatusBar hidden />
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.zoomContainer,
            { transform: [{ scale }, { translateX: pan.x }, { translateY: pan.y }] },
          ]}
          {...panResponder.panHandlers}
        >
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="contain"
            />
          ) : null}
        </Animated.View>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.85,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH - 24,
    height: SCREEN_HEIGHT * 0.8,
  },
  closeBtn: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeBtnText: { color: '#fff', fontSize: 20, fontWeight: '700' },
});
