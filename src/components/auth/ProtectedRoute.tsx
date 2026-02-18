import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  tabKey?: string;
}

export function ProtectedRoute({ children, tabKey }: ProtectedRouteProps) {
  const { user, loading, getTabPermission } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (tabKey) {
    const permission = getTabPermission(tabKey);
    if (permission === 'hidden') {
      return <Navigate to="/accueil" replace />;
    }
  }

  return <>{children}</>;
}
