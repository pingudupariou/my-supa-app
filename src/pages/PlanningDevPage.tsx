import { ReadOnlyWrapper } from '@/components/auth/ReadOnlyWrapper';
import { ProductPlanningGantt } from '@/components/costflow/ProductPlanningGantt';

export function PlanningDevPage() {
  return (
    <ReadOnlyWrapper tabKey="costflow">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Planning Développement</h1>
          <p className="text-muted-foreground">
            Planification du développement produit et suivi des phases
          </p>
        </div>
        <ProductPlanningGantt />
      </div>
    </ReadOnlyWrapper>
  );
}
