// VOCALS — Voice → Execution System
// Main App Entry with Navigation

import React from 'react';
import { StatusBar, View, Text, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from './src/screens/HomeScreen';
import RecordScreen from './src/screens/RecordScreen';
import NoteDetailScreen from './src/screens/NoteDetailScreen';
import InsightsScreen from './src/screens/InsightsScreen';
import SettingsScreen from './src/screens/SettingsScreen';

import { COLORS, FONT_SIZE, FONT_WEIGHT, SPACING } from './src/constants/theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Tab Navigator
function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: Platform.OS === 'web' ? 12 : 18,
          height: Platform.OS === 'web' ? 68 : 76,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'web' ? 10 : 16,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: COLORS.cardBorder,
          borderRadius: 28,
          backgroundColor: 'rgba(255, 253, 252, 0.96)',
          shadowColor: '#8F7668',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.12,
          shadowRadius: 24,
          elevation: 12,
        },
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textTertiary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 4,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Execute',
          tabBarIcon: function ({ focused, color, size }) {
            return (
              <View style={{
                width: 32, height: 32, borderRadius: 16,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: focused ? COLORS.accentDim : 'transparent',
              }}>
                <Ionicons name={focused ? 'document-text' : 'document-text-outline'} size={18} color={color} />
              </View>
            );
          },
        }}
      />
      <Tab.Screen
        name="Insights"
        component={InsightsScreen}
        options={{
          tabBarLabel: 'Insights',
          tabBarIcon: function ({ focused, color, size }) {
            return (
              <View style={{
                width: 32, height: 32, borderRadius: 16,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: focused ? COLORS.accentDim : 'transparent',
              }}>
                <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} size={18} color={color} />
              </View>
            );
          },
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: function ({ focused, color, size }) {
            return (
              <View style={{
                width: 32, height: 32, borderRadius: 16,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: focused ? COLORS.accentDim : 'transparent',
              }}>
                <Ionicons name={focused ? 'settings' : 'settings-outline'} size={18} color={color} />
              </View>
            );
          },
        }}
      />
    </Tab.Navigator>
  );
}

// Dark theme for navigation
const SoftTheme = {
  dark: false,
  colors: {
    primary: COLORS.accent,
    background: COLORS.background,
    card: COLORS.background,
    text: COLORS.textPrimary,
    border: COLORS.divider,
    notification: COLORS.accent,
  },
  fonts: {
    regular: {
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
      fontWeight: '400',
    },
    medium: {
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
      fontWeight: '500',
    },
    bold: {
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
      fontWeight: '700',
    },
    heavy: {
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
      fontWeight: '800',
    },
  },
};

// Main App
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer theme={SoftTheme}>
          <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: COLORS.background },
              animation: 'slide_from_bottom',
            }}
          >
            <Stack.Screen
              name="Main"
              component={TabNavigator}
              options={{ animation: 'none' }}
            />
            <Stack.Screen
              name="Record"
              component={RecordScreen}
              options={{
                presentation: 'fullScreenModal',
                animation: 'slide_from_bottom',
              }}
            />
            <Stack.Screen
              name="NoteDetail"
              component={NoteDetailScreen}
              options={{
                animation: 'slide_from_right',
              }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
