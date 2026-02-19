import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface ClientInfo {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  tenant_id: string;
  tenant_name?: string;
}

interface PortalAuthContextType {
  user: User | null;
  session: Session | null;
  client: ClientInfo | null;
  loading: boolean;
  clientLoading: boolean;
  isWrongUserType: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshClient: () => Promise<void>;
}

const PortalAuthContext = createContext<PortalAuthContextType | undefined>(undefined);

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientLoading, setClientLoading] = useState(false);
  const [isWrongUserType, setIsWrongUserType] = useState(false);

  const fetchClientRecord = async (userId: string) => {
    setClientLoading(true);
    setIsWrongUserType(false);
    try {
      const { data: clientData, error } = await supabase
        .from('clients')
        .select(`
          id, name, email, phone, tenant_id,
          tenants:tenant_id (name)
        `)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('[PortalAuth] Error fetching client:', error.message);
        setClient(null);
      } else if (clientData) {
        setClient({
          id: clientData.id,
          name: clientData.name,
          email: clientData.email,
          phone: clientData.phone,
          tenant_id: clientData.tenant_id,
          tenant_name: (clientData.tenants as any)?.name,
        });
      } else {
        // User exists but has no client record — likely a tenant user on portal
        console.log('[PortalAuth] No client record found — wrong user type');
        setClient(null);
        setIsWrongUserType(true);
      }
    } catch (err) {
      console.error('[PortalAuth] Unexpected error fetching client:', err);
      setClient(null);
    } finally {
      setClientLoading(false);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Only synchronous state updates inside the callback
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Defer Supabase calls with setTimeout to prevent deadlock
        setTimeout(() => fetchClientRecord(session.user.id), 0);
      } else {
        setClient(null);
        setIsWrongUserType(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      // Always resolve loading regardless of session presence
      setLoading(false);
      if (session?.user) {
        fetchClientRecord(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshClient = async () => {
    if (!user) return;
    
    try {
      const { data: clientData, error } = await supabase
        .from('clients')
        .select(`
          id,
          name,
          email,
          phone,
          tenant_id,
          tenants:tenant_id (name)
        `)
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error('[PortalAuth] Error refreshing client:', error);
        setClient(null);
        return;
      }
      
      if (clientData) {
        setClient({
          id: clientData.id,
          name: clientData.name,
          email: clientData.email,
          phone: clientData.phone,
          tenant_id: clientData.tenant_id,
          tenant_name: (clientData.tenants as any)?.name,
        });
      } else {
        console.log('[PortalAuth] No client record found on refresh');
        setClient(null);
      }
    } catch (err) {
      console.error('[PortalAuth] Unexpected error refreshing client:', err);
      setClient(null);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setClient(null);
  };

  return (
    <PortalAuthContext.Provider value={{ user, session, client, loading, clientLoading, isWrongUserType, signIn, signOut, refreshClient }}>
      {children}
    </PortalAuthContext.Provider>
  );
}

export function usePortalAuth() {
  const context = useContext(PortalAuthContext);
  if (context === undefined) {
    throw new Error('usePortalAuth must be used within a PortalAuthProvider');
  }
  return context;
}
