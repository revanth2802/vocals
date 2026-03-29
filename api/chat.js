const { parseJsonBody, proxyJsonToOpenAI } = require('./_lib/openai');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: { message: 'Method not allowed' } });
    }

    try {
        const payload = await parseJsonBody(req);
        const result = await proxyJsonToOpenAI(payload);

        res.status(result.status);
        res.setHeader('Content-Type', 'application/json');
        return res.send(result.body);
    } catch (error) {
        return res.status(500).json({ error: { message: error.message || 'Chat proxy failed' } });
    }
};
