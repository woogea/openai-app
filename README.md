# English diary correction app

A Next.js Pages Router app with Firebase Google sign-in and an OpenAI-backed correction endpoint.

## Local development

Use Node.js 22 or later. npm/package-lock.json is the dependency source of truth.

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run dev
```

Configure these variables in your local environment or an untracked `.env.local`:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `OPENAI_API_KEY` (server only; never put it in `next.config.js` `env`)
- Optional `FIREBASE_PROJECT_ID`: trusted server-side project ID override, which must match the client Firebase project

No credential values belong in Git. Firebase Admin's ID-token verification uses the configured project ID and Firebase public signing certificates. This endpoint does not use service-account operations or check revoked sessions. Revocation checks require additional trusted server configuration and are not enabled by this patch. Authentication emulator settings are rejected by the endpoint so unsigned emulator tokens cannot authorize paid requests.

## Endpoint security

`POST /api/diary` requires `Authorization: Bearer <Firebase ID token>`. The server verifies the signature, issuer, audience and expiry before calling OpenAI. Signing in on the page alone is not trusted by the API. Missing/invalid tokens return 401; missing trusted project configuration returns 503. A valid user can submit a diary of up to 6000 characters. The request body is limited to 32 KiB and responses are not cached. OpenAI calls have a 20-second timeout and a 2000-token output cap. Errors do not expose provider payloads or log tokens/diary text.

Pending client requests are aborted on authentication changes/unmount. Responses are tied to the current user object and a monotonically increasing request generation, so signing out and back in (even as the same user) cannot insert an old diary response into a new session.

These limits are per request, not per-user quotas or a global spending limit. A public production deployment still needs appropriate abuse controls and billing monitoring. The route uses the existing `gpt-3.5-turbo` model; test model availability with the intended account before any separately authorized deployment.

## Dependency changes

- Next.js is pinned to 15.5.27, the September 2026 maintenance-LTS security release. The application remains on Pages Router with React 18.
- Firebase is updated and Firebase Admin verifies server-side tokens.
- The incompatible React FirebaseUI wrapper is replaced by Firebase's Google popup API; sign-in and sign-out remain available.
- Unused PM2 and its vulnerable vm2/PAC dependency chain are removed. The existing startup command remains `next start`.
- The old OpenAI SDK/Axios dependency is replaced with Node's built-in fetch to the same fixed API endpoint.
- Scoped transitive security overrides pin PostCSS 8.5.28 (Next), grpc-js 1.14.5 (Firebase Firestore), and uuid 11.1.1 (gaxios). Gaxios uses the unchanged CommonJS v4() API. Revisit these overrides when upstream dependency ranges catch up.
- The stale second lockfile is removed; use `npm ci` for reproducible installs.

## Validation and deployment

`npm test` covers authorization failure, valid-user flow, input/method limits, provider errors, sensitive logging prevention, Firebase token validation with local test keys and mocked public certificates, and deployment safeguards. Tests never call the paid API or use real credentials.

The review branch `security/openai-app-auth-20261005` is explicitly excluded from Vercel Git deployments in `vercel.json`. This change does not disable deployments for `main`. A draft PR is for review only: merging or deploying requires separate approval. No production environment variables or keys were read or changed during this work.
