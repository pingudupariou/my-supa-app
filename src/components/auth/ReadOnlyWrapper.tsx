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
    <div className={isReadOnly ? 'pointer-events-none opacity-90' : ''}>
      {isReadOnly && (
        <div className="mb-4 p-2 bg-muted border rounded text-sm text-muted-foreground text-center">
          Mode lecture seule
        </div>
      )}
      {children}
    </div>
  );
}
