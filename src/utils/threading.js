import { normalizeCategory } from './helpers';

const STOP_WORDS = new Set([
    'about', 'after', 'again', 'also', 'and', 'any', 'are', 'around', 'back', 'been', 'before',
    'call', 'could', 'did', 'does', 'dont', 'follow', 'for', 'from', 'have', 'him', 'her', 'his',
    'inquire', 'message', 'ping', 'reach', 'speak', 'talk', 'tell',
    'into', 'just', 'like', 'make', 'need', 'next', 'note', 'onto', 'our', 'out', 'over', 'please',
    'said', 'say', 'should', 'some', 'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they',
    'this', 'those', 'through', 'today', 'tomorrow', 'want', 'what', 'when', 'will', 'with', 'work',
    'would', 'your',
]);

const THREAD_TYPE_BY_CATEGORY = {
    work: 'Work',
    shopping: 'Shopping',
    travel: 'Travel',
    career: 'Career',
    health: 'Health',
    personal: 'Personal',
    finance: 'Finance',
    learning: 'Learning',
};

const normalizeWord = (value = '') => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const toTitleCase = (value = '') =>
    value
        .split(' ')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

const tokenize = (value = '') => {
    const words = value
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map(normalizeWord)
        .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));

    return [...new Set(words)];
};

const buildContextFromNote = (note = {}) => {
    const taskText = (note.tasks || []).map((task) => task.text).join(' ');
    const reminderText = (note.reminders || []).map((reminder) => reminder.text).join(' ');
    const ideaText = (note.ideas || []).map((idea) => idea.text).join(' ');
    const rawText = [
        note.title,
        note.summary,
        note.transcript,
        taskText,
        reminderText,
        ideaText,
        ...(note.entities || []),
    ]
        .filter(Boolean)
        .join(' ');

    const entities = [...new Set((note.entities || []).map((entity) => entity.trim()).filter(Boolean))];
    const tokens = tokenize(rawText);
    const normalizedCategory = normalizeCategory(note.category);
    const threadType = THREAD_TYPE_BY_CATEGORY[normalizedCategory] || 'Personal';

    return {
        tokens,
        entities,
        threadType,
    };
};

const getSharedItems = (left = [], right = []) => left.filter((item) => right.includes(item));

const createThreadLabel = (context, sharedTokens = []) => {
    const labelTokens = sharedTokens.length > 0 ? sharedTokens : context.tokens.slice(0, 2);

    if (labelTokens.length >= 2) {
        return `${toTitleCase(labelTokens[0])} ${toTitleCase(labelTokens[1])}`;
    }

    if (labelTokens.length === 1 && context.entities.length > 0) {
        return `${toTitleCase(labelTokens[0])} ${context.entities[0]}`;
    }

    if (labelTokens.length === 1) {
        return toTitleCase(labelTokens[0]);
    }

    if (context.entities.length > 0) {
        return context.entities[0];
    }

    return `${context.threadType} Thread`;
};

const enrichTasksWithThread = (tasks = [], thread) =>
    tasks.map((task) => ({
        ...task,
        threadId: thread.id,
        threadLabel: thread.label,
        threadType: thread.type,
    }));

const scoreThread = (context, thread) => {
    const sharedEntities = getSharedItems(context.entities.map((item) => item.toLowerCase()), thread.entities);
    const sharedTokens = getSharedItems(context.tokens, thread.tokens);
    const sameType = context.threadType === thread.type;
    const bothHaveEntities = context.entities.length > 0 && thread.entities.length > 0;
    const entityMismatch = bothHaveEntities && sharedEntities.length === 0;

    if (entityMismatch) {
        return {
            score: -1,
            sharedTokens,
        };
    }

    return {
        score: (sharedEntities.length * 4) + (sharedTokens.length * 2) + (sameType ? 1 : 0),
        sharedTokens,
    };
};

export const inferThreadsForNotes = (notes = []) => {
    const workingNotes = [...notes].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    const threads = [];

    const threadedNotes = workingNotes.map((note, index) => {
        const context = buildContextFromNote(note);

        let bestMatch = null;
        let bestScore = 0;
        let bestSharedTokens = [];

        threads.forEach((thread) => {
            const { score, sharedTokens } = scoreThread(context, thread);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = thread;
                bestSharedTokens = sharedTokens;
            }
        });

        if (!bestMatch || bestScore < 4) {
            bestMatch = {
                id: note.threadId || `thread_${note.id || index}`,
                label: note.threadLabel || createThreadLabel(context),
                type: note.threadType || context.threadType,
                tokens: [...context.tokens],
                entities: context.entities.map((entity) => entity.toLowerCase()),
            };
            threads.push(bestMatch);
        } else {
            bestMatch.tokens = [...new Set([...bestMatch.tokens, ...context.tokens])];
            bestMatch.entities = [...new Set([...bestMatch.entities, ...context.entities.map((entity) => entity.toLowerCase())])];

            if (!note.threadLabel) {
                bestMatch.label = createThreadLabel(context, bestSharedTokens) || bestMatch.label;
            }
        }

        return {
            ...note,
            threadId: bestMatch.id,
            threadLabel: bestMatch.label,
            threadType: bestMatch.type,
            tasks: enrichTasksWithThread(note.tasks || [], bestMatch),
        };
    });

    return threadedNotes.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
};

export const getThreadTypeLabel = (threadType) => threadType || 'General';
