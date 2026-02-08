import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCostFlowData, CostFlowReference, CostFlowProduct } from '@/hooks/useCostFlowData';
import { ReferenceManager } from '@/components/costflow/ReferenceManager';
import { ReferenceDetail } from '@/components/costflow/ReferenceDetail';
import { ProductManager } from '@/components/costflow/ProductManager';
import { ProductDetail } from '@/components/costflow/ProductDetail';
import { CostAnalysis } from '@/components/costflow/CostAnalysis';
import { Loader2 } from 'lucide-react';

export function CostFlowPage() {
  const data = useCostFlowData();
  const [selectedRef, setSelectedRef] = useState<CostFlowReference | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<CostFlowProduct | null>(null);

  if (data.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">CostFlow — Production & Bureau d'études</h1>
        <p className="text-sm text-muted-foreground">Gestion des références, nomenclatures et calcul des coûts de revient</p>
      </div>

      <Tabs defaultValue="references" className="space-y-4">
        <TabsList>
          <TabsTrigger value="references">📦 Références</TabsTrigger>
          <TabsTrigger value="products">🎯 Produits</TabsTrigger>
          <TabsTrigger value="costs">💰 Coûts & Export</TabsTrigger>
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
            <ProductManager
              products={data.products}
              onCreateProduct={data.createProduct}
              onUpdateProduct={data.updateProduct}
              onDeleteProduct={data.deleteProduct}
              onSelectProduct={setSelectedProduct}
              calculateProductCosts={data.calculateProductCosts}
            />
          )}
        </TabsContent>

        <TabsContent value="costs">
          <CostAnalysis
            products={data.products}
            references={data.references}
            bom={data.bom}
            calculateProductCosts={data.calculateProductCosts}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
