import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const isExpoGo = Constants.appOwnership === 'expo';

let AppEventsLogger: any = { logPurchase: () => {}, logEvent: () => {} };
let Settings: any = { setAdvertiserTrackingEnabled: () => {}, initializeSDK: () => {} };

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
    if (Platform.OS === 'ios') {
      const { status } = await requestTrackingPermissionsAsync();
      
      if (status === 'granted') {
        Settings.setAdvertiserTrackingEnabled(true);
      } else {
        Settings.setAdvertiserTrackingEnabled(false);
      }
    } else {
      // For Android, tracking is usually enabled by default unless user opts out centrally
      Settings.setAdvertiserTrackingEnabled(true);
    }

    Settings.initializeSDK();
  } catch (error) {
    console.warn('Meta SDK Initialization error:', error);
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
