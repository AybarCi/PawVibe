import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications are handled when the app is open
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export const requestNotificationPermissions = async () => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
        return false;
    }

    if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    return true;
};

export const scheduleVaccineReminder = async (
    remindTitle: string,
    remindBody: string,
    dayOfTitle: string,
    dayOfBody: string,
    dueDateStr: string
) => {
    const dueDate = new Date(dueDateStr);
    const ids: string[] = [];

    // 1. One day before
    const dayBefore = new Date(dueDate);
    dayBefore.setDate(dayBefore.getDate() - 1);
    dayBefore.setHours(10, 0, 0, 0);

    if (dayBefore > new Date()) {
        const id1 = await Notifications.scheduleNotificationAsync({
            content: {
                title: remindTitle,
                body: remindBody,
                sound: true,
            },
            trigger: { date: dayBefore, type: 'date' } as any,
        });
        ids.push(id1);
    }

    // 2. On the day
    const dayOf = new Date(dueDate);
    dayOf.setHours(9, 0, 0, 0);

    if (dayOf > new Date()) {
        const id2 = await Notifications.scheduleNotificationAsync({
            content: {
                title: dayOfTitle,
                body: dayOfBody,
                sound: true,
            },
            trigger: { date: dayOf, type: 'date' } as any,
        });
        ids.push(id2);
    }

    return ids;
};

export const cancelVaccineReminders = async (notificationIds: string[]) => {
    if (!notificationIds || notificationIds.length === 0) return;
    
    for (const id of notificationIds) {
        try {
            await Notifications.cancelScheduledNotificationAsync(id);
        } catch (error) {
            console.error('Error cancelling notification:', error);
        }
    }
};
