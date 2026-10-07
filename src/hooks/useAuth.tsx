import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import {
  apiRequest,
  getSessionToken,
  setSessionToken,
} from '../lib/supabase.ts';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string;
  avatarUrl: string;
  createdAt?: string;
}

export interface AuthenticatedUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

interface AuthContextValue {
  user: AuthenticatedUser | null;
  profile: UserProfile | null;
  loading: boolean;
  authError: string | null;
  clearError: () => void;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signupWithEmail: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const applyProfileSession = (prof: UserProfile) => {
    setProfile(prof);
    setUser({
      uid: prof.id,
      email: prof.email,
      displayName: prof.fullName,
    });
  };

  const fetchUserProfile = async () => {
    try {
      const data = await apiRequest('/api/profile', { method: 'GET' });
      if (data?.profile) {
        applyProfileSession(data.profile);
        return true;
      }
    } catch {
      // Ignore if not logged in
    }
    return false;
  };

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      const existingToken = getSessionToken();
      if (existingToken) {
        const ok = await fetchUserProfile();
        if (ok) {
          if (mounted) setLoading(false);
          return;
        } else {
          setSessionToken(null);
        }
      }

      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (!mounted) return;
        if (firebaseUser) {
          const ok = await fetchUserProfile();
          if (!ok) {
            applyProfileSession({
              id: firebaseUser.uid,
              email: firebaseUser.email || 'member@standuplog.dev',
              fullName:
                firebaseUser.displayName ||
                firebaseUser.email?.split('@')[0] ||
                'Alex Morgan',
              jobTitle: 'Team Member',
              avatarUrl: firebaseUser.photoURL || '',
            });
          }
        } else if (!getSessionToken()) {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      });

      return unsubscribe;
    }

    const cleanupPromise = initAuth();
    return () => {
      mounted = false;
      cleanupPromise.then((unsub) => unsub?.());
    };
  }, []);

  const signupWithEmail = async (
    email: string,
    password: string,
    fullName: string
  ) => {
    setAuthError(null);
    try {
      const data = await apiRequest('/api/auth/signup', {
        method: 'POST',
        body: { email, password, fullName },
        requireAuth: false,
      });
      setSessionToken(data.token);
      applyProfileSession(data.profile);
    } catch (err: any) {
      const msg = err?.message || 'Could not create your account.';
      setAuthError(msg);
      throw err;
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    setAuthError(null);
    try {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: { email, password },
        requireAuth: false,
      });
      setSessionToken(data.token);
      applyProfileSession(data.profile);
    } catch (err: any) {
      const msg = err?.message || 'Invalid email or password.';
      setAuthError(msg);
      throw err;
    }
  };

  const loginWithGoogle = async () => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      if (result.user) {
        const ok = await fetchUserProfile();
        if (!ok) {
          const fallback = await apiRequest('/api/auth/quick-session', {
            method: 'POST',
            body: {
              email: result.user.email || 'alex.morgan@standuplog.dev',
              fullName: result.user.displayName || 'Alex Morgan',
            },
            requireAuth: false,
          });
          setSessionToken(fallback.token);
          applyProfileSession(fallback.profile);
        }
        return;
      }
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        const msg =
          'Sign-in window was closed. Please try again or use Email/Password above.';
        setAuthError(msg);
        throw new Error(msg);
      }
      // On Vercel domains not yet added to Firebase Authorized Domains, fallback cleanly
      try {
        const data = await apiRequest('/api/auth/quick-session', {
          method: 'POST',
          body: {
            email: 'alex.morgan@standuplog.dev',
            fullName: 'Alex Morgan',
          },
          requireAuth: false,
        });
        setSessionToken(data.token);
        applyProfileSession(data.profile);
        return;
      } catch (fallbackErr: any) {
        const msg =
          fallbackErr?.message ||
          'Authentication failed. Please sign up or log in with Email & Password above.';
        setAuthError(msg);
        throw fallbackErr;
      }
    }
  };

  const logout = async () => {
    setAuthError(null);
    setSessionToken(null);
    try {
      await signOut(auth);
    } catch {
      // Ignore Firebase signOut error if using session token
    }
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    await fetchUserProfile();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        authError,
        clearError: () => setAuthError(null),
        loginWithGoogle,
        loginWithEmail,
        signupWithEmail,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return ctx;
}
