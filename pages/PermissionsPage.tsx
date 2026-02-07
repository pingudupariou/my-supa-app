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
import { Loader2, Shield, Eye, EyeOff, Pencil, Users, Settings } from 'lucide-react';
import { UserRolesManager } from '@/components/admin/UserRolesManager';

const ROLES: AppRole[] = ['admin', 'finance', 'board', 'investisseur', 'lecteur'];
const PERMISSIONS: TabPermission[] = ['hidden', 'read', 'write'];

const TAB_ITEMS = [
  { key: 'home', label: 'Accueil' },
  { key: 'product-plan', label: 'Plan Produit' },
  { key: 'organisation', label: 'Organisation' },
  { key: 'charges', label: 'Structure des Charges' },
  { key: 'funding', label: 'Besoin de Financement' },
  { key: 'scenarios', label: 'Scénarios' },
  { key: 'valuation', label: 'Valorisation & Analyse' },
  { key: 'investment-summary', label: 'Synthèse Investisseur' },
];

const roleLabels: Record<AppRole, string> = {
  admin: 'Admin',
  finance: 'Finance',
  board: 'Board',
  investisseur: 'Investisseur',
  lecteur: 'Lecteur',
};

const permissionLabels: Record<TabPermission, { label: string; icon: typeof Eye; color: string }> = {
  hidden: { label: 'Masqué', icon: EyeOff, color: 'bg-muted text-muted-foreground' },
  read: { label: 'Lecture', icon: Eye, color: 'bg-blue-100 text-blue-800' },
  write: { label: 'Écriture', icon: Pencil, color: 'bg-green-100 text-green-800' },
};

interface PermissionMatrix {
  [role: string]: {
    [tabKey: string]: TabPermission;
  };
}

export function PermissionsPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [matrix, setMatrix] = useState<PermissionMatrix>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/');
    }
  }, [isAdmin, authLoading, navigate]);

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('tab_permissions')
        .select('*');

      if (error) throw error;

      const newMatrix: PermissionMatrix = {};
      ROLES.forEach(role => {
        newMatrix[role] = {};
        TAB_ITEMS.forEach(tab => {
          newMatrix[role][tab.key] = 'hidden';
        });
      });

      data?.forEach(p => {
        if (newMatrix[p.role]) {
          newMatrix[p.role][p.tab_key] = p.permission as TabPermission;
        }
      });

      setMatrix(newMatrix);
    } catch (e) {
      console.error('Error fetching permissions:', e);
      toast({
        title: "Erreur",
        description: "Impossible de charger les permissions.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePermission = async (role: AppRole, tabKey: string, permission: TabPermission) => {
    const cellKey = `${role}:${tabKey}`;
    setSaving(cellKey);

    try {
      const { error } = await supabase
        .from('tab_permissions')
        .upsert(
          { role, tab_key: tabKey, permission },
          { onConflict: 'role,tab_key' }
        );

      if (error) throw error;

      setMatrix(prev => ({
        ...prev,
        [role]: {
          ...prev[role],
          [tabKey]: permission,
        },
      }));

      toast({
        title: "Permission mise à jour",
        description: `${roleLabels[role]} - ${TAB_ITEMS.find(t => t.key === tabKey)?.label}`,
      });
    } catch (e) {
      console.error('Error updating permission:', e);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour la permission.",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Administration</h1>
          <p className="text-muted-foreground">
            Gestion des utilisateurs et des permissions
          </p>
        </div>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Utilisateurs
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Permissions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UserRolesManager />
        </TabsContent>

        <TabsContent value="permissions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Matrice des Permissions</CardTitle>
              <CardDescription>
                HIDDEN = onglet invisible • READ = lecture seule • WRITE = modification autorisée
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32 sticky left-0 bg-background">Rôle</TableHead>
                      {TAB_ITEMS.map(tab => (
                        <TableHead key={tab.key} className="text-center min-w-[140px]">
                          {tab.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ROLES.map(role => (
                      <TableRow key={role}>
                        <TableCell className="font-medium sticky left-0 bg-background">
                          <Badge variant={role === 'admin' ? 'default' : 'secondary'}>
                            {roleLabels[role]}
                          </Badge>
                        </TableCell>
                        {TAB_ITEMS.map(tab => {
                          const currentPerm = matrix[role]?.[tab.key] || 'hidden';
                          const cellKey = `${role}:${tab.key}`;
                          const isSaving = saving === cellKey;
                          const isAdminSelf = role === 'admin'; // Admin always has full access

                          return (
                            <TableCell key={tab.key} className="text-center p-2">
                              {isAdminSelf ? (
                                <Badge className={permissionLabels.write.color}>
                                  <Pencil className="h-3 w-3 mr-1" />
                                  {permissionLabels.write.label}
                                </Badge>
                              ) : (
                                <Select
                                  value={currentPerm}
                                  onValueChange={(val) => updatePermission(role, tab.key, val as TabPermission)}
                                  disabled={isSaving}
                                >
                                  <SelectTrigger className={`w-28 ${isSaving ? 'opacity-50' : ''}`}>
                                    {isSaving ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <SelectValue />
                                    )}
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PERMISSIONS.map(perm => {
                                      const { label, icon: Icon, color } = permissionLabels[perm];
                                      return (
                                        <SelectItem key={perm} value={perm}>
                                          <div className="flex items-center gap-2">
                                            <Icon className="h-3 w-3" />
                                            {label}
                                          </div>
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
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

          <Card>
            <CardHeader>
              <CardTitle>Légende des Rôles</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="p-3 border rounded-lg">
                <Badge className="mb-2">Admin</Badge>
                <p className="text-sm text-muted-foreground">
                  Accès complet, gestion des utilisateurs et permissions
                </p>
              </div>
              <div className="p-3 border rounded-lg">
                <Badge variant="secondary" className="mb-2">Finance</Badge>
                <p className="text-sm text-muted-foreground">
                  DAF/CFO - Accès aux modules financiers
                </p>
              </div>
              <div className="p-3 border rounded-lg">
                <Badge variant="secondary" className="mb-2">Board</Badge>
                <p className="text-sm text-muted-foreground">
                  Conseil d'administration - Vue stratégique
                </p>
              </div>
              <div className="p-3 border rounded-lg">
                <Badge variant="secondary" className="mb-2">Investisseur</Badge>
                <p className="text-sm text-muted-foreground">
                  Investisseurs - Synthèse et valorisation uniquement
                </p>
              </div>
              <div className="p-3 border rounded-lg">
                <Badge variant="outline" className="mb-2">Lecteur</Badge>
                <p className="text-sm text-muted-foreground">
                  Rôle par défaut - Accès minimal en lecture
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
