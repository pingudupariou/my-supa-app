import { ReactNode, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { NovarideLogo } from '@/components/ui/NovarideLogo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Home,
  Package,
  Users,
  Receipt,
  LineChart,
  Banknote,
  BarChart3,
  TrendingUp,
  FileText,
  Shield,
  LogOut,
  Menu,
  X,
  MessageSquare,
  Cog,
  Clock,
  Database,
} from 'lucide-react';

const navItems = [
  { to: '/home', label: 'Accueil', icon: Home, tabKey: 'home' },
  { to: '/', label: 'Plan Produit', icon: Package, tabKey: 'product-plan' },
  { to: '/organisation', label: 'Organisation', icon: Users, tabKey: 'organisation' },
  { to: '/charges', label: 'Charges', icon: Receipt, tabKey: 'charges' },
  { to: '/crm', label: 'CRM', icon: MessageSquare, tabKey: 'crm' },
  { to: '/costflow', label: 'Production et BE', icon: Cog, tabKey: 'costflow' },
  { to: '/timetracking', label: "Suivi d'activité", icon: Clock, tabKey: 'timetracking' },
  { to: '/previsionnel', label: 'Prévisionnel', icon: LineChart, tabKey: 'previsionnel' },
  { to: '/funding', label: 'Financement', icon: Banknote, tabKey: 'funding' },
  { to: '/scenarios', label: 'Scénarios', icon: BarChart3, tabKey: 'scenarios' },
  { to: '/valuation', label: 'Valorisation', icon: TrendingUp, tabKey: 'valuation' },
  { to: '/investment-summary', label: 'Synthèse', icon: FileText, tabKey: 'investment-summary' },
  { to: '/snapshots', label: 'Sauvegardes', icon: Database, tabKey: 'snapshots' },
];

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { signOut, isAdmin, getTabPermission } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const visibleItems = navItems.filter(item => {
    const perm = getTabPermission(item.tabKey);
    return perm !== 'hidden';
  });

  return (
    <div className="flex min-h-screen">
      {/* Mobile toggle */}
      <button
        className="fixed top-4 left-4 z-50 lg:hidden p-2 bg-sidebar text-white rounded"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 w-56 bg-sidebar text-sidebar-foreground flex flex-col transition-transform lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="p-4 border-b border-sidebar-border">
          <NovarideLogo variant="compact" color="light" />
          <div className="text-xs text-sidebar-foreground/50 mt-1">FinPlan Studio</div>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {visibleItems.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/10'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}

          {isAdmin && (
            <NavLink
              to="/permissions"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors mt-4 border-t border-sidebar-border pt-4',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/10'
              )}
            >
              <Shield className="h-4 w-4" />
              Administration
            </NavLink>
          )}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Déconnexion
          </Button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="flex-1 lg:ml-56 p-6">
        {children}
      </main>
    </div>
  );
}
