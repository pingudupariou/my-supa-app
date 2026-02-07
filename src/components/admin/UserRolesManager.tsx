import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { AppRole } from '@/context/AuthContext';

const ROLES: AppRole[] = ['admin', 'finance', 'board', 'investisseur', 'lecteur'];

interface UserWithRole { id: string; email: string; role: AppRole; }

export function UserRolesManager() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      const { data } = await supabase.from('user_roles' as any).select('*');
      if (data) setUsers((data as any[]).map((r: any) => ({ id: r.user_id, email: r.user_id, role: r.role })));
    } catch {} finally { setLoading(false); }
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
          <TableHeader><TableRow><TableHead>Utilisateur</TableHead><TableHead>Rôle</TableHead></TableRow></TableHeader>
          <TableBody>
            {users.map(user => (
              <TableRow key={user.id}>
                <TableCell className="font-mono text-xs">{user.email}</TableCell>
                <TableCell>
                  <Select value={user.role} onValueChange={v => updateRole(user.id, v as AppRole)}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Aucun utilisateur</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
