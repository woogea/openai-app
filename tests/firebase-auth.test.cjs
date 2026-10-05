const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const nock = require('nock');
const ts = require('typescript');
const { createFirebaseTokenVerifier, verifyFirebaseIdToken } = require('../lib/firebase-auth');
const { getApps, deleteApp } = require('firebase-admin/app');
const projectId = 'diary-security-test';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicPem = publicKey.export({ type: 'spki', format: 'pem' });
const savedEnv = {};
const envNames = ['FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'FIREBASE_AUTH_EMULATOR_HOST', 'OPENAI_API_KEY'];

function jwt(claims = {}, key = privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', kid: 'local-test-key', typ: 'JWT' };
  const payload = { iss: `https://securetoken.google.com/${projectId}`, aud: projectId,
    sub: 'test-user', iat: now - 10, auth_time: now - 20, exp: now + 3600, ...claims };
  const input = [header, payload].map((v) => Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');
  return `${input}.${sign('RSA-SHA256', Buffer.from(input), key).toString('base64url')}`;
}

before(() => {
  for (const name of envNames) savedEnv[name] = process.env[name];
  process.env.FIREBASE_PROJECT_ID = projectId;
  delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
  // This is an offline fixture, never a real provider credential.
  process.env.OPENAI_API_KEY = 'test-only-not-a-real-key';
  nock.disableNetConnect();
  nock('https://www.googleapis.com').persist()
    .get('/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com')
    .reply(200, { 'local-test-key': publicPem }, { 'Cache-Control': 'public, max-age=3600' });
});

after(async () => {
  nock.cleanAll(); nock.enableNetConnect();
  for (const name of envNames) {
    if (savedEnv[name] === undefined) delete process.env[name];
    else process.env[name] = savedEnv[name];
  }
  await Promise.all(getApps().filter((app) => app.name === 'diary-auth').map(deleteApp));
});

test('Firebase Admin accepts a correctly signed ID token for the trusted project', async () => {
  const user = await verifyFirebaseIdToken(jwt());
  assert.equal(user.uid, 'test-user');
  assert.equal(user.aud, projectId);
});

test('Firebase Admin rejects an expired signed token', async () => {
  await assert.rejects(verifyFirebaseIdToken(jwt({ exp: Math.floor(Date.now() / 1000) - 3600 })), /expired/i);
});

test('Firebase Admin rejects a token from another project', async () => {
  await assert.rejects(verifyFirebaseIdToken(jwt({ aud: 'other-project' })), /audience/i);
});

test('Firebase Admin rejects a token with the wrong issuer', async () => {
  await assert.rejects(verifyFirebaseIdToken(jwt({ iss: 'https://attacker.invalid' })), /issuer/i);
});

test('Firebase Admin rejects a token signed by an untrusted private key', async () => {
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
  await assert.rejects(verifyFirebaseIdToken(jwt({}, other.privateKey)), /signature/i);
});

test('Firebase Admin rejects an unsigned token', async () => {
  const token = Buffer.from('{"alg":"none"}').toString('base64url') + '.'
    + Buffer.from(JSON.stringify({ sub: 'test-user', aud: projectId })).toString('base64url') + '.';
  await assert.rejects(verifyFirebaseIdToken(token));
});

test('missing trusted project fails closed before auth lookup', async () => {
  let lookedUp = false;
  const verify = createFirebaseTokenVerifier({ projectId: '', authForProject() { lookedUp = true; } });
  await assert.rejects(verify('token'), { code: 'auth/configuration-missing' });
  assert.equal(lookedUp, false);
});

test('emulator configuration cannot accept unsigned tokens on the paid route', async () => {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  try { await assert.rejects(verifyFirebaseIdToken(jwt()), { code: 'auth/configuration-missing' }); }
  finally { delete process.env.FIREBASE_AUTH_EMULATOR_HOST; }
});

function loadRoute() {
  const filename = path.join(__dirname, '../pages/api/diary.js');
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const routeModule = new Module(filename, module);
  routeModule.filename = filename;
  routeModule.paths = Module._nodeModulePaths(path.dirname(filename));
  routeModule._compile(outputText, filename);
  return routeModule.exports;
}
function response() {
  return { headers: {}, setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; } };
}

test('real API route accepts verified user and forwards bounded request to mocked provider', async () => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'Corrected' } }] }) };
  };
  try {
    const route = loadRoute(); const res = response();
    await route.default({ method: 'POST', headers: { authorization: `Bearer ${jwt()}` }, body: { diary: 'Hello diary.' } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { text: 'Corrected' });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, 'https://api.openai.com/v1/chat/completions');
    const body = JSON.parse(requests[0].options.body);
    assert.equal(body.max_tokens, 2000);
    assert.equal(body.messages.at(-1).content, 'Hello diary.');
    assert.equal(requests[0].options.headers.Authorization, 'Bearer test-only-not-a-real-key');
    assert.ok(requests[0].options.signal instanceof AbortSignal);
    assert.equal(route.config.api.bodyParser.sizeLimit, '32kb');
  } finally { global.fetch = originalFetch; }
});

test('real API route denies a cross-project user before calling the provider', async () => {
  const originalFetch = global.fetch; let called = false;
  global.fetch = async () => { called = true; throw new Error('must not call provider'); };
  try {
    const route = loadRoute(); const res = response();
    await route.default({ method: 'POST', headers: { authorization: `Bearer ${jwt({ aud: 'other-project' })}` }, body: { diary: 'Hello diary.' } }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(called, false);
  } finally { global.fetch = originalFetch; }
});
