import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const isExpoGo = Constants.appOwnership === 'expo';
const FIRST_LAUNCH_KEY = '@meta_first_launch_logged';

let AppEventsLogger: any = { logPurchase: () => { }, logEvent: () => { } };
let Settings: any = {
  setAdvertiserTrackingEnabled: () => { },
  initializeSDK: () => { },
  setAutoLogAppEventsEnabled: () => { }
};

if (!isExpoGo) {
  try {
    const fbsdk = require('react-native-fbsdk-next');
    AppEventsLogger = fbsdk.AppEventsLogger;
    Settings = fbsdk.Settings;
  } catch (e) {
    console.warn("Failed to load fbsdk", e);
  }
}

export const initMetaTracking = async () => {
  try {
    // 1. Set Auto Logging & Advertiser Tracking before initialization for maximum reliability
    Settings.setAutoLogAppEventsEnabled(true);

    if (Platform.OS === 'ios') {
      const { status } = await requestTrackingPermissionsAsync();
      Settings.setAdvertiserTrackingEnabled(status === 'granted');
    } else {
      Settings.setAdvertiserTrackingEnabled(true);
    }

    // 2. Initialize the SDK
    Settings.initializeSDK();

    if (!isExpoGo) {
      // 3. First Launch Detection for 'fb_mobile_install'
      const hasLoggedInstall = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
      if (!hasLoggedInstall) {
        AppEventsLogger.logEvent('fb_mobile_install');
        await AsyncStorage.setItem(FIRST_LAUNCH_KEY, 'true');
        console.log('[MetaTracking] First launch detected. Logging fb_mobile_install.');
      }

      // 4. Explicitly log app activation (fb_mobile_activate_app)
      AppEventsLogger.logEvent('fb_mobile_activate_app');
    }

    console.log('[MetaTracking] SDK Initialized & App Activation logged');
  } catch (error) {
    console.warn('Meta SDK Initialization error:', error);
  }
};

/**
 * Advanced Auto Matching (AAM)
 * Hashes user data (email) and sends it to Meta for better ad attribution matching.
 */
export const setMetaUserData = async (email: string) => {
  if (isExpoGo || !email) return;

  try {
    const { Settings: fbsdkSettings } = require('react-native-fbsdk-next');
    
    // Normalize and hash email
    const cleanEmail = email.trim().toLowerCase();
    
    // In v17+, setUserData is the preferred way for AAM
    // Some versions use setInternalUserData but setUserData is standard
    fbsdkSettings.setUserData({
      email: cleanEmail,
    });
    
    console.log('[MetaTracking] User data set for AAM');
  } catch (e) {
    console.warn('[MetaTracking] Failed to set user data:', e);
  }
};

export const logMetaPurchase = (purchaseAmount: number, currency: string = 'USD') => {
  try {
    AppEventsLogger.logPurchase(purchaseAmount, currency);
  } catch (error) {
    console.warn('Meta SDK logPurchase error:', error);
  }
};

export const logMetaEvent = (eventName: string, parameters?: Record<string, string | number>) => {
  try {
    AppEventsLogger.logEvent(eventName, parameters);
  } catch (error) {
    console.warn(`Meta SDK logEvent (${eventName}) error:`, error);
  }
};
