const { getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

function configurationError() {
  return Object.assign(new Error('Firebase project configuration is required'), {
    code: 'auth/configuration-missing',
  });
}

function createFirebaseTokenVerifier({ projectId, authForProject }) {
  return async function verifyIdToken(token) {
    if (!projectId) throw configurationError();
    // Firebase Admin validates signature, expiry, audience, issuer and subject.
    // This verifies ID tokens; it does not opt into credentialed revocation checks.
    return authForProject(projectId).verifyIdToken(token);
  };
}

async function verifyFirebaseIdToken(token) {
  // Emulator tokens are unsigned. Never allow an accidental emulator setting
  // to disable signature verification on this paid API endpoint.
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) throw configurationError();
  const projectId = process.env.FIREBASE_PROJECT_ID
    || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  return createFirebaseTokenVerifier({
    projectId,
    authForProject(id) {
      const name = 'diary-auth';
      const app = getApps().find((candidate) => candidate.name === name)
        || initializeApp({ projectId: id }, name);
      if (app.options.projectId !== id) throw configurationError();
      return getAuth(app);
    },
  })(token);
}

module.exports = { createFirebaseTokenVerifier, verifyFirebaseIdToken };
