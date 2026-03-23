import { AppEventsLogger, Settings } from 'react-native-fbsdk-next';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { Platform } from 'react-native';

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
