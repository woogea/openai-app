// Import FirebaseAuth and firebase.
import React, { use } from 'react';
import StyledFirebaseAuth from 'react-firebaseui/StyledFirebaseAuth';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { useAuthState } from '../hooks/useAuthState'

// Configure Firebase.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
}

console.log(process.env)
console.log(firebaseConfig)
if(!firebase.apps.length){
    firebase.initializeApp(firebaseConfig);
}

// Configure FirebaseUI.
const uiConfig = {
  // Popup signin flow rather than redirect flow.
  signInFlow: 'popup',
  // Redirect to /signedIn after sign in is successful. Alternatively you can provide a callbacks.signInSuccess function.
  signInSuccessUrl: '/',
  // We will display Google and Facebook as auth providers.
  signInOptions: [
    firebase.auth.GoogleAuthProvider.PROVIDER_ID,
  ],
};

function SignInForm() {
    const { isSignedIn, userName } = useAuthState()
    console.log(isSignedIn, userName)
    if(!isSignedIn){
        return (
            <div>
                <StyledFirebaseAuth uiConfig={uiConfig} firebaseAuth={firebase.auth()} />
            </div>
        );
    } else {
        return (
            <div>
                Logout {userName} < button onClick={() => firebase.auth().signOut()}>Sign out!</button>
            </div>
        )
    }
}

export default SignInForm