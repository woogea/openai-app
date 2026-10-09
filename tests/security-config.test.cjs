const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

test('Next config does not make secrets available to client compilation', () => {
  const config = require('../next.config');
  assert.equal(config.env, undefined);
});

test('new review branch is excluded from Vercel automatic deployments', () => {
  const config = require('../vercel.json');
  assert.equal(config.git.deploymentEnabled['security/openai-app-auth-20261005'], false);
  assert.equal(config.git.deploymentEnabled.main, undefined);
});

test('API/client code does not log tokens, environment or diary content', () => {
  for (const file of ['pages/api/diary.js', 'lib/diary-handler.js', 'components/signinform.tsx', 'lib/diary-client.js']) {
    assert.doesNotMatch(fs.readFileSync(path.join(root, file), 'utf8'), /console\.(?:log|error|debug|info)/);
  }
});

test('client sends Bearer token rather than trusted client identity', () => {
  const source = fs.readFileSync(path.join(root, 'lib/diary-client.js'), 'utf8');
  assert.match(source, /getIdToken\(\)/);
  assert.match(source, /Authorization: `Bearer \$\{token\}`/);
});
