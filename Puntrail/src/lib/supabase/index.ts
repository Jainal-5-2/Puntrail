export { supabase } from './client';

export {
  signInWithPassword,
  signOut,
  getSession,
  getCurrentUser,
  fetchProfile,
  onAuthStateChange,
} from './auth';

export type { AuthResult, ProfileResult } from './auth';