const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDiaryClient } = require('../lib/diary-client');
function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}
function fixture() {
  let onAuth;
  const auth = {
    currentUser: { uid: 'user-a', getIdToken: async () => 'verified-token-a' },
    onAuthStateChanged(callback) { onAuth = callback; return () => {}; },
  };
  const pending = []; const requests = []; const results = [];
  const client = createDiaryClient({ auth, fetchImpl(url, options) {
    requests.push({ url, options });
    const d = deferred(); pending.push(d); return d.promise;
  } });
  const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
  const signIn = (uid) => { auth.currentUser = uid ? { uid, getIdToken: async () => `token-${uid}` } : null; onAuth(auth.currentUser); };
  return { auth, client, pending, requests, results, settle, signIn };
}
const response = (text) => ({ json: async () => ({ text }) });

test('verified current-session response is delivered and request uses Bearer token', async () => {
  const f = fixture(); const task = f.client.submit('Diary A', (text) => f.results.push(text));
  await f.settle(); f.pending[0].resolve(response('Correction A')); await task;
  assert.deepEqual(f.results, ['Correction A']);
  assert.equal(f.requests[0].options.headers.Authorization, 'Bearer verified-token-a');
  assert.equal(f.requests[0].options.signal.aborted, false);
  f.client.dispose();
});
for (const uid of ['user-b', 'user-a']) {
  test(`sign-out and re-sign-in as ${uid} cannot receive previous session response`, async () => {
    const f = fixture(); const task = f.client.submit('Private diary A', (text) => f.results.push(text));
    await f.settle(); f.signIn(null); f.signIn(uid);
    assert.equal(f.requests[0].options.signal.aborted, true);
    // Even if the transport ignores cancellation, the stale result stays hidden.
    f.pending[0].resolve(response('Private correction A')); await task;
    assert.deepEqual(f.results, []);
    f.client.dispose();
  });
}

test('newer request wins when old response arrives last', async () => {
  const f = fixture();
  const first = f.client.submit('First', (text) => f.results.push(text)); await f.settle();
  const second = f.client.submit('Second', (text) => f.results.push(text)); await f.settle();
  f.pending[1].resolve(response('Second result')); await second;
  f.pending[0].resolve(response('First result')); await first;
  assert.deepEqual(f.results, ['Second result']);
  f.client.dispose();
});

test('unmount/dispose prevents late response insertion', async () => {
  const f = fixture(); const task = f.client.submit('Private diary', (text) => f.results.push(text));
  await f.settle(); f.client.dispose(); f.pending[0].resolve(response('Late')); await task;
  assert.deepEqual(f.results, []);
});

test('auth change while obtaining token prevents any API request', async () => {
  const f = fixture(); const token = deferred(); f.auth.currentUser.getIdToken = () => token.promise;
  const task = f.client.submit('Private diary', (text) => f.results.push(text));
  f.signIn('user-b'); token.resolve('old-token'); await task;
  assert.equal(f.requests.length, 0); assert.deepEqual(f.results, []);
  f.client.dispose();
});
