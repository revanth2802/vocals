// SettingsScreen — API key config + app preferences
import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView,
    StatusBar, Alert, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, CARD_STYLE } from '../constants/theme';
import { getSettings, saveSettings, clearAllData } from '../services/storage';
import {
    syncDailyDigestNotification,
    getScheduledNotificationsDebug,
    cancelAllScheduledNotifications,
} from '../services/notifications';
import { CAPTURE_MODES, getCaptureMode } from '../constants/captureModes';

const SettingsScreen = ({ navigation }) => {
    const [settings, setSettings] = useState({
        recordingMode: 'action',
        followUpEnabled: true,
        dailyDigestEnabled: true,
        hapticFeedback: true,
    });
    const [saved, setSaved] = useState(false);
    const [notificationsDebug, setNotificationsDebug] = useState({ supported: true, items: [] });
    const [loadingNotifications, setLoadingNotifications] = useState(false);
    const selectedMode = getCaptureMode(settings.recordingMode);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        const data = await getSettings();
        setSettings(data);
        await loadNotificationsDebug();
    };

    const loadNotificationsDebug = async () => {
        setLoadingNotifications(true);
        try {
            const data = await getScheduledNotificationsDebug();
            setNotificationsDebug(data);
        } finally {
            setLoadingNotifications(false);
        }
    };

    const handleSave = async (key, value) => {
        const updated = { ...settings, [key]: value };
        setSettings(updated);
        await saveSettings(updated);
        if (key === 'dailyDigestEnabled') {
            await syncDailyDigestNotification(value);
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleClearData = () => {
        Alert.alert(
            'Clear All Data',
            'This will permanently delete all your voice notes, tasks, and settings. This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete Everything',
                    style: 'destructive',
                    onPress: async () => {
                        await clearAllData();
                        Alert.alert('Done', 'All data has been cleared.');
                    },
                },
            ]
        );
    };

    const handleCancelAllNotifications = () => {
        Alert.alert(
            'Cancel Scheduled Notifications',
            'This will remove all pending reminders and digests from this device.',
            [
                { text: 'Keep', style: 'cancel' },
                {
                    text: 'Cancel All',
                    style: 'destructive',
                    onPress: async () => {
                        const result = await cancelAllScheduledNotifications();
                        await loadNotificationsDebug();

                        if (!result.supported) {
                            Alert.alert('Not Supported', 'This action is only available on native builds.');
                            return;
                        }

                        Alert.alert('Done', `Cancelled ${result.cancelled} scheduled notifications.`);
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />
            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Settings</Text>
                    {saved && <Text style={styles.savedBadge}>Saved</Text>}
                </View>

                {/* Recording Preferences */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Recording</Text>

                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Default Mode</Text>
                            <Text style={styles.settingDescription}>
                                {selectedMode.subtitle}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.modeGrid}>
                        {CAPTURE_MODES.map((mode) => (
                            <TouchableOpacity
                                key={mode.key}
                                style={[styles.modeOption, settings.recordingMode === mode.key && styles.modeOptionActive]}
                                onPress={() => handleSave('recordingMode', mode.key)}
                            >
                                <Ionicons
                                    name={mode.iconName}
                                    size={18}
                                    color={settings.recordingMode === mode.key ? COLORS.accent : COLORS.textSecondary}
                                />
                                <Text style={[styles.modeOptionText, settings.recordingMode === mode.key && styles.modeOptionTextActive]}>
                                    {mode.shortLabel}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Execution Loop */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Execution Loop</Text>

                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Follow-up Nudges</Text>
                            <Text style={styles.settingDescription}>
                                "Did you actually do it?" reminders for incomplete tasks
                            </Text>
                        </View>
                        <Switch
                            value={settings.followUpEnabled}
                            onValueChange={(val) => handleSave('followUpEnabled', val)}
                            trackColor={{ false: COLORS.surface, true: COLORS.accentDim }}
                            thumbColor={settings.followUpEnabled ? COLORS.accent : COLORS.textTertiary}
                        />
                    </View>

                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Daily Digest</Text>
                            <Text style={styles.settingDescription}>
                                Morning summary of pending tasks and broken promises
                            </Text>
                        </View>
                        <Switch
                            value={settings.dailyDigestEnabled}
                            onValueChange={(val) => handleSave('dailyDigestEnabled', val)}
                            trackColor={{ false: COLORS.surface, true: COLORS.accentDim }}
                            thumbColor={settings.dailyDigestEnabled ? COLORS.accent : COLORS.textTertiary}
                        />
                    </View>

                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Haptic Feedback</Text>
                            <Text style={styles.settingDescription}>
                                Vibration feedback for recording and saving
                            </Text>
                        </View>
                        <Switch
                            value={settings.hapticFeedback}
                            onValueChange={(val) => handleSave('hapticFeedback', val)}
                            trackColor={{ false: COLORS.surface, true: COLORS.accentDim }}
                            thumbColor={settings.hapticFeedback ? COLORS.accent : COLORS.textTertiary}
                        />
                    </View>
                </View>

                {/* Data */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Data</Text>

                    <TouchableOpacity style={styles.dangerButton} onPress={handleClearData}>
                        <Text style={styles.dangerButtonText}>Clear All Data</Text>
                        <Text style={styles.dangerDescription}>Delete all notes, tasks, and settings</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.section}>
                    <View style={styles.debugHeader}>
                        <View>
                            <Text style={styles.sectionTitle}>Notification Debug</Text>
                            <Text style={styles.sectionDescription}>
                                Inspect what reminders are currently scheduled on this device.
                            </Text>
                        </View>
                        <View style={styles.debugActions}>
                            <TouchableOpacity style={styles.refreshButton} onPress={loadNotificationsDebug}>
                                <Text style={styles.refreshButtonText}>
                                    {loadingNotifications ? '...' : 'Refresh'}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.cancelAllButton} onPress={handleCancelAllNotifications}>
                                <Text style={styles.cancelAllButtonText}>Cancel All</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {!notificationsDebug.supported ? (
                        <Text style={styles.debugEmptyText}>
                            Scheduled notification inspection is only available on native builds.
                        </Text>
                    ) : notificationsDebug.items.length === 0 ? (
                        <Text style={styles.debugEmptyText}>
                            No pending scheduled notifications yet.
                        </Text>
                    ) : (
                        notificationsDebug.items.map((item, index) => (
                            <View key={`${item.id || 'notification'}_${index}`} style={styles.debugItem}>
                                <View style={styles.debugTypeBadge}>
                                    <Text style={styles.debugTypeText}>{item.type}</Text>
                                </View>
                                <Text style={styles.debugTitle}>{item.title}</Text>
                                {!!item.body && <Text style={styles.debugBody}>{item.body}</Text>}
                                <Text style={styles.debugTrigger}>{item.trigger}</Text>
                            </View>
                        ))
                    )}
                </View>

                {/* About */}
                <View style={styles.aboutSection}>
                    <Text style={styles.appName}>VOCALS</Text>
                    <Text style={styles.appTagline}>Voice → Execution System</Text>
                    <Text style={styles.version}>v1.0.0</Text>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.xl,
        paddingTop: SPACING.xl,
        paddingBottom: SPACING.lg,
    },
    headerTitle: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.heading,
        fontWeight: FONT_WEIGHT.bold,
    },
    savedBadge: {
        color: COLORS.success,
        fontSize: FONT_SIZE.small,
        fontWeight: FONT_WEIGHT.semibold,
    },

    // Sections
    section: {
        ...CARD_STYLE,
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.lg,
    },
    sectionTitle: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.bodyLarge,
        fontWeight: FONT_WEIGHT.semibold,
        marginBottom: SPACING.sm,
    },
    sectionDescription: {
        color: COLORS.textTertiary,
        fontSize: FONT_SIZE.small,
        lineHeight: 20,
        marginBottom: SPACING.lg,
    },
    // Settings Row
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
    },
    settingInfo: {
        flex: 1,
        marginRight: SPACING.lg,
    },
    settingLabel: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.body,
        fontWeight: FONT_WEIGHT.medium,
    },
    settingDescription: {
        color: COLORS.textTertiary,
        fontSize: FONT_SIZE.small,
        marginTop: 2,
        lineHeight: 18,
    },

    // Mode Toggle
    modeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
        marginTop: SPACING.md,
    },
    modeOption: {
        minWidth: 96,
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.sm,
    },
    modeOptionActive: {
        backgroundColor: COLORS.accentDim,
        borderColor: COLORS.accent,
    },
    modeOptionText: {
        color: COLORS.textTertiary,
        fontSize: FONT_SIZE.small,
        fontWeight: FONT_WEIGHT.medium,
        marginTop: SPACING.xs,
    },
    modeOptionTextActive: {
        color: COLORS.accent,
    },

    // Danger
    dangerButton: {
        backgroundColor: COLORS.urgentDim,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.lg,
        borderWidth: 1,
        borderColor: 'rgba(255, 59, 48, 0.3)',
    },
    dangerButtonText: {
        color: COLORS.urgent,
        fontSize: FONT_SIZE.body,
        fontWeight: FONT_WEIGHT.semibold,
    },
    dangerDescription: {
        color: COLORS.textTertiary,
        fontSize: FONT_SIZE.small,
        marginTop: SPACING.xs,
    },

    // Debug
    debugHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: SPACING.md,
    },
    debugActions: {
        alignItems: 'flex-end',
        gap: SPACING.sm,
    },
    refreshButton: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
    },
    refreshButtonText: {
        color: COLORS.accent,
        fontSize: FONT_SIZE.small,
        fontWeight: FONT_WEIGHT.semibold,
    },
    cancelAllButton: {
        backgroundColor: COLORS.urgentDim,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: 'rgba(255, 59, 48, 0.4)',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
    },
    cancelAllButtonText: {
        color: COLORS.urgent,
        fontSize: FONT_SIZE.small,
        fontWeight: FONT_WEIGHT.semibold,
    },
    debugEmptyText: {
        color: COLORS.textTertiary,
        fontSize: FONT_SIZE.small,
        lineHeight: 20,
    },
    debugItem: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        padding: SPACING.md,
        marginTop: SPACING.sm,
    },
    debugTypeBadge: {
        alignSelf: 'flex-start',
        backgroundColor: COLORS.accentDim,
        borderRadius: BORDER_RADIUS.full,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 2,
        marginBottom: SPACING.sm,
    },
    debugTypeText: {
        color: COLORS.accent,
        fontSize: FONT_SIZE.caption,
        fontWeight: FONT_WEIGHT.bold,
        textTransform: 'uppercase',
    },
    debugTitle: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.body,
        fontWeight: FONT_WEIGHT.semibold,
    },
    debugBody: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.small,
        lineHeight: 18,
        marginTop: SPACING.xs,
    },
    debugTrigger: {
        color: COLORS.textTertiary,
        fontSize: FONT_SIZE.caption,
        marginTop: SPACING.sm,
    },

    // About
    aboutSection: {
        alignItems: 'center',
        paddingVertical: SPACING.xxxl,
    },
    appName: {
        color: COLORS.accent,
        fontSize: FONT_SIZE.heading,
        fontWeight: FONT_WEIGHT.heavy,
        letterSpacing: 4,
    },
    appTagline: {
        color: COLORS.textTertiary,
        fontSize: FONT_SIZE.small,
        marginTop: SPACING.xs,
    },
    version: {
        color: COLORS.textMuted,
        fontSize: FONT_SIZE.caption,
        marginTop: SPACING.sm,
    },
});

export default SettingsScreen;
