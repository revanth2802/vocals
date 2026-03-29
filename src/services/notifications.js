import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const DAILY_DIGEST_ID = 'vocals-daily-digest';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const isNotificationsSupported = Platform.OS !== 'web';
const DATE_TRIGGER_TYPE = Notifications.SchedulableTriggerInputTypes.DATE;
const DAILY_TRIGGER_TYPE = Notifications.SchedulableTriggerInputTypes.DAILY;

const formatTriggerSummary = (trigger) => {
  if (!trigger) return 'No trigger metadata';

  if (trigger.type === 'daily') {
    return `Daily at ${String(trigger.hour).padStart(2, '0')}:${String(trigger.minute).padStart(2, '0')}`;
  }

  if (trigger.value) {
    return new Date(trigger.value).toLocaleString();
  }

  if (trigger.date) {
    return new Date(trigger.date).toLocaleString();
  }

  return 'Scheduled';
};

const buildDateAtHour = (offsetDays, hour, minute = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  date.setHours(hour, minute, 0, 0);
  return date;
};

const parseDueDescription = (dueDescription) => {
  if (!dueDescription) return null;

  const value = dueDescription.toLowerCase();

  if (value.includes('tomorrow morning')) return buildDateAtHour(1, 9);
  if (value.includes('tomorrow')) return buildDateAtHour(1, 9);
  if (value.includes('tonight')) return buildDateAtHour(0, 19);
  if (value.includes('this evening')) return buildDateAtHour(0, 18);
  if (value.includes('next week')) return buildDateAtHour(7, 9);
  if (value.includes('friday')) {
    const date = new Date();
    const currentDay = date.getDay();
    const friday = 5;
    const diff = (friday - currentDay + 7) % 7 || 7;
    date.setDate(date.getDate() + diff);
    date.setHours(9, 0, 0, 0);
    return date;
  }

  return null;
};

export const requestNotificationPermissions = async () => {
  if (!isNotificationsSupported) return false;

  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
};

export const scheduleTaskNotifications = async (tasks = []) => {
  if (!isNotificationsSupported || tasks.length === 0) return;

  const granted = await requestNotificationPermissions();
  if (!granted) return;

  await Promise.all(
    tasks.map(async (task) => {
      const dueDate = parseDueDescription(task.dueDescription);
      if (!dueDate || dueDate <= new Date()) return;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Task coming up',
          body: task.text,
          data: { type: 'task', taskId: task.id },
        },
        trigger: {
          type: DATE_TRIGGER_TYPE,
          date: dueDate,
        },
      });
    })
  );
};

export const scheduleFollowUpNotification = async (tasks = [], enabled = true) => {
  if (!isNotificationsSupported || !enabled || tasks.length === 0) return;

  const granted = await requestNotificationPermissions();
  if (!granted) return;

  const followUpDate = buildDateAtHour(1, 18);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Did you actually do it?',
      body: `Quick check-in: ${tasks[0].text}`,
      data: { type: 'followup', taskIds: tasks.map((task) => task.id) },
    },
    trigger: {
      type: DATE_TRIGGER_TYPE,
      date: followUpDate,
    },
  });
};

export const syncDailyDigestNotification = async (enabled = true) => {
  if (!isNotificationsSupported) return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const existing = scheduled.filter(
    (item) => item.content?.data?.id === DAILY_DIGEST_ID
  );

  await Promise.all(existing.map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));

  if (!enabled) return;

  const granted = await requestNotificationPermissions();
  if (!granted) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Daily execution digest',
      body: 'Open VOCALS and review your pending tasks and unfinished thoughts.',
      data: { type: 'daily-digest', id: DAILY_DIGEST_ID },
    },
    trigger: {
      type: DAILY_TRIGGER_TYPE,
      hour: 9,
      minute: 0,
    },
  });
};

export const getScheduledNotificationsDebug = async () => {
  if (!isNotificationsSupported) {
    return {
      supported: false,
      items: [],
    };
  }

  const items = await Notifications.getAllScheduledNotificationsAsync();

  return {
    supported: true,
    items: items.map((item) => ({
      id: item.identifier,
      title: item.content?.title || 'Untitled notification',
      body: item.content?.body || '',
      type: item.content?.data?.type || 'unknown',
      trigger: formatTriggerSummary(item.trigger),
    })),
  };
};

export const cancelAllScheduledNotifications = async () => {
  if (!isNotificationsSupported) return { supported: false, cancelled: 0 };

  const items = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    items.map((item) =>
      Notifications.cancelScheduledNotificationAsync(item.identifier)
    )
  );

  return { supported: true, cancelled: items.length };
};
