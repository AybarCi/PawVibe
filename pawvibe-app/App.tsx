import * as React from 'react';
import { Image, Platform, AppState } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import './lib/i18n'; // Initialize i18n
import { useTranslation } from 'react-i18next';
import { supabase } from './lib/supabase';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

// Import screens
import CameraScreen from './src/screens/CameraScreen';
import MyScansScreen from './src/screens/MyScansScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { IAPProvider } from './src/context/IAPContext';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => { });

const Tab = createBottomTabNavigator();

const DarkPurpleTheme = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        background: '#0A001A',
    },
};

// Tells Supabase Auth to continuously refresh the session automatically if
// the app is in the foreground.
AppState.addEventListener('change', (state) => {
    if (state === 'active') {
        supabase.auth.startAutoRefresh()
    } else {
        supabase.auth.stopAutoRefresh()
    }
})

export default function App() {
    const { t } = useTranslation();

    useEffect(() => {
        async function prepare() {
            try {
                // Minimum wait to show off the splash screen beautifully
                await new Promise(resolve => setTimeout(resolve, 2500));
            } catch (e) {
                console.warn(e);
            } finally {
                await SplashScreen.hideAsync();
            }
        }
        prepare();
    }, []);

    return (
        <SafeAreaProvider>
            <IAPProvider>
                <NavigationContainer theme={DarkPurpleTheme}>
                    <Tab.Navigator
                        id="RootTab"
                        screenOptions={({ route }) => ({
                            tabBarIcon: ({ focused, color, size }) => {
                                let iconSource;

                                if (route.name === 'Scan') {
                                    iconSource = require('./assets/tab-scan.png');
                                } else if (route.name === 'MyScans') {
                                    iconSource = require('./assets/tab-myscans.png');
                                } else if (route.name === 'Profile') {
                                    iconSource = require('./assets/tab-profile.png');
                                }

                                // Use opacity to indicate focus state since we are using static images
                                return (
                                    <Image
                                        source={iconSource}
                                        style={{
                                            width: 77, // Increased from 32
                                            height: 77, // Increased from 32
                                            opacity: focused ? 1 : 0.4,
                                            marginTop: Platform.OS === 'ios' ? 32 : 16 // Push down slightly to center vertically without labels
                                        }}
                                        resizeMode="contain"
                                    />
                                );
                            },
                            tabBarActiveTintColor: '#FF007F', // Neon Pink
                            tabBarInactiveTintColor: '#6A4C93', // Muted Purple
                            tabBarShowLabel: false, // Hides the text labels
                            tabBarStyle: {
                                backgroundColor: '#0A001A', // Deep dark purple background
                                borderTopColor: '#FF007F', // Neon pink top border
                                borderTopWidth: 1, // Add defined width for retro glow feel
                                height: Platform.OS === 'ios' ? 90 : 70, // Keep height for safe area
                                paddingBottom: Platform.OS === 'ios' ? 30 : 0, // Remove bottom padding on Android since there's no text
                                paddingTop: Platform.OS === 'ios' ? 0 : 0, // Reset padding top to center vertically
                            },
                            headerStyle: {
                                backgroundColor: '#0A001A',
                            },
                            headerTintColor: '#fff',
                            headerTitleStyle: {
                                fontWeight: '900',
                                color: '#FFD700', // Neon Yellow Header Title
                            },
                        })}
                    >
                        <Tab.Screen
                            name="Scan"
                            component={CameraScreen}
                            options={{ headerShown: false, tabBarLabel: t('app.tab_scan') }}
                        />
                        <Tab.Screen
                            name="MyScans"
                            component={MyScansScreen}
                            options={{ headerShown: false, tabBarLabel: t('app.tab_scans') }}
                        />
                        <Tab.Screen
                            name="Profile"
                            component={ProfileScreen}
                            options={{ headerShown: false, tabBarLabel: t('app.tab_profile') }}
                        />
                    </Tab.Navigator>
                </NavigationContainer>
            </IAPProvider>
        </SafeAreaProvider >
    );
}
