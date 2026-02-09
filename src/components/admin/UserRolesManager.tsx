import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { AppRole } from '@/context/AuthContext';

const ROLES: AppRole[] = ['admin', 'finance', 'board', 'investisseur', 'lecteur', 'bureau_etude', 'production', 'marketing'];

interface UserWithRole {
  id: string;
  email: string;
  display_name: string;
  role: AppRole;
}

export function UserRolesManager() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      // Fetch auth users via edge function
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch(
        `https://twkcoxagbajvopzzinor.supabase.co/functions/v1/list-users`,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      const authUsers: { id: string; email: string; display_name: string }[] = await res.json();

      // Fetch roles
      const { data: rolesData } = await supabase.from('user_roles' as any).select('*');
      const rolesMap = new Map<string, AppRole>();
      if (rolesData) {
        (rolesData as any[]).forEach((r: any) => rolesMap.set(r.user_id, r.role));
      }

      // Merge
      const merged: UserWithRole[] = authUsers.map(u => ({
        id: u.id,
        email: u.email,
        display_name: u.display_name,
        role: rolesMap.get(u.id) || 'lecteur',
      }));

      setUsers(merged);
    } catch (e) {
      console.error('Error fetching users:', e);
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (userId: string, newRole: AppRole) => {
    try {
      await supabase.from('user_roles' as any).upsert({ user_id: userId, role: newRole } as any, { onConflict: 'user_id' });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast({ title: 'Rôle mis à jour' });
    } catch { toast({ title: 'Erreur', variant: 'destructive' }); }
  };

  if (loading) return <Loader2 className="h-6 w-6 animate-spin mx-auto" />;

  return (
    <Card>
      <CardHeader><CardTitle>Gestion des Utilisateurs</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rôle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(user => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.display_name || '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  <Select value={user.role} onValueChange={v => updateRole(user.id, v as AppRole)}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Aucun utilisateur</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
