import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, LogOut, ArrowLeft, MailCheck } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { NovarideLogo } from '@/components/ui/NovarideLogo';

export function PendingApprovalPage() {
  const { user, isApproved, isAdmin, approvalLoading, signOut } = useAuth();
  const navigate = useNavigate();

  if (!user) return <Navigate to="/auth" replace />;
  if (!approvalLoading && (isApproved || isAdmin)) return <Navigate to="/" replace />;

  const handleBackToLogin = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <NovarideLogo />
          </div>
          <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Clock className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl">Compte en attente d'approbation</CardTitle>
          <CardDescription className="leading-relaxed">
            Votre demande d'inscription a bien été enregistrée. Un administrateur doit valider votre accès avant que vous puissiez utiliser la plateforme.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-muted/50 border border-border p-3 text-sm space-y-2">
            <div className="flex items-start gap-2">
              <MailCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-muted-foreground">
                Vous recevrez un accès dès l'approbation. Reconnectez-vous plus tard avec :
              </p>
            </div>
            <p className="font-medium text-foreground text-center break-all">{user.email}</p>
          </div>

          <Button className="w-full" onClick={handleBackToLogin}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à la page de connexion
          </Button>

          <Button variant="ghost" className="w-full text-muted-foreground" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Se déconnecter
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}