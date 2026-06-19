import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from './theme';
import HomeScreen from './screens/HomeScreen';
import MotorcyclesScreen from './screens/MotorcyclesScreen';
import MotorcycleDetailScreen from './screens/MotorcycleDetailScreen';
import AddMotorcycleScreen from './screens/AddMotorcycleScreen';
import DirectionsScreen from './screens/DirectionsScreen';

const Tab = createBottomTabNavigator();
const MotorcycleStack = createNativeStackNavigator();

function MotorcyclesStackScreen() {
  return (
    <MotorcycleStack.Navigator screenOptions={{ headerShown: false }}>
      <MotorcycleStack.Screen name="MotorcyclesList" component={MotorcyclesScreen} />
      <MotorcycleStack.Screen name="MotorcycleDetail" component={MotorcycleDetailScreen} />
    </MotorcycleStack.Navigator>
  );
}

function AppTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.bronze,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.headerBg,
          borderTopWidth: 1,
          borderTopColor: COLORS.cardBorder,
          paddingTop: 8,
          paddingBottom: 8 + insets.bottom,
          height: 70 + insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <Text style={{ fontSize: size, color }}>🏠</Text>,
        }}
      />
      <Tab.Screen
        name="MotorcyclesTab"
        component={MotorcyclesStackScreen}
        options={{
          tabBarLabel: 'Motorcycles',
          tabBarIcon: ({ color, size }) => <Text style={{ fontSize: size, color }}>🏍</Text>,
        }}
      />
      <Tab.Screen
        name="Add Motorcycle"
        component={AddMotorcycleScreen}
        options={{
          tabBarLabel: 'Add Bike',
          tabBarIcon: ({ color, size }) => <Text style={{ fontSize: size, color }}>➕</Text>,
        }}
      />
      <Tab.Screen
        name="DirectionsTab"
        component={DirectionsScreen}
        options={{
          tabBarLabel: 'Directions',
          tabBarIcon: ({ color, size }) => <Text style={{ fontSize: size, color }}>🗺</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <AppTabs />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
