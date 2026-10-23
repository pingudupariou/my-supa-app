import { Role, Department } from '@/engine/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { RolePhoto } from './RolePhoto';
import { cn } from '@/lib/utils';

const DEPARTMENTS: Department[] = ['R&D', 'Production', 'Sales', 'Support', 'Admin'];

interface OrgChartProps {
  roles: Role[];
  /** First plan year: roles starting after it are shown as planned hires. */
  startYear?: number;
  onEdit?: (role: Role) => void;
  onRemove?: (id: string) => void;
  onAddToTeam?: (dept?: Department) => void;
  /** Hides edit controls and empty departments (summary / PDF). */
  readOnly?: boolean;
}

export function OrgChart({ roles, startYear, onEdit, onRemove, onAddToTeam, readOnly = false }: OrgChartProps) {
  const departments = readOnly ? DEPARTMENTS.filter(d => roles.some(r => r.department === d)) : DEPARTMENTS;
  if (readOnly && departments.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">Aucun poste configuré — rendez-vous dans l'onglet Organisation</p>;
  }
  return (
    <div className={cn('grid gap-4', readOnly ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5 print:grid-cols-5' : 'md:grid-cols-3 lg:grid-cols-5')}>
      {departments.map(dept => {
        const deptRoles = roles
          .filter(r => r.department === dept)
          .sort((a, b) => a.startYear - b.startYear || a.title.localeCompare(b.title));
        return (
          <div key={dept} className="rounded-lg border bg-card break-inside-avoid">
            <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2 rounded-t-lg">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{dept}</span>
                <Badge variant="secondary" className="text-[10px] px-1.5">{deptRoles.length}</Badge>
              </div>
              {!readOnly && onAddToTeam && (
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onAddToTeam(dept)} aria-label={`Ajouter un poste ${dept}`}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <div className="space-y-2 p-2">
              {deptRoles.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">Aucun poste</p>
              )}
              {deptRoles.map(role => {
                const planned = startYear !== undefined && role.startYear > startYear;
                return (
                  <div key={role.id} className={cn('group flex flex-col items-center text-center rounded-md border p-3', planned ? 'border-dashed bg-muted/20' : 'bg-background')}>
                    <RolePhoto photo={role.photo} name={role.personName || role.title} muted={planned && !role.photo} className="h-14 w-14" />
                    <div className="mt-2 text-sm font-semibold leading-tight">{role.personName || (planned ? 'À recruter' : '—')}</div>
                    <div className="text-xs text-muted-foreground leading-tight">{role.title}</div>
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span>{role.startYear}</span>
                      <span>•</span>
                      <span>{(role.annualCostLoaded / 1000).toFixed(0)}k€</span>
                      {planned && <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0">Prévu</Badge>}
                    </div>
                    {!readOnly && (onEdit || onRemove) && (
                      <div className="flex gap-1 mt-2">
                        {onEdit && (
                          <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => onEdit(role)} aria-label="Modifier le poste">
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        )}
                        {onRemove && (
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-destructive" onClick={() => onRemove(role.id)} aria-label="Supprimer le poste">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
