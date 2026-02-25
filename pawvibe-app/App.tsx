import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import './lib/i18n'; // Initialize i18n
import { useTranslation } from 'react-i18next';

// Import screens
import CameraScreen from './src/screens/CameraScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Tab = createBottomTabNavigator();

export default function App() {
    const { t } = useTranslation();
    return (
        <SafeAreaProvider>
            <NavigationContainer>
                <Tab.Navigator
                    id="RootTab"
                    screenOptions={({ route }) => ({
                        tabBarIcon: ({ focused, color, size }) => {
                            let iconName;

                            if (route.name === 'Scan') {
                                iconName = focused ? 'camera' : 'camera-outline';
                            } else if (route.name === 'Profile') {
                                iconName = focused ? 'person' : 'person-outline';
                            }

                            // You can return any component that you like here!
                            return <Ionicons name={iconName as any} size={size} color={color} />;
                        },
                        tabBarActiveTintColor: '#FF007F', // Neon Pink
                        tabBarInactiveTintColor: '#6A4C93', // Muted Purple
                        tabBarStyle: {
                            backgroundColor: '#0A001A', // Deep dark purple background
                            borderTopColor: '#FF007F', // Neon pink top border
                            borderTopWidth: 1, // Add defined width for retro glow feel
                        },
                        headerStyle: {
                            backgroundColor: '#0A001A',
                        },
                        headerTintColor: '#fff',
                        headerTitleStyle: {
                            fontWeight: '900',
                            color: '#FFD700', // Neon Yellow Header Title
                        },
                        tabBarShowLabel: true,
                    })}
                >
                    <Tab.Screen
                        name="Scan"
                        component={CameraScreen}
                        options={{ headerShown: false, tabBarLabel: t('app.tab_scan') }}
                    />
                    <Tab.Screen
                        name="Profile"
                        component={ProfileScreen}
                        options={{ headerShown: false, tabBarLabel: t('app.tab_profile') }}
                    />
                </Tab.Navigator>
            </NavigationContainer>
        </SafeAreaProvider>
    );
}
