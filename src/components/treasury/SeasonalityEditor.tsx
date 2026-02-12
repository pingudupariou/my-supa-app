import { SectionCard } from '@/components/ui/KPICard';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MONTHS, SeasonalityConfig, MonthIndex } from '@/engine/monthlyTreasuryEngine';
import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SeasonalityEditorProps {
  title: string;
  description?: string;
  seasonality: SeasonalityConfig;
  onChange: (seasonality: SeasonalityConfig) => void;
}

const SHORT_MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

export function SeasonalityEditor({ title, description, seasonality, onChange }: SeasonalityEditorProps) {
  const handleChange = (month: MonthIndex, value: number) => {
    onChange({ ...seasonality, [month]: value });
  };

  const reset = () => {
    const fresh: SeasonalityConfig = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0 };
    onChange(fresh);
  };

  // Calculer les coefs normalisés pour affichage
  const rawCoefs = Object.values(seasonality).map(v => 1 + v);
  const sumRaw = rawCoefs.reduce((a, b) => a + b, 0);
  const normalizedCoefs = sumRaw > 0 ? rawCoefs.map(c => (c / sumRaw) * 12) : Array(12).fill(1);
  const isDefault = Object.values(seasonality).every(v => v === 0);

  return (
    <SectionCard
      title={title}
      action={
        <div className="flex items-center gap-2">
          {isDefault && <Badge variant="secondary" className="text-xs">Répartition uniforme</Badge>}
          <Button variant="ghost" size="sm" onClick={reset} disabled={isDefault}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Réinitialiser
          </Button>
        </div>
      }
    >
      {description && <p className="text-xs text-muted-foreground mb-4">{description}</p>}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
        {Array.from({ length: 12 }, (_, i) => i as MonthIndex).map(month => {
          const val = seasonality[month] || 0;
          const coef = normalizedCoefs[month];
          const pct = (coef / 12 * 100).toFixed(1);
          return (
            <div key={month} className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{SHORT_MONTHS[month]}</Label>
                <span className={cn(
                  "text-xs font-mono-numbers",
                  val > 0 ? "text-[hsl(var(--positive))]" : val < 0 ? "text-destructive" : "text-muted-foreground"
                )}>
                  {val > 0 ? '+' : ''}{(val * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[val * 100]}
                onValueChange={([v]) => handleChange(month, v / 100)}
                min={-80}
                max={200}
                step={5}
              />
              <div className="text-[10px] text-muted-foreground text-right">
                ≈ {pct}% annuel
              </div>
            </div>
          );
        })}
      </div>

      {/* Barre visuelle de répartition */}
      <div className="mt-4 flex gap-0.5 h-8 rounded overflow-hidden">
        {normalizedCoefs.map((coef, i) => (
          <div
            key={i}
            className="flex items-end justify-center transition-all"
            style={{
              flex: coef,
              backgroundColor: `hsl(var(--primary) / ${0.3 + (coef / Math.max(...normalizedCoefs)) * 0.7})`,
            }}
          >
            <span className="text-[9px] font-mono-numbers text-primary-foreground/80">
              {SHORT_MONTHS[i]}
            </span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
