/**
 * App.tsx - Minimal entry point
 * 
 * This file is kept small to reduce initial bundle size.
 * The authenticated layout is lazy-loaded after login.
 */
import type { Session } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
import { lazy,Suspense,useEffect,useState } from 'react';
import { supabase,SupabaseDb } from './services/supabaseService';
import { User } from './types';

// Lazy load pages
const LoginPage = lazy(() => import('./pages/LoginPage'));
const AuthenticatedApp = lazy(() => import('./components/layout/AuthenticatedApp'));

// Minimal loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center h-full min-h-[400px]">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
      <p className="text-sm text-[var(--text-muted)]">Loading...</p>
    </div>
  </div>
);

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const authFallback = window.setTimeout(() => {
      if (isMounted) setAuthLoading(false);
    }, 5000);

    const syncUser = async (session: Session | null) => {
      if (!session?.user) {
        setCurrentUser(null);
        return;
      }

      try {
        const user = await SupabaseDb.getUserByAuthId(session.user.id);
        if (!isMounted) return;

        if (user) {
          setCurrentUser(user);
        } else {
          setCurrentUser(null);
          await supabase.auth.signOut();
        }
      } catch (_error) {
        if (!isMounted) return;
        setCurrentUser(null);
      }
    };

    const hydrateSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;
        await syncUser(session);
      } catch (_error) {
        if (!isMounted) return;
        setCurrentUser(null);
        await supabase.auth.signOut().catch(() => undefined);
      } finally {
        if (isMounted) {
          clearTimeout(authFallback);
          setAuthLoading(false);
        }
      }
    };

    void hydrateSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncUser(session);
      if (isMounted) setAuthLoading(false);
    });

    return () => {
      isMounted = false;
      clearTimeout(authFallback);
      subscription?.unsubscribe();
    };
  }, []);

  const handleLogout = () => {
    void supabase.auth.signOut();
    setCurrentUser(null);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-theme-bg flex items-center justify-center">
        <PageLoader />
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-theme-bg flex items-center justify-center">
        <PageLoader />
      </div>
    }>
      {currentUser ? (
        <AuthenticatedApp currentUser={currentUser} onLogout={handleLogout} />
      ) : (
        <LoginPage onLogin={setCurrentUser} />
      )}
    </Suspense>
  );
}
