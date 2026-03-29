const { proxyMultipartToOpenAI } = require('./_lib/openai');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: { message: 'Method not allowed' } });
    }

    try {
        const result = await proxyMultipartToOpenAI(req, '/audio/transcriptions');
        res.status(result.status);
        res.setHeader('Content-Type', result.contentType);
        return res.send(result.body);
    } catch (error) {
        return res.status(500).json({ error: { message: error.message || 'Transcription proxy failed' } });
    }
};

module.exports.config = {
    api: {
        bodyParser: false,
    },
};
