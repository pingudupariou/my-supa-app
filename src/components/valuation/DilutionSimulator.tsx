import { SectionCard } from '@/components/ui/KPICard';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { formatCurrency, formatPercent } from '@/data/financialConfig';

export interface DilutionConfig {
  totalRaise: number;
  ebitdaMultiple: number;
  ocRatio: number;
  referenceEBITDA: number;
}

export const defaultDilutionConfig: DilutionConfig = {
  totalRaise: 1500000,
  ebitdaMultiple: 6,
  ocRatio: 0,
  referenceEBITDA: 500000,
};

interface DilutionSimulatorProps {
  config: DilutionConfig;
  onChange: (config: DilutionConfig) => void;
}

export function DilutionSimulator({ config, onChange }: DilutionSimulatorProps) {
  const preMoney = Math.max(200000, config.referenceEBITDA * config.ebitdaMultiple);
  const ocAmount = config.totalRaise * config.ocRatio;
  const equityAmount = config.totalRaise * (1 - config.ocRatio);
  const postMoney = preMoney + equityAmount;
  const dilution = postMoney > 0 ? equityAmount / postMoney : 0;

  return (
    <SectionCard title="Simulation de Dilution" id="valuation-dilution">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="space-y-3">
            <Label>Part OC: {(config.ocRatio * 100).toFixed(0)}% — Equity: {((1 - config.ocRatio) * 100).toFixed(0)}%</Label>
            <Slider
              value={[config.ocRatio * 100]}
              onValueChange={([v]) => onChange({ ...config, ocRatio: v / 100 })}
              min={0}
              max={99}
              step={1}
            />
          </div>
        </div>
        <div className="space-y-3">
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="text-sm text-muted-foreground">Pre-Money</div>
            <div className="text-xl font-bold font-mono-numbers">{formatCurrency(preMoney, true)}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-muted/30 rounded-lg">
              <div className="text-sm text-muted-foreground">Part OC</div>
              <div className="text-lg font-bold font-mono-numbers">{formatCurrency(ocAmount, true)}</div>
              <div className="text-xs text-muted-foreground">{(config.ocRatio * 100).toFixed(0)}% de la levée</div>
            </div>
            <div className="p-3 bg-muted/30 rounded-lg">
              <div className="text-sm text-muted-foreground">Part Equity</div>
              <div className="text-lg font-bold font-mono-numbers">{formatCurrency(equityAmount, true)}</div>
              <div className="text-xs text-muted-foreground">{((1 - config.ocRatio) * 100).toFixed(0)}% de la levée</div>
            </div>
          </div>
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="text-sm text-muted-foreground">Post-Money</div>
            <div className="text-xl font-bold font-mono-numbers">{formatCurrency(postMoney, true)}</div>
          </div>
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="text-sm text-muted-foreground">Dilution (equity uniquement)</div>
            <div className="text-xl font-bold font-mono-numbers">{formatPercent(dilution)}</div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
