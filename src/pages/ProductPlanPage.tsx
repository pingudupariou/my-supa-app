import { useState } from 'react';
import { useFinancial, RevenueMode } from '@/context/FinancialContext';
import { Product } from '@/engine/types';
import { SectionCard, KPICard } from '@/components/ui/KPICard';
import { HeroBanner } from '@/components/ui/HeroBanner';
import { SaveButton } from '@/components/ui/SaveButton';
import { TabSaveAs, useSaveWithTabVersion } from '@/components/ui/TabSaveAs';
import { SimplifiedPricingTable } from '@/components/product/SimplifiedPricingTable';
import { ProductPlanCategoryManager } from '@/components/product/ProductPlanCategoryManager';
import { RevenueVisualization } from '@/components/product/RevenueVisualization';
import { VolumesByChannelTable } from '@/components/product/VolumesByChannelTable';
import { ProductRoadmap } from '@/components/product/ProductRoadmap';
import { GlobalRevenueEditor, calculateGlobalRevenue } from '@/components/product/GlobalRevenueEditor';
import { ClientRevenueEditor } from '@/components/product/ClientRevenueEditor';
import { ErplainActualsImport } from '@/components/product/ErplainActualsImport';
import { CurrentYearProjection } from '@/components/product/CurrentYearProjection';
import { PageExportPDF, ExportableSection } from '@/components/export/PageExportPDF';
import { ReadOnlyWrapper } from '@/components/auth/ReadOnlyWrapper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatPercent } from '@/data/financialConfig';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Calculator, Package, PieChart, Layers, Target, Users, Map, Download, CalendarClock } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const EXPORT_SECTIONS: ExportableSection[] = [
  { id: 'kpis', label: 'KPIs Produits', elementId: 'product-kpis' },
  { id: 'revenue-viz', label: 'Visualisation CA', elementId: 'product-revenue-viz' },
  { id: 'revenue-chart', label: 'Projection CA', elementId: 'product-revenue-chart' },
  { id: 'pricing', label: 'Pricing Produits', elementId: 'product-pricing' },
  { id: 'volumes', label: 'Volumes par Année', elementId: 'product-volumes' },
];

export function ProductPlanPage() {
  const saveWithVersion = useSaveWithTabVersion('product-plan');
  const [helpersOpen, setHelpersOpen] = useState<string[]>([]);
  const {
    state,
    computed,
    updateProducts,
    addProduct,
    removeProduct,
    setRevenueMode,
    updateScenarioSettings,
    updateGlobalRevenueConfig,
    updateClientRevenueConfig,
    updateRoadmapBlocks,
    updateProductCategories,
    updateTransportConfig,
  } = useFinancial();

  const transportCfg = state.transportConfig?.[state.revenueMode];
  const transportFor = (year: number) => computed.transportByYear.find(t => t.year === year)?.transport || 0;

  const settings = state.scenarioSettings;
  const YEARS = Array.from(
    { length: settings.durationYears },
    (_, i) => settings.startYear + i
  );

  const handleAddProduct = (product: Product) => {
    addProduct(product);
  };

  const handleUpdateProduct = (updatedProduct: Product) => {
    const updatedProducts = state.products.map(p =>
      p.id === updatedProduct.id ? updatedProduct : p
    );
    updateProducts(updatedProducts);
  };

  const handleChannelVolumeChange = (productId: string, year: number, channel: 'B2C' | 'B2B' | 'OEM', volume: number) => {
    const updatedProducts = state.products.map(p => {
      if (p.id !== productId) return p;
      const channels = p.volumesByChannel || { B2C: {}, B2B: {}, OEM: {} };
      const updatedChannels = {
        ...channels,
        [channel]: { ...channels[channel], [year]: volume },
      };
      // Keep legacy volumesByYear in sync (sum of channels)
      const totalVol = (updatedChannels.B2C[year] || 0) + (updatedChannels.B2B[year] || 0) + (updatedChannels.OEM[year] || 0);
      return {
        ...p,
        volumesByChannel: updatedChannels,
        volumesByYear: { ...p.volumesByYear, [year]: totalVol },
      };
    });
    updateProducts(updatedProducts);
  };

  const handleBulkChannelVolumes = (changes: { productId: string; year: number; channel: 'B2C' | 'B2B' | 'OEM'; volume: number }[]) => {
    const updatedProducts = state.products.map(p => {
      const mine = changes.filter(c => c.productId === p.id);
      if (!mine.length) return p;
      const ch = structuredClone(p.volumesByChannel || { B2C: {}, B2B: {}, OEM: {} });
      const vby = { ...p.volumesByYear };
      mine.forEach(c => { ch[c.channel][c.year] = c.volume; });
      new Set(mine.map(c => c.year)).forEach(y => { vby[y] = (ch.B2C[y] || 0) + (ch.B2B[y] || 0) + (ch.OEM[y] || 0); });
      return { ...p, volumesByChannel: ch, volumesByYear: vby };
    });
    updateProducts(updatedProducts);
  };

  // KPIs
  const totalDevCost = computed.totalDevCost;
  const lastYear = YEARS[YEARS.length - 1];
  const totalRevenueLast = computed.revenueByYear.find(r => r.year === lastYear)?.revenue || 0;
  const avgMargin = computed.revenueByYear.length > 0
    ? computed.revenueByYear.reduce((acc, r) => acc + (r.revenue > 0 ? (r.revenue - r.cogs - transportFor(r.year)) / r.revenue : 0), 0) / computed.revenueByYear.length
    : 0;
  const totalTransportLast = transportFor(lastYear);

  const byProduct = state.revenueMode === 'by-product';
  const steps = [
    ...(byProduct
      ? [
          { value: 'volumes', label: 'Volumes par année & canal', help: 'Unités B2C, B2B, OEM', icon: Package },
          { value: 'pricing', label: 'Produits & prix', help: 'Prix HT, coûts, statut', icon: Calculator },
        ]
      : [{ value: 'entry', label: state.revenueMode === 'by-client' ? 'CA par client' : 'CA global par canal', help: 'Saisie du chiffre d’affaires', icon: Target }]),
    { value: 'results', label: 'Résultats', help: 'CA, marge, transport', icon: PieChart },
    { value: 'roadmap', label: 'Roadmap', help: 'Facultatif', icon: Map, optional: true },
  ];

  // Chart data
  const chartData = YEARS.map(year => {
    const yearData = computed.revenueByYear.find(r => r.year === year);
    const transport = transportFor(year);
    return {
      year,
      revenue: (yearData?.revenue || 0) / 1000,
      cogs: (yearData?.cogs || 0) / 1000,
      margin: ((yearData?.revenue || 0) - (yearData?.cogs || 0) - transport) / 1000,
      transport: transport / 1000,
    };
  });

  return (
    <ReadOnlyWrapper tabKey="product-plan">
    <div className="space-y-6">
      <HeroBanner
        image="ccd-evo"
        title="Plan Produit"
        subtitle="Source unique du chiffre d'affaires et des investissements R&D"
        height="sm"
      />

      {/* Sélecteur de mode CA */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-muted/30 rounded-lg border">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">Mode de calcul du CA :</span>
          <div className="flex gap-2">
            <Button
              variant={state.revenueMode === 'by-product' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRevenueMode('by-product')}
            >
              <Layers className="h-4 w-4 mr-1" />
              Par Produit
            </Button>
            <Button
              variant={state.revenueMode === 'by-channel-global' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRevenueMode('by-channel-global')}
            >
              <Target className="h-4 w-4 mr-1" />
              CA Global par Canal
            </Button>
            <Button
              variant={state.revenueMode === 'by-client' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRevenueMode('by-client')}
            >
              <Users className="h-4 w-4 mr-1" />
              Par Client
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Année de début
            <select
              aria-label="Année de début du plan"
              className="h-9 rounded-md border bg-background px-2 text-sm text-foreground"
              value={settings.startYear}
              onChange={(e) => updateScenarioSettings({ startYear: Number(e.target.value) })}
            >
              {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 3 + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>
          <Badge variant={state.revenueMode === 'by-product' ? 'default' : state.revenueMode === 'by-channel-global' ? 'secondary' : 'outline'}>
            {state.revenueMode === 'by-product' ? 'Détail produits' : state.revenueMode === 'by-channel-global' ? 'Global canaux' : 'Par client'}
          </Badge>
          <PageExportPDF
            pageTitle="Plan Produit"
            sections={EXPORT_SECTIONS}
            fileName="Plan_Produit"
          />
          <TabSaveAs tabKey="product-plan" label="Plan produit" />
          <SaveButton
            onSave={saveWithVersion}
            hasUnsavedChanges={state.hasUnsavedChanges}
            lastSaved={state.lastSaved ? new Date(state.lastSaved) : null}
          />
        </div>
      </div>

      {/* Parcours de saisie : la saisie d'abord, les résultats ensuite. */}
      <Tabs key={state.revenueMode} defaultValue={byProduct ? 'volumes' : 'entry'} className="space-y-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/50 p-1">
          {steps.map((step, i) => (
            <TabsTrigger key={step.value} value={step.value} className="flex-1 min-w-[180px] justify-start gap-3 px-3 py-2 text-left data-[state=active]:shadow-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">{step.optional ? <step.icon className="h-3.5 w-3.5" /> : i + 1}</span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{step.label}</span>
                <span className="block text-[11px] font-normal text-muted-foreground whitespace-normal">{step.help}</span>
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* 1 · Volumes (mode produit) */}
        {byProduct && (
          <TabsContent value="volumes" className="space-y-6">
            <div id="product-volumes">
              <VolumesByChannelTable
                products={state.products.filter(p => p.productStatus === 'validated')}
                standbyCount={state.products.filter(p => p.productStatus !== 'validated').length}
                years={YEARS}
                onChannelVolumeChange={handleChannelVolumeChange}
                onBulkChannelVolumes={handleBulkChannelVolumes}
                onUpdateProduct={handleUpdateProduct}
                onAddProduct={handleAddProduct}
              />
            </div>
            <section aria-label="Aides au remplissage" className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Aides au remplissage</h3>
              <Accordion type="multiple" value={helpersOpen} onValueChange={setHelpersOpen} className="rounded-lg border px-4">
                <AccordionItem value="erplain">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="flex items-start gap-3 text-left"><Download className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      <span><span className="block">Réalisé Erplain & catégories</span><span className="block text-xs font-normal text-muted-foreground">Charger les ventes passées, regrouper les produits en catégories, ajouter ou retirer des produits.</span></span>
                    </span>
                  </AccordionTrigger>
                  {/* Toujours monté : les ventes chargées restent en mémoire quand on replie. */}
                  <AccordionContent forceMount hidden={!helpersOpen.includes('erplain')}>
                    <ErplainActualsImport products={state.products} years={YEARS} onApply={updateProducts} onSave={saveWithVersion} showManualAdd={false} />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="projection" className="border-b-0">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="flex items-start gap-3 text-left"><CalendarClock className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      <span><span className="block">Base étalon de l’année en cours</span><span className="block text-xs font-normal text-muted-foreground">Projeter l’année {new Date().getFullYear()} entière à partir des ventes Erplain à date.</span></span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent forceMount hidden={!helpersOpen.includes('projection')}>
                    <CurrentYearProjection products={state.products} years={YEARS} onApply={updateProducts} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </section>
          </TabsContent>
        )}

        {/* 1 · Saisie du CA (modes global / par client) */}
        {state.revenueMode === 'by-channel-global' && (
          <TabsContent value="entry">
            <GlobalRevenueEditor config={state.globalRevenueConfig} onChange={updateGlobalRevenueConfig} years={YEARS} />
          </TabsContent>
        )}
        {state.revenueMode === 'by-client' && (
          <TabsContent value="entry">
            <ClientRevenueEditor config={state.clientRevenueConfig} onChange={updateClientRevenueConfig} years={YEARS} />
          </TabsContent>
        )}

        {/* 2 · Produits & prix (mode produit) */}
        {byProduct && (
          <TabsContent value="pricing">
            <div id="product-pricing" className="space-y-4">
              <ProductPlanCategoryManager categories={state.productCategories} onUpdate={updateProductCategories} />
              <SimplifiedPricingTable
                products={state.products}
                categories={state.productCategories}
                onUpdateProduct={handleUpdateProduct}
                onAddProduct={handleAddProduct}
                onRemoveProduct={removeProduct}
                years={YEARS}
              />
            </div>
          </TabsContent>
        )}

        {/* Résultats : KPIs, graphique, transport, répartition */}
        <TabsContent value="results" className="space-y-6">
          {/* KPIs */}
          <div id="product-kpis" className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              label="Investissement R&D"
              value={formatCurrency(totalDevCost, true)}
              subValue={`${state.products.filter(p => p.devCost > 0).length} produits`}
            />
            <KPICard
              label={`CA ${lastYear}`}
              value={formatCurrency(totalRevenueLast, true)}
              subValue="Projection"
              trend="up"
            />
            <KPICard
              label={transportCfg?.enabled ? 'Marge Nette Moy.' : 'Marge Brute Moy.'}
              value={formatPercent(avgMargin)}
              subValue={transportCfg?.enabled ? 'Après transport' : 'Sur la période'}
            />
            <KPICard
              label="Produits Actifs"
              value={state.products.length.toString()}
              subValue="En portefeuille"
            />
          </div>

          {/* Revenue Chart */}
          <div id="product-revenue-chart">
            <SectionCard title="Projection du Chiffre d'Affaires">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis tickFormatter={(v) => `${v}k€`} />
                    <Tooltip formatter={(value: number) => `${value.toFixed(0)}k€`} />
                    <Legend />
                    <Bar dataKey="revenue" name="CA" fill="hsl(var(--primary))" />
                    <Bar dataKey="margin" name={transportCfg?.enabled ? 'Marge après transport' : 'Marge'} fill="hsl(150, 60%, 40%)" />
                    {transportCfg?.enabled && <Bar dataKey="transport" name="Transport" fill="hsl(25, 80%, 50%)" />}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>

          {transportCfg && (
            <SectionCard title="Transport & expédition">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={transportCfg.enabled}
                    onChange={(e) => updateTransportConfig(state.revenueMode, { enabled: e.target.checked })}
                  />
                  Activer pour ce mode de calcul
                </label>
                {transportCfg.enabled && (
                  <>
                    <label className="flex items-center gap-2 text-sm">
                      Type
                      <select
                        aria-label="Type de coût de transport"
                        className="h-9 rounded-md border bg-background px-2 text-sm text-foreground"
                        value={transportCfg.type}
                        onChange={(e) => updateTransportConfig(state.revenueMode, { type: e.target.value as 'percent' | 'fixed' })}
                      >
                        <option value="percent">% du CA</option>
                        <option value="fixed">Montant fixe annuel</option>
                      </select>
                    </label>
                    {transportCfg.type === 'percent' ? (
                      <label className="flex items-center gap-2 text-sm">
                        Taux
                        <Input
                          type="number"
                          step="0.1"
                          className="w-24"
                          value={(transportCfg.percent * 100).toString()}
                          onChange={(e) => updateTransportConfig(state.revenueMode, { percent: (Number(e.target.value) || 0) / 100 })}
                        />
                        % du CA HT
                      </label>
                    ) : (
                      <>
                        <label className="flex items-center gap-2 text-sm">
                          Montant annuel
                          <Input
                            type="number"
                            className="w-28"
                            value={transportCfg.fixedAmount.toString()}
                            onChange={(e) => updateTransportConfig(state.revenueMode, { fixedAmount: Number(e.target.value) || 0 })}
                          />
                          €
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={transportCfg.indexedToRevenue}
                            onChange={(e) => updateTransportConfig(state.revenueMode, { indexedToRevenue: e.target.checked })}
                          />
                          Indexé sur la croissance du CA
                        </label>
                      </>
                    )}
                    <Badge variant="secondary">
                      {lastYear} : {formatCurrency(totalTransportLast, true)} de transport imputé sur la marge
                    </Badge>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Le coût de transport est déduit de la marge brute affichée (KPIs et graphique) pour le mode de CA actif. Chaque mode a son propre réglage.
              </p>
            </SectionCard>
          )}

          {byProduct && (
            <div id="product-revenue-viz">
              <RevenueVisualization products={state.products} years={YEARS} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="roadmap">
          <ProductRoadmap
            products={state.products}
            years={YEARS}
            persistedBlocks={state.roadmapBlocks}
            onBlocksChange={updateRoadmapBlocks}
          />
        </TabsContent>
      </Tabs>
    </div>
    </ReadOnlyWrapper>
  );
}
