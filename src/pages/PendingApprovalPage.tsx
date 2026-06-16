import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, LogOut } from 'lucide-react';
import { Navigate } from 'react-router-dom';

export function PendingApprovalPage() {
  const { user, isApproved, isAdmin, approvalLoading, signOut } = useAuth();

  if (!user) return <Navigate to="/auth" replace />;
  if (!approvalLoading && (isApproved || isAdmin)) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Clock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>En attente d'approbation</CardTitle>
          <CardDescription>
            Votre compte a bien été créé. Un administrateur doit approuver votre accès avant que vous puissiez utiliser la plateforme.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground text-center">
            Connecté en tant que <span className="font-medium text-foreground">{user.email}</span>
          </p>
          <Button variant="outline" className="w-full" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Se déconnecter
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}