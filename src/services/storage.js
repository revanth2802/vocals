// Local Storage Service — AsyncStorage wrapper for all app data
import AsyncStorage from '@react-native-async-storage/async-storage';
import { inferThreadsForNotes } from '../utils/threading';
import { normalizeCategory } from '../utils/helpers';

const KEYS = {
    NOTES: '@vocals_notes',
    TASKS: '@vocals_tasks',
    SETTINGS: '@vocals_settings',
    PROMISE_STATS: '@vocals_promises',
};

const uniqueByText = (items = [], field = 'text') => {
    const seen = new Set();

    return items.filter((item) => {
        const value = (item?.[field] || '').trim().toLowerCase();
        if (!value) return true;
        if (seen.has(value)) return false;
        seen.add(value);
        return true;
    });
};

const uniqueStrings = (items = []) => [...new Set(items.filter(Boolean).map((item) => item.trim()))];

const shouldMergeIntoExistingNote = (targetNote, incomingNote) => {
    const incomingTasks = incomingNote.tasks || [];
    const incomingReminders = incomingNote.reminders || [];
    const incomingIdeas = incomingNote.ideas || [];
    const targetTasks = targetNote.tasks || [];

    const taskOnlyUpdate =
        incomingTasks.length > 0 &&
        incomingReminders.length === 0 &&
        incomingIdeas.length === 0;

    const targetLooksLikeOngoingList =
        targetTasks.length > 0 ||
        ['shopping', 'travel'].includes(targetNote.category);

    const summaryDeltaIsSmall =
        (incomingNote.summary || '').trim().length <= 120 &&
        (incomingNote.title || '').trim().length <= 48;

    return taskOnlyUpdate && targetLooksLikeOngoingList && summaryDeltaIsSmall;
};

const mergeIntoExistingNote = (targetNote, incomingNote) => {
    const mergedTasks = uniqueByText([...(targetNote.tasks || []), ...(incomingNote.tasks || [])], 'text');
    const mergedReminders = uniqueByText([...(targetNote.reminders || []), ...(incomingNote.reminders || [])], 'text');
    const mergedIdeas = uniqueByText([...(targetNote.ideas || []), ...(incomingNote.ideas || [])], 'text');
    const mergedEntities = uniqueStrings([...(targetNote.entities || []), ...(incomingNote.entities || [])]);
    const mergedVagueItems = uniqueByText([...(targetNote.vagueItems || []), ...(incomingNote.vagueItems || [])], 'original');

    return {
        ...targetNote,
        updatedAt: new Date().toISOString(),
        summary: targetNote.summary || incomingNote.summary,
        modeSummary: targetNote.modeSummary || incomingNote.modeSummary,
        transcript: [targetNote.transcript, incomingNote.transcript].filter(Boolean).join('\n\n'),
        tasks: mergedTasks,
        reminders: mergedReminders,
        ideas: mergedIdeas,
        entities: mergedEntities,
        vagueItems: mergedVagueItems,
        themes: uniqueStrings([...(targetNote.themes || []), ...(incomingNote.themes || [])]),
        keyInsights: uniqueStrings([...(targetNote.keyInsights || []), ...(incomingNote.keyInsights || [])]),
    };
};

const buildNormalizedNoteDraft = (note) => {
    const { continueNoteId, forceNewNote, ...noteWithoutContinueTarget } = note;
    const normalizedTasks = (note.tasks || []).map((task) => ({
        ...task,
        category: normalizeCategory(task.category || note.category),
    }));

    return {
        id: noteWithoutContinueTarget.id || Date.now().toString(),
        createdAt: noteWithoutContinueTarget.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        audioUri: null,
        transcript: '',
        summary: '',
        tasks: normalizedTasks,
        reminders: [],
        ideas: [],
        intents: [],
        entities: [],
        clarificationAnswers: {},
        category: normalizeCategory(noteWithoutContinueTarget.category),
        priority: 'normal',
        ...noteWithoutContinueTarget,
        tasks: normalizedTasks,
        category: normalizeCategory(noteWithoutContinueTarget.category),
    };
};

// ─── Notes ───────────────────────────────────────────

export const saveNote = async (note) => {
    try {
        const notes = await getNotes();
        const continueNoteId = note.continueNoteId;
        const forceNewNote = !!note.forceNewNote;
        const newNote = buildNormalizedNoteDraft(note);
        const threadedNotes = inferThreadsForNotes([newNote, ...notes]);
        const threadedNewNote = threadedNotes.find((item) => item.id === newNote.id) || newNote;
        const appendTarget = forceNewNote ? null : threadedNotes.find((item) =>
            item.id !== newNote.id &&
            (
                (continueNoteId && item.id === continueNoteId) ||
                (!continueNoteId && item.threadId === threadedNewNote.threadId)
            )
        );

        if (appendTarget && (continueNoteId || shouldMergeIntoExistingNote(appendTarget, threadedNewNote))) {
            const mergedNotes = notes.map((existingNote) =>
                existingNote.id === appendTarget.id
                    ? mergeIntoExistingNote(existingNote, threadedNewNote)
                    : existingNote
            );
            const rethreadedNotes = inferThreadsForNotes(mergedNotes);
            await AsyncStorage.setItem(KEYS.NOTES, JSON.stringify(rethreadedNotes));
            return rethreadedNotes.find((item) => item.id === appendTarget.id) || appendTarget;
        }

        await AsyncStorage.setItem(KEYS.NOTES, JSON.stringify(threadedNotes));
        return threadedNewNote;
    } catch (e) {
        console.error('Error saving note:', e);
        throw e;
    }
};

export const getSuggestedContinueTargets = async (noteDraft) => {
    try {
        const notes = await getNotes();
        if (notes.length === 0) return [];

        const candidateNote = buildNormalizedNoteDraft({
            ...noteDraft,
            id: 'candidate_preview',
        });
        const threadedNotes = inferThreadsForNotes([candidateNote, ...notes]);
        const threadedCandidate = threadedNotes.find((item) => item.id === 'candidate_preview');

        if (!threadedCandidate?.threadId) return [];

        return threadedNotes
            .filter((item) => item.id !== 'candidate_preview' && item.threadId === threadedCandidate.threadId)
            .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
            .slice(0, 3)
            .map((item) => ({
                id: item.id,
                title: item.title || 'Untitled note',
                category: item.category,
                updatedAt: item.updatedAt || item.createdAt,
                taskCount: item.tasks?.length || 0,
            }));
    } catch (e) {
        console.error('Error finding continue targets:', e);
        return [];
    }
};

export const getNotes = async () => {
    try {
        const data = await AsyncStorage.getItem(KEYS.NOTES);
        const parsed = data ? JSON.parse(data) : [];
        const normalizedNotes = parsed.map((note) => ({
            ...note,
            category: normalizeCategory(note.category),
            intents: note.intents || [],
            clarificationAnswers: note.clarificationAnswers || {},
            tasks: (note.tasks || []).map((task) => ({
                ...task,
                category: normalizeCategory(task.category || note.category),
            })),
        }));
        return inferThreadsForNotes(normalizedNotes);
    } catch (e) {
        console.error('Error getting notes:', e);
        return [];
    }
};

export const updateNote = async (noteId, updates) => {
    try {
        const notes = await getNotes();
        const index = notes.findIndex(n => n.id === noteId);
        if (index !== -1) {
            notes[index] = { ...notes[index], ...updates, updatedAt: new Date().toISOString() };
            await AsyncStorage.setItem(KEYS.NOTES, JSON.stringify(notes));
            return notes[index];
        }
        return null;
    } catch (e) {
        console.error('Error updating note:', e);
        throw e;
    }
};

export const deleteNote = async (noteId) => {
    try {
        const notes = await getNotes();
        const filtered = notes.filter(n => n.id !== noteId);
        await AsyncStorage.setItem(KEYS.NOTES, JSON.stringify(filtered));
    } catch (e) {
        console.error('Error deleting note:', e);
        throw e;
    }
};

// ─── Tasks ───────────────────────────────────────────

export const getAllTasks = async () => {
    try {
        const notes = await getNotes();
        const allTasks = [];
        notes.forEach(note => {
            if (note.tasks && note.tasks.length > 0) {
                note.tasks.forEach(task => {
                    allTasks.push({
                        ...task,
                        noteId: note.id,
                        noteCreatedAt: note.createdAt,
                    });
                });
            }
        });
        return allTasks;
    } catch (e) {
        console.error('Error getting tasks:', e);
        return [];
    }
};

export const toggleTask = async (noteId, taskId) => {
    try {
        const notes = await getNotes();
        const noteIndex = notes.findIndex(n => n.id === noteId);
        if (noteIndex !== -1) {
            const taskIndex = notes[noteIndex].tasks.findIndex(t => t.id === taskId);
            if (taskIndex !== -1) {
                const task = notes[noteIndex].tasks[taskIndex];
                task.completed = !task.completed;
                task.completedAt = task.completed ? new Date().toISOString() : null;
                await AsyncStorage.setItem(KEYS.NOTES, JSON.stringify(notes));

                // Update promise stats
                await updatePromiseStats(task, task.completed ? 'completed' : 'reopened');

                return task;
            }
        }
        return null;
    } catch (e) {
        console.error('Error toggling task:', e);
        throw e;
    }
};

export const deleteTask = async (noteId, taskId) => {
    try {
        const notes = await getNotes();
        const noteIndex = notes.findIndex((note) => note.id === noteId);
        if (noteIndex === -1) return null;

        const existingTasks = notes[noteIndex].tasks || [];
        const filteredTasks = existingTasks.filter((task) => task.id !== taskId);
        if (filteredTasks.length === existingTasks.length) return null;

        notes[noteIndex] = {
            ...notes[noteIndex],
            tasks: filteredTasks,
            updatedAt: new Date().toISOString(),
        };

        await AsyncStorage.setItem(KEYS.NOTES, JSON.stringify(notes));
        return notes[noteIndex];
    } catch (e) {
        console.error('Error deleting task:', e);
        throw e;
    }
};

// ─── Promise Tracker ─────────────────────────────────

export const getPromiseStats = async () => {
    try {
        const data = await AsyncStorage.getItem(KEYS.PROMISE_STATS);
        return data ? JSON.parse(data) : {
            totalSpoken: 0,
            totalCompleted: 0,
            totalBroken: 0,
            weeklyHistory: [],
            patterns: {},
        };
    } catch (e) {
        console.error('Error getting promise stats:', e);
        return { totalSpoken: 0, totalCompleted: 0, totalBroken: 0, weeklyHistory: [], patterns: {} };
    }
};

export const updatePromiseStats = async (task, event = 'completed') => {
    try {
        const stats = await getPromiseStats();

        if (event === 'completed' && task.completed) {
            stats.totalCompleted += 1;
        }

        if (event === 'reopened' && stats.totalCompleted > 0) {
            stats.totalCompleted -= 1;
        }

        const today = new Date().toISOString().split('T')[0];
        const todayEntry = stats.weeklyHistory.find(h => h.date === today);
        if (todayEntry) {
            if (event === 'completed' && task.completed) {
                todayEntry.completed = (todayEntry.completed || 0) + 1;
            }
            if (event === 'reopened' && todayEntry.completed > 0) {
                todayEntry.completed -= 1;
            }
        }

        // Track patterns
        const taskLower = task.text.toLowerCase();
        const keywords = ['gym', 'call', 'email', 'study', 'read', 'exercise', 'meditate', 'write', 'code', 'clean'];
        keywords.forEach(keyword => {
            if (taskLower.includes(keyword)) {
                if (!stats.patterns[keyword]) {
                    stats.patterns[keyword] = { mentioned: 0, completed: 0 };
                }
                if (event === 'completed' && task.completed) {
                    stats.patterns[keyword].completed += 1;
                }
                if (event === 'reopened' && stats.patterns[keyword].completed > 0) {
                    stats.patterns[keyword].completed -= 1;
                }
            }
        });

        await AsyncStorage.setItem(KEYS.PROMISE_STATS, JSON.stringify(stats));
        return stats;
    } catch (e) {
        console.error('Error updating promise stats:', e);
    }
};

export const incrementSpokenPromises = async (tasks = []) => {
    try {
        const stats = await getPromiseStats();
        const taskList = Array.isArray(tasks) ? tasks : [];
        const count = taskList.length;
        stats.totalSpoken += count;

        // Add to weekly history
        const today = new Date().toISOString().split('T')[0];
        const todayEntry = stats.weeklyHistory.find(h => h.date === today);
        if (todayEntry) {
            todayEntry.spoken += count;
        } else {
            stats.weeklyHistory.push({ date: today, spoken: count, completed: 0 });
        }

        // Track recurring patterns even before tasks are completed.
        const keywords = ['gym', 'call', 'email', 'study', 'read', 'exercise', 'meditate', 'write', 'code', 'clean'];
        taskList.forEach(task => {
            const taskLower = task.text?.toLowerCase?.() || '';
            keywords.forEach(keyword => {
                if (taskLower.includes(keyword)) {
                    if (!stats.patterns[keyword]) {
                        stats.patterns[keyword] = { mentioned: 0, completed: 0 };
                    }
                    stats.patterns[keyword].mentioned += 1;
                }
            });
        });

        // Keep only last 30 days
        stats.weeklyHistory = stats.weeklyHistory.slice(-30);

        await AsyncStorage.setItem(KEYS.PROMISE_STATS, JSON.stringify(stats));
        return stats;
    } catch (e) {
        console.error('Error incrementing spoken promises:', e);
    }
};

// ─── Settings ────────────────────────────────────────

export const getSettings = async () => {
    try {
        const data = await AsyncStorage.getItem(KEYS.SETTINGS);
        return data ? JSON.parse(data) : {
            recordingMode: 'action', // 'action' or 'braindump'
            followUpEnabled: true,
            dailyDigestEnabled: true,
            hapticFeedback: true,
        };
    } catch (e) {
        console.error('Error getting settings:', e);
        return {};
    }
};

export const saveSettings = async (settings) => {
    try {
        const current = await getSettings();
        const updated = { ...current, ...settings };
        await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(updated));
        return updated;
    } catch (e) {
        console.error('Error saving settings:', e);
        throw e;
    }
};

// ─── Clear All ───────────────────────────────────────

export const clearAllData = async () => {
    try {
        await AsyncStorage.multiRemove(Object.values(KEYS));
    } catch (e) {
        console.error('Error clearing data:', e);
    }
};
