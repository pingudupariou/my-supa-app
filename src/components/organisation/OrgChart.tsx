import { Role, Department } from '@/engine/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Trash2 } from 'lucide-react';

const DEPARTMENTS: Department[] = ['R&D', 'Production', 'Sales', 'Support', 'Admin'];

interface OrgChartProps {
  roles: Role[];
  onEdit: (role: Role) => void;
  onRemove: (id: string) => void;
  onAddToTeam: (dept?: Department) => void;
}

export function OrgChart({ roles, onEdit, onRemove, onAddToTeam }: OrgChartProps) {
  return (
    <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
      {DEPARTMENTS.map(dept => {
        const deptRoles = roles.filter(r => r.department === dept);
        return (
          <div key={dept}>
            <div className="flex items-center justify-between mb-2">
              <Badge variant="outline">{dept}</Badge>
              <Button size="sm" variant="ghost" onClick={() => onAddToTeam(dept)}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-2">
              {deptRoles.map(role => (
                <Card key={role.id} className="bg-muted/30">
                  <CardContent className="p-3">
                    <div className="text-sm font-medium">{role.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {role.startYear} • {(role.annualCostLoaded / 1000).toFixed(0)}k€
                    </div>
                    <div className="flex gap-1 mt-2">
                      <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => onEdit(role)}>
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-destructive" onClick={() => onRemove(role.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
