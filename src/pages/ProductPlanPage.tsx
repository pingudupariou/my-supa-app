import { useState } from 'react';
import { useFinancial, RevenueMode } from '@/context/FinancialContext';
import { Product } from '@/engine/types';
import { SectionCard, KPICard } from '@/components/ui/KPICard';
import { HeroBanner } from '@/components/ui/HeroBanner';
import { SaveButton } from '@/components/ui/SaveButton';
import { SimplifiedPricingTable } from '@/components/product/SimplifiedPricingTable';
import { RevenueVisualization } from '@/components/product/RevenueVisualization';
import { GlobalRevenueEditor, calculateGlobalRevenue } from '@/components/product/GlobalRevenueEditor';
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
import { Calculator, Package, PieChart, Layers, Target } from 'lucide-react';

const EXPORT_SECTIONS: ExportableSection[] = [
  { id: 'kpis', label: 'KPIs Produits', elementId: 'product-kpis' },
  { id: 'revenue-viz', label: 'Visualisation CA', elementId: 'product-revenue-viz' },
  { id: 'revenue-chart', label: 'Projection CA', elementId: 'product-revenue-chart' },
  { id: 'pricing', label: 'Pricing Produits', elementId: 'product-pricing' },
  { id: 'volumes', label: 'Volumes par Année', elementId: 'product-volumes' },
];

export function ProductPlanPage() {
  const { 
    state, 
    computed, 
    updateProducts, 
    addProduct, 
    removeProduct, 
    saveAll,
    setRevenueMode,
    updateGlobalRevenueConfig,
  } = useFinancial();

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

  // KPIs
  const totalDevCost = computed.totalDevCost;
  const lastYear = YEARS[YEARS.length - 1];
  const totalRevenueLast = computed.revenueByYear.find(r => r.year === lastYear)?.revenue || 0;
  const avgMargin = computed.revenueByYear.length > 0
    ? computed.revenueByYear.reduce((acc, r) => acc + (r.revenue > 0 ? (r.revenue - r.cogs) / r.revenue : 0), 0) / computed.revenueByYear.length
    : 0;

  // Chart data
  const chartData = YEARS.map(year => {
    const yearData = computed.revenueByYear.find(r => r.year === year);
    return {
      year,
      revenue: (yearData?.revenue || 0) / 1000,
      cogs: (yearData?.cogs || 0) / 1000,
      margin: ((yearData?.revenue || 0) - (yearData?.cogs || 0)) / 1000,
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
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={state.revenueMode === 'by-product' ? 'default' : 'secondary'}>
            {state.revenueMode === 'by-product' ? 'Détail produits' : 'Global canaux'}
          </Badge>
          <PageExportPDF
            pageTitle="Plan Produit"
            sections={EXPORT_SECTIONS}
            fileName="Plan_Produit"
          />
          <SaveButton
            onSave={saveAll}
            hasUnsavedChanges={state.hasUnsavedChanges}
            lastSaved={state.lastSaved ? new Date(state.lastSaved) : null}
          />
        </div>
      </div>

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
          label="Marge Brute Moy."
          value={formatPercent(avgMargin)}
          subValue="Sur la période"
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
                <Bar dataKey="margin" name="Marge" fill="hsl(150, 60%, 40%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <Tabs defaultValue="visualization" className="space-y-4">
        <TabsList>
          <TabsTrigger value="visualization">
            <PieChart className="h-4 w-4 mr-1" />
            Visualisation CA
          </TabsTrigger>
          <TabsTrigger value="pricing">
            <Calculator className="h-4 w-4 mr-1" />
            Pricing Produits
          </TabsTrigger>
          <TabsTrigger value="volumes">
            <Package className="h-4 w-4 mr-1" />
            Volumes par Année
          </TabsTrigger>
        </TabsList>

        {/* Mode CA Global par Canal */}
        {state.revenueMode === 'by-channel-global' && (
          <TabsContent value="visualization">
            <GlobalRevenueEditor
              config={state.globalRevenueConfig}
              onChange={updateGlobalRevenueConfig}
              years={YEARS}
            />
          </TabsContent>
        )}

        {/* Revenue Visualization (mode produit) */}
        {state.revenueMode === 'by-product' && (
          <TabsContent value="visualization">
            <div id="product-revenue-viz">
              <RevenueVisualization products={state.products} years={YEARS} />
            </div>
          </TabsContent>
        )}

        {/* Simplified Pricing Table (mode produit uniquement) */}
        <TabsContent value="pricing">
          {state.revenueMode === 'by-product' ? (
            <div id="product-pricing">
              <SimplifiedPricingTable
                products={state.products}
                onUpdateProduct={handleUpdateProduct}
                onAddProduct={handleAddProduct}
                onRemoveProduct={removeProduct}
              />
            </div>
          ) : (
            <SectionCard title="Pricing Produits">
              <div className="p-8 text-center text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">Mode CA Global actif</p>
                <p className="text-sm">
                  Le pricing par produit n'est pas disponible en mode "CA Global par Canal".
                  <br />Passez en mode "Par Produit" pour gérer les prix individuellement.
                </p>
              </div>
            </SectionCard>
          )}
        </TabsContent>

        {/* Volumes by Year */}
        <TabsContent value="volumes">
          <div id="product-volumes">
            <SectionCard title="Volumes par Année">
              <p className="text-sm text-muted-foreground mb-4">
                Saisissez les volumes de vente prévisionnels par produit et par année.
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead rowSpan={2}>Produit</TableHead>
                      {YEARS.map(year => (
                        <TableHead key={year} colSpan={3} className="text-center border-l">{year}</TableHead>
                      ))}
                      <TableHead rowSpan={2} className="text-right border-l">CA Total</TableHead>
                    </TableRow>
                    <TableRow>
                      {YEARS.map(year => (
                        <>
                          <TableHead key={`${year}-b2c`} className="text-center text-xs border-l">B2C</TableHead>
                          <TableHead key={`${year}-b2b`} className="text-center text-xs">B2B</TableHead>
                          <TableHead key={`${year}-oem`} className="text-center text-xs">OEM</TableHead>
                        </>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {state.products.map((product) => {
                      const channels = product.volumesByChannel || { B2C: {}, B2B: {}, OEM: {} };
                      const totalRevenue = YEARS.reduce((sum, year) => {
                        const vB2C = channels.B2C[year] || 0;
                        const vB2B = channels.B2B[year] || 0;
                        const vOEM = channels.OEM[year] || 0;
                        return sum + vB2C * product.priceHT + vB2B * (product.priceHT_B2B || product.priceHT) + vOEM * (product.priceHT_OEM || product.priceHT);
                      }, 0);
                      
                      return (
                        <TableRow key={product.id}>
                          <TableCell>
                            <div className="font-medium">{product.name}</div>
                            <div className="text-xs text-muted-foreground">
                              Coût: {formatCurrency(product.unitCost)}
                            </div>
                          </TableCell>
                          {YEARS.map(year => (
                            <>
                              {(['B2C', 'B2B', 'OEM'] as const).map(ch => (
                                <TableCell key={`${year}-${ch}`} className={`text-center ${ch === 'B2C' ? 'border-l' : ''}`}>
                                  {year >= product.launchYear ? (
                                    <Input
                                      type="number"
                                      value={channels[ch][year] || 0}
                                      onChange={(e) => handleChannelVolumeChange(product.id, year, ch, Number(e.target.value))}
                                      className="h-7 w-16 mx-auto text-center text-xs"
                                    />
                                  ) : (
                                    <span className="text-muted-foreground text-xs">-</span>
                                  )}
                                </TableCell>
                              ))}
                            </>
                          ))}
                          <TableCell className="text-right font-mono-numbers font-medium border-l">
                            {formatCurrency(totalRevenue, true)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </SectionCard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
    </ReadOnlyWrapper>
  );
}
