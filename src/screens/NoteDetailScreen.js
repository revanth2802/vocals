// NoteDetailScreen — View full note with all structured data
import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView,
    StatusBar, Alert, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, CARD_STYLE } from '../constants/theme';
import { getNotes, toggleTask, deleteTask, deleteNote } from '../services/storage';
import { formatRelativeTime, getCategoryIconName, getCategoryLabel, getPriorityColor } from '../utils/helpers';
import { getCaptureMode } from '../constants/captureModes';
import TaskItem from '../components/TaskItem';

const NoteDetailScreen = ({ route, navigation }) => {
    const { noteId } = route.params;
    const [note, setNote] = useState(null);

    const loadNote = async () => {
        const notes = await getNotes();
        const found = notes.find(n => n.id === noteId);
        setNote(found);
    };

    useEffect(() => {
        loadNote();
    }, [noteId]);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', loadNote);
        return unsubscribe;
    }, [navigation]);

    if (!note) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" />
                <View style={styles.loading}>
                    <Text style={styles.loadingText}>Loading...</Text>
                </View>
            </SafeAreaView>
        );
    }

    const handleToggleTask = async (task) => {
        await toggleTask(note.id, task.id);
        await loadNote();
    };

    const handleDeleteTask = async (task) => {
        await deleteTask(note.id, task.id);
        await loadNote();
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete Note',
            'This will permanently delete this note and all its tasks.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        await deleteNote(note.id);
                        navigation.goBack();
                    },
                },
            ]
        );
    };

    const handleShare = async () => {
        const taskList = (note.tasks || []).map(t => `${t.completed ? '[Done]' : '[Open]'} ${t.text}`).join('\n');
        const ideaList = (note.ideas || []).map(i => `Idea: ${i.text}`).join('\n');

        const message = [
            `${note.title}`,
            '',
            note.summary,
            '',
            taskList ? `Tasks:\n${taskList}` : '',
            ideaList ? `\nIdeas:\n${ideaList}` : '',
            '',
            '— Sent from VOCALS',
        ].filter(Boolean).join('\n');

        try {
            await Share.share({ message });
        } catch (e) {
            console.error('Share error:', e);
        }
    };

    const completedTasks = (note.tasks || []).filter(t => t.completed).length;
    const totalTasks = (note.tasks || []).length;
    const progress = totalTasks > 0 ? completedTasks / totalTasks : 0;
    const captureMode = getCaptureMode(note.mode);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={22} color={COLORS.accent} />
                </TouchableOpacity>
                <View style={styles.headerActions}>
                    <TouchableOpacity onPress={handleShare} style={styles.headerButton}>
                        <Ionicons name="share-outline" size={18} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
                        <Ionicons name="trash-outline" size={18} color={COLORS.urgent} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Meta */}
                <View style={styles.metaRow}>
                    <View style={styles.categoryBadge}>
                        <Ionicons name={getCategoryIconName(note.category)} size={14} color={COLORS.textSecondary} />
                        <Text style={styles.categoryText}>{getCategoryLabel(note.category)}</Text>
                    </View>
                    <View style={[styles.priorityBadge, {
                        backgroundColor: note.priority === 'high' ? COLORS.urgentDim :
                            note.priority === 'medium' ? COLORS.warningDim : COLORS.infoDim,
                    }]}>
                        <Text style={[styles.priorityText, { color: getPriorityColor(note.priority) }]}>
                            {note.priority}
                        </Text>
                    </View>
                    <Text style={styles.timeText}>{formatRelativeTime(note.createdAt)}</Text>
                </View>

                {/* Title */}
                <Text style={styles.title}>{note.title}</Text>

                {/* Summary */}
                {note.summary && (
                    <Text style={styles.summary}>{note.summary}</Text>
                )}

                <View style={styles.modeCard}>
                    <Text style={styles.modeCardEyebrow}>CAPTURE MOMENT</Text>
                    <View style={styles.modeCardTitleRow}>
                        <Ionicons name={captureMode.iconName} size={18} color={COLORS.accent} />
                        <Text style={styles.modeCardTitle}>{captureMode.label}</Text>
                    </View>
                    <Text style={styles.modeCardSubtitle}>
                        {note.modeSummary || captureMode.subtitle}
                    </Text>
                </View>

                {/* Task Progress */}
                {totalTasks > 0 && (
                    <View style={styles.progressCard}>
                        <View style={styles.progressHeader}>
                            <Text style={styles.progressTitle}>Task Progress</Text>
                            <Text style={styles.progressCount}>{completedTasks}/{totalTasks}</Text>
                        </View>
                        <View style={styles.progressBar}>
                            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                        </View>
                    </View>
                )}

                {/* Tasks */}
                {note.tasks?.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>TASKS</Text>
                        <View style={styles.taskList}>
                            {note.tasks.map((task, idx) => (
                                <TaskItem
                                    key={`${task.id || 'task'}_${idx}`}
                                    task={task}
                                    onToggle={handleToggleTask}
                                    onDelete={handleDeleteTask}
                                />
                            ))}
                        </View>
                    </View>
                )}

                {/* Reminders */}
                {note.reminders?.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>REMINDERS</Text>
                        {note.reminders.map((rem, idx) => (
                            <View key={`${rem.id || 'reminder'}_${idx}`} style={styles.reminderCard}>
                                <Text style={styles.reminderText}>{rem.text}</Text>
                                <Text style={styles.reminderTime}>{rem.timeDescription}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Ideas */}
                {note.ideas?.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>IDEAS</Text>
                        {note.ideas.map((idea, idx) => (
                            <View key={`${idea.id || 'idea'}_${idx}`} style={styles.ideaCard}>
                                <Text style={styles.ideaText}>{idea.text}</Text>
                                <View style={styles.tagRow}>
                                    {idea.tags?.map((tag, i) => (
                                        <View key={i} style={styles.tag}>
                                            <Text style={styles.tagText}>#{tag}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Vague Items */}
                {note.vagueItems?.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>NEEDS CLARITY</Text>
                        {note.vagueItems.map((item, idx) => (
                            <View key={idx} style={styles.vagueCard}>
                                <Text style={styles.vagueOriginal}>"{item.original}"</Text>
                                <Text style={styles.vagueQuestion}>{item.clarifyQuestion}</Text>
                                <View style={styles.suggestionRow}>
                                    {item.suggestions?.map((sug, i) => (
                                        <TouchableOpacity key={i} style={styles.suggestionButton}>
                                            <Text style={styles.suggestionText}>{sug}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Entities */}
                {note.entities?.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>MENTIONED</Text>
                        <View style={styles.entityRow}>
                            {note.entities.map((entity, idx) => (
                                <View key={idx} style={styles.entityBadge}>
                                    <Text style={styles.entityText}>{entity}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Transcript */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>ORIGINAL TRANSCRIPT</Text>
                    <View style={styles.transcriptCard}>
                        <Text style={styles.transcriptText}>{note.transcript}</Text>
                    </View>
                </View>

                <View style={{ height: 60 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    loading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.body,
    },

    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.md,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.card,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    headerActions: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    headerButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.card,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },

    // Meta
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.xl,
        gap: SPACING.sm,
        marginBottom: SPACING.md,
    },
    categoryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.card,
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.sm,
        gap: SPACING.xs,
    },
    categoryText: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.caption,
        fontWeight: FONT_WEIGHT.medium,
    },
    priorityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.sm,
        gap: SPACING.xs,
    },
    priorityText: {
        fontSize: FONT_SIZE.caption,
        fontWeight: FONT_WEIGHT.medium,
        textTransform: 'capitalize',
    },
    timeText: {
        color: COLORS.textTertiary,
        fontSize: FONT_SIZE.caption,
        marginLeft: 'auto',
    },

    // Title & Summary
    title: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.hero,
        fontWeight: FONT_WEIGHT.bold,
        paddingHorizontal: SPACING.xl,
        marginBottom: SPACING.sm,
    },
    summary: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.body,
        lineHeight: 24,
        paddingHorizontal: SPACING.xl,
        marginBottom: SPACING.lg,
    },
    modeCard: {
        ...CARD_STYLE,
        marginHorizontal: SPACING.xl,
        marginBottom: SPACING.xxl,
    },
    modeCardEyebrow: {
        color: COLORS.textTertiary,
        fontSize: FONT_SIZE.caption,
        fontWeight: FONT_WEIGHT.bold,
        letterSpacing: 1.5,
        marginBottom: SPACING.sm,
    },
    modeCardTitle: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.subtitle,
        fontWeight: FONT_WEIGHT.bold,
    },
    modeCardTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginBottom: SPACING.xs,
    },
    modeCardSubtitle: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.body,
        lineHeight: 22,
    },

    // Progress
    progressCard: {
        ...CARD_STYLE,
        marginHorizontal: SPACING.xl,
        marginBottom: SPACING.xxl,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: SPACING.sm,
    },
    progressTitle: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.small,
        fontWeight: FONT_WEIGHT.semibold,
    },
    progressCount: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.small,
        fontWeight: FONT_WEIGHT.bold,
    },
    progressBar: {
        height: 6,
        backgroundColor: COLORS.surface,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: COLORS.success,
        borderRadius: 3,
    },

    // Sections
    section: {
        marginBottom: SPACING.xxl,
    },
    sectionLabel: {
        color: COLORS.textTertiary,
        fontSize: FONT_SIZE.caption,
        fontWeight: FONT_WEIGHT.bold,
        letterSpacing: 1.5,
        paddingHorizontal: SPACING.xl,
        marginBottom: SPACING.md,
    },
    taskList: {
        backgroundColor: COLORS.card,
        marginHorizontal: SPACING.xl,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        overflow: 'hidden',
    },

    // Reminders
    reminderCard: {
        ...CARD_STYLE,
        marginHorizontal: SPACING.xl,
        marginBottom: SPACING.sm,
    },
    reminderText: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.body,
        fontWeight: FONT_WEIGHT.medium,
    },
    reminderTime: {
        color: COLORS.warning,
        fontSize: FONT_SIZE.small,
        marginTop: SPACING.xs,
    },

    // Ideas
    ideaCard: {
        ...CARD_STYLE,
        marginHorizontal: SPACING.xl,
        marginBottom: SPACING.sm,
    },
    ideaText: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.body,
        fontWeight: FONT_WEIGHT.medium,
        lineHeight: 22,
    },
    tagRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
        marginTop: SPACING.sm,
    },
    tag: {
        backgroundColor: COLORS.infoDim,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 2,
        borderRadius: BORDER_RADIUS.sm,
    },
    tagText: {
        color: COLORS.info,
        fontSize: FONT_SIZE.caption,
    },

    // Vague
    vagueCard: {
        ...CARD_STYLE,
        marginHorizontal: SPACING.xl,
        marginBottom: SPACING.sm,
        borderColor: COLORS.warning,
    },
    vagueOriginal: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.body,
        fontStyle: 'italic',
        marginBottom: SPACING.sm,
    },
    vagueQuestion: {
        color: COLORS.warning,
        fontSize: FONT_SIZE.body,
        fontWeight: FONT_WEIGHT.medium,
        marginBottom: SPACING.md,
    },
    suggestionRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
        flexWrap: 'wrap',
    },
    suggestionButton: {
        backgroundColor: COLORS.warningDim,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.full,
        borderWidth: 1,
        borderColor: COLORS.warning,
    },
    suggestionText: {
        color: COLORS.warning,
        fontSize: FONT_SIZE.small,
        fontWeight: FONT_WEIGHT.medium,
    },

    // Entities
    entityRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
        paddingHorizontal: SPACING.xl,
    },
    entityBadge: {
        backgroundColor: COLORS.accentDim,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.full,
    },
    entityText: {
        color: COLORS.accent,
        fontSize: FONT_SIZE.small,
        fontWeight: FONT_WEIGHT.medium,
    },

    // Transcript
    transcriptCard: {
        ...CARD_STYLE,
        marginHorizontal: SPACING.xl,
        backgroundColor: COLORS.surface,
    },
    transcriptText: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.body,
        lineHeight: 24,
        fontStyle: 'italic',
    },

});

export default NoteDetailScreen;
