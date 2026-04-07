import { useAuthContext } from '../../contexts/AuthContext';

export function useAuth() {
  const { user, loading, signInWithGoogle, signInWithEmail, signOut } = useAuthContext();
  return { user, loading, signInWithGoogle, signInWithEmail, signOut };
}
