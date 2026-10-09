import { useState } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { useAuthState } from '../hooks/useAuthState';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

export default function SignInForm() {
  const { isSignedIn, userName } = useAuthState();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function signInOrOut() {
    setBusy(true);
    setError('');
    try {
      if (isSignedIn) {
        await firebase.auth().signOut();
      } else {
        await firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider());
      }
    } catch {
      setError('サインインの操作を完了できませんでした。もう一度お試しください。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {isSignedIn && <span>{userName} </span>}
      <button disabled={busy} onClick={signInOrOut}>
        {isSignedIn ? 'Sign out' : 'Sign in with Google'}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
