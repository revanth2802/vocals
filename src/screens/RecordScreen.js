// RecordScreen — The core recording experience
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Animated, Alert,
    StatusBar, ScrollView, TextInput, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/theme';
import { formatTime, formatRelativeTime, getCategoryLabel } from '../utils/helpers';
import { transcribeAudio, processTranscript } from '../services/ai';
import { saveNote, incrementSpokenPromises, getSettings, getSuggestedContinueTargets } from '../services/storage';
import { scheduleTaskNotifications, scheduleFollowUpNotification } from '../services/notifications';
import { CAPTURE_MODES, getCaptureMode } from '../constants/captureModes';
import TaskItem from '../components/TaskItem';

const RECORDING_STATES = {
    IDLE: 'idle',
    RECORDING: 'recording',
    TRANSCRIBING: 'transcribing',
    PROCESSING: 'processing',
    REVIEW: 'review',
    SAVING: 'saving',
    DONE: 'done',
};

const MINIMAX_API_KEY = process.env.EXPO_PUBLIC_MINIMAX_API_KEY;
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

const INTENT_LABELS = {
    task: 'Task',
    reminder: 'Reminder',
    calendar: 'Calendar',
    message: 'Message',
    travel: 'Travel',
    idea: 'Idea',
    note: 'Note',
};

const NEW_NOTE_ROUTE = '__new__';

const withUniqueIds = (items = [], prefix) =>
    items.map((item, index) => ({
        ...item,
        id: `${prefix}_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`,
    }));

const buildFallbackIntents = (result = {}) => ([
    ...(result.tasks || []).map((task) => ({
        text: task.text,
        type: 'task',
        category: task.category || result.category || 'personal',
        suggestedThread: null,
        needsClarification: false,
        clarificationQuestion: null,
        clarificationOptions: [],
    })),
    ...(result.reminders || []).map((reminder) => ({
        text: reminder.text,
        type: 'reminder',
        category: result.category || 'personal',
        suggestedThread: null,
        needsClarification: !!reminder.isVague,
        clarificationQuestion: reminder.isVague ? 'When should this reminder happen?' : null,
        clarificationOptions: reminder.isVague ? ['Today', 'Tomorrow', 'This week'] : [],
    })),
    ...(result.ideas || []).map((idea) => ({
        text: idea.text,
        type: 'idea',
        category: result.category || 'personal',
        suggestedThread: null,
        needsClarification: false,
        clarificationQuestion: null,
        clarificationOptions: [],
    })),
]);

const normalizeProcessedResult = (result = {}) => ({
    ...result,
    tasks: withUniqueIds(result.tasks || [], 'task'),
    reminders: withUniqueIds(result.reminders || [], 'reminder'),
    ideas: withUniqueIds(result.ideas || [], 'idea'),
    intents: withUniqueIds(
        (result.intents && result.intents.length > 0 ? result.intents : buildFallbackIntents(result)).map((intent) => ({
            ...intent,
            type: intent.type || 'note',
            category: intent.category || result.category || 'personal',
            suggestedThread: intent.suggestedThread || null,
            needsClarification: !!intent.needsClarification,
            clarificationQuestion: intent.clarificationQuestion || null,
            clarificationOptions: intent.clarificationOptions || [],
        })),
        'intent'
    ),
});

const tokenizeText = (value = '') =>
    value
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((part) => part.length >= 3);

const scoreIntentMatch = (itemText = '', intentText = '') => {
    const itemTokens = tokenizeText(itemText);
    const intentTokens = tokenizeText(intentText);
    if (itemTokens.length === 0 || intentTokens.length === 0) return 0;

    return itemTokens.filter((token) => intentTokens.includes(token)).length;
};

const mapItemsToIntents = (items = [], intents = []) =>
    items.reduce((acc, item) => {
        let bestIntentId = intents[0]?.id || null;
        let bestScore = -1;

        intents.forEach((intent) => {
            const score = scoreIntentMatch(item.text || '', intent.text || '');
            if (score > bestScore) {
                bestScore = score;
                bestIntentId = intent.id;
            }
        });

        if (bestIntentId) {
            acc[bestIntentId] = [...(acc[bestIntentId] || []), item];
        }

        return acc;
    }, {});

const RecordScreen = ({ navigation }) => {
    const [state, setState] = useState(RECORDING_STATES.IDLE);
    const [mode, setMode] = useState('action');
    const [recording, setRecording] = useState(null);
    const [duration, setDuration] = useState(0);
    const [audioUri, setAudioUri] = useState(null);
    const [transcript, setTranscript] = useState('');
    const [manualTranscript, setManualTranscript] = useState('');
    const [showManualComposer, setShowManualComposer] = useState(false);
    const [editingTranscript, setEditingTranscript] = useState(false);
    const [processed, setProcessed] = useState(null);
    const [intentThreadSuggestions, setIntentThreadSuggestions] = useState({});
    const [intentThreadSelections, setIntentThreadSelections] = useState({});
    const [clarificationAnswers, setClarificationAnswers] = useState({});
    const [error, setError] = useState(null);

    // Animations
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const ringAnim1 = useRef(new Animated.Value(0)).current;
    const ringAnim2 = useRef(new Animated.Value(0)).current;
    const ringAnim3 = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;

    const timerRef = useRef(null);
    const selectedMode = getCaptureMode(mode);

    useEffect(() => {
        const loadDefaultMode = async () => {
            const settings = await getSettings();
            if (settings.recordingMode) {
                setMode(settings.recordingMode);
            }
        };

        loadDefaultMode();
    }, []);

    // ─── Pulse Animation ──────────────────────────────
    useEffect(() => {
        if (state === RECORDING_STATES.RECORDING) {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.15,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ])
            );

            const ring1 = Animated.loop(
                Animated.sequence([
                    Animated.timing(ringAnim1, {
                        toValue: 1,
                        duration: 2000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(ringAnim1, {
                        toValue: 0,
                        duration: 0,
                        useNativeDriver: true,
                    }),
                ])
            );

            const ring2 = Animated.loop(
                Animated.sequence([
                    Animated.delay(600),
                    Animated.timing(ringAnim2, {
                        toValue: 1,
                        duration: 2000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(ringAnim2, {
                        toValue: 0,
                        duration: 0,
                        useNativeDriver: true,
                    }),
                ])
            );

            const ring3 = Animated.loop(
                Animated.sequence([
                    Animated.delay(1200),
                    Animated.timing(ringAnim3, {
                        toValue: 1,
                        duration: 2000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(ringAnim3, {
                        toValue: 0,
                        duration: 0,
                        useNativeDriver: true,
                    }),
                ])
            );

            pulse.start();
            ring1.start();
            ring2.start();
            ring3.start();

            return () => {
                pulse.stop();
                ring1.stop();
                ring2.stop();
                ring3.stop();
            };
        }
    }, [state]);

    // ─── Entry animation ──────────────────────────────
    useEffect(() => {
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

    // ─── Timer ─────────────────────────────────────────
    useEffect(() => {
        if (state === RECORDING_STATES.RECORDING) {
            timerRef.current = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [state]);

    // ─── Recording Functions ───────────────────────────

    const processTextCapture = async (text, nextAudioUri = null) => {
        const cleanedText = (text || '').trim();
        if (!cleanedText) {
            throw new Error('Add some text before continuing.');
        }

        setTranscript(cleanedText);
        setAudioUri(nextAudioUri);
        setState(RECORDING_STATES.PROCESSING);

        const result = await processTranscript(cleanedText, mode);
        const normalizedResult = normalizeProcessedResult(result);
        setProcessed(normalizedResult);

        const suggestionEntries = await Promise.all(
            (normalizedResult.intents || []).map(async (intent) => {
                const scopedEntities = (normalizedResult.entities || []).filter((entity) =>
                    intent.text?.toLowerCase?.().includes(entity.toLowerCase())
                );
                const suggestions = await getSuggestedContinueTargets({
                    transcript: intent.text,
                    title: intent.text,
                    summary: intent.text,
                    entities: scopedEntities.length > 0 ? scopedEntities : (normalizedResult.entities || []),
                    category: intent.category || normalizedResult.category || 'personal',
                    mode,
                });

                return [intent.id, suggestions];
            })
        );

        setIntentThreadSuggestions(Object.fromEntries(suggestionEntries));
        setIntentThreadSelections({});
        setClarificationAnswers({});
        setState(RECORDING_STATES.REVIEW);
    };

    const startRecording = async () => {
        try {
            setError(null);
            setIntentThreadSuggestions({});
            setIntentThreadSelections({});
            setClarificationAnswers({});
            const hasServerConfig = Platform.OS === 'web' || !!API_BASE_URL;
            if (!MINIMAX_API_KEY && !hasServerConfig) {
                Alert.alert(
                    'AI Setup Required',
                    'Set EXPO_PUBLIC_API_BASE_URL for the backend, or use EXPO_PUBLIC_MINIMAX_API_KEY for local development.',
                    [
                        { text: 'OK' },
                    ]
                );
                return;
            }

            const permission = await Audio.requestPermissionsAsync();
            if (!permission.granted) {
                Alert.alert('Permission Needed', 'Microphone access is required to record voice notes.');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording: newRecording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            setRecording(newRecording);
            setDuration(0);
            setState(RECORDING_STATES.RECORDING);

            try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch (e) { }
        } catch (err) {
            console.error('Failed to start recording:', err);
            setError('Failed to start recording. Please check microphone permissions.');
        }
    };

    const stopRecording = async () => {
        try {
            try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (e) { }

            setState(RECORDING_STATES.TRANSCRIBING);

            await recording.stopAndUnloadAsync();
            await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

            const uri = recording.getURI();
            setRecording(null);

            // Transcribe
            try {
                const text = await transcribeAudio(uri);
                await processTextCapture(text, uri);
            } catch (err) {
                console.error('Processing error:', err);
                setError(err.message || 'Failed to process audio');
                setIntentThreadSuggestions({});
                setIntentThreadSelections({});
                setClarificationAnswers({});
                setState(RECORDING_STATES.IDLE);
            }
        } catch (err) {
            console.error('Failed to stop recording:', err);
            setError('Failed to stop recording');
            setIntentThreadSuggestions({});
            setIntentThreadSelections({});
            setClarificationAnswers({});
            setState(RECORDING_STATES.IDLE);
        }
    };

    const handleManualProcess = async () => {
        try {
            setError(null);
            setIntentThreadSuggestions({});
            setIntentThreadSelections({});
            setClarificationAnswers({});
            await processTextCapture(manualTranscript, null);
        } catch (err) {
            console.error('Manual processing error:', err);
            setError(err.message || 'Failed to process text');
            setState(RECORDING_STATES.IDLE);
        }
    };

    const cancelRecording = async () => {
        try {
            if (recording) {
                await recording.stopAndUnloadAsync();
                await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
                setRecording(null);
            }
            setDuration(0);
            setIntentThreadSuggestions({});
            setIntentThreadSelections({});
            setClarificationAnswers({});
            setState(RECORDING_STATES.IDLE);
        } catch (err) {
            console.error('Failed to cancel:', err);
            setIntentThreadSuggestions({});
            setIntentThreadSelections({});
            setClarificationAnswers({});
            setState(RECORDING_STATES.IDLE);
        }
    };

    const handleSave = async () => {
        try {
            const unresolvedClarifications = (processed?.intents || []).filter(
                (intent) => intent.needsClarification && !clarificationAnswers[intent.id]
            );
            if (unresolvedClarifications.length > 0) {
                Alert.alert(
                    'One Quick Clarification',
                    'Answer the pending question so the app can route this correctly before saving.'
                );
                return;
            }

            setState(RECORDING_STATES.SAVING);
            const settings = await getSettings();
            const normalizedTasks = processed.tasks || [];
            const normalizedReminders = processed.reminders || [];
            const normalizedIdeas = processed.ideas || [];
            const intents = processed.intents || [];

            if (intents.length === 0) {
                await saveNote({
                    audioUri,
                    transcript,
                    title: processed.title || 'Untitled',
                    summary: processed.summary || '',
                    modeSummary: processed.modeSummary || '',
                    tasks: normalizedTasks,
                    reminders: normalizedReminders,
                    ideas: normalizedIdeas,
                    entities: processed.entities || [],
                    category: processed.category || 'personal',
                    priority: processed.priority || 'normal',
                    vagueItems: processed.vagueItems || [],
                    themes: processed.themes || [],
                    keyInsights: processed.keyInsights || [],
                    intents: [],
                    clarificationAnswers,
                    mode,
                });
            } else {
            const tasksByIntent = mapItemsToIntents(normalizedTasks, intents);
            const remindersByIntent = mapItemsToIntents(normalizedReminders, intents);
            const ideasByIntent = mapItemsToIntents(normalizedIdeas, intents);

            const buckets = intents.reduce((acc, intent) => {
                const route = intentThreadSelections[intent.id] || NEW_NOTE_ROUTE;
                if (!acc[route]) {
                    acc[route] = {
                        intents: [],
                        tasks: [],
                        reminders: [],
                        ideas: [],
                    };
                }

                acc[route].intents.push(intent);
                acc[route].tasks.push(...(tasksByIntent[intent.id] || []));
                acc[route].reminders.push(...(remindersByIntent[intent.id] || []));
                acc[route].ideas.push(...(ideasByIntent[intent.id] || []));
                return acc;
            }, {});

            const notesToSave = Object.entries(buckets).map(([route, bucket], index) => {
                const bucketTranscript = bucket.intents.map((intent) => intent.text).join('. ');
                const bucketCategory = bucket.intents[0]?.category || processed.category || 'personal';
                const bucketEntities = (processed.entities || []).filter((entity) =>
                    bucketTranscript.toLowerCase().includes(entity.toLowerCase())
                );

                return {
                    audioUri: route === NEW_NOTE_ROUTE ? audioUri : null,
                    transcript: bucketTranscript || transcript,
                    title: bucket.intents.length === 1 ? bucket.intents[0].text : `${processed.title || 'Untitled'} ${index + 1}`,
                    summary: bucket.intents.map((intent) => intent.text).join(' • '),
                    modeSummary: processed.modeSummary || '',
                    tasks: bucket.tasks,
                    reminders: bucket.reminders,
                    ideas: bucket.ideas,
                    entities: bucketEntities,
                    category: bucketCategory,
                    priority: processed.priority || 'normal',
                    vagueItems: processed.vagueItems || [],
                    themes: processed.themes || [],
                    keyInsights: processed.keyInsights || [],
                    intents: bucket.intents,
                    clarificationAnswers: bucket.intents.reduce((acc, intent) => {
                        if (clarificationAnswers[intent.id]) {
                            acc[intent.id] = clarificationAnswers[intent.id];
                        }
                        return acc;
                    }, {}),
                    mode,
                    forceNewNote: route === NEW_NOTE_ROUTE,
                    continueNoteId: route !== NEW_NOTE_ROUTE ? route : null,
                };
            });

            for (const noteDraft of notesToSave) {
                await saveNote(noteDraft);
            }
            }

            // Update promise stats
            const extractedTasks = normalizedTasks;
            if (extractedTasks.length > 0) {
                await incrementSpokenPromises(extractedTasks);
                await scheduleTaskNotifications(extractedTasks);
                await scheduleFollowUpNotification(extractedTasks, settings.followUpEnabled);
            }

            try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) { }

            setState(RECORDING_STATES.DONE);

            setTimeout(() => {
                navigation.goBack();
            }, 800);
        } catch (err) {
            console.error('Save error:', err);
            setError('Failed to save note');
            setState(RECORDING_STATES.REVIEW);
        }
    };

    const handleClarificationAnswer = (intentId, option) => {
        setClarificationAnswers((current) => ({
            ...current,
            [intentId]: option,
        }));
    };

    const handleIntentThreadSelection = (intentId, route) => {
        setIntentThreadSelections((current) => ({
            ...current,
            [intentId]: route,
        }));
    };

    const handleDiscard = () => {
        Alert.alert(
            'Discard Recording',
            'Are you sure? This cannot be undone.',
            [
                { text: 'Keep', style: 'cancel' },
                {
                    text: 'Discard', style: 'destructive', onPress: () => {
                        setState(RECORDING_STATES.IDLE);
                        setTranscript('');
                        setProcessed(null);
                        setAudioUri(null);
                        setManualTranscript('');
                        setShowManualComposer(false);
                        setIntentThreadSuggestions({});
                        setIntentThreadSelections({});
                        setClarificationAnswers({});
                    }
                },
            ]
        );
    };

    // ─── Ring Component ────────────────────────────────
    const AnimatedRing = ({ anim, size }) => {
        const scale = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [1, size / 80],
        });
        const opacity = anim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0.4, 0.15, 0],
        });

        return (
            <Animated.View style={[styles.ring, {
                transform: [{ scale }],
                opacity,
            }]} />
        );
    };

    // ─── Render Functions ──────────────────────────────

    const renderModeSelector = () => (
        <View style={styles.modeSelector}>
            {CAPTURE_MODES.map((captureMode) => (
                <TouchableOpacity
                    key={captureMode.key}
                    style={[styles.modeButton, mode === captureMode.key && styles.modeButtonActive]}
                    onPress={() => setMode(captureMode.key)}
                >
                    <Ionicons
                        name={captureMode.iconName}
                        size={16}
                        color={mode === captureMode.key ? COLORS.accent : COLORS.textSecondary}
                    />
                    <Text style={[styles.modeText, mode === captureMode.key && styles.modeTextActive]}>
                        {captureMode.shortLabel}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    const renderIdleState = () => (
        <View style={styles.centerContent}>
            {renderModeSelector()}

            <View style={styles.modeIntroCard}>
                <View style={styles.modePreviewRow}>
                    <View style={styles.modePreviewBadge}>
                        <Ionicons name={selectedMode.iconName} size={14} color={COLORS.accent} />
                        <Text style={styles.modeIntroEyebrow}>{selectedMode.label}</Text>
                    </View>
                    <View style={styles.modePreviewDot} />
                </View>
                <Text style={styles.idleTitle}>{selectedMode.title}</Text>
                <Text style={styles.idleSubtitle}>{selectedMode.subtitle}</Text>
            </View>

            <TouchableOpacity
                style={styles.recordButton}
                onPress={startRecording}
                activeOpacity={0.8}
            >
                <View style={styles.recordButtonInner}>
                    <View style={styles.micIcon}>
                        <Ionicons name="mic" size={34} color="#FFFFFF" />
                    </View>
                </View>
            </TouchableOpacity>

            <Text style={styles.tapToRecord}>Tap to record</Text>

            <TouchableOpacity
                style={styles.manualToggleButton}
                onPress={() => setShowManualComposer((current) => !current)}
                activeOpacity={0.85}
            >
                <Ionicons name="create-outline" size={16} color={COLORS.accent} />
                <Text style={styles.manualToggleText}>
                    {showManualComposer ? 'Hide typed input' : 'Type instead'}
                </Text>
            </TouchableOpacity>

            {showManualComposer && (
                <View style={styles.manualComposer}>
                    <Text style={styles.manualComposerLabel}>Transcript</Text>
                    <TextInput
                        style={styles.manualComposerInput}
                        value={manualTranscript}
                        onChangeText={setManualTranscript}
                        placeholder="Type what you would have said out loud..."
                        placeholderTextColor={COLORS.textMuted}
                        multiline
                        textAlignVertical="top"
                    />
                    <TouchableOpacity
                        style={styles.manualComposerButton}
                        onPress={handleManualProcess}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.manualComposerButtonText}>Process text</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

    const renderRecordingState = () => (
        <View style={styles.centerContent}>
            <View style={styles.recordingHeader}>
                <View style={styles.liveIndicator}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>RECORDING</Text>
                </View>
                <View style={styles.modeLabelRow}>
                    <Ionicons name={selectedMode.iconName} size={14} color={COLORS.textSecondary} />
                    <Text style={styles.modeLabel}>{selectedMode.label}</Text>
                </View>
            </View>

            <Text style={styles.timer}>{formatTime(duration)}</Text>

            <View style={styles.recordingButtonContainer}>
                <AnimatedRing anim={ringAnim1} size={200} />
                <AnimatedRing anim={ringAnim2} size={240} />
                <AnimatedRing anim={ringAnim3} size={280} />

                <Animated.View style={[styles.recordButtonActive, {
                    transform: [{ scale: pulseAnim }],
                }]}>
                    <TouchableOpacity
                        style={styles.stopButton}
                        onPress={stopRecording}
                        activeOpacity={0.8}
                    >
                        <View style={styles.stopIcon} />
                    </TouchableOpacity>
                </Animated.View>
            </View>

            <Text style={styles.speakNow}>Speak naturally and let VOCALS structure the rest.</Text>

            <TouchableOpacity style={styles.cancelButton} onPress={cancelRecording}>
                <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
        </View>
    );

    const renderProcessingState = () => (
        <View style={styles.centerContent}>
            <View style={styles.processingOrb}>
                <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
            <Text style={styles.processingTitle}>
                {state === RECORDING_STATES.TRANSCRIBING
                    ? 'Transcribing your voice...'
                    : selectedMode.processingLabel}
            </Text>
            <Text style={styles.processingSubtitle}>
                {state === RECORDING_STATES.TRANSCRIBING
                    ? 'Converting speech to text'
                    : selectedMode.subtitle}
            </Text>
        </View>
    );

    const renderReviewState = () => (
        <ScrollView style={styles.reviewContainer} showsVerticalScrollIndicator={false}>
            <View style={styles.reviewContent}>
                {/* Success Header */}
                <View style={styles.reviewHeader}>
                    <Text style={styles.reviewTitle}>Processed</Text>
                    <Text style={styles.reviewSubtitle}>Review and save</Text>
                </View>

                <View style={styles.reviewModeCard}>
                    <Text style={styles.reviewModeEyebrow}>CAPTURE MOMENT</Text>
                    <View style={styles.reviewModeTitleRow}>
                        <Ionicons name={selectedMode.iconName} size={18} color={COLORS.accent} />
                        <Text style={styles.reviewModeTitle}>{selectedMode.label}</Text>
                    </View>
                    <Text style={styles.reviewModeSubtitle}>
                        {processed?.modeSummary || selectedMode.subtitle}
                    </Text>
                </View>

                {/* Title */}
                <View style={styles.reviewSection}>
                    <Text style={styles.sectionLabel}>TITLE</Text>
                    <Text style={styles.noteTitle}>{processed?.title || 'Untitled'}</Text>
                </View>

                {processed?.intents?.length > 0 && (
                    <View style={styles.reviewSection}>
                        <Text style={styles.sectionLabel}>ACTIONS</Text>
                        {processed.intents.map((intent) => {
                            const routeOptions = intentThreadSuggestions[intent.id] || [];
                            const selectedRoute = intentThreadSelections[intent.id] || NEW_NOTE_ROUTE;
                            return (
                            <View key={intent.id} style={styles.intentCard}>
                                <View style={styles.intentHeader}>
                                    <View style={styles.intentTypeBadge}>
                                        <Text style={styles.intentTypeText}>{INTENT_LABELS[intent.type] || 'Intent'}</Text>
                                    </View>
                                    <Text style={styles.intentCategoryText}>{getCategoryLabel(intent.category)}</Text>
                                </View>
                                <Text style={styles.intentText}>{intent.text}</Text>
                                {routeOptions.length > 0 && (
                                    <View style={styles.intentRouteSection}>
                                        <Text style={styles.intentRouteLabel}>Add to</Text>
                                        <TouchableOpacity
                                            style={[styles.threadOption, selectedRoute === NEW_NOTE_ROUTE && styles.threadOptionActive]}
                                            onPress={() => handleIntentThreadSelection(intent.id, NEW_NOTE_ROUTE)}
                                            activeOpacity={0.85}
                                        >
                                            <View style={styles.threadOptionTextWrap}>
                                                <Text style={styles.threadOptionTitle}>New note</Text>
                                            </View>
                                            <View style={[styles.threadTick, selectedRoute === NEW_NOTE_ROUTE && styles.threadTickActive]}>
                                                {selectedRoute === NEW_NOTE_ROUTE && <Text style={styles.threadTickText}>OK</Text>}
                                            </View>
                                        </TouchableOpacity>
                                        {routeOptions.map((item) => {
                                            const isSelected = selectedRoute === item.id;
                                            return (
                                                <TouchableOpacity
                                                    key={item.id}
                                                    style={[styles.threadOption, isSelected && styles.threadOptionActive]}
                                                    onPress={() => handleIntentThreadSelection(intent.id, item.id)}
                                                    activeOpacity={0.85}
                                                >
                                                    <View style={styles.threadOptionTextWrap}>
                                                        <Text style={styles.threadOptionTitle}>{item.title}</Text>
                                                        <Text style={styles.threadOptionMeta}>
                                                            {getCategoryLabel(item.category)} · {item.taskCount} tasks · {formatRelativeTime(item.updatedAt)}
                                                        </Text>
                                                    </View>
                                                    <View style={[styles.threadTick, isSelected && styles.threadTickActive]}>
                                                        {isSelected && <Text style={styles.threadTickText}>OK</Text>}
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                )}
                            </View>
                        )})}
                    </View>
                )}

                {(processed?.intents || []).some((intent) => intent.needsClarification) && (
                    <View style={styles.reviewSection}>
                        <Text style={styles.sectionLabel}>AGENT CHECK</Text>
                        {processed.intents
                            .filter((intent) => intent.needsClarification)
                            .map((intent) => (
                                <View key={intent.id} style={styles.intentQuestionCard}>
                                    <Text style={styles.intentQuestionType}>
                                        {INTENT_LABELS[intent.type] || 'Intent'}
                                    </Text>
                                    <Text style={styles.intentQuestionText}>{intent.clarificationQuestion}</Text>
                                    <View style={styles.optionRow}>
                                        {(intent.clarificationOptions || []).map((option) => {
                                            const isSelected = clarificationAnswers[intent.id] === option;
                                            return (
                                                <TouchableOpacity
                                                    key={option}
                                                    style={[styles.optionChip, isSelected && styles.optionChipActive]}
                                                    onPress={() => handleClarificationAnswer(intent.id, option)}
                                                    activeOpacity={0.85}
                                                >
                                                    <Text style={[styles.optionChipText, isSelected && styles.optionChipTextActive]}>
                                                        {option}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            ))}
                    </View>
                )}

                {/* Summary */}
                {processed?.summary && (
                    <View style={styles.reviewSection}>
                        <Text style={styles.sectionLabel}>SUMMARY</Text>
                        <Text style={styles.noteSummary}>{processed.summary}</Text>
                    </View>
                )}

                {/* Transcript */}
                <View style={styles.reviewSection}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionLabel}>TRANSCRIPT</Text>
                        <TouchableOpacity onPress={() => setEditingTranscript(!editingTranscript)}>
                            <Text style={styles.editButton}>
                                {editingTranscript ? 'Done' : 'Edit'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                    {editingTranscript ? (
                        <TextInput
                            style={styles.transcriptInput}
                            value={transcript}
                            onChangeText={setTranscript}
                            multiline
                            autoFocus
                        />
                    ) : (
                        <Text style={styles.transcriptText}>{transcript}</Text>
                    )}
                </View>

                {/* Tasks */}
                {processed?.tasks?.length > 0 && (
                    <View style={styles.reviewSection}>
                        <Text style={styles.sectionLabel}>
                            TASKS ({processed.tasks.length})
                        </Text>
                        {processed.tasks.map((task, idx) => (
                            <TaskItem key={`${task.id || 'task'}_${idx}`} task={task} />
                        ))}
                    </View>
                )}

                {/* Reminders */}
                {processed?.reminders?.length > 0 && (
                    <View style={styles.reviewSection}>
                        <Text style={styles.sectionLabel}>
                            REMINDERS ({processed.reminders.length})
                        </Text>
                        {processed.reminders.map((rem, idx) => (
                            <View key={`${rem.id || 'reminder'}_${idx}`} style={styles.reminderItem}>
                                <Text style={styles.reminderText}>{rem.text}</Text>
                                <Text style={styles.reminderTime}>{rem.timeDescription}</Text>
                                {rem.isVague && (
                                    <View style={styles.vagueBadge}>
                                        <Text style={styles.vagueText}>Vague time</Text>
                                    </View>
                                )}
                            </View>
                        ))}
                    </View>
                )}

                {/* Ideas */}
                {processed?.ideas?.length > 0 && (
                    <View style={styles.reviewSection}>
                        <Text style={styles.sectionLabel}>
                            IDEAS ({processed.ideas.length})
                        </Text>
                        {processed.ideas.map((idea, idx) => (
                            <View key={`${idea.id || 'idea'}_${idx}`} style={styles.ideaItem}>
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

                {/* Vague Items — Forced Clarity */}
                {processed?.vagueItems?.length > 0 && (
                    <View style={styles.reviewSection}>
                        <Text style={styles.sectionLabel}>NEEDS CLARITY</Text>
                        {processed.vagueItems.map((item, idx) => (
                            <View key={idx} style={styles.vagueItem}>
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

                {/* Key Insights (Brain Dump) */}
                {processed?.keyInsights?.length > 0 && (
                    <View style={styles.reviewSection}>
                        <Text style={styles.sectionLabel}>KEY INSIGHTS</Text>
                        {processed.keyInsights.map((insight, idx) => (
                            <View key={idx} style={styles.insightItem}>
                                <Text style={styles.insightText}>• {insight}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Entities */}
                {processed?.entities?.length > 0 && (
                    <View style={styles.reviewSection}>
                        <Text style={styles.sectionLabel}>MENTIONED</Text>
                        <View style={styles.entityRow}>
                            {processed.entities.map((entity, idx) => (
                                <View key={idx} style={styles.entityBadge}>
                                    <Text style={styles.entityText}>{entity}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                    <TouchableOpacity
                        style={styles.saveButton}
                        onPress={handleSave}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.saveButtonText}>
                            {Object.values(intentThreadSelections).some((value) => value && value !== NEW_NOTE_ROUTE)
                                ? 'Save to Notes'
                                : 'Save & Execute'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.discardButton}
                        onPress={handleDiscard}
                    >
                        <Text style={styles.discardButtonText}>Discard</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 100 }} />
            </View>
        </ScrollView>
    );

    const renderDoneState = () => (
        <View style={styles.centerContent}>
            <Ionicons name="checkmark-circle" size={60} color={COLORS.success} style={styles.doneIcon} />
            <Text style={styles.doneTitle}>Saved!</Text>
            <Text style={styles.doneSubtitle}>
                {(processed?.tasks?.length || 0)} tasks added to your execution queue
            </Text>
        </View>
    );

    // ─── Main Render ───────────────────────────────────
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* Close Button */}
            {(state === RECORDING_STATES.IDLE || state === RECORDING_STATES.REVIEW) && (
                <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="close" size={22} color={COLORS.textPrimary} />
                </TouchableOpacity>
            )}

            {error && (
                <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity onPress={() => setError(null)}>
                        <Text style={styles.errorDismiss}>Dismiss</Text>
                    </TouchableOpacity>
                </View>
            )}

            <Animated.View style={[styles.content, {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
            }]}>
                {state === RECORDING_STATES.IDLE && renderIdleState()}
                {state === RECORDING_STATES.RECORDING && renderRecordingState()}
                {(state === RECORDING_STATES.TRANSCRIBING || state === RECORDING_STATES.PROCESSING) && renderProcessingState()}
                {state === RECORDING_STATES.REVIEW && renderReviewState()}
                {(state === RECORDING_STATES.SAVING || state === RECORDING_STATES.DONE) && renderDoneState()}
            </Animated.View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    content: {
        flex: 1,
    },
    closeButton: {
        position: 'absolute',
        top: 60,
        right: SPACING.xl,
        zIndex: 100,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.card,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    centerContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: SPACING.xxxl,
    },

    // Error
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.urgentDim,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        marginHorizontal: SPACING.lg,
        marginTop: SPACING.sm,
        borderRadius: BORDER_RADIUS.md,
    },
    errorText: {
        color: COLORS.urgent,
        fontSize: FONT_SIZE.small,
        flex: 1,
    },
    errorDismiss: {
        color: COLORS.urgent,
        fontSize: FONT_SIZE.small,
        fontWeight: FONT_WEIGHT.semibold,
        marginLeft: SPACING.md,
    },

    // Mode Selector
    modeSelector: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: SPACING.sm,
        marginBottom: SPACING.huge,
    },
    modeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 98,
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.lg,
        borderRadius: BORDER_RADIUS.md,
        gap: SPACING.sm,
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    modeButtonActive: {
        backgroundColor: COLORS.accentDim,
        borderColor: COLORS.accent,
    },
    modeText: {
        color: COLORS.textTertiary,
        fontSize: FONT_SIZE.small,
        fontWeight: FONT_WEIGHT.medium,
    },
    modeTextActive: {
        color: COLORS.accent,
    },

    // Idle State
    modeIntroCard: {
        backgroundColor: COLORS.card,
        borderRadius: BORDER_RADIUS.xxl,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        paddingVertical: SPACING.xxl,
        paddingHorizontal: SPACING.xl,
        marginBottom: SPACING.huge,
        width: '100%',
        ...SHADOWS.elevated,
    },
    modePreviewRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    modePreviewBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3EEFF',
        borderRadius: BORDER_RADIUS.full,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        gap: SPACING.xs,
    },
    modePreviewDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: COLORS.accentLight,
    },
    modeIntroEyebrow: {
        color: COLORS.accent,
        fontSize: FONT_SIZE.caption,
        fontWeight: FONT_WEIGHT.bold,
        letterSpacing: 1.2,
    },
    idleTitle: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.heading,
        fontWeight: FONT_WEIGHT.bold,
        textAlign: 'center',
        marginBottom: SPACING.sm,
    },
    idleSubtitle: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.body,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: SPACING.huge,
    },

    // Record Button
    recordButton: {
        width: 116,
        height: 116,
        borderRadius: 58,
        backgroundColor: '#FFE7E7',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#FFD4D4',
    },
    recordButtonInner: {
        width: 92,
        height: 92,
        borderRadius: 46,
        backgroundColor: COLORS.recordRed,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 6,
        borderColor: '#FFF6F6',
        ...SHADOWS.glow(COLORS.recordRed),
    },
    micIcon: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    tapToRecord: {
        color: COLORS.textTertiary,
        fontSize: FONT_SIZE.small,
        marginTop: SPACING.xl,
        fontWeight: FONT_WEIGHT.medium,
    },
    manualToggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        marginTop: SPACING.lg,
        paddingVertical: SPACING.sm,
    },
    manualToggleText: {
        color: COLORS.accent,
        fontSize: FONT_SIZE.small,
        fontWeight: FONT_WEIGHT.semibold,
    },
    manualComposer: {
        width: '100%',
        marginTop: SPACING.lg,
        backgroundColor: COLORS.card,
        borderRadius: BORDER_RADIUS.xl,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        padding: SPACING.lg,
        ...SHADOWS.card,
    },
    manualComposerLabel: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.caption,
        fontWeight: FONT_WEIGHT.bold,
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: SPACING.sm,
    },
    manualComposerInput: {
        minHeight: 120,
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.body,
        lineHeight: 22,
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        padding: SPACING.md,
    },
    manualComposerButton: {
        marginTop: SPACING.md,
        backgroundColor: COLORS.accent,
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.md,
    },
    manualComposerButtonText: {
        color: '#FFFFFF',
        fontSize: FONT_SIZE.body,
        fontWeight: FONT_WEIGHT.semibold,
    },

    // Recording State
    recordingHeader: {
        alignItems: 'center',
        marginBottom: SPACING.huge,
    },
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginBottom: SPACING.sm,
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.recordRed,
    },
    liveText: {
        color: COLORS.recordRed,
        fontSize: FONT_SIZE.caption,
        fontWeight: FONT_WEIGHT.bold,
        letterSpacing: 2,
    },
    modeLabel: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.small,
    },
    modeLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    timer: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.display,
        fontWeight: FONT_WEIGHT.heavy,
        fontVariant: ['tabular-nums'],
        marginBottom: SPACING.huge,
    },
    recordingButtonContainer: {
        width: 184,
        height: 184,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ring: {
        position: 'absolute',
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 2,
        borderColor: COLORS.recordRed,
    },
    recordButtonActive: {
        width: 92,
        height: 92,
        borderRadius: 46,
        backgroundColor: COLORS.recordRed,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.glow(COLORS.recordRed),
    },
    stopButton: {
        width: 92,
        height: 92,
        borderRadius: 46,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stopIcon: {
        width: 28,
        height: 28,
        borderRadius: 6,
        backgroundColor: '#FFFFFF',
    },
    speakNow: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.body,
        marginTop: SPACING.huge,
    },
    cancelButton: {
        marginTop: SPACING.xxl,
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.xxl,
    },
    cancelText: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.body,
        fontWeight: FONT_WEIGHT.medium,
    },

    // Processing
    processingOrb: {
        width: 92,
        height: 92,
        borderRadius: 46,
        backgroundColor: '#F3EEFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E2D8FF',
    },
    processingTitle: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.title,
        fontWeight: FONT_WEIGHT.semibold,
        marginTop: SPACING.xxl,
        textAlign: 'center',
    },
    processingSubtitle: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.body,
        marginTop: SPACING.sm,
        textAlign: 'center',
    },

    // Review
    reviewContainer: {
        flex: 1,
    },
    reviewContent: {
        paddingTop: SPACING.huge + 40,
    },
    reviewHeader: {
        paddingHorizontal: SPACING.lg,
        marginBottom: SPACING.lg,
    },
    reviewTitle: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.heading,
        fontWeight: FONT_WEIGHT.bold,
    },
    reviewSubtitle: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.body,
        marginTop: SPACING.xs,
    },
    reviewModeCard: {
        backgroundColor: '#F7F3FF',
        borderRadius: BORDER_RADIUS.xl,
        borderWidth: 1,
        borderColor: '#E8DEFF',
        padding: SPACING.lg,
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.xxl,
    },
    reviewModeEyebrow: {
        color: COLORS.textTertiary,
        fontSize: FONT_SIZE.caption,
        fontWeight: FONT_WEIGHT.bold,
        letterSpacing: 1.5,
        marginBottom: SPACING.sm,
    },
    reviewModeTitle: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.subtitle,
        fontWeight: FONT_WEIGHT.bold,
    },
    reviewModeTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginBottom: SPACING.xs,
    },
    reviewModeSubtitle: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.body,
        lineHeight: 22,
    },
    reviewSection: {
        marginBottom: SPACING.xxl,
        paddingHorizontal: SPACING.lg,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sectionLabel: {
        color: COLORS.textTertiary,
        fontSize: FONT_SIZE.caption,
        fontWeight: FONT_WEIGHT.bold,
        letterSpacing: 1.5,
        marginBottom: SPACING.sm,
        textTransform: 'uppercase',
    },
    editButton: {
        color: COLORS.accent,
        fontSize: FONT_SIZE.small,
        fontWeight: FONT_WEIGHT.semibold,
    },
    noteTitle: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.title,
        fontWeight: FONT_WEIGHT.bold,
    },
    intentCard: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
    },
    intentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: SPACING.md,
        marginBottom: SPACING.sm,
    },
    intentTypeBadge: {
        backgroundColor: COLORS.accentDim,
        borderRadius: BORDER_RADIUS.full,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
    },
    intentTypeText: {
        color: COLORS.accent,
        fontSize: FONT_SIZE.caption,
        fontWeight: FONT_WEIGHT.semibold,
    },
    intentCategoryText: {
        color: COLORS.textTertiary,
        fontSize: FONT_SIZE.small,
        fontWeight: FONT_WEIGHT.medium,
    },
    intentText: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.body,
        lineHeight: 22,
        fontWeight: FONT_WEIGHT.medium,
    },
    intentRouteSection: {
        marginTop: SPACING.md,
    },
    intentRouteLabel: {
        color: COLORS.textTertiary,
        fontSize: FONT_SIZE.caption,
        fontWeight: FONT_WEIGHT.bold,
        letterSpacing: 1,
        marginBottom: SPACING.sm,
        textTransform: 'uppercase',
    },
    noteSummary: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.body,
        lineHeight: 24,
    },
    transcriptText: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.body,
        lineHeight: 24,
        fontStyle: 'italic',
    },
    transcriptInput: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.body,
        lineHeight: 24,
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.accent,
        minHeight: 100,
    },
    threadPrompt: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.body,
        lineHeight: 22,
        marginBottom: SPACING.md,
    },
    threadOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: SPACING.md,
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
    },
    threadOptionActive: {
        borderColor: COLORS.accent,
        backgroundColor: '#F7F3FF',
    },
    threadOptionTextWrap: {
        flex: 1,
    },
    threadOptionTitle: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.body,
        fontWeight: FONT_WEIGHT.semibold,
    },
    threadOptionMeta: {
        color: COLORS.textTertiary,
        fontSize: FONT_SIZE.small,
        lineHeight: 20,
        marginTop: SPACING.xs,
    },
    threadTick: {
        width: 26,
        height: 26,
        borderRadius: 13,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.card,
    },
    threadTickActive: {
        borderColor: COLORS.accent,
        backgroundColor: COLORS.accent,
    },
    threadTickText: {
        color: '#FFFFFF',
        fontSize: FONT_SIZE.caption,
        fontWeight: FONT_WEIGHT.bold,
    },
    intentQuestionCard: {
        backgroundColor: '#FFF8EF',
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        borderColor: '#F6D79C',
        padding: SPACING.md,
        marginBottom: SPACING.sm,
    },
    intentQuestionType: {
        color: COLORS.warning,
        fontSize: FONT_SIZE.caption,
        fontWeight: FONT_WEIGHT.bold,
        letterSpacing: 1,
        marginBottom: SPACING.xs,
        textTransform: 'uppercase',
    },
    intentQuestionText: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.body,
        lineHeight: 22,
        fontWeight: FONT_WEIGHT.medium,
    },
    optionRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
        marginTop: SPACING.md,
    },
    optionChip: {
        backgroundColor: COLORS.card,
        borderRadius: BORDER_RADIUS.full,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
    },
    optionChipActive: {
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
    },
    optionChipText: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.small,
        fontWeight: FONT_WEIGHT.medium,
    },
    optionChipTextActive: {
        color: '#FFFFFF',
    },

    // Reminders
    reminderItem: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
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
    vagueBadge: {
        backgroundColor: COLORS.warningDim,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.full,
        alignSelf: 'flex-start',
        marginTop: SPACING.xs,
    },
    vagueText: {
        color: COLORS.warning,
        fontSize: FONT_SIZE.caption,
    },

    // Ideas
    ideaItem: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    ideaText: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZE.body,
        fontWeight: FONT_WEIGHT.medium,
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
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.full,
    },
    tagText: {
        color: COLORS.info,
        fontSize: FONT_SIZE.caption,
    },

    // Vague Items
    vagueItem: {
        backgroundColor: '#FFF8EF',
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: '#F6D79C',
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

    // Insights
    insightItem: {
        marginBottom: SPACING.sm,
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    insightText: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.body,
        lineHeight: 22,
    },

    // Entities
    entityRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
    },
    entityBadge: {
        backgroundColor: '#F1EDFF',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.full,
    },
    entityText: {
        color: COLORS.accent,
        fontSize: FONT_SIZE.small,
        fontWeight: FONT_WEIGHT.medium,
    },

    // Action Buttons
    actionButtons: {
        paddingHorizontal: SPACING.lg,
        paddingTop: SPACING.xxl,
        gap: SPACING.md,
    },
    saveButton: {
        backgroundColor: COLORS.accent,
        borderRadius: BORDER_RADIUS.xl,
        paddingVertical: SPACING.lg,
        alignItems: 'center',
        ...SHADOWS.glow(COLORS.accent),
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: FONT_SIZE.bodyLarge,
        fontWeight: FONT_WEIGHT.bold,
    },
    discardButton: {
        alignItems: 'center',
        paddingVertical: SPACING.md,
        backgroundColor: COLORS.cardElevated,
        borderRadius: BORDER_RADIUS.xl,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    discardButtonText: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.body,
        fontWeight: FONT_WEIGHT.medium,
    },

    // Done
    doneIcon: {
        fontSize: 64,
        marginBottom: SPACING.xxl,
    },
    doneTitle: {
        color: COLORS.success,
        fontSize: FONT_SIZE.heading,
        fontWeight: FONT_WEIGHT.bold,
        marginBottom: SPACING.sm,
    },
    doneSubtitle: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.body,
        textAlign: 'center',
    },
});

export default RecordScreen;
