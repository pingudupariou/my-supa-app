import { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';

interface ReadOnlyWrapperProps {
  children: ReactNode;
  tabKey: string;
}

export function ReadOnlyWrapper({ children, tabKey }: ReadOnlyWrapperProps) {
  const { getTabPermission } = useAuth();
  const permission = getTabPermission(tabKey);
  const isReadOnly = permission === 'read';

  return (
    <div className="relative">
      {isReadOnly && (
        <div className="mb-4 p-3 bg-muted border border-border rounded-md text-sm text-muted-foreground text-center font-medium">
          🔒 Mode lecture seule — Vous pouvez consulter les données mais pas les modifier
        </div>
      )}
      <div className={isReadOnly ? 'pointer-events-none select-none opacity-80' : ''}>
        {children}
      </div>
    </div>
  );
}
