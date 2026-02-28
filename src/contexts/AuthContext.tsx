import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { setUser as setTrackingUser, addBreadcrumb, clearUser as clearTrackingUser } from '@/lib/errorTracking';
import * as Sentry from '@sentry/react';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, isBetaFounder?: boolean) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Track auth state changes for error monitoring
        Sentry.setUser(session?.user ? { id: session.user.id } : null);
        if (session?.user) {
          setTrackingUser(session.user.id);
          addBreadcrumb({
            type: 'user',
            category: 'auth',
            message: `Auth state: ${event}`,
            data: { event },
          });
        } else {
          clearTrackingUser();
          addBreadcrumb({
            type: 'user',
            category: 'auth',
            message: `Auth state: ${event} (signed out)`,
            data: { event },
          });
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log('[AuthContext] signIn called');
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      console.error('[AuthContext] signInWithPassword error:', error.message);
    } else {
      console.log('[AuthContext] signInWithPassword successful');
    }
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string, isBetaFounder: boolean = false) => {
    console.log('[AuthContext] signUp called, isBetaFounder:', isBetaFounder);
    const redirectUrl = `${window.location.origin}/dashboard`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          is_beta_founder: isBetaFounder,
        },
      },
    });
    
    if (error) {
      console.error('[AuthContext] signUp error:', error.message, error);
      return { error: error as Error | null };
    }
    
    console.log('[AuthContext] signUp response:', {
      user: data.user?.id,
      identities: data.user?.identities?.length,
      emailConfirmed: data.user?.email_confirmed_at,
    });

    // Send verification email via our custom edge function (bypasses Supabase's built-in email)
    if (data.user && !data.user.email_confirmed_at) {
      try {
        console.log('[AuthContext] Sending verification email via edge function...');
        const { error: emailError } = await supabase.functions.invoke('send-auth-email', {
          body: {
            email,
            type: 'signup',
            redirect_to: redirectUrl,
            user: {
              email,
              user_metadata: { full_name: fullName },
            },
          },
        });
        
        if (emailError) {
          console.error('[AuthContext] Failed to send verification email:', emailError);
        } else {
          console.log('[AuthContext] Verification email sent successfully');
        }
      } catch (err) {
        console.error('[AuthContext] Error calling send-auth-email:', err);
      }
    }
    
    return { error: null };
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Sign out error:', error);
        throw error;
      }
    } finally {
      // Always clear local state regardless of API result
      setUser(null);
      setSession(null);
    }
  };

  const refreshSession = async () => {
    console.log('[AuthContext] Refreshing session...');
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      console.error('[AuthContext] Session refresh error:', error);
      throw error;
    }
    if (data.session) {
      console.log('[AuthContext] Session refreshed successfully');
      setSession(data.session);
      setUser(data.session.user);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
