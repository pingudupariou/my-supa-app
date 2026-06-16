import { ReactNode, createContext, useContext, useEffect, useRef } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isReadOnly) return;
    const root = containerRef.current;
    if (!root) return;

    const isNavElement = (el: HTMLElement | null): boolean => {
      if (!el) return false;
      return !!el.closest(
        '[role="tab"],[role="tablist"],[data-readonly-allow="true"],[data-radix-scroll-area-viewport],[role="combobox"],[role="listbox"],[role="option"],[role="menu"],[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"],a[href],[data-state][data-orientation],[data-sidebar]'
      );
    };

    const blockWrites = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Allow scroll/nav/dropdown opening interactions
      if (isNavElement(target)) return;
      // Block typing in inputs / textareas / contenteditable
      if (target.matches('input,textarea,[contenteditable="true"]')) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // Block clicks on actionable buttons (writes, deletes, opens edit dialogs)
      const btn = target.closest('button,[role="button"]') as HTMLElement | null;
      if (btn && !isNavElement(btn)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const blockChange = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.matches('input,textarea,select')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    root.addEventListener('click', blockWrites, true);
    root.addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement | null;
      if (t && t.matches('input,textarea,[contenteditable="true"]') && !['Tab','Escape','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
    root.addEventListener('paste', blockChange, true);
    root.addEventListener('submit', blockChange, true);
    root.addEventListener('drop', blockChange, true);

    return () => {
      root.removeEventListener('click', blockWrites, true);
      root.removeEventListener('paste', blockChange, true);
      root.removeEventListener('submit', blockChange, true);
      root.removeEventListener('drop', blockChange, true);
    };
  }, [isReadOnly]);

  return (
    <ReadOnlyContext.Provider value={isReadOnly}>
      <div ref={containerRef} className={isReadOnly ? 'read-only-mode' : ''}>
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
