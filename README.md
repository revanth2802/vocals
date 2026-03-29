# VOCALS

VOCALS is a voice-first mobile app that turns spoken thoughts into structured execution.

Instead of acting like a passive note archive, VOCALS is designed around follow-through:

- record voice notes
- transcribe audio with a server-side speech-to-text provider
- extract tasks, reminders, ideas, and entities with GPT
- surface unfinished work in an execution-first dashboard
- schedule follow-up reminders and daily digest notifications
- track spoken promises against completed actions

## Product Direction

VOCALS is built around the idea:

`Voice -> Execution System`

It is meant to help users move from:

- random thought
- quick reminder
- meeting recap
- idea capture
- brain dump

into:

- clear tasks
- reminders
- summaries
- follow-up accountability
- insight into what actually got done

## Core Features

- Voice recording with `expo-av`
- Speech transcription via server-side Whisper-compatible route
- AI note structuring using `MiniMax-Text-01`
- Multiple capture modes:
  - Action
  - Meeting
  - Idea
  - Quick Task
  - Reflection
  - Debug
  - Follow-up
  - Brain Dump
- Action-first home dashboard
- Task queue and completion tracking
- Promise tracker for repeated intentions vs completed actions
- Daily digest and follow-up notifications
- Notification debug panel in Settings
- Local persistence with AsyncStorage

## Tech Stack

- Expo
- React Native
- React Navigation
- AsyncStorage
- Expo AV
- Expo Notifications
- Expo Haptics
- MiniMax API
- Optional OpenAI Whisper API for transcription

## Project Structure

```text
vocals/
├── App.js
├── app.json
├── package.json
├── assets/
└── src/
    ├── components/
    ├── constants/
    ├── screens/
    ├── services/
    └── utils/
```

Important files:

- [App.js](/Users/revanthmalladi/Downloads/vocals/App.js): app shell and tab navigation
- [src/screens/HomeScreen.js](/Users/revanthmalladi/Downloads/vocals/src/screens/HomeScreen.js): action-first dashboard
- [src/screens/RecordScreen.js](/Users/revanthmalladi/Downloads/vocals/src/screens/RecordScreen.js): voice capture, AI processing, review, save flow
- [src/screens/InsightsScreen.js](/Users/revanthmalladi/Downloads/vocals/src/screens/InsightsScreen.js): analytics and follow-through metrics
- [src/screens/NoteDetailScreen.js](/Users/revanthmalladi/Downloads/vocals/src/screens/NoteDetailScreen.js): full note detail view
- [src/screens/SettingsScreen.js](/Users/revanthmalladi/Downloads/vocals/src/screens/SettingsScreen.js): preferences, notification debug, data reset
- [src/services/ai.js](/Users/revanthmalladi/Downloads/vocals/src/services/ai.js): OpenAI transcription and structuring logic
- [src/services/storage.js](/Users/revanthmalladi/Downloads/vocals/src/services/storage.js): local app data and promise tracking
- [src/services/notifications.js](/Users/revanthmalladi/Downloads/vocals/src/services/notifications.js): local notification scheduling

## Environment Variables

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_MINIMAX_API_KEY=your-local-minimax-key-here
OPENAI_TRANSCRIPTION_API_KEY=sk-your-openai-transcription-key-here
```

Example template:

- [.env.example](/Users/revanthmalladi/Downloads/vocals/.env.example)

Important:

- the app can use MiniMax locally for text generation
- audio transcription is expected to run server-side
- for production, keep provider keys on your backend/Vercel environment

## Getting Started

Install dependencies:

```bash
npm install
```

Start the Expo dev server:

```bash
npm run start
```

Run on web:

```bash
npm run web
```

Run native iOS build locally:

```bash
npm run ios
```

Run native Android build locally:

```bash
npm run android
```

## Mobile Testing Notes

This app uses native capabilities such as:

- microphone recording
- notifications
- haptics

Because of that, plain Expo Go may not always be the best testing path depending on SDK/client compatibility.

If Expo Go works on your device:

```bash
npx expo start
```

If you hit native-module or client-version issues, use a native/dev-client path instead.

## How The App Works

1. The user records a voice note.
2. The audio is sent to OpenAI Whisper for transcription.
3. The transcript is sent to GPT for structured extraction.
4. VOCALS creates a note containing:
   - title
   - summary
   - tasks
   - reminders
   - ideas
   - entities
   - mode summary
   - vague items that need clarification
5. The note is saved locally.
6. Task reminders and follow-up notifications are scheduled when possible.
7. The dashboard and insights views update from stored note/task data.

## Capture Modes

VOCALS supports multiple contexts so AI output can match the moment:

- `action`: direct execution-focused capture
- `meeting`: decisions, owners, and deadlines
- `idea`: concept capture plus suggested next steps
- `quicktask`: rapid task extraction
- `reflection`: personal reflection and emotional summary
- `debug`: problem-solving and issue breakdown
- `followup`: commitments that need checking later
- `braindump`: organize free-form thinking without over-forcing tasks

## Notifications

The app supports:

- due-date reminders parsed from task language like `tomorrow` or `tonight`
- next-day follow-up reminders
- daily digest notifications
- notification inspection and cancellation in Settings

Notification behavior is implemented in [notifications.js](/Users/revanthmalladi/Downloads/vocals/src/services/notifications.js).

## Persistence

App data is stored locally using AsyncStorage:

- notes
- tasks
- settings
- promise stats

This logic lives in [storage.js](/Users/revanthmalladi/Downloads/vocals/src/services/storage.js).

## Design Notes

The current UI direction is:

- bright professional dashboard aesthetic
- action-first layout
- low-noise visual hierarchy
- minimal emoji usage
- soft cards and rounded surfaces for mobile clarity

## Current Limitations

- OpenAI key is client-side for local development
- due-date parsing is intentionally simple and rule-based
- notifications require native support and permissions
- voice and notification flows are best validated on device
- there is not yet a full backend or sync layer

## Build Check

Web export can be used as a fast sanity check:

```bash
npx expo export --platform web
```

## Future Improvements

- move OpenAI calls behind a secure backend
- add stronger natural-language date parsing
- add editable task rescheduling inside the app
- expand unfinished-thought tracking
- add authentication and cloud sync
- support collaboration or shared execution workflows

## License

This project currently has no explicit license file.
