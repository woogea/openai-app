const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDiaryHandler, MAX_DIARY_LENGTH } = require('../lib/diary-handler');

function response() {
  return {
    headers: {}, statusCode: null, payload: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.payload = value; return this; },
  };
}
function fixture({ verifier = async () => ({ uid: 'signed-in-user' }), completion = async () => 'Corrected diary' } = {}) {
  const calls = { verify: [], completion: [] };
  const handler = createDiaryHandler({
    async verifyIdToken(token) { calls.verify.push(token); return verifier(token); },
    async createCompletion(diary) { calls.completion.push(diary); return completion(diary); },
  });
  const req = { method: 'POST', headers: { authorization: 'Bearer signed-token' }, body: { diary: 'I went shopping.' } };
  return { handler, req, calls, res: response() };
}

test('authenticated request verifies the token before using the paid API', async () => {
  const f = fixture();
  await f.handler(f.req, f.res);
  assert.equal(f.res.statusCode, 200);
  assert.deepEqual(f.calls.verify, ['signed-token']);
  assert.deepEqual(f.calls.completion, ['I went shopping.']);
  assert.deepEqual(f.res.payload, { text: 'Corrected diary' });
  assert.equal(f.res.headers['Cache-Control'], 'no-store');
});

for (const authorization of [undefined, '', 'Basic signed-token', 'Bearer', 'Bearer a b', ['Bearer a'], `Bearer ${'a'.repeat(16385)}`]) {
  test(`rejects missing/malformed authorization (${typeof authorization}, ${String(authorization).length} chars) without provider call`, async () => {
    const f = fixture(); f.req.headers.authorization = authorization;
    await f.handler(f.req, f.res);
    assert.equal(f.res.statusCode, 401);
    assert.equal(f.calls.verify.length, 0);
    assert.equal(f.calls.completion.length, 0);
  });
}

test('legacy token header alone cannot bypass Bearer verification', async () => {
  const f = fixture(); f.req.headers = { token: 'signed-token' };
  await f.handler(f.req, f.res);
  assert.equal(f.res.statusCode, 401);
  assert.equal(f.calls.completion.length, 0);
});

for (const code of ['auth/id-token-expired', 'auth/argument-error', 'auth/invalid-id-token']) {
  test(`rejects ${code} without calling OpenAI`, async () => {
    const f = fixture({ verifier: async () => { throw Object.assign(new Error('private token'), { code }); } });
    await f.handler(f.req, f.res);
    assert.equal(f.res.statusCode, 401);
    assert.equal(f.calls.completion.length, 0);
    assert.deepEqual(f.res.payload, { text: 'Sign in is required' });
  });
}

test('fails closed when trusted Firebase project is not configured', async () => {
  const f = fixture({ verifier: async () => { throw Object.assign(new Error('private configuration'), { code: 'auth/configuration-missing' }); } });
  await f.handler(f.req, f.res);
  assert.equal(f.res.statusCode, 503);
  assert.equal(f.calls.completion.length, 0);
});

for (const user of [null, {}, { uid: '' }, { uid: 123 }]) {
  test(`rejects invalid verified user ${JSON.stringify(user)}`, async () => {
    const f = fixture({ verifier: async () => user });
    await f.handler(f.req, f.res);
    assert.equal(f.res.statusCode, 401);
    assert.equal(f.calls.completion.length, 0);
  });
}

for (const diary of [undefined, null, {}, '', '  ', 'a'.repeat(MAX_DIARY_LENGTH + 1)]) {
  test(`rejects invalid input ${typeof diary}/${String(diary).length}`, async () => {
    const f = fixture(); f.req.body = { diary };
    await f.handler(f.req, f.res);
    assert.equal(f.res.statusCode, 400);
    assert.equal(f.calls.completion.length, 0);
  });
}

test('maximum permitted input is accepted', async () => {
  const f = fixture(); f.req.body.diary = 'a'.repeat(MAX_DIARY_LENGTH);
  await f.handler(f.req, f.res);
  assert.equal(f.res.statusCode, 200);
});

test('GET and other methods cannot invoke the provider', async () => {
  const f = fixture(); f.req.method = 'GET';
  await f.handler(f.req, f.res);
  assert.equal(f.res.statusCode, 405);
  assert.equal(f.res.headers.Allow, 'POST');
  assert.equal(f.calls.verify.length, 0);
  assert.equal(f.calls.completion.length, 0);
});

test('provider failure returns a generic response without exposing token/diary', async () => {
  const f = fixture({ completion: async () => { throw new Error('secret API key and diary'); } });
  await f.handler(f.req, f.res);
  assert.equal(f.res.statusCode, 502);
  assert.deepEqual(f.res.payload, { text: 'The correction service is unavailable' });
});

test('invalid provider payload fails safely', async () => {
  const f = fixture({ completion: async () => undefined });
  await f.handler(f.req, f.res);
  assert.equal(f.res.statusCode, 502);
});
