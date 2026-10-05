import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, AuthError } from '@supabase/supabase-js';

export type AppRole = 'admin' | 'finance' | 'board' | 'investisseur' | 'lecteur' | 'bureau_etude' | 'production' | 'marketing';
export type TabPermission = 'hidden' | 'read' | 'write';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isApproved: boolean;
  approvalLoading: boolean;
  userRole: AppRole;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  getTabPermission: (tabKey: string) => TabPermission;
  refreshAccess: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<AppRole>('lecteur');
  const [isApproved, setIsApproved] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState(true);
  const [permissions, setPermissions] = useState<Record<string, Record<string, TabPermission>>>({});
  const activeUserId = useRef<string | null>(null);
  const accessVersion = useRef(0);

  const refreshAccess = async (initial = false) => {
    const userId = activeUserId.current;
    if (!userId) return;
    const version = ++accessVersion.current;
    if (initial) setApprovalLoading(true);
    try {
      const [roleResult, permissionResult] = await Promise.all([
        supabase.from('user_roles' as any).select('role, approved').eq('user_id', userId).single(),
        supabase.from('tab_permissions' as any).select('*'),
      ]);
      if (activeUserId.current !== userId || accessVersion.current !== version) return;
      if (roleResult.error || permissionResult.error) {
        setUserRole('lecteur'); setIsApproved(false); setPermissions({});
        return;
      }
      const role = roleResult.data as unknown as { role: AppRole; approved: boolean } | null;
      const matrix: Record<string, Record<string, TabPermission>> = {};
      for (const p of (permissionResult.data ?? []) as unknown as { role: string; tab_key: string; permission: TabPermission }[]) {
        matrix[p.role] ??= {};
        matrix[p.role][p.tab_key] = p.permission;
      }
      setUserRole(role?.role ?? 'lecteur');
      setIsApproved(!!role?.approved);
      setPermissions(matrix);
    } finally {
      if (activeUserId.current === userId && accessVersion.current === version) setApprovalLoading(false);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      const changed = activeUserId.current !== (session?.user.id ?? null);
      activeUserId.current = session?.user.id ?? null;
      if (session?.user) {
        if (changed) { setUserRole('lecteur'); setPermissions({}); setIsApproved(false); setApprovalLoading(true); }
        setTimeout(() => { void refreshAccess(changed); }, 0);
      } else {
        accessVersion.current++;
        setUserRole('lecteur'); setPermissions({});
        setIsApproved(false);
        setApprovalLoading(false);
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      activeUserId.current = session?.user.id ?? null;
      if (session?.user) { void refreshAccess(true); }
      else { setApprovalLoading(false); }
    });
    // Refresh role, approval and permissions together, including after an admin changes a role.
    const refresh = () => { if (document.visibilityState === 'visible') void refreshAccess(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const interval = setInterval(refresh, 10000);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      clearInterval(interval);
    };
  }, []);

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
    const explicit = rolePerms?.[tabKey];
    if (explicit) return explicit;
    // Chat and Plan atelier must be explicitly granted (read or write); hidden otherwise,
    // matching what the Administration page shows for a missing permission.
    if (tabKey === 'chat' || tabKey === 'plan-atelier') return 'hidden';
    return 'write';
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, isApproved, approvalLoading, userRole, signIn, signUp, signOut, getTabPermission, refreshAccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
