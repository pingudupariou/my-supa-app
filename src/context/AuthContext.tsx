import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, AuthError } from '@supabase/supabase-js';

export type AppRole = 'admin' | 'finance' | 'board' | 'investisseur' | 'lecteur' | 'bureau_etude' | 'production' | 'marketing';
export type TabPermission = 'hidden' | 'read' | 'write';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  userRole: AppRole;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  getTabPermission: (tabKey: string) => TabPermission;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<AppRole>('lecteur');
  const [permissions, setPermissions] = useState<Record<string, Record<string, TabPermission>>>({});

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        setTimeout(() => fetchUserRole(session.user.id), 0);
        setTimeout(() => fetchPermissions(), 0);
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) { fetchUserRole(session.user.id); fetchPermissions(); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data } = await supabase.from('user_roles' as any).select('role').eq('user_id', userId).single();
      if (data) setUserRole((data as any).role as AppRole);
    } catch { setUserRole('lecteur'); }
  };

  const fetchPermissions = async () => {
    try {
      const { data } = await supabase.from('tab_permissions' as any).select('*');
      if (data) {
        const matrix: Record<string, Record<string, TabPermission>> = {};
        (data as any[]).forEach((p: any) => { if (!matrix[p.role]) matrix[p.role] = {}; matrix[p.role][p.tab_key] = p.permission; });
        setPermissions(matrix);
      }
    } catch {}
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };
  const signUp = async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName }, emailRedirectTo: `${window.location.origin}/` } });
    return { error };
  };
  const signOut = async () => { await supabase.auth.signOut(); setUser(null); };
  const isAdmin = userRole === 'admin';
  const getTabPermission = (tabKey: string): TabPermission => {
    if (isAdmin) return 'write';
    const rolePerms = permissions[userRole];
    if (!rolePerms) return 'write';
    return rolePerms[tabKey] || 'write';
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, userRole, signIn, signUp, signOut, getTabPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
