import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCostFlowData, CostFlowReference, CostFlowProduct } from '@/hooks/useCostFlowData';
import { ReferenceManager } from '@/components/costflow/ReferenceManager';
import { ReferenceDetail } from '@/components/costflow/ReferenceDetail';
import { ProductManager } from '@/components/costflow/ProductManager';
import { ProductDetail } from '@/components/costflow/ProductDetail';
import { ProductCategoryManager } from '@/components/costflow/ProductCategoryManager';
import { CostAnalysis } from '@/components/costflow/CostAnalysis';
import { SupplierManager } from '@/components/costflow/SupplierManager';
import { MeetingManager } from '@/components/costflow/MeetingManager';
import { ProductPlanningGantt } from '@/components/costflow/ProductPlanningGantt';
import { ReadOnlyWrapper } from '@/components/auth/ReadOnlyWrapper';
import { Loader2 } from 'lucide-react';

export function CostFlowPage() {
  const data = useCostFlowData();
  const [selectedRef, setSelectedRef] = useState<CostFlowReference | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<CostFlowProduct | null>(null);
  const [activeTab, setActiveTab] = useState('references');

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
          <TabsTrigger value="meetings">📋 Réunions BE</TabsTrigger>
          <TabsTrigger value="planning">📅 Planning Dev</TabsTrigger>
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

        <TabsContent value="meetings">
          <MeetingManager />
        </TabsContent>

        <TabsContent value="planning">
          <ProductPlanningGantt />
        </TabsContent>
      </Tabs>
    </div>
    </ReadOnlyWrapper>
  );
}
