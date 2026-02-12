import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NovarideLogo } from '@/components/ui/NovarideLogo';
import { useCostFlowData } from '@/hooks/useCostFlowData';
import { usePlanningData } from '@/hooks/usePlanningData';
import { useCRMData } from '@/hooks/useCRMData';
import { Package, Layers, Factory, Users, CalendarRange, TrendingUp, Cog } from 'lucide-react';
import heroImg from '@/assets/hero-novaride.jpg';
import visionImg from '@/assets/savoir-faire.jpg';
import productImg from '@/assets/ccd-gold.jpg';
import transmissionImg from '@/assets/pulley-wheels.jpg';
import compImg from '@/assets/composants-hero.jpg';
import actionImg from '@/assets/novaride-action.jpg';

const ALL_MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

export function TableauDeBordPage() {
  const { products, references, productCategories, suppliers, bom } = useCostFlowData();
  const { rows, blocks, colors } = usePlanningData();
  const { customers, orders } = useCRMData();

  // KPIs
  const totalProducts = products.length;
  const totalReferences = references.length;
  const totalSuppliers = suppliers.length;
  const totalCategories = productCategories.length;
  const totalCustomers = customers.length;
  const activeOrders = orders.filter(o => ['draft', 'confirmed', 'in_progress'].includes(o.status)).length;
  const totalBomEntries = bom.length;

  // Planning summary: blocks in progress (current month range)
  const currentMonth = new Date().getMonth(); // 0-based
  const currentGlobalMonth = currentMonth + 1; // 1-based
  const activeBlocks = blocks.filter(b =>
    b.start_month <= currentGlobalMonth && (b.start_month + b.duration - 1) >= currentGlobalMonth
  );

  // Mini planning: next 6 months
  const planningMonths = useMemo(() => {
    const months: { label: string; index: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const mIdx = (currentMonth + i) % 12;
      months.push({ label: ALL_MONTHS[mIdx], index: currentGlobalMonth + i });
    }
    return months;
  }, [currentMonth, currentGlobalMonth]);

  // Products with most references in BOM
  const topProducts = useMemo(() => {
    const counts: Record<string, number> = {};
    bom.forEach(b => { counts[b.product_id] = (counts[b.product_id] || 0) + 1; });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id, count]) => ({
        product: products.find(p => p.id === id),
        refCount: count,
      }))
      .filter(x => x.product);
  }, [bom, products]);

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <div className="relative rounded-xl overflow-hidden h-48 md:h-56">
        <img
          src={heroImg}
          alt="Novaride Engineering"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
        <div className="absolute inset-0 flex items-center px-8">
          <div>
            <NovarideLogo variant="full" color="light" className="mb-2" />
            <p className="text-white/80 text-lg font-light tracking-wide">Tableau de bord opérationnel</p>
            <p className="text-white/50 text-sm mt-1">We engage, we move</p>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
        <KPITile icon={Package} label="Produits" value={totalProducts} color="text-primary" />
        <KPITile icon={Layers} label="Références" value={totalReferences} color="text-blue-500" />
        <KPITile icon={Factory} label="Fournisseurs" value={totalSuppliers} color="text-amber-500" />
        <KPITile icon={Cog} label="Catégories" value={totalCategories} color="text-violet-500" />
        <KPITile icon={Users} label="Clients" value={totalCustomers} color="text-emerald-500" />
        <KPITile icon={TrendingUp} label="Commandes actives" value={activeOrders} color="text-rose-500" />
        <KPITile icon={CalendarRange} label="Tâches en cours" value={activeBlocks.length} color="text-cyan-500" />
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Mini Planning */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarRange className="h-5 w-5" />
              Planning développement — 6 prochains mois
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucune ligne de planning configurée
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground w-40">Produit</th>
                      {planningMonths.map(m => (
                        <th key={m.index} className="text-center py-2 px-1 font-medium text-muted-foreground min-w-[60px]">
                          {m.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 8).map(row => {
                      const rowBlocks = blocks.filter(b => b.row_id === row.id);
                      return (
                        <tr key={row.id} className="border-t border-border/50">
                          <td className="py-2 pr-4 font-medium truncate max-w-[160px]">{row.label}</td>
                          {planningMonths.map(m => {
                            const block = rowBlocks.find(b =>
                              b.start_month <= m.index && (b.start_month + b.duration - 1) >= m.index
                            );
                            if (block) {
                              const color = colors.find(c => c.id === block.color_id);
                              const isStart = block.start_month === m.index;
                              return (
                                <td key={m.index} className="py-2 px-0.5">
                                  <div
                                    className="h-6 rounded-sm flex items-center justify-center text-[10px] font-medium text-white truncate px-1"
                                    style={{ backgroundColor: color?.color || '#6366f1' }}
                                    title={block.label}
                                  >
                                    {isStart ? block.label : ''}
                                  </div>
                                </td>
                              );
                            }
                            return <td key={m.index} className="py-2 px-0.5"><div className="h-6 rounded-sm bg-muted/30" /></td>;
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Side panel */}
        <div className="space-y-4">
          {/* Photo card */}
          <Card className="overflow-hidden">
            <div className="relative h-36">
              <img src={productImg} alt="CCD EVO" className="w-full h-full object-cover object-center" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-3 left-4">
                <p className="text-white text-sm font-semibold">Engineering Excellence</p>
                <p className="text-white/60 text-xs">Conception française premium</p>
              </div>
            </div>
          </Card>

          {/* Top products by BOM complexity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Top produits (nomenclature)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune nomenclature</p>
              ) : (
                topProducts.map(({ product, refCount }) => {
                  const cat = productCategories.find(c => c.id === product!.category_id);
                  return (
                    <div key={product!.id} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        {cat && <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />}
                        <span className="text-sm truncate">{product!.name}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs ml-2 flex-shrink-0">
                        {refCount} réf.
                      </Badge>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Categories overview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Catégories produit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {productCategories.map(cat => {
                  const count = products.filter(p => p.category_id === cat.id).length;
                  return (
                    <Badge key={cat.id} variant="outline" className="gap-1.5">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
                      {cat.name}
                      <span className="text-muted-foreground">({count})</span>
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom visual strip */}
      <div className="grid grid-cols-4 gap-4 h-32 rounded-xl overflow-hidden">
        <div className="relative">
          <img src={visionImg} alt="Vision" className="w-full h-full object-cover rounded-lg" />
          <div className="absolute inset-0 bg-black/30 rounded-lg" />
          <div className="absolute bottom-2 left-3 text-white text-xs font-medium">Vision</div>
        </div>
        <div className="relative">
          <img src={transmissionImg} alt="Transmission" className="w-full h-full object-cover rounded-lg" />
          <div className="absolute inset-0 bg-black/30 rounded-lg" />
          <div className="absolute bottom-2 left-3 text-white text-xs font-medium">Transmission</div>
        </div>
        <div className="relative">
          <img src={compImg} alt="Composants" className="w-full h-full object-cover rounded-lg" />
          <div className="absolute inset-0 bg-black/30 rounded-lg" />
          <div className="absolute bottom-2 left-3 text-white text-xs font-medium">Composants</div>
        </div>
        <div className="relative">
          <img src={actionImg} alt="Performance" className="w-full h-full object-cover rounded-lg" />
          <div className="absolute inset-0 bg-black/30 rounded-lg" />
          <div className="absolute bottom-2 left-3 text-white text-xs font-medium">Performance</div>
        </div>
      </div>
    </div>
  );
}

// KPI tile sub-component
function KPITile({ icon: Icon, label, value, color }: { icon: typeof Package; label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex flex-col items-center text-center gap-1.5">
        <Icon className={`h-5 w-5 ${color}`} />
        <span className="text-2xl font-bold font-mono">{value}</span>
        <span className="text-[11px] text-muted-foreground leading-tight">{label}</span>
      </CardContent>
    </Card>
  );
}
