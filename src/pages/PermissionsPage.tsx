import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, AppRole, TabPermission } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Loader2, Shield, Eye, EyeOff, Pencil, Users, Settings, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserRolesManager } from '@/components/admin/UserRolesManager';

const ROLES: AppRole[] = ['admin', 'finance', 'board', 'investisseur', 'lecteur', 'bureau_etude', 'production', 'marketing'];
const PERMISSIONS: TabPermission[] = ['hidden', 'read', 'write'];

const TAB_ITEMS = [
  { key: 'home', label: 'Accueil' },
  { key: 'tableau-de-bord', label: 'Tableau de bord' },
  { key: 'product-plan', label: 'Plan Produit' },
  { key: 'organisation', label: 'Organisation' },
  { key: 'charges', label: 'Structure des Charges' },
  { key: 'previsionnel', label: 'Prévisionnel' },
  { key: 'scenarios', label: 'Scénarios' },
  { key: 'funding', label: 'Besoin de Financement' },
  { key: 'valuation', label: 'Valorisation & Analyse' },
  { key: 'investment-summary', label: 'Synthèse Investisseur' },
  { key: 'planning-dev', label: 'Planning Dev' },
  { key: 'costflow', label: 'Production et BE' },
  { key: 'crm', label: 'CRM' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'timetracking', label: "Suivi d'activité" },
  { key: 'snapshots', label: 'Sauvegardes' },
];

const roleLabels: Record<AppRole, string> = { admin: 'Admin', finance: 'Finance', board: 'Board', investisseur: 'Investisseur', lecteur: 'Lecteur', bureau_etude: 'Bureau d\'étude', production: 'Production', marketing: 'Marketing' };
const permissionLabels: Record<TabPermission, { label: string; icon: typeof Eye; color: string }> = {
  hidden: { label: 'Masqué', icon: EyeOff, color: 'bg-muted text-muted-foreground' },
  read: { label: 'Lecture', icon: Eye, color: 'bg-blue-100 text-blue-800' },
  write: { label: 'Écriture', icon: Pencil, color: 'bg-green-100 text-green-800' },
};

interface PermissionMatrix { [role: string]: { [tabKey: string]: TabPermission } }

export function PermissionsPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [matrix, setMatrix] = useState<PermissionMatrix>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => { if (!authLoading && !isAdmin) navigate('/'); }, [isAdmin, authLoading, navigate]);

  useEffect(() => { fetchPermissions(); }, []);

  const fetchPermissions = async () => {
    try {
      const { data, error } = await supabase.from('tab_permissions' as any).select('*');
      if (error) throw error;
      const newMatrix: PermissionMatrix = {};
      ROLES.forEach(role => { newMatrix[role] = {}; TAB_ITEMS.forEach(tab => { newMatrix[role][tab.key] = 'hidden'; }); });
      (data as any[])?.forEach((p: any) => { if (newMatrix[p.role]) newMatrix[p.role][p.tab_key] = p.permission; });
      setMatrix(newMatrix);
    } catch { } finally { setLoading(false); }
  };

  const syncPermissions = async () => {
    setSyncing(true);
    try {
      // Fetch existing rows from DB
      const { data, error } = await supabase.from('tab_permissions' as any).select('role, tab_key');
      if (error) throw error;
      const existing = new Set((data as any[])?.map((p: any) => `${p.role}:${p.tab_key}`) || []);

      // Find missing combinations (non-admin roles only)
      const missing: { role: string; tab_key: string; permission: string }[] = [];
      ROLES.filter(r => r !== 'admin').forEach(role => {
        TAB_ITEMS.forEach(tab => {
          if (!existing.has(`${role}:${tab.key}`)) {
            missing.push({ role, tab_key: tab.key, permission: 'hidden' });
          }
        });
      });

      // Remove DB rows for tabs that no longer exist in config
      const validKeys = new Set(TAB_ITEMS.map(t => t.key));
      const obsolete = (data as any[])?.filter((p: any) => !validKeys.has(p.tab_key)) || [];
      if (obsolete.length > 0) {
        const obsoleteKeys = [...new Set(obsolete.map((p: any) => p.tab_key))];
        for (const key of obsoleteKeys) {
          await supabase.from('tab_permissions' as any).delete().eq('tab_key', key);
        }
      }

      if (missing.length > 0) {
        const { error: insertError } = await supabase.from('tab_permissions' as any).insert(missing as any);
        if (insertError) throw insertError;
      }

      await fetchPermissions();
      toast({ title: 'Synchronisation terminée', description: `${missing.length} permission(s) ajoutée(s), ${obsolete.length} obsolète(s) supprimée(s)` });
    } catch {
      toast({ title: 'Erreur de synchronisation', variant: 'destructive' });
    } finally { setSyncing(false); }
  };

  const updatePermission = async (role: AppRole, tabKey: string, permission: TabPermission) => {
    setSaving(`${role}:${tabKey}`);
    try {
      await supabase.from('tab_permissions' as any).upsert({ role, tab_key: tabKey, permission } as any, { onConflict: 'role,tab_key' });
      setMatrix(prev => ({ ...prev, [role]: { ...prev[role], [tabKey]: permission } }));
      toast({ title: 'Permission mise à jour' });
    } catch { toast({ title: 'Erreur', variant: 'destructive' }); }
    finally { setSaving(null); }
  };

  if (authLoading || loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div><h1 className="text-2xl font-bold">Administration</h1><p className="text-muted-foreground">Gestion des utilisateurs et des permissions</p></div>
      </div>
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="users" className="flex items-center gap-2"><Users className="h-4 w-4" />Utilisateurs</TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2"><Settings className="h-4 w-4" />Permissions</TabsTrigger>
        </TabsList>
        <TabsContent value="users"><UserRolesManager /></TabsContent>
        <TabsContent value="permissions" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div><CardTitle>Matrice des Permissions</CardTitle><CardDescription>HIDDEN = invisible • READ = lecture seule • WRITE = modification</CardDescription></div>
                <Button variant="outline" size="sm" onClick={syncPermissions} disabled={syncing}><RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />Synchroniser avec la base</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">Rôle</TableHead>
                      {TAB_ITEMS.map(tab => <TableHead key={tab.key} className="text-center min-w-[140px]">{tab.label}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ROLES.map(role => (
                      <TableRow key={role}>
                        <TableCell><Badge variant={role === 'admin' ? 'default' : 'secondary'}>{roleLabels[role]}</Badge></TableCell>
                        {TAB_ITEMS.map(tab => {
                          const currentPerm = matrix[role]?.[tab.key] || 'hidden';
                          const cellKey = `${role}:${tab.key}`;
                          return (
                            <TableCell key={tab.key} className="text-center p-2">
                              {role === 'admin' ? (
                                <Badge className={permissionLabels.write.color}><Pencil className="h-3 w-3 mr-1" />{permissionLabels.write.label}</Badge>
                              ) : (
                                <Select value={currentPerm} onValueChange={v => updatePermission(role, tab.key, v as TabPermission)} disabled={saving === cellKey}>
                                  <SelectTrigger className={`w-28 ${currentPerm === 'write' ? 'bg-green-50 border-green-300 text-green-800' : currentPerm === 'read' ? 'bg-yellow-50 border-yellow-300 text-yellow-800' : 'bg-red-50 border-red-300 text-red-800'}`}><SelectValue /></SelectTrigger>
                                  <SelectContent>{PERMISSIONS.map(perm => { const { label, icon: Icon } = permissionLabels[perm]; return <SelectItem key={perm} value={perm}><div className="flex items-center gap-2"><Icon className="h-3 w-3" />{label}</div></SelectItem>; })}</SelectContent>
                                </Select>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
