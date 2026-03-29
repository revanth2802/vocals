// HomeScreen — Action-first dashboard
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView,
    StatusBar, Animated, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, CARD_STYLE, SHADOWS } from '../constants/theme';
import { getNotes, getAllTasks, toggleTask, deleteTask, getPromiseStats, getSettings } from '../services/storage';
import { formatRelativeTime } from '../utils/helpers';
import { generateFollowUp } from '../services/ai';
import ActionCard from '../components/ActionCard';
import TaskItem from '../components/TaskItem';
import PromiseTracker from '../components/PromiseTracker';

const FILTERS = [
    { key: 'notes', label: 'Notes' },
    { key: 'now', label: 'Today' },
    { key: 'all', label: 'Queue' },
    { key: 'ideas', label: 'Ideas' },
    { key: 'done', label: 'Done' },
];

const HomeScreen = ({ navigation }) => {
    const [notes, setNotes] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [promiseStats, setPromiseStats] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [activeFilter, setActiveFilter] = useState('now');
    const [followUpMessage, setFollowUpMessage] = useState(null);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(24)).current;

    const loadData = useCallback(async () => {
        try {
            const [notesData, tasksData, statsData] = await Promise.all([
                getNotes(),
                getAllTasks(),
                getPromiseStats(),
            ]);

            setNotes(notesData);
            setTasks(tasksData);
            setPromiseStats(statsData);

            const settings = await getSettings();
            if (settings.followUpEnabled) {
                const pendingTasks = tasksData.filter((task) => !task.completed).slice(0, 5);
                if (pendingTasks.length > 0) {
                    const nudge = await generateFollowUp(pendingTasks);
                    setFollowUpMessage(nudge);
                } else {
                    setFollowUpMessage(null);
                }
            } else {
                setFollowUpMessage(null);
            }
        } catch (e) {
            console.error('Error loading data:', e);
        }
    }, []);

    useEffect(() => {
        loadData();
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
            }),
        ]).start();
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

    const handleToggleTask = async (task) => {
        await toggleTask(task.noteId, task.id);
        await loadData();
    };

    const handleDeleteTask = async (task) => {
        await deleteTask(task.noteId, task.id);
        await loadData();
    };

    const incompleteTasks = tasks.filter((task) => !task.completed);
    const completedTasks = tasks.filter((task) => task.completed);
    const highPriorityTasks = incompleteTasks.filter((task) => task.priority === 'high');
    const overdueTasks = incompleteTasks.filter((task) => {
        if (!task.dueDescription) return false;
        const due = task.dueDescription.toLowerCase();
        return due.includes('yesterday') || due.includes('overdue');
    });
    const upcomingTasks = incompleteTasks.filter((task) => task.priority !== 'high').slice(0, 5);
    const allIdeas = notes.flatMap((note) => (note.ideas || []).map((idea) => ({
        ...idea,
        noteId: note.id,
        createdAt: note.createdAt,
    })));

    const completionRate = tasks.length > 0
        ? Math.round((completedTasks.length / tasks.length) * 100)
        : 0;

    const renderFilterBar = () => (
        <View style={styles.filterBar}>
            {FILTERS.map((filter) => (
                <TouchableOpacity
                    key={filter.key}
                    style={[styles.filterChip, activeFilter === filter.key && styles.filterChipActive]}
                    onPress={() => setActiveFilter(filter.key)}
                >
                    <Text style={[styles.filterText, activeFilter === filter.key && styles.filterTextActive]}>
                        {filter.label}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    const renderFocusSection = () => (
        <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
                <View>
                    <Text style={styles.sectionTitle}>Today's focus</Text>
                    <Text style={styles.sectionSubtitle}>A quick look at what matters now</Text>
                </View>
                <View style={styles.completionBadge}>
                    <Text style={styles.completionBadgeText}>{completionRate}%</Text>
                </View>
            </View>

            {followUpMessage?.message && (
                <View style={styles.followUpCard}>
                    <Text style={styles.followUpEyebrow}>ACCOUNTABILITY NUDGE</Text>
                    <Text style={styles.followUpMessage}>{followUpMessage.message}</Text>
                </View>
            )}

            {promiseStats && promiseStats.totalSpoken > 0 && (
                <PromiseTracker stats={promiseStats} patterns={promiseStats.patterns} />
            )}

            {overdueTasks.length > 0 && (
                <View style={styles.listSection}>
                    <Text style={styles.listTitle}>Overdue</Text>
                    {overdueTasks.map((task, index) => (
                        <TaskItem key={`${task.id || 'task'}_${index}`} task={task} onToggle={handleToggleTask} onDelete={handleDeleteTask} />
                    ))}
                </View>
            )}

            {highPriorityTasks.length > 0 && (
                <View style={styles.listSection}>
                    <Text style={styles.listTitle}>Priority tasks</Text>
                    {highPriorityTasks.map((task, index) => (
                        <TaskItem key={`${task.id || 'task'}_${index}`} task={task} onToggle={handleToggleTask} onDelete={handleDeleteTask} />
                    ))}
                </View>
            )}

            {upcomingTasks.length > 0 && (
                <View style={styles.listSection}>
                    <Text style={styles.listTitle}>Upcoming queue</Text>
                    {upcomingTasks.map((task, index) => (
                        <TaskItem key={`${task.id || 'task'}_${index}`} task={task} onToggle={handleToggleTask} onDelete={handleDeleteTask} />
                    ))}
                </View>
            )}
        </View>
    );

    const renderQueue = () => (
        <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
                <View>
                    <Text style={styles.sectionTitle}>Execution queue</Text>
                    <Text style={styles.sectionSubtitle}>{incompleteTasks.length} tasks waiting</Text>
                </View>
            </View>
            {incompleteTasks.length === 0 ? (
                <View style={styles.emptyInline}>
                    <Text style={styles.emptyInlineTitle}>Nothing pending right now</Text>
                </View>
            ) : (
                incompleteTasks.map((task, index) => (
                    <TaskItem key={`${task.id || 'task'}_${index}`} task={task} onToggle={handleToggleTask} onDelete={handleDeleteTask} />
                ))
            )}
        </View>
    );

    const renderDone = () => (
        <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
                <View>
                    <Text style={styles.sectionTitle}>Completed</Text>
                    <Text style={styles.sectionSubtitle}>What you've already closed</Text>
                </View>
            </View>
            {completedTasks.length === 0 ? (
                <View style={styles.emptyInline}>
                    <Text style={styles.emptyInlineTitle}>No completed tasks yet</Text>
                </View>
            ) : (
                completedTasks.map((task, index) => (
                    <TaskItem key={`${task.id || 'task'}_${index}`} task={task} onToggle={handleToggleTask} onDelete={handleDeleteTask} />
                ))
            )}
        </View>
    );

    const renderNotes = () => (
        <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderStandalone}>
                <Text style={styles.sectionTitle}>Captured notes</Text>
                <Text style={styles.sectionSubtitle}>Recent voice moments</Text>
            </View>
            {notes.map((note, index) => (
                <ActionCard
                    key={`${note.id || 'note'}_${index}`}
                    note={note}
                    onPress={(selectedNote) => navigation.navigate('NoteDetail', { noteId: selectedNote.id })}
                />
            ))}
        </View>
    );

    const renderIdeas = () => (
        <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
                <View>
                    <Text style={styles.sectionTitle}>Idea stream</Text>
                    <Text style={styles.sectionSubtitle}>Thoughts worth turning into action</Text>
                </View>
            </View>
            {allIdeas.length === 0 ? (
                <View style={styles.emptyInline}>
                    <Text style={styles.emptyInlineTitle}>No ideas yet</Text>
                    <Text style={styles.emptyInlineBody}>Use Idea or Brain Dump mode to fill this up.</Text>
                </View>
            ) : (
                allIdeas.map((idea, index) => (
                    <View key={`${idea.id || 'idea'}_${index}`} style={styles.ideaCard}>
                        <Text style={styles.ideaText}>{idea.text}</Text>
                        <Text style={styles.ideaTime}>{formatRelativeTime(idea.createdAt)}</Text>
                    </View>
                ))
            )}
        </View>
    );

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <View style={styles.emptyIconBadge}>
                <Ionicons name="mic-outline" size={28} color={COLORS.accent} />
            </View>
            <Text style={styles.emptyTitle}>No voice notes yet</Text>
            <Text style={styles.emptySubtitle}>
                Start with a quick capture and VOCALS will turn it into a clean dashboard.
            </Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => navigation.navigate('Record')}>
                <Text style={styles.emptyButtonText}>Start Recording</Text>
            </TouchableOpacity>
        </View>
    );

    const renderActivePanel = () => {
        if (notes.length === 0 && tasks.length === 0) {
            return renderEmptyState();
        }

        if (activeFilter === 'now') return renderFocusSection();
        if (activeFilter === 'all') return renderQueue();
        if (activeFilter === 'done') return renderDone();
        if (activeFilter === 'notes') return renderNotes();
        return renderIdeas();
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            <Animated.View
                style={[
                    styles.animatedContainer,
                    {
                        opacity: fadeAnim,
                        transform: [{ translateY: slideAnim }],
                    },
                ]}
            >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
                    }
                >
                    {renderFilterBar()}
                    {renderActivePanel()}
                    <View style={{ height: 140 }} />
                </ScrollView>
            </Animated.View>

            <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('Record')} activeOpacity={0.85}>
                <View style={styles.fabIconBadge}>
                    <Ionicons name="mic" size={16} color="#FFFFFF" />
                </View>
                <Text style={styles.fabText}>Record</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    animatedContainer: {
        flex: 1,
    },
    filterBar: {
        flexDirection: 'row',
        marginTop: SPACING.lg,
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.lg,
        backgroundColor: COLORS.cardElevated,
        borderRadius: BORDER_RADIUS.full,
        padding: SPACING.xs,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    filterChip: {
        flex: 1,
        alignItems: 'center',
        borderRadius: BORDER_RADIUS.full,
        paddingVertical: SPACING.sm,
    },
    filterChipActive: {
        backgroundColor: COLORS.card,
        ...SHADOWS.card,
    },
    filterText: {
        color: COLORS.textTertiary,
        fontSize: FONT_SIZE.small,
        fontWeight: FONT_WEIGHT.medium,
    },
    filterTextActive: {
        color: COLORS.accent,
        fontWeight: FONT_WEIGHT.semibold,
    },
    sectionCard: {
        ...CARD_STYLE,
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.lg,
        padding: SPACING.xl,
    },
    sectionBlock: {
        marginBottom: SPACING.lg,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    sectionHeaderStandalone: {
        paddingHorizontal: SPACING.xl,
        marginBottom: SPACING.sm,
    },
    sectionTitle: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.subtitle,
        fontWeight: FONT_WEIGHT.bold,
    },
    sectionSubtitle: {
        color: COLORS.textTertiary,
        fontSize: FONT_SIZE.small,
        marginTop: SPACING.xs,
    },
    completionBadge: {
        backgroundColor: COLORS.successDim,
        borderRadius: BORDER_RADIUS.full,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
    },
    completionBadgeText: {
        color: COLORS.success,
        fontSize: FONT_SIZE.small,
        fontWeight: FONT_WEIGHT.bold,
    },
    followUpCard: {
        backgroundColor: '#F5F1FF',
        borderRadius: BORDER_RADIUS.xl,
        padding: SPACING.lg,
        marginBottom: SPACING.lg,
    },
    followUpEyebrow: {
        color: COLORS.accent,
        fontSize: FONT_SIZE.caption,
        fontWeight: FONT_WEIGHT.bold,
        letterSpacing: 1.2,
        marginBottom: SPACING.sm,
    },
    followUpMessage: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.bodyLarge,
        lineHeight: 24,
        fontWeight: FONT_WEIGHT.medium,
    },
    listSection: {
        marginTop: SPACING.lg,
    },
    listTitle: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.bodyLarge,
        fontWeight: FONT_WEIGHT.semibold,
        marginBottom: SPACING.sm,
    },
    emptyInline: {
        alignItems: 'center',
        paddingVertical: SPACING.xxl,
    },
    emptyInlineTitle: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.bodyLarge,
        fontWeight: FONT_WEIGHT.semibold,
    },
    emptyInlineBody: {
        color: COLORS.textTertiary,
        fontSize: FONT_SIZE.small,
        marginTop: SPACING.xs,
    },
    ideaCard: {
        backgroundColor: COLORS.cardElevated,
        borderRadius: BORDER_RADIUS.xl,
        padding: SPACING.lg,
        marginBottom: SPACING.sm,
    },
    ideaText: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.bodyLarge,
        fontWeight: FONT_WEIGHT.medium,
        lineHeight: 24,
    },
    ideaTime: {
        color: COLORS.textTertiary,
        fontSize: FONT_SIZE.caption,
        marginTop: SPACING.sm,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.massive,
        paddingHorizontal: SPACING.xxxl,
    },
    emptyIconBadge: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F1EDFF',
        marginBottom: SPACING.xl,
    },
    emptyTitle: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.title,
        fontWeight: FONT_WEIGHT.bold,
        marginBottom: SPACING.sm,
    },
    emptySubtitle: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.body,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: SPACING.xl,
    },
    emptyButton: {
        backgroundColor: COLORS.accent,
        borderRadius: BORDER_RADIUS.full,
        paddingHorizontal: SPACING.xxl,
        paddingVertical: SPACING.md,
        ...SHADOWS.glow(COLORS.accent),
    },
    emptyButtonText: {
        color: '#FFFFFF',
        fontSize: FONT_SIZE.body,
        fontWeight: FONT_WEIGHT.bold,
    },
    fab: {
        position: 'absolute',
        right: SPACING.lg,
        bottom: 104,
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        backgroundColor: COLORS.accent,
        borderRadius: BORDER_RADIUS.full,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        ...SHADOWS.glow(COLORS.accent),
    },
    fabIconBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.16)',
    },
    fabText: {
        color: '#FFFFFF',
        fontSize: FONT_SIZE.body,
        fontWeight: FONT_WEIGHT.bold,
    },
});

export default HomeScreen;
