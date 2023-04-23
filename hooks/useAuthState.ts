import { useEffect, useState } from 'react';

import firebase from 'firebase/compat/app'
import 'firebase/compat/auth'

export type AuthState = {
    isSignedIn: boolean;
    isLoading: boolean;
    userId: string | undefined;
    userName: string | undefined;
    avatarUrl: string | undefined;
}

const INITIAL_AUTH_STATE: AuthState = {
    isSignedIn: false,
    isLoading: true,
    userId: undefined,
    userName: undefined,
    avatarUrl: undefined,
}


export function useAuthState(): AuthState  {
    const [authState, setAuthState] = useState<AuthState>(INITIAL_AUTH_STATE);
    useEffect(()=>{
        const unsubscribe = firebase.auth().onAuthStateChanged(
            (user) => {
                if (user) {
                    setAuthState({
                        isSignedIn: true,
                        isLoading: false,
                        userId: user.uid,
                        userName: user.displayName,
                        avatarUrl: user.photoURL,
                    })
                } else {
                    setAuthState({...INITIAL_AUTH_STATE, isLoading: false})
                }
            }
        )
        return () => unsubscribe();
    },[])
    return authState
}

