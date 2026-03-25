import * as React from 'react';
import { Image, Platform, AppState, View, Text, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import './lib/i18n'; // Initialize i18n
import { useTranslation } from 'react-i18next';
import { supabase } from './lib/supabase';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import Toast, { BaseToast, ErrorToast, ToastConfigParams } from 'react-native-toast-message';
import { initMetaTracking } from './lib/metaTracking';

// Import screens
import CameraScreen from './src/screens/CameraScreen';
import MyScansScreen from './src/screens/MyScansScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AccountScreen from './src/screens/AccountScreen';
import { IAPProvider } from './src/context/IAPContext';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => { });

const Tab = createBottomTabNavigator();
const ProfileStack = createNativeStackNavigator();

function ProfileStackScreen() {
    return (
        <ProfileStack.Navigator id="ProfileStack" screenOptions={{ headerShown: false }}>
            <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
            <ProfileStack.Screen name="Account" component={AccountScreen} />
        </ProfileStack.Navigator>
    );
}

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

/* Custom Toast Configuration - Neon Cyberpunk Theme */
const toastStyles = StyleSheet.create({
    toastContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A0B2E',
        width: '90%',
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderRadius: 20,
        borderWidth: 2,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 10,
        marginTop: Platform.OS === 'ios' ? 0 : 20,
    },
    successContainer: { borderColor: '#00FF00', shadowColor: '#00FF00' },
    errorContainer: { borderColor: '#FF007F', shadowColor: '#FF007F' },
    infoContainer: { borderColor: '#FFD700', shadowColor: '#FFD700' },
    iconContainer: { marginRight: 15, justifyContent: 'center', alignItems: 'center' },
    iconText: { fontSize: 28 },
    textContainer: { flex: 1 },
    titleBase: { fontSize: 16, fontWeight: '900', marginBottom: 2 },
    titleSuccess: { color: '#00FF00' },
    titleError: { color: '#FF007F' },
    titleInfo: { color: '#FFD700' },
    message: { fontSize: 14, color: '#D3C4E5' },
});

const toastConfig = {
    success: ({ text1, text2 }: ToastConfigParams<any>) => (
        <View style={[toastStyles.toastContainer, toastStyles.successContainer]}>
            <View style={toastStyles.iconContainer}><Text style={toastStyles.iconText}>✨</Text></View>
            <View style={toastStyles.textContainer}>
                <Text style={[toastStyles.titleBase, toastStyles.titleSuccess]}>{text1}</Text>
                <Text style={toastStyles.message}>{text2}</Text>
            </View>
        </View>
    ),
    error: ({ text1, text2 }: ToastConfigParams<any>) => (
        <View style={[toastStyles.toastContainer, toastStyles.errorContainer]}>
            <View style={toastStyles.iconContainer}><Text style={toastStyles.iconText}>🚫</Text></View>
            <View style={toastStyles.textContainer}>
                <Text style={[toastStyles.titleBase, toastStyles.titleError]}>{text1}</Text>
                <Text style={toastStyles.message}>{text2}</Text>
            </View>
        </View>
    ),
    info: ({ text1, text2 }: ToastConfigParams<any>) => (
        <View style={[toastStyles.toastContainer, toastStyles.infoContainer]}>
            <View style={toastStyles.iconContainer}><Text style={toastStyles.iconText}>🐾</Text></View>
            <View style={toastStyles.textContainer}>
                <Text style={[toastStyles.titleBase, toastStyles.titleInfo]}>{text1}</Text>
                <Text style={toastStyles.message}>{text2}</Text>
            </View>
        </View>
    )
};

export default function App() {
    const { t } = useTranslation();

    useEffect(() => {
        async function prepare() {
            try {
                // Ensure anonymous session exists before anything else
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    console.log('[App] No session found, signing in anonymously...');
                    await supabase.auth.signInAnonymously();
                    console.log('[App] Anonymous session created.');
                } else {
                    console.log('[App] Existing session found:', session.user.id);
                }

                // Minimum wait to show off the splash screen beautifully
                await new Promise(resolve => setTimeout(resolve, 2500));
            } catch (e) {
                console.warn('[App] Startup error:', e);
            } finally {
                await SplashScreen.hideAsync();
                
                // Initialize Meta Tracking after splash screen
                initMetaTracking();
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
                                            marginTop: Platform.OS === 'ios' ? 32 : 20 // Push down slightly to center vertically without labels
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
                                height: Platform.OS === 'ios' ? 90 : 80, // Keep height for safe area
                                paddingBottom: Platform.OS === 'ios' ? 30 : 10, // Adjust bottom padding on Android
                                paddingTop: Platform.OS === 'ios' ? 0 : 5, // Add top padding on Android to separate from line
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
                            listeners={({ navigation, route }) => ({
                                tabPress: (e) => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                },
                            })}
                        />
                        <Tab.Screen
                            name="MyScans"
                            component={MyScansScreen}
                            options={{ headerShown: false, tabBarLabel: t('app.tab_scans') }}
                            listeners={({ navigation, route }) => ({
                                tabPress: (e) => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                },
                            })}
                        />
                        <Tab.Screen
                            name="Profile"
                            component={ProfileStackScreen}
                            options={{ headerShown: false, tabBarLabel: t('app.tab_profile') }}
                            listeners={({ navigation, route }) => ({
                                tabPress: (e) => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                },
                            })}
                        />
                    </Tab.Navigator>
                </NavigationContainer>
            </IAPProvider>
            <Toast config={toastConfig} />
        </SafeAreaProvider >
    );
}
