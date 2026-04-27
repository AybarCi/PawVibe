import { Settings, AppEventsLogger } from 'react-native-fbsdk-next';
import { InteractionManager, AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sha256 } from 'js-sha256';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

/* =========================
   CONFIG
========================= */

const STORAGE_QUEUE = 'META_QUEUE_CLIENT';
const STORAGE_PURCHASES = 'META_PURCHASES_CLIENT';

const MAX_QUEUE = 50;

/* =========================
   EVENTS
========================= */

export const META_EVENTS = {
  COMPLETE_REGISTRATION: 'CompleteRegistration',
  LOGIN: 'Login',
  ADD_TO_CART: 'AddToCart',
  VIEW_CONTENT: 'ViewContent',
  SEARCH: 'Search',
  INITIATE_CHECKOUT: 'InitiateCheckout',
  PURCHASE: 'Purchase',
};

/* =========================
   STATE
========================= */

let ready = false;
let flushing = false;
let trackingAllowed = true;

let queue: any[] = [];
let userData: Record<string, string> = {};

const seen = new Map<string, number>();
const purchaseHistory: Record<string, boolean> = {};

let appStateSub: any;

/* =========================
   STORAGE HELPERS
========================= */

const safeGet = async (k: string) => {
  try {
    return await AsyncStorage.getItem(k);
  } catch {
    return null;
  }
};

const safeSet = async (k: string, v: any) => {
  try {
    await AsyncStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

const loadAll = async () => {
  try {
    const [q, p] = await Promise.all([
      safeGet(STORAGE_QUEUE),
      safeGet(STORAGE_PURCHASES),
    ]);

    if (q) queue = JSON.parse(q);
    if (p) Object.assign(purchaseHistory, JSON.parse(p));
  } catch {
    queue = [];
  }
};

/* =========================
   DEDUP SYSTEM
========================= */

const mark = (id: string) => {
  seen.set(id, Date.now());

  if (seen.size > 5000) {
    const oldest = seen.keys().next().value;
    seen.delete(oldest);
  }
};

const isDup = (id: string) => seen.has(id);

const isPurchaseDup = (id?: string) => !!(id && purchaseHistory[id]);

/* =========================
   FLUSH ENGINE
========================= */

const flush = async () => {
  if (flushing || !ready || !queue.length || !trackingAllowed) return;

  flushing = true;

  try {
    const batch = queue.splice(0, 20);
    await safeSet(STORAGE_QUEUE, queue);

    for (const e of batch) {
      if (e.type === 'event') {
        AppEventsLogger.logEvent(e.name, {
          ...e.params,
          event_id: e.event_id,
        });
      }

      if (e.type === 'purchase') {
        if (!isPurchaseDup(e.purchase_id)) {
          const eventName =
            Platform.OS === 'ios'
              ? 'fb_mobile_purchase'
              : META_EVENTS.PURCHASE;

          AppEventsLogger.logEvent(eventName, {
            value: e.amount,
            currency: e.currency,
            event_id: e.event_id,
          });

          if (e.purchase_id) {
            purchaseHistory[e.purchase_id] = true;
            await safeSet(STORAGE_PURCHASES, purchaseHistory);
          }
        }
      }

      mark(e.event_id);
    }
  } catch (err) {
    console.warn('[META FLUSH ERROR]', err);
  } finally {
    flushing = false;
  }
};

/* =========================
   INIT
========================= */

export const initMetaTracking = async (granted: boolean) => {
  trackingAllowed = granted;

  // Rule 2: Initialize SDK
  Settings.initializeSDK();

  Settings.setAdvertiserTrackingEnabled(granted);
  Settings.setAdvertiserIDCollectionEnabled(granted);

  await loadAll();

  if (granted) {
    AppEventsLogger.logEvent('fb_mobile_activate_app');

    // Rule 3: Manual install trigger using first-launch check
    const hasLoggedInstall = await safeGet('META_INSTALL_LOGGED');
    if (!hasLoggedInstall) {
      AppEventsLogger.logEvent('fb_mobile_install');
      await safeSet('META_INSTALL_LOGGED', 'true');
    }
  }

  InteractionManager.runAfterInteractions(() => {
    setTimeout(() => {
      ready = true;
      flush();
    }, 500);
  });

  appStateSub?.remove?.();
  appStateSub = AppState.addEventListener('change', state => {
    if (state === 'active') flush();
  });
};

/* =========================
   USER DATA
========================= */

export const setMetaUserData = (
  email?: string,
  externalId?: string,
  phone?: string
) => {
  if (email) userData.em = sha256(email.trim().toLowerCase());
  if (phone) userData.ph = sha256(phone.replace(/\D/g, ''));
  if (externalId) userData.external_id = `app_${externalId}`;

  if (ready && trackingAllowed) {
    AppEventsLogger.setUserData(userData);
  }
};

/* =========================
   CORE TRACKER
========================= */

const track = async (type: 'event' | 'purchase', payload: any) => {
  const id = payload.event_id || uuidv4();

  if (isDup(id) || !trackingAllowed) return;

  if (type === 'purchase' && isPurchaseDup(payload.purchase_id)) return;

  const event = {
    ...payload,
    type,
    event_id: id,
  };

  if (!ready) {
    if (queue.length > MAX_QUEUE) queue.shift();
    queue.push(event);
    await safeSet(STORAGE_QUEUE, queue);
    return;
  }

  queue.push(event);
  await safeSet(STORAGE_QUEUE, queue);

  mark(id);

  flush();
};

/* =========================
   PUBLIC API
========================= */

export const logMetaEvent = (name: string, params?: any) =>
  track('event', { name, params });

export const logMetaPurchase = (
  amount: number,
  currency = 'USD',
  purchase_id?: string
) =>
  track('purchase', { amount, currency, purchase_id });

/* =========================
   FUNNEL HELPERS
========================= */

export const logViewContent = (name: string) =>
  logMetaEvent(META_EVENTS.VIEW_CONTENT, { content_name: name });

export const logAddToCart = (name: string, price: number) =>
  logMetaEvent(META_EVENTS.ADD_TO_CART, { content_name: name, value: price });

export const logCheckout = (name: string, price: number) =>
  logMetaEvent(META_EVENTS.INITIATE_CHECKOUT, { content_name: name, value: price });

export const logSearch = (q: string) =>
  logMetaEvent(META_EVENTS.SEARCH, { search_string: q });
