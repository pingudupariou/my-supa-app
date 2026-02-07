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
  const equityAmount = config.totalRaise * (1 - config.ocRatio);
  const postMoney = preMoney + equityAmount;
  const dilution = postMoney > 0 ? equityAmount / postMoney : 0;

  return (
    <SectionCard title="Simulation de Dilution" id="valuation-dilution">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="space-y-3">
            <Label>Multiple EBITDA: {config.ebitdaMultiple.toFixed(1)}x</Label>
            <Slider
              value={[config.ebitdaMultiple]}
              onValueChange={([v]) => onChange({ ...config, ebitdaMultiple: v })}
              min={2}
              max={15}
              step={0.5}
            />
          </div>
          <div className="space-y-3">
            <Label>Part OC: {(config.ocRatio * 100).toFixed(0)}%</Label>
            <Slider
              value={[config.ocRatio * 100]}
              onValueChange={([v]) => onChange({ ...config, ocRatio: v / 100 })}
              min={0}
              max={50}
              step={5}
            />
          </div>
        </div>
        <div className="space-y-3">
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="text-sm text-muted-foreground">Pre-Money</div>
            <div className="text-xl font-bold font-mono-numbers">{formatCurrency(preMoney, true)}</div>
          </div>
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="text-sm text-muted-foreground">Post-Money</div>
            <div className="text-xl font-bold font-mono-numbers">{formatCurrency(postMoney, true)}</div>
          </div>
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="text-sm text-muted-foreground">Dilution</div>
            <div className="text-xl font-bold font-mono-numbers">{formatPercent(dilution)}</div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
