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

  const handleVolumeChange = (productId: string, year: number, volume: number) => {
    const updatedProducts = state.products.map(p => {
      if (p.id !== productId) return p;
      return {
        ...p,
        volumesByYear: { ...p.volumesByYear, [year]: volume },
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
            <SectionCard title="Volumes par Canal et par Année">
              <p className="text-sm text-muted-foreground mb-4">
                Saisissez les volumes de vente prévisionnels par produit, par canal (B2C, B2B, OEM) et par année. Le CA est calculé comme la somme des (prix canal × volume canal).
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      {YEARS.map(year => (
                        <TableHead key={year} className="text-center" colSpan={3}>
                          {year}
                        </TableHead>
                      ))}
                      <TableHead className="text-right">CA Total</TableHead>
                    </TableRow>
                    <TableRow>
                      <TableHead></TableHead>
                      {YEARS.map(year => (
                        <>
                          <TableHead key={`${year}-b2c`} className="text-center text-xs">B2C</TableHead>
                          <TableHead key={`${year}-b2b`} className="text-center text-xs">B2B</TableHead>
                          <TableHead key={`${year}-oem`} className="text-center text-xs">OEM</TableHead>
                        </>
                      ))}
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {state.products.map((product) => {
                      const channels = product.volumesByChannel || { B2C: {}, B2B: {}, OEM: {} };
                      const totalRevenue = YEARS.reduce((sum, year) => {
                        if (year < product.launchYear) return sum;
                        const volB2C = channels.B2C[year] || 0;
                        const volB2B = channels.B2B[year] || 0;
                        const volOEM = channels.OEM[year] || 0;
                        return sum + volB2C * product.priceHT + volB2B * (product.priceHT_B2B || product.priceHT) + volOEM * (product.priceHT_OEM || product.priceHT);
                      }, 0);

                      const handleChannelVolume = (channel: 'B2C' | 'B2B' | 'OEM', year: number, volume: number) => {
                        const currentChannels = product.volumesByChannel || { B2C: {}, B2B: {}, OEM: {} };
                        const updatedChannels = {
                          ...currentChannels,
                          [channel]: { ...currentChannels[channel], [year]: volume },
                        };
                        // Also update legacy volumesByYear as sum of channels
                        const newVolByYear = { ...product.volumesByYear };
                        YEARS.forEach(y => {
                          newVolByYear[y] = (updatedChannels.B2C[y] || 0) + (updatedChannels.B2B[y] || 0) + (updatedChannels.OEM[y] || 0);
                        });
                        handleUpdateProduct({ ...product, volumesByChannel: updatedChannels, volumesByYear: newVolByYear });
                      };

                      return (
                        <TableRow key={product.id}>
                          <TableCell>
                            <div className="font-medium">{product.name}</div>
                            <div className="text-xs text-muted-foreground">
                              Lancement: {product.launchYear}
                            </div>
                          </TableCell>
                          {YEARS.map(year => (
                            year >= product.launchYear ? (
                              <>
                                <TableCell key={`${year}-b2c`} className="text-center">
                                  <Input
                                    type="number"
                                    value={channels.B2C[year] || 0}
                                    onChange={(e) => handleChannelVolume('B2C', year, Number(e.target.value))}
                                    className="h-8 w-16 mx-auto text-center text-xs"
                                  />
                                </TableCell>
                                <TableCell key={`${year}-b2b`} className="text-center">
                                  <Input
                                    type="number"
                                    value={channels.B2B[year] || 0}
                                    onChange={(e) => handleChannelVolume('B2B', year, Number(e.target.value))}
                                    className="h-8 w-16 mx-auto text-center text-xs"
                                  />
                                </TableCell>
                                <TableCell key={`${year}-oem`} className="text-center">
                                  <Input
                                    type="number"
                                    value={channels.OEM[year] || 0}
                                    onChange={(e) => handleChannelVolume('OEM', year, Number(e.target.value))}
                                    className="h-8 w-16 mx-auto text-center text-xs"
                                  />
                                </TableCell>
                              </>
                            ) : (
                              <>
                                <TableCell key={`${year}-b2c`} className="text-center text-muted-foreground">-</TableCell>
                                <TableCell key={`${year}-b2b`} className="text-center text-muted-foreground">-</TableCell>
                                <TableCell key={`${year}-oem`} className="text-center text-muted-foreground">-</TableCell>
                              </>
                            )
                          ))}
                          <TableCell className="text-right font-mono-numbers font-medium">
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
