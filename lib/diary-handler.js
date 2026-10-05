const MAX_DIARY_LENGTH = 6000;

function createDiaryHandler({ verifyIdToken, createCompletion }) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ text: 'Method not allowed' });
    }

    // Accept only a single Bearer token, never a client-provided user ID.
    const authorization = req.headers.authorization;
    const match = typeof authorization === 'string'
      && /^Bearer ([^\s]+)$/i.exec(authorization);
    if (!match || match[1].length > 16384) {
      return res.status(401).json({ text: 'Sign in is required' });
    }

    try {
      const user = await verifyIdToken(match[1]);
      if (!user || typeof user.uid !== 'string' || !user.uid) {
        return res.status(401).json({ text: 'Sign in is required' });
      }
    } catch (error) {
      if (error?.code === 'auth/configuration-missing') {
        return res.status(503).json({ text: 'Authentication is unavailable' });
      }
      return res.status(401).json({ text: 'Sign in is required' });
    }

    const diary = req.body && req.body.diary;
    if (typeof diary !== 'string' || !diary.trim()
      || diary.length > MAX_DIARY_LENGTH) {
      return res.status(400).json({ text: 'Enter a diary of 1–6000 characters' });
    }

    try {
      const text = await createCompletion(diary);
      if (typeof text !== 'string') throw new Error('Invalid completion');
      return res.status(200).json({ text });
    } catch {
      // Never log diary contents, ID tokens, or provider error payloads.
      return res.status(502).json({ text: 'The correction service is unavailable' });
    }
  };
}

module.exports = { createDiaryHandler, MAX_DIARY_LENGTH };
