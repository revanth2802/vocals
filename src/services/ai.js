import { Platform } from 'react-native';
import { getCaptureMode } from '../constants/captureModes';

const MINIMAX_CHAT_API_URL = 'https://api.minimax.io/v1/text/chatcompletion_v2';
const OPENAI_TRANSCRIPTION_API_URL = 'https://api.openai.com/v1/audio/transcriptions';
const CLIENT_MINIMAX_API_KEY = process.env.EXPO_PUBLIC_MINIMAX_API_KEY;
const CLIENT_TRANSCRIPTION_API_KEY =
    process.env.EXPO_PUBLIC_OPENAI_TRANSCRIPTION_API_KEY ||
    process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

const getServerApiUrl = (path) => {
    if (!API_BASE_URL) return null;
    return `${API_BASE_URL}${path}`;
};

const getRequiredClientApiKey = () => {
    if (!CLIENT_MINIMAX_API_KEY) {
        throw new Error('AI service is not configured. Set MINIMAX_API_KEY on the server and EXPO_PUBLIC_API_BASE_URL in the app, or use EXPO_PUBLIC_MINIMAX_API_KEY for local-only development.');
    }

    return CLIENT_MINIMAX_API_KEY;
};

const parseErrorResponse = async (response, fallbackMessage) => {
    try {
        const error = await response.json();
        return error.error?.message || error.message || fallbackMessage;
    } catch {
        return fallbackMessage;
    }
};

const extractMessageContent = (data) => {
    const content = data?.choices?.[0]?.message?.content;

    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content
            .map((item) => (typeof item === 'string' ? item : item?.text || item?.content || ''))
            .join('');
    }

    return '';
};

const parseJsonFromModelOutput = (rawContent) => {
    const content = (rawContent || '').trim();
    if (!content) {
        throw new Error('No response from AI');
    }

    const withoutCodeFence = content
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

    try {
        return JSON.parse(withoutCodeFence);
    } catch {
        const objectStart = withoutCodeFence.indexOf('{');
        const objectEnd = withoutCodeFence.lastIndexOf('}');
        if (objectStart === -1 || objectEnd === -1 || objectEnd <= objectStart) {
            throw new Error('AI returned non-JSON output.');
        }

        const jsonSlice = withoutCodeFence.slice(objectStart, objectEnd + 1);
        return JSON.parse(jsonSlice);
    }
};

const normalizeMiniMaxPayload = (payload) => ({
    model: payload.model,
    messages: payload.messages.map((message, index) => ({
        role: message.role,
        name: message.role === 'assistant' ? 'AI Assistant' : `User ${index + 1}`,
        content: message.content,
    })),
    temperature: payload.temperature ?? 0.7,
    max_completion_tokens: payload.max_tokens ?? 1024,
});

const createChatCompletion = async (payload) => {
    const serverUrl = getServerApiUrl('/api/chat');
    const miniMaxPayload = normalizeMiniMaxPayload(payload);

    if (serverUrl) {
        const response = await fetch(serverUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(miniMaxPayload),
        });

        if (!response.ok) {
            throw new Error(await parseErrorResponse(response, `AI processing failed: ${response.status}`));
        }

        return response.json();
    }

    const apiKey = getRequiredClientApiKey();
    const response = await fetch(MINIMAX_CHAT_API_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(miniMaxPayload),
    });

    if (!response.ok) {
        throw new Error(await parseErrorResponse(response, `AI processing failed: ${response.status}`));
    }

    return response.json();
};

export const transcribeAudio = async (audioUri) => {
    const formData = new FormData();
    formData.append('file', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'recording.m4a',
    });
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');
    formData.append('response_format', 'text');

    try {
        const serverUrl = getServerApiUrl('/api/transcribe');
        if (serverUrl) {
            const response = await fetch(serverUrl, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(await parseErrorResponse(response, `Transcription failed: ${response.status}`));
            }

            const text = await response.text();
            return text.trim();
        }

        if (CLIENT_TRANSCRIPTION_API_KEY) {
            const response = await fetch(OPENAI_TRANSCRIPTION_API_URL, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${CLIENT_TRANSCRIPTION_API_KEY}`,
                },
                body: formData,
            });

            if (!response.ok) {
                throw new Error(await parseErrorResponse(response, `Transcription failed: ${response.status}`));
            }

            const text = await response.text();
            return text.trim();
        }
    } catch (error) {
        console.error('Transcription error:', error);
        throw error;
    }

    throw new Error('Speech transcription is not configured. Add EXPO_PUBLIC_OPENAI_TRANSCRIPTION_API_KEY for local testing or configure the /api/transcribe backend.');
};

const SYSTEM_PROMPT = `You are an AI execution engine inside a voice notes app called VOCALS. Your job is to analyze spoken transcripts and extract ACTIONABLE structure.

You must return valid JSON with this exact schema:
{
  "title": "Brief title (max 6 words)",
  "summary": "One sentence summary of what was said",
  "tasks": [
    {
      "id": "task_1",
      "text": "Clear, actionable task description",
      "priority": "high" | "medium" | "low",
      "dueDescription": "tomorrow" | "tonight" | "by 8 PM" | null,
      "category": "work" | "personal" | "shopping" | "travel" | "career" | "health" | "finance" | "learning",
      "completed": false
    }
  ],
  "reminders": [
    {
      "id": "rem_1",
      "text": "What to be reminded about",
      "timeDescription": "when (e.g., 'tomorrow morning', 'Friday 5 PM')",
      "isVague": false
    }
  ],
  "ideas": [
    {
      "id": "idea_1",
      "text": "The idea described clearly",
      "tags": ["relevant", "tags"]
    }
  ],
  "intents": [
    {
      "id": "intent_1",
      "type": "task" | "reminder" | "calendar" | "message" | "travel" | "idea" | "note",
      "text": "The specific user intent in one sentence",
      "category": "work" | "personal" | "shopping" | "travel" | "career" | "health" | "finance" | "learning",
      "suggestedThread": "Short thread label if obvious, otherwise null",
      "needsClarification": false,
      "clarificationQuestion": null,
      "clarificationOptions": []
    }
  ],
  "entities": ["person names", "project names", "places mentioned"],
  "category": "work" | "personal" | "shopping" | "travel" | "career" | "health" | "finance" | "learning",
  "priority": "high" | "medium" | "low",
  "modeSummary": "One sentence on how to act on this capture",
  "vagueItems": [
    {
      "original": "what user said vaguely",
      "clarifyQuestion": "question to make it concrete",
      "suggestions": ["suggestion 1", "suggestion 2"]
    }
  ]
}

RULES:
1. Extract EVERY actionable item — do not miss any
2. If something is vague like "I should probably..." or "maybe later...", put it in vagueItems and suggest clarification
3. Set priority based on time urgency and language used
4. Be concise in task descriptions — action verbs first
5. Identify ALL people, projects, and places mentioned
6. If it's a brain dump with no clear actions, still summarize and categorize
7. Generate unique IDs for each task, reminder, and idea
8. If a due time is mentioned, capture it in dueDescription
9. Tailor the output to the user's capture mode and preserve the most useful structure for that moment
10. Categories are fixed life areas, not capture modes
11. Choose exactly one category from: work, personal, shopping, travel, career, health, finance, learning
12. Split combined requests into separate intents when the user mentions multiple things in one sentence
13. Set needsClarification to true only when one short question would materially improve routing or execution
14. clarificationOptions should contain 2-4 short answer choices when useful, otherwise an empty array
15. ALWAYS return valid JSON — no extra text, no markdown`;

const BRAINDUMP_SYSTEM_PROMPT = `You are an AI thought organizer inside a voice notes app called VOCALS. The user is doing a brain dump — they want to freely think out loud and have you organize their thoughts.

Return valid JSON with this schema:
{
  "title": "Brief title (max 6 words)",
  "summary": "Comprehensive summary of their thoughts (2-3 sentences)",
  "themes": ["main theme 1", "main theme 2"],
  "tasks": [
    {
      "id": "task_1",
      "text": "Any action items found",
      "priority": "medium",
      "dueDescription": null,
      "category": "personal",
      "completed": false
    }
  ],
  "reminders": [],
  "ideas": [
    {
      "id": "idea_1",
      "text": "Key idea or thought",
      "tags": ["relevant", "tags"]
    }
  ],
  "intents": [
    {
      "id": "intent_1",
      "type": "idea" | "task" | "note",
      "text": "The main actionable or reflective intent",
      "category": "work" | "personal" | "shopping" | "travel" | "career" | "health" | "finance" | "learning",
      "suggestedThread": "Short thread label if obvious, otherwise null",
      "needsClarification": false,
      "clarificationQuestion": null,
      "clarificationOptions": []
    }
  ],
  "entities": [],
  "category": "personal",
  "priority": "low",
  "modeSummary": "One sentence on the main takeaway from this reflection",
  "keyInsights": ["insight 1", "insight 2"],
  "vagueItems": []
}

RULES:
1. Focus on ORGANIZING thoughts, not extracting tasks aggressively
2. Identify recurring themes
3. Highlight key insights and ideas
4. Only extract tasks if they are clearly stated
5. Be thoughtful in summarization — capture the essence
6. Choose exactly one category from: work, personal, shopping, travel, career, health, finance, learning
7. Include intents even for reflective captures so the app knows whether this is mainly a note, task, or idea
8. ALWAYS return valid JSON`;

export const processTranscript = async (transcript, mode = 'action') => {
    const captureMode = getCaptureMode(mode);
    const systemPrompt = mode === 'braindump' ? BRAINDUMP_SYSTEM_PROMPT : SYSTEM_PROMPT;
    const modePrompt = `Capture mode: ${captureMode.label}
Mode guidance: ${captureMode.promptFocus}

Additional behavior rules for this mode:
- Preserve the most valuable output for ${captureMode.label.toLowerCase()} captures.
- If there are decisions, include them in the summary and modeSummary.
- If there are obvious next steps, put them into tasks instead of leaving them implicit.
- Keep titles crisp and concrete.`;

    try {
        const data = await createChatCompletion({
            model: 'MiniMax-Text-01',
            messages: [
                { role: 'system', content: `${systemPrompt}\n\n${modePrompt}` },
                { role: 'user', content: `Analyze this voice transcript and extract structured data:\n\n"${transcript}"` },
            ],
            temperature: 0.3,
            max_tokens: 2000,
        });

        return parseJsonFromModelOutput(extractMessageContent(data));
    } catch (error) {
        console.error('AI processing error:', error);
        throw error;
    }
};

export const generateFollowUp = async (incompleteTasks) => {
    if (incompleteTasks.length === 0) return null;

    const taskList = incompleteTasks.map((task) => `- "${task.text}" (said ${task.noteCreatedAt})`).join('\n');

    try {
        const data = await createChatCompletion({
            model: 'MiniMax-Text-01',
            messages: [
                {
                    role: 'system',
                    content: 'You are a friendly but firm accountability partner. The user has incomplete tasks. Generate a brief, motivating follow-up message. Be direct but not harsh. Return JSON: { "message": "your message", "mostUrgent": "task text" }',
                },
                {
                    role: 'user',
                    content: `These tasks are still incomplete:\n${taskList}\n\nGenerate a follow-up nudge.`,
                },
            ],
            temperature: 0.7,
            max_tokens: 300,
        });

        return parseJsonFromModelOutput(extractMessageContent(data));
    } catch (error) {
        console.error('Follow-up generation error:', error);
        return null;
    }
};
