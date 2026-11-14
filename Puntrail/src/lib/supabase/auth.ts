import type { AuthError, Session, User } from '@supabase/supabase-js';

import { supabase } from './client';

export interface AuthResult {
  session: Session | null;
  error: AuthError | null;
}

export interface ProfileResult {
  role: 'visitor' | 'admin' | null;
  displayName: string | null;
  error: Error | null;
}

export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { session: data.session, error };
}

export async function signOut(): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getCurrentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function fetchProfile(userId: string): Promise<ProfileResult> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role, display_name')
    .eq('id', userId)
    .single();

  if (error) {
    return { role: null, displayName: null, error: new Error(error.message) };
  }

  return {
    role: data.role as 'visitor' | 'admin',
    displayName: data.display_name,
    error: null,
  };
}

export function onAuthStateChange(
  callback: (session: Session | null) => void,
): { unsubscribe: () => void } {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return { unsubscribe: () => data.subscription.unsubscribe() };
}