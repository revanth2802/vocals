const MINIMAX_CHAT_API_URL = 'https://api.minimax.io/v1/text/chatcompletion_v2';
const OPENAI_TRANSCRIPTION_API_URL = 'https://api.openai.com/v1/audio/transcriptions';

const getMiniMaxApiKey = () => {
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) {
        throw new Error('Missing MINIMAX_API_KEY on the server.');
    }

    return apiKey;
};

const getTranscriptionApiKey = () => {
    const apiKey = process.env.OPENAI_TRANSCRIPTION_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('Missing OPENAI_TRANSCRIPTION_API_KEY on the server.');
    }

    return apiKey;
};

const readRawBody = async (req) => {
    if (req.body && Buffer.isBuffer(req.body)) return req.body;
    if (typeof req.body === 'string') return Buffer.from(req.body);
    if (req.body && typeof req.body === 'object' && !req[Symbol.asyncIterator]) {
        return Buffer.from(JSON.stringify(req.body));
    }

    const chunks = [];
    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
};

const parseJsonBody = async (req) => {
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
        return req.body;
    }

    const raw = await readRawBody(req);
    return raw.length > 0 ? JSON.parse(raw.toString('utf8')) : {};
};

const proxyJsonToOpenAI = async (payload) => {
    const response = await fetch(MINIMAX_CHAT_API_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${getMiniMaxApiKey()}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const text = await response.text();
    return {
        ok: response.ok,
        status: response.status,
        body: text,
    };
};

const proxyMultipartToOpenAI = async (req, endpoint) => {
    const rawBody = await readRawBody(req);
    const response = await fetch(OPENAI_TRANSCRIPTION_API_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${getTranscriptionApiKey()}`,
            'Content-Type': req.headers['content-type'] || 'multipart/form-data',
        },
        body: rawBody,
    });

    const text = await response.text();
    return {
        ok: response.ok,
        status: response.status,
        body: text,
        contentType: response.headers.get('content-type') || 'text/plain',
    };
};

module.exports = {
    getMiniMaxApiKey,
    getTranscriptionApiKey,
    readRawBody,
    parseJsonBody,
    proxyJsonToOpenAI,
    proxyMultipartToOpenAI,
};
