import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCostFlowData, CostFlowReference, CostFlowProduct } from '@/hooks/useCostFlowData';
import { ReferenceManager } from '@/components/costflow/ReferenceManager';
import { ReferenceDetail } from '@/components/costflow/ReferenceDetail';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { ProductManager } from '@/components/costflow/ProductManager';
import { ProductDetail } from '@/components/costflow/ProductDetail';
import { ProductCategoryManager } from '@/components/costflow/ProductCategoryManager';
import { CostAnalysis } from '@/components/costflow/CostAnalysis';
import { SupplierManager } from '@/components/costflow/SupplierManager';
import { MeetingManager } from '@/components/costflow/MeetingManager';
import { ProductPlanningGantt } from '@/components/costflow/ProductPlanningGantt';
import { TrashManager } from '@/components/costflow/TrashManager';
import { ReferenceUsageMap } from '@/components/costflow/ReferenceUsageMap';
import { StockManager } from '@/components/costflow/StockManager';
import { ReadOnlyWrapper } from '@/components/auth/ReadOnlyWrapper';
import { Loader2 } from 'lucide-react';

export function CostFlowPage() {
  const { isAdmin } = useAuth();
  const data = useCostFlowData();
  const [selectedRef, setSelectedRef] = useState<CostFlowReference | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<CostFlowProduct | null>(null);
  const [activeTab, setActiveTab] = useState('references');
  const [salesRules, setSalesRules] = useState<{ id: string; name: string; type: string }[]>([]);

  // Load sales rules from pricing_config
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: cfg } = await supabase
        .from('pricing_config')
        .select('config_data')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cfg?.config_data) {
        const c = cfg.config_data as any;
        if (c.salesRules?.length) {
          setSalesRules(c.salesRules.map((r: any) => ({ id: r.id, name: r.name, type: r.type })));
        }
      }
    };
    load();
  }, []);

  if (data.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ReadOnlyWrapper tabKey="costflow">
    <div className="space-y-6">
      <div>
        <h1 className="page-title">CostFlow — Production & Bureau d'études</h1>
        <p className="text-sm text-muted-foreground">Gestion des références, nomenclatures et calcul des coûts de revient</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="references">📦 Références</TabsTrigger>
          <TabsTrigger value="products">🎯 Produits</TabsTrigger>
          <TabsTrigger value="suppliers">🏭 Fournisseurs</TabsTrigger>
          <TabsTrigger value="costs">💰 Coûts & Export</TabsTrigger>
          <TabsTrigger value="stock">📊 Stock</TabsTrigger>
          <TabsTrigger value="usage">🔗 Cas d'usage</TabsTrigger>
          <TabsTrigger value="meetings">📋 Réunions BE</TabsTrigger>
          <TabsTrigger value="planning">📅 Planning Dev</TabsTrigger>
          <TabsTrigger value="trash" className="relative">
            🗑️ Corbeille
            {(data.trashedProducts.length + data.trashedReferences.length) > 0 && (
              <span className="ml-1 inline-flex items-center justify-center h-4 min-w-[1rem] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                {data.trashedProducts.length + data.trashedReferences.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="references">
          {selectedRef ? (
            <ReferenceDetail
              reference={selectedRef}
              files={data.referenceFiles}
              onUploadFile={data.uploadFile}
              onDeleteFile={data.deleteFile}
              onGetSignedUrl={data.getSignedUrl}
              onBack={() => setSelectedRef(null)}
            />
          ) : (
            <ReferenceManager
              references={data.references}
              suppliers={data.suppliers}
              onCreateReference={data.createReference}
              onUpdateReference={data.updateReference}
              onDeleteReference={data.deleteReference}
              onBulkImport={data.bulkCreateReferences}
              onSelectReference={setSelectedRef}
            />
          )}
        </TabsContent>

        <TabsContent value="products">
          {selectedProduct ? (
            <ProductDetail
              product={selectedProduct}
              references={data.references}
              bom={data.bom}
              onAddBomEntry={data.addBomEntry}
              onUpdateBomEntry={data.updateBomEntry}
              onRemoveBomEntry={data.removeBomEntry}
              calculateProductCosts={data.calculateProductCosts}
              onBack={() => setSelectedProduct(null)}
            />
          ) : (
            <div className="space-y-6">
              <ProductManager
                products={data.products}
                references={data.references}
                categories={data.productCategories}
                salesRules={salesRules}
                getProductChannels={data.getProductChannels}
                onSetProductChannel={data.setProductChannel}
                onCreateProduct={data.createProduct}
                onUpdateProduct={data.updateProduct}
                onDeleteProduct={data.deleteProduct}
                onSelectProduct={setSelectedProduct}
                onImportProduct={data.createProductWithBom}
                calculateProductCosts={data.calculateProductCosts}
              />
              <ProductCategoryManager
                categories={data.productCategories}
                onCreateCategory={data.createProductCategory}
                onUpdateCategory={data.updateProductCategory}
                onDeleteCategory={data.deleteProductCategory}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="suppliers">
          <SupplierManager
            suppliers={data.suppliers}
            onCreateSupplier={data.createSupplier}
            onUpdateSupplier={data.updateSupplier}
            onDeleteSupplier={data.deleteSupplier}
          />
        </TabsContent>

        <TabsContent value="costs">
          <CostAnalysis
            products={data.products}
            references={data.references}
            bom={data.bom}
            calculateProductCosts={data.calculateProductCosts}
          />
        </TabsContent>

        <TabsContent value="usage">
          <ReferenceUsageMap
            references={data.references}
            products={data.products}
            bom={data.bom}
          />
        </TabsContent>

        <TabsContent value="meetings">
          <MeetingManager />
        </TabsContent>

        <TabsContent value="planning">
          <ProductPlanningGantt />
        </TabsContent>
        <TabsContent value="trash">
          <TrashManager
            trashedProducts={data.trashedProducts}
            trashedReferences={data.trashedReferences}
            onRestoreProduct={data.restoreProduct}
            onPermanentDeleteProduct={data.permanentDeleteProduct}
            onRestoreReference={data.restoreReference}
            onPermanentDeleteReference={data.permanentDeleteReference}
            isAdmin={isAdmin}
          />
        </TabsContent>
      </Tabs>
    </div>
    </ReadOnlyWrapper>
  );
}
