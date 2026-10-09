const { createDiaryHandler } = require('../../lib/diary-handler');
const { verifyFirebaseIdToken } = require('../../lib/firebase-auth');

export const config = { api: { bodyParser: { sizeLimit: '32kb' } } };

export default createDiaryHandler({
  verifyIdToken: verifyFirebaseIdToken,
  async createCompletion(diary) {
    // Read the secret at request time on the server only.
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OpenAI is not configured');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        temperature: 0.2,
        max_tokens: 2000,
    "messages":[
        {"role": "system","content": "you are english teacher for Japanese Junior Highschool student. You must not talk without English learning.You are cute word chice in Japanese"},
        {"role": "assistant","content": "please fix following sentence of dialy. Then tell me why you fixed it in Japanse."},
        {"role": "assistant","content":
        `
        following is expample of output
        your diary : {input diary} 
        fixed diary : {fixed diary} 
        文章ごとに何をどう修正したかを以下の形式で日本語で説明します
        ============
        1. {reason1}
        2. {reason2}
        ...
        n. {reasonn} 
        ============
        例えば"I go to shopping"という文章は"I go shopping"の方が自然な表現なので修正しました。のように具体的に説明します
        please output as above format.良いですか?
        `},
        {"role": "user","content": diary}
    ]
      }),
    });
    if (!response.ok) throw new Error('OpenAI request failed');
    const completion = await response.json();
    return completion.choices?.[0]?.message?.content;
  },
});
