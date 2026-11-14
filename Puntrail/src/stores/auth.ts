import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';

import { fetchProfile, getSession, onAuthStateChange, signInWithPassword, signOut } from '@/lib/supabase';

type AuthRole = 'visitor' | 'admin' | null;

interface AuthState {
  session: Session | null;
  role: AuthRole;
  displayName: string | null;
  isInitializing: boolean;
  isSigningIn: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
}

async function loadProfileForSession(session: Session | null): Promise<{
  role: AuthRole;
  displayName: string | null;
}> {
  if (!session?.user) return { role: null, displayName: null };
  const result = await fetchProfile(session.user.id);
  if (result.error) return { role: null, displayName: null };
  return { role: result.role, displayName: result.displayName };
}

export const useAuth = create<AuthState>()((set, get) => ({
  session: null,
  role: null,
  displayName: null,
  isInitializing: true,
  isSigningIn: false,
  error: null,

  initialize: async () => {
    const session = await getSession();
    const profile = await loadProfileForSession(session);
    set({
      session,
      role: profile.role,
      displayName: profile.displayName,
      isInitializing: false,
    });

    onAuthStateChange((nextSession) => {
      if (!nextSession) {
        set({ session: null, role: null, displayName: null });
        return;
      }
      set({ session: nextSession });
      void loadProfileForSession(nextSession).then((nextProfile) => {
        set({ role: nextProfile.role, displayName: nextProfile.displayName });
      });
    });
  },

  signIn: async (email: string, password: string) => {
    set({ isSigningIn: true, error: null });
    const { session, error } = await signInWithPassword(email, password);

    if (error || !session) {
      set({ isSigningIn: false, error: 'Invalid email or password.' });
      return false;
    }

    const profile = await loadProfileForSession(session);
    set({
      session,
      role: profile.role,
      displayName: profile.displayName,
      isSigningIn: false,
      error: null,
    });
    return true;
  },

  signOut: async () => {
    await signOut();
    set({ session: null, role: null, displayName: null, error: null });
  },

  refreshProfile: async () => {
    const { session } = get();
    const profile = await loadProfileForSession(session);
    set({ role: profile.role, displayName: profile.displayName });
  },

  clearError: () => set({ error: null }),
}));