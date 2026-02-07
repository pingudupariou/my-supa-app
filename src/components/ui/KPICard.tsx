import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { ReactNode } from 'react';

interface KPICardProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export function KPICard({ label, value, subValue, trend, className }: KPICardProps) {
  return (
    <Card className={cn('', className)}>
      <CardContent className="pt-4 pb-3">
        <div className="kpi-label mb-1">{label}</div>
        <div className="kpi-value flex items-center gap-2">
          {value}
          {trend === 'up' && <TrendingUp className="h-4 w-4 text-[hsl(var(--positive))]" />}
          {trend === 'down' && <TrendingDown className="h-4 w-4 text-[hsl(var(--negative))]" />}
        </div>
        {subValue && <div className="text-xs text-muted-foreground mt-1">{subValue}</div>}
      </CardContent>
    </Card>
  );
}

interface SectionCardProps {
  title: string;
  children: ReactNode;
  id?: string;
  className?: string;
}

export function SectionCard({ title, children, id, className }: SectionCardProps) {
  return (
    <Card className={cn('', className)} id={id}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
