import { ReactNode, createContext, useContext } from 'react';
import { useAuth } from '@/context/AuthContext';

interface ReadOnlyWrapperProps {
  children: ReactNode;
  tabKey: string;
}

const ReadOnlyContext = createContext(false);

export function useIsReadOnly() {
  return useContext(ReadOnlyContext);
}

export function ReadOnlyWrapper({ children, tabKey }: ReadOnlyWrapperProps) {
  const { getTabPermission } = useAuth();
  const permission = getTabPermission(tabKey);
  const isReadOnly = permission === 'read';

  return (
    <ReadOnlyContext.Provider value={isReadOnly}>
      <div className={isReadOnly ? 'read-only-mode' : ''}>
        {isReadOnly && (
          <div className="mb-4 p-3 bg-muted border border-border rounded-md text-sm text-muted-foreground text-center font-medium">
            🔒 Mode lecture seule — Vous pouvez consulter les données mais pas les modifier
          </div>
        )}
        {children}
      </div>
    </ReadOnlyContext.Provider>
  );
}

/** Wraps content that should be disabled in read-only mode (buttons, inputs, forms) */
export function ReadOnlyContent({ children }: { children: ReactNode }) {
  const isReadOnly = useIsReadOnly();
  if (!isReadOnly) return <>{children}</>;
  return (
    <div className="pointer-events-none select-none opacity-80">
      {children}
    </div>
  );
}
