import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Loader2, Check, X, Trash2, History } from 'lucide-react';
import { AppRole, useAuth } from '@/context/AuthContext';

const ROLES: AppRole[] = ['admin', 'finance', 'board', 'investisseur', 'lecteur', 'bureau_etude', 'production', 'marketing'];

interface UserWithRole {
  id: string;
  email: string;
  display_name: string;
  role: AppRole;
  approved: boolean;
  created_at: string | null;
  last_sign_in_at: string | null;
}

interface HistoryEntry {
  id: string;
  action: string;
  created_at: string;
  performed_by: string | null;
  details: any;
}

const ACTION_LABELS: Record<string, string> = {
  signup: "Inscription",
  approved: "Approuvé",
  revoked: "Révoqué",
  deleted: "Supprimé",
  role_changed: "Rôle modifié",
};

const ACTION_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  signup: 'outline',
  approved: 'secondary',
  revoked: 'destructive',
  deleted: 'destructive',
  role_changed: 'default',
};

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function UserRolesManager() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const { user: currentUser } = useAuth();
  const [historyOpen, setHistoryOpen] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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
          created_at: (u as any).created_at ?? null,
          last_sign_in_at: (u as any).last_sign_in_at ?? null,
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
      const previous = users.find(u => u.id === userId)?.role;
      await supabase.from('user_roles' as any).upsert({ user_id: userId, role: newRole } as any, { onConflict: 'user_id' });
      await supabase.from('user_approval_history' as any).insert({
        target_user_id: userId,
        target_email: users.find(u => u.id === userId)?.email ?? null,
        action: 'role_changed',
        performed_by: currentUser?.id,
        details: { from: previous, to: newRole },
      } as any);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast({ title: 'Rôle mis à jour' });
    } catch { toast({ title: 'Erreur', variant: 'destructive' }); }
  };

  const setApproval = async (userId: string, approved: boolean) => {
    try {
      await supabase.from('user_roles' as any).update({ approved } as any).eq('user_id', userId);
      await supabase.from('user_approval_history' as any).insert({
        target_user_id: userId,
        target_email: users.find(u => u.id === userId)?.email ?? null,
        action: approved ? 'approved' : 'revoked',
        performed_by: currentUser?.id,
        details: {},
      } as any);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, approved } : u));
      toast({ title: approved ? 'Utilisateur approuvé' : 'Approbation révoquée' });
    } catch { toast({ title: 'Erreur', variant: 'destructive' }); }
  };

  const deleteUser = async (userId: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(
        `https://twkcoxagbajvopzzinor.supabase.co/functions/v1/delete-user`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur');
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast({ title: 'Utilisateur supprimé' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  const openHistory = async (userId: string) => {
    setHistoryOpen(userId);
    setHistory([]);
    setHistoryLoading(true);
    try {
      const { data } = await supabase
        .from('user_approval_history' as any)
        .select('*')
        .eq('target_user_id', userId)
        .order('created_at', { ascending: false });
      setHistory((data as any) || []);
    } finally {
      setHistoryLoading(false);
    }
  };

  if (loading) return <Loader2 className="h-6 w-6 animate-spin mx-auto" />;

  const activeUser = users.find(u => u.id === historyOpen);

  return (
    <Card>
      <CardHeader><CardTitle>Gestion des Utilisateurs</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Inscription</TableHead>
              <TableHead>Dernière connexion</TableHead>
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
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(user.created_at)}</TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(user.last_sign_in_at)}</TableCell>
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
                  <Button size="sm" variant="ghost" className="mr-1" onClick={() => openHistory(user.id)} title="Historique">
                    <History className="h-4 w-4" />
                  </Button>
                  {user.approved ? (
                    <Button size="sm" variant="outline" onClick={() => setApproval(user.id, false)}>
                      <X className="h-4 w-4 mr-1" /> Révoquer
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => setApproval(user.id, true)}>
                      <Check className="h-4 w-4 mr-1" /> Approuver
                    </Button>
                  )}
                  {currentUser?.id !== user.id && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive" className="ml-2">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer cet utilisateur ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Cette action est irréversible. Le compte de <strong>{user.email}</strong> sera définitivement supprimé.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteUser(user.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {users.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Aucun utilisateur</TableCell></TableRow>}
          </TableBody>
        </Table>

        <Dialog open={!!historyOpen} onOpenChange={(o) => { if (!o) setHistoryOpen(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Historique — {activeUser?.email || ''}</DialogTitle>
            </DialogHeader>
            {historyLoading ? (
              <Loader2 className="h-5 w-5 animate-spin mx-auto my-6" />
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Aucun évènement</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {history.map(h => (
                  <div key={h.id} className="flex items-start gap-3 p-3 rounded-md border border-border bg-muted/30">
                    <Badge variant={ACTION_VARIANTS[h.action] || 'outline'} className="shrink-0">
                      {ACTION_LABELS[h.action] || h.action}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">{formatDate(h.created_at)}</p>
                      {h.details && Object.keys(h.details).length > 0 && (
                        <p className="text-xs mt-1 font-mono break-all">
                          {h.action === 'role_changed' && h.details.from && h.details.to
                            ? `${h.details.from} → ${h.details.to}`
                            : JSON.stringify(h.details)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
