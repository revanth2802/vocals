// ActionCard — Card component for notes/actions in the feed
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, CARD_STYLE, SHADOWS } from '../constants/theme';
import { formatRelativeTime, getCategoryIconName, getCategoryLabel, truncateText } from '../utils/helpers';
import { getCaptureMode } from '../constants/captureModes';

const ActionCard = ({ note, onPress }) => {
    const taskCount = note.tasks?.length || 0;
    const completedTasks = note.tasks?.filter(t => t.completed).length || 0;
    const ideaCount = note.ideas?.length || 0;
    const reminderCount = note.reminders?.length || 0;
    const captureMode = getCaptureMode(note.mode);

    const progress = taskCount > 0 ? completedTasks / taskCount : 0;

    return (
        <TouchableOpacity
            style={styles.card}
            onPress={() => onPress && onPress(note)}
            activeOpacity={0.7}
        >
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerBadges}>
                    <View style={styles.categoryBadge}>
                        <Ionicons name={getCategoryIconName(note.category)} size={14} color={COLORS.textSecondary} />
                        <Text style={styles.categoryText}>
                            {getCategoryLabel(note.category)}
                        </Text>
                    </View>
                    <View style={styles.modeBadge}>
                        <Ionicons name={captureMode.iconName} size={14} color={COLORS.accent} />
                        <Text style={styles.modeBadgeText}>{captureMode.shortLabel}</Text>
                    </View>
                </View>
                <Text style={styles.time}>{formatRelativeTime(note.createdAt)}</Text>
            </View>

            {/* Title */}
            <Text style={styles.title} numberOfLines={1}>{note.title || 'Untitled Note'}</Text>

            {/* Summary */}
            {note.summary && (
                <Text style={styles.summary} numberOfLines={2}>
                    {truncateText(note.summary, 120)}
                </Text>
            )}

            {/* Task Progress */}
            {taskCount > 0 && (
                <View style={styles.progressSection}>
                    <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                    </View>
                    <Text style={styles.progressText}>
                        {completedTasks}/{taskCount} tasks
                    </Text>
                </View>
            )}

            {/* Stats Row */}
            <View style={styles.stats}>
                {taskCount > 0 && (
                    <View style={styles.stat}>
                        <Text style={styles.statText}>{taskCount} tasks</Text>
                    </View>
                )}
                {ideaCount > 0 && (
                    <View style={styles.stat}>
                        <Text style={styles.statText}>{ideaCount} ideas</Text>
                    </View>
                )}
                {reminderCount > 0 && (
                    <View style={styles.stat}>
                        <Text style={styles.statText}>{reminderCount} reminders</Text>
                    </View>
                )}
                {note.priority === 'high' && (
                    <View style={[styles.stat, styles.urgentStat]}>
                        <Text style={[styles.statText, { color: COLORS.urgent }]}>Urgent</Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        ...CARD_STYLE,
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.md,
        padding: SPACING.xl,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: SPACING.sm,
        gap: SPACING.sm,
    },
    headerBadges: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        flexWrap: 'wrap',
        flex: 1,
    },
    categoryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.cardElevated,
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.full,
        gap: SPACING.xs,
    },
    categoryIcon: {
        fontSize: 12,
    },
    categoryText: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.caption,
        fontWeight: FONT_WEIGHT.medium,
    },
    modeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1EDFF',
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.full,
        gap: SPACING.xs,
    },
    modeBadgeText: {
        color: COLORS.accent,
        fontSize: FONT_SIZE.caption,
        fontWeight: FONT_WEIGHT.medium,
    },
    time: {
        color: COLORS.textTertiary,
        fontSize: FONT_SIZE.caption,
        marginTop: SPACING.xs,
    },
    title: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.bodyLarge,
        fontWeight: FONT_WEIGHT.semibold,
        marginBottom: SPACING.xs,
    },
    summary: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.small,
        lineHeight: 20,
        marginBottom: SPACING.md,
    },
    progressSection: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.md,
        gap: SPACING.sm,
    },
    progressBar: {
        flex: 1,
        height: 6,
        backgroundColor: COLORS.cardElevated,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: COLORS.success,
        borderRadius: 2,
    },
    progressText: {
        color: COLORS.textTertiary,
        fontSize: FONT_SIZE.caption,
        fontWeight: FONT_WEIGHT.medium,
    },
    stats: {
        flexDirection: 'row',
        gap: SPACING.md,
        flexWrap: 'wrap',
    },
    stat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    statText: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.caption,
        fontWeight: FONT_WEIGHT.medium,
    },
    urgentStat: {
        backgroundColor: COLORS.urgentDim,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.full,
    },
});

export default ActionCard;
