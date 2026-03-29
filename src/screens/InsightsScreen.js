import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView, StatusBar, RefreshControl, TouchableOpacity, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, CARD_STYLE } from '../constants/theme';
import { getNotes, getAllTasks } from '../services/storage';

const MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

const isSameMonth = (left, right) =>
    left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();

const getMonthCounts = (notes = [], visibleMonth) => {
    const counts = {};

    notes.forEach((note) => {
        const date = new Date(note.createdAt);
        if (!isSameMonth(date, visibleMonth)) return;

        const key = date.toISOString().slice(0, 10);
        counts[key] = (counts[key] || 0) + 1;
    });

    return counts;
};

const buildMonthGrid = (visibleMonth, counts) => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const leadingEmpty = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const cells = [];

    for (let index = 0; index < leadingEmpty; index += 1) {
        cells.push({ key: `empty_start_${index}`, empty: true });
    }

    for (let day = 1; day <= totalDays; day += 1) {
        const date = new Date(year, month, day);
        const key = date.toISOString().slice(0, 10);
        cells.push({
            key,
            empty: false,
            day,
            count: counts[key] || 0,
            isToday: key === new Date().toISOString().slice(0, 10),
        });
    }

    while (cells.length % 7 !== 0) {
        cells.push({ key: `empty_end_${cells.length}`, empty: true });
    }

    return cells;
};

const getCellTone = (count, maxCount) => {
    if (count === 0 || maxCount === 0) return COLORS.cardElevated;

    const intensity = count / maxCount;
    if (intensity >= 0.85) return '#1F9D55';
    if (intensity >= 0.55) return '#32B768';
    if (intensity >= 0.25) return '#70D69B';
    return '#BEEED1';
};

const toDateKey = (date) => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized.toISOString().slice(0, 10);
};

const formatReadableDate = (dateKey) => {
    const date = new Date(dateKey);
    return `${MONTH_LABELS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
};

const getTodaySummary = (notes = [], tasks = []) => {
    const todayKey = toDateKey(new Date());
    const notesToday = notes.filter((note) => toDateKey(note.createdAt) === todayKey);
    const tasksCreatedToday = notesToday.reduce((sum, note) => sum + (note.tasks?.length || 0), 0);
    const tasksCompletedToday = tasks.filter((task) => task.completed && task.completedAt && toDateKey(task.completedAt) === todayKey).length;

    return {
        notesToday: notesToday.length,
        tasksCreatedToday,
        tasksCompletedToday,
    };
};

const getStreakData = (notes = []) => {
    const activeKeys = [...new Set(notes.map((note) => toDateKey(note.createdAt)))].sort();
    if (activeKeys.length === 0) {
        return { currentStreak: 0, bestStreak: 0, lastActiveDate: null };
    }

    let bestStreak = 0;
    let runningStreak = 0;
    let previousDate = null;

    activeKeys.forEach((key) => {
        const currentDate = new Date(key);
        if (!previousDate) {
            runningStreak = 1;
        } else {
            const diffDays = Math.round((currentDate - previousDate) / 86400000);
            runningStreak = diffDays === 1 ? runningStreak + 1 : 1;
        }
        bestStreak = Math.max(bestStreak, runningStreak);
        previousDate = currentDate;
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastActiveDate = new Date(activeKeys[activeKeys.length - 1]);
    const daysSinceLastActive = Math.round((today - lastActiveDate) / 86400000);
    const currentStreak = daysSinceLastActive <= 1 ? runningStreak : 0;

    return {
        currentStreak,
        bestStreak,
        lastActiveDate: activeKeys[activeKeys.length - 1],
    };
};

const InsightsScreen = ({ navigation }) => {
    const [notes, setNotes] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [visibleMonth, setVisibleMonth] = useState(startOfMonth(new Date()));
    const [selectedDateKey, setSelectedDateKey] = useState(toDateKey(new Date()));
    const { width } = useWindowDimensions();

    const loadData = useCallback(async () => {
        const [notesData, tasksData] = await Promise.all([
            getNotes(),
            getAllTasks(),
        ]);
        setNotes(notesData);
        setTasks(tasksData);
    }, []);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', loadData);
        return unsubscribe;
    }, [navigation, loadData]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const monthCounts = useMemo(() => getMonthCounts(notes, visibleMonth), [notes, visibleMonth]);
    const monthCells = useMemo(() => buildMonthGrid(visibleMonth, monthCounts), [visibleMonth, monthCounts]);
    const maxCount = Math.max(...Object.values(monthCounts), 0);
    const totalNotesThisMonth = Object.values(monthCounts).reduce((sum, count) => sum + count, 0);
    const activeDaysThisMonth = Object.values(monthCounts).filter((count) => count > 0).length;
    const totalTasks = tasks.length;
    const todaySummary = useMemo(() => getTodaySummary(notes, tasks), [notes, tasks]);
    const streakData = useMemo(() => getStreakData(notes), [notes]);
    const selectedNotes = useMemo(
        () => notes.filter((note) => toDateKey(note.createdAt) === selectedDateKey),
        [notes, selectedDateKey]
    );
    const selectedTasks = useMemo(
        () => selectedNotes.reduce((sum, note) => sum + (note.tasks?.length || 0), 0),
        [selectedNotes]
    );
    const selectedCompletedTasks = useMemo(
        () => selectedNotes.reduce((sum, note) => sum + ((note.tasks || []).filter((task) => task.completed).length), 0),
        [selectedNotes]
    );

    const horizontalPadding = SPACING.lg * 2;
    const calendarInnerPadding = SPACING.lg * 2;
    const cellGap = 8;
    const availableWidth = width - horizontalPadding - calendarInnerPadding;
    const cellSize = Math.max(34, Math.min(46, Math.floor((availableWidth - (cellGap * 6)) / 7)));

    const currentMonth = startOfMonth(new Date());
    const isCurrentMonthVisible = isSameMonth(visibleMonth, currentMonth);

    const handlePreviousMonth = () => {
        setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        if (isCurrentMonthVisible) return;
        setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
                }
            >
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Activity</Text>
                    <Text style={styles.headerSubtitle}>Your note activity this month.</Text>
                </View>

                <View style={styles.summaryRow}>
                    <View style={styles.summaryCard}>
                        <Text style={styles.summaryCardLabel}>Today</Text>
                        <Text style={styles.summaryCardValue}>{todaySummary.notesToday}</Text>
                        <Text style={styles.summaryCardMeta}>
                            {todaySummary.tasksCreatedToday} created · {todaySummary.tasksCompletedToday} done
                        </Text>
                    </View>

                    <View style={styles.summaryCard}>
                        <Text style={styles.summaryCardLabel}>Streak</Text>
                        <Text style={styles.summaryCardValue}>{streakData.currentStreak}</Text>
                        <Text style={styles.summaryCardMeta}>
                            Best {streakData.bestStreak} days
                        </Text>
                    </View>
                </View>

                <View style={styles.calendarCard}>
                    <View style={styles.calendarHeader}>
                        <TouchableOpacity style={styles.navButton} onPress={handlePreviousMonth} activeOpacity={0.8}>
                            <Ionicons name="chevron-back" size={18} color={COLORS.textPrimary} />
                        </TouchableOpacity>

                        <View style={styles.monthHeading}>
                            <Text style={styles.monthTitle}>
                                {MONTH_LABELS[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
                            </Text>
                            <Text style={styles.monthMeta}>
                                {totalNotesThisMonth} notes · {activeDaysThisMonth} active days
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.navButton, isCurrentMonthVisible && styles.navButtonDisabled]}
                            onPress={handleNextMonth}
                            disabled={isCurrentMonthVisible}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="chevron-forward" size={18} color={isCurrentMonthVisible ? COLORS.textMuted : COLORS.textPrimary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.dayHeaderRow}>
                        {DAY_LABELS.map((day) => (
                            <Text key={day} style={styles.dayHeaderText}>{day}</Text>
                        ))}
                    </View>

                    <View style={[styles.grid, { gap: cellGap }]}>
                        {monthCells.map((cell) => {
                            if (cell.empty) {
                                return <View key={cell.key} style={{ width: cellSize, height: cellSize }} />;
                            }

                            return (
                                <TouchableOpacity
                                    key={cell.key}
                                    activeOpacity={0.82}
                                    onPress={() => setSelectedDateKey(cell.key)}
                                    style={[
                                        styles.dayCell,
                                        {
                                            width: cellSize,
                                            height: cellSize,
                                            backgroundColor: getCellTone(cell.count, maxCount),
                                        },
                                        cell.isToday && styles.todayCell,
                                        selectedDateKey === cell.key && styles.selectedCell,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.dayNumber,
                                            cell.count > 0 && styles.dayNumberActive,
                                            cell.isToday && styles.todayNumber,
                                            selectedDateKey === cell.key && styles.selectedDayNumber,
                                        ]}
                                    >
                                        {cell.day}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <View style={styles.legendRow}>
                        <Text style={styles.legendLabel}>Less</Text>
                        <View style={[styles.legendCell, { backgroundColor: COLORS.cardElevated }]} />
                        <View style={[styles.legendCell, { backgroundColor: '#BEEED1' }]} />
                        <View style={[styles.legendCell, { backgroundColor: '#70D69B' }]} />
                        <View style={[styles.legendCell, { backgroundColor: '#32B768' }]} />
                        <View style={[styles.legendCell, { backgroundColor: '#1F9D55' }]} />
                        <Text style={styles.legendLabel}>More</Text>
                    </View>

                    <Text style={styles.footerText}>
                        {totalTasks} tasks extracted across all saved notes.
                    </Text>
                </View>

                <View style={styles.dayDetailCard}>
                    <Text style={styles.dayDetailLabel}>Selected day</Text>
                    <Text style={styles.dayDetailTitle}>{formatReadableDate(selectedDateKey)}</Text>
                    <Text style={styles.dayDetailMeta}>
                        {selectedNotes.length} notes · {selectedTasks} tasks · {selectedCompletedTasks} completed
                    </Text>

                    {selectedNotes.length === 0 ? (
                        <Text style={styles.dayDetailEmpty}>No notes captured on this day.</Text>
                    ) : (
                        selectedNotes.slice(0, 4).map((note) => (
                            <View key={note.id} style={styles.dayDetailRow}>
                                <View style={styles.dayDetailBullet} />
                                <View style={styles.dayDetailContent}>
                                    <Text style={styles.dayDetailNoteTitle} numberOfLines={1}>
                                        {note.title || 'Untitled Note'}
                                    </Text>
                                    <Text style={styles.dayDetailNoteMeta}>
                                        {(note.tasks || []).length} tasks
                                    </Text>
                                </View>
                            </View>
                        ))
                    )}
                </View>

                <View style={{ height: 120 }} />
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
        paddingHorizontal: SPACING.xl,
        paddingTop: SPACING.xl,
        paddingBottom: SPACING.lg,
    },
    headerTitle: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.heading,
        fontWeight: FONT_WEIGHT.bold,
    },
    headerSubtitle: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.body,
        marginTop: SPACING.xs,
    },
    summaryRow: {
        flexDirection: 'row',
        gap: SPACING.md,
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.lg,
    },
    summaryCard: {
        ...CARD_STYLE,
        flex: 1,
        padding: SPACING.lg,
    },
    summaryCardLabel: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.small,
        fontWeight: FONT_WEIGHT.medium,
    },
    summaryCardValue: {
        color: COLORS.textPrimary,
        fontSize: 30,
        fontWeight: FONT_WEIGHT.heavy,
        marginTop: SPACING.sm,
    },
    summaryCardMeta: {
        color: COLORS.textTertiary,
        fontSize: FONT_SIZE.small,
        marginTop: SPACING.xs,
        lineHeight: 18,
    },
    calendarCard: {
        ...CARD_STYLE,
        marginHorizontal: SPACING.lg,
        padding: SPACING.lg,
    },
    calendarHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: SPACING.lg,
    },
    navButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.cardElevated,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    navButtonDisabled: {
        backgroundColor: COLORS.surface,
    },
    monthHeading: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
    },
    monthTitle: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.title,
        fontWeight: FONT_WEIGHT.bold,
        textAlign: 'center',
    },
    monthMeta: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.small,
        marginTop: SPACING.xs,
        textAlign: 'center',
    },
    dayHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: SPACING.sm,
    },
    dayHeaderText: {
        flex: 1,
        textAlign: 'center',
        color: COLORS.textTertiary,
        fontSize: 12,
        fontWeight: FONT_WEIGHT.medium,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    dayCell: {
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    todayCell: {
        borderWidth: 2,
        borderColor: COLORS.accent,
    },
    selectedCell: {
        borderWidth: 2,
        borderColor: COLORS.textPrimary,
    },
    dayNumber: {
        color: COLORS.textTertiary,
        fontSize: FONT_SIZE.small,
        fontWeight: FONT_WEIGHT.medium,
    },
    dayNumberActive: {
        color: '#0E3B22',
        fontWeight: FONT_WEIGHT.bold,
    },
    todayNumber: {
        color: COLORS.accent,
    },
    selectedDayNumber: {
        color: COLORS.textPrimary,
        fontWeight: FONT_WEIGHT.bold,
    },
    legendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: SPACING.md,
    },
    legendLabel: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.small,
        fontWeight: FONT_WEIGHT.medium,
    },
    legendCell: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    footerText: {
        color: COLORS.textTertiary,
        fontSize: FONT_SIZE.small,
        marginTop: SPACING.md,
        textAlign: 'center',
    },
    dayDetailCard: {
        ...CARD_STYLE,
        marginHorizontal: SPACING.lg,
        marginTop: SPACING.lg,
    },
    dayDetailLabel: {
        color: COLORS.textTertiary,
        fontSize: FONT_SIZE.caption,
        fontWeight: FONT_WEIGHT.bold,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
    },
    dayDetailTitle: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.title,
        fontWeight: FONT_WEIGHT.bold,
        marginTop: SPACING.sm,
    },
    dayDetailMeta: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.small,
        marginTop: SPACING.xs,
        marginBottom: SPACING.md,
    },
    dayDetailEmpty: {
        color: COLORS.textTertiary,
        fontSize: FONT_SIZE.body,
        lineHeight: 22,
    },
    dayDetailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        borderTopWidth: 1,
        borderTopColor: COLORS.divider,
    },
    dayDetailBullet: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.accent,
        marginRight: SPACING.md,
    },
    dayDetailContent: {
        flex: 1,
    },
    dayDetailNoteTitle: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.body,
        fontWeight: FONT_WEIGHT.medium,
    },
    dayDetailNoteMeta: {
        color: COLORS.textTertiary,
        fontSize: FONT_SIZE.small,
        marginTop: 2,
    },
});

export default InsightsScreen;
