import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Loader2, Check, X } from 'lucide-react';
import { AppRole } from '@/context/AuthContext';

const ROLES: AppRole[] = ['admin', 'finance', 'board', 'investisseur', 'lecteur', 'bureau_etude', 'production', 'marketing'];

interface UserWithRole {
  id: string;
  email: string;
  display_name: string;
  role: AppRole;
  approved: boolean;
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
      const rolesMap = new Map<string, { role: AppRole; approved: boolean }>();
      if (rolesData) {
        (rolesData as any[]).forEach((r: any) => rolesMap.set(r.user_id, { role: r.role, approved: !!r.approved }));
      }

      // Merge
      const merged: UserWithRole[] = authUsers.map(u => {
        const r = rolesMap.get(u.id);
        return {
          id: u.id,
          email: u.email,
          display_name: u.display_name,
          role: r?.role || 'lecteur',
          approved: r?.approved ?? false,
        };
      });

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

  const setApproval = async (userId: string, approved: boolean) => {
    try {
      await supabase.from('user_roles' as any).update({ approved } as any).eq('user_id', userId);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, approved } : u));
      toast({ title: approved ? 'Utilisateur approuvé' : 'Approbation révoquée' });
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
              <TableHead>Statut</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(user => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.display_name || '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  {user.approved
                    ? <Badge variant="secondary">Approuvé</Badge>
                    : <Badge variant="destructive">En attente</Badge>}
                </TableCell>
                <TableCell>
                  <Select value={user.role} onValueChange={v => updateRole(user.id, v as AppRole)}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {user.approved ? (
                    <Button size="sm" variant="outline" onClick={() => setApproval(user.id, false)}>
                      <X className="h-4 w-4 mr-1" /> Révoquer
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => setApproval(user.id, true)}>
                      <Check className="h-4 w-4 mr-1" /> Approuver
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Aucun utilisateur</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
