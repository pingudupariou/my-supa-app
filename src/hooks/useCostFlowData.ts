import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export interface CostFlowReference {
  id: string;
  code: string;
  name: string;
  category: string;
  revision: string;
  supplier: string;
  currency: string;
  prices: Record<number, number>; // volume -> price
  comments: string;
  created_at: string;
  updated_at: string;
}

export interface CostFlowReferenceFile {
  id: string;
  reference_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  version: number;
  uploaded_at: string;
}

export type CostMode = 'bom' | 'manual';

export interface CostFlowProduct {
  id: string;
  name: string;
  family: string;
  main_supplier: string;
  coefficient: number;
  price_ttc: number;
  default_volume: number;
  comments: string;
  category_id: string | null;
  cost_mode: CostMode;
  manual_unit_cost: number;
  created_at: string;
  updated_at: string;
}

export interface CostFlowBomEntry {
  id: string;
  product_id: string;
  reference_id: string;
  quantity: number;
  reference?: CostFlowReference;
}

export interface CostFlowSupplier {
  id: string;
  name: string;
  contact_name: string;
  email: string;
  phone: string;
  country: string;
  comments: string;
  created_at: string;
  updated_at: string;
}

export interface CostFlowProductCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  created_at: string;
}

const VOLUME_TIERS = [50, 100, 200, 500, 1000, 2000, 5000, 10000] as const;

function rowToReference(row: any): CostFlowReference {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category || 'Mécanique',
    revision: row.revision || 'A',
    supplier: row.supplier || '',
    currency: row.currency || 'EUR',
    prices: {
      50: Number(row.price_vol_50) || 0,
      100: Number(row.price_vol_100) || 0,
      200: Number(row.price_vol_200) || 0,
      500: Number(row.price_vol_500) || 0,
      1000: Number(row.price_vol_1000) || 0,
      2000: Number(row.price_vol_2000) || 0,
      5000: Number(row.price_vol_5000) || 0,
      10000: Number(row.price_vol_10000) || 0,
    },
    comments: row.comments || '',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function useCostFlowData() {
  const { user } = useAuth();
  const [references, setReferences] = useState<CostFlowReference[]>([]);
  const [products, setProducts] = useState<CostFlowProduct[]>([]);
  const [bom, setBom] = useState<CostFlowBomEntry[]>([]);
  const [referenceFiles, setReferenceFiles] = useState<CostFlowReferenceFile[]>([]);
  const [suppliers, setSuppliers] = useState<CostFlowSupplier[]>([]);
  const [productCategories, setProductCategories] = useState<CostFlowProductCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const [initialLoaded, setInitialLoaded] = useState(false);
  
  const fetchAll = useCallback(async () => {
    if (!user) return;
    if (!initialLoaded) setLoading(true);
    try {
      const [refsRes, prodsRes, bomRes, filesRes, suppRes, catRes] = await Promise.all([
        supabase.from('costflow_references' as any).select('*').order('code'),
        supabase.from('costflow_products' as any).select('*').order('name'),
        supabase.from('costflow_bom' as any).select('*'),
        supabase.from('costflow_reference_files' as any).select('*').order('uploaded_at', { ascending: false }),
        supabase.from('costflow_suppliers' as any).select('*').order('name'),
        supabase.from('costflow_product_categories' as any).select('*').order('name'),
      ]);
      if (refsRes.data) setReferences((refsRes.data as any[]).map(rowToReference));
      if (prodsRes.data) setProducts((prodsRes.data as any[]).map((r: any) => ({
        id: r.id, name: r.name, family: r.family || 'Standard',
        main_supplier: r.main_supplier || '', coefficient: Number(r.coefficient) || 1.3,
        price_ttc: Number(r.price_ttc) || 0, default_volume: r.default_volume || 500,
        comments: r.comments || '', category_id: r.category_id || null,
        cost_mode: (r.cost_mode as CostMode) || 'bom',
        manual_unit_cost: Number(r.manual_unit_cost) || 0,
        created_at: r.created_at, updated_at: r.updated_at,
      })));
      if (bomRes.data) setBom((bomRes.data as any[]).map((r: any) => ({
        id: r.id, product_id: r.product_id, reference_id: r.reference_id,
        quantity: Number(r.quantity) || 1,
      })));
      if (filesRes.data) setReferenceFiles((filesRes.data as any[]).map((r: any) => ({
        id: r.id, reference_id: r.reference_id, file_name: r.file_name,
        file_path: r.file_path, file_size: r.file_size || 0,
        version: r.version || 1, uploaded_at: r.uploaded_at,
      })));
      if (suppRes.data) setSuppliers((suppRes.data as any[]).map((r: any) => ({
        id: r.id, name: r.name, contact_name: r.contact_name || '',
        email: r.email || '', phone: r.phone || '', country: r.country || 'France',
        comments: r.comments || '', created_at: r.created_at, updated_at: r.updated_at,
      })));
      if (catRes.data) setProductCategories((catRes.data as any[]).map((r: any) => ({
        id: r.id, name: r.name, description: r.description || '',
        color: r.color || '#6366f1', created_at: r.created_at,
      })));
    } catch (err) {
      console.error('CostFlow fetch error:', err);
    } finally {
      setLoading(false);
      setInitialLoaded(true);
    }
  }, [user, initialLoaded]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // === REFERENCES CRUD ===
  const createReference = async (ref: Partial<CostFlowReference>) => {
    if (!user) return;
    const prices = ref.prices || {};
    const { error } = await supabase.from('costflow_references' as any).insert({
      user_id: user.id, code: ref.code, name: ref.name,
      category: ref.category || 'Mécanique', revision: ref.revision || 'A',
      supplier: ref.supplier || '', currency: ref.currency || 'EUR',
      comments: ref.comments || '',
      price_vol_50: prices[50] || 0, price_vol_100: prices[100] || 0,
      price_vol_200: prices[200] || 0, price_vol_500: prices[500] || 0,
      price_vol_1000: prices[1000] || 0, price_vol_2000: prices[2000] || 0,
      price_vol_5000: prices[5000] || 0, price_vol_10000: prices[10000] || 0,
    } as any);
    if (error) { toast.error('Erreur création référence'); console.error(error); }
    else { toast.success('Référence créée'); fetchAll(); }
  };

  const updateReference = async (id: string, ref: Partial<CostFlowReference>) => {
    if (!user) return;
    const update: any = {};
    if (ref.code !== undefined) update.code = ref.code;
    if (ref.name !== undefined) update.name = ref.name;
    if (ref.category !== undefined) update.category = ref.category;
    if (ref.revision !== undefined) update.revision = ref.revision;
    if (ref.supplier !== undefined) update.supplier = ref.supplier;
    if (ref.currency !== undefined) update.currency = ref.currency;
    if (ref.comments !== undefined) update.comments = ref.comments;
    if (ref.prices) {
      update.price_vol_50 = ref.prices[50] ?? 0;
      update.price_vol_100 = ref.prices[100] ?? 0;
      update.price_vol_200 = ref.prices[200] ?? 0;
      update.price_vol_500 = ref.prices[500] ?? 0;
      update.price_vol_1000 = ref.prices[1000] ?? 0;
      update.price_vol_2000 = ref.prices[2000] ?? 0;
      update.price_vol_5000 = ref.prices[5000] ?? 0;
      update.price_vol_10000 = ref.prices[10000] ?? 0;
    }
    const { error } = await supabase.from('costflow_references' as any).update(update).eq('id', id);
    if (error) { toast.error('Erreur mise à jour'); console.error(error); }
    else { toast.success('Référence mise à jour'); fetchAll(); }
  };

  const deleteReference = async (id: string) => {
    const { error } = await supabase.from('costflow_references' as any).delete().eq('id', id);
    if (error) { toast.error('Erreur suppression'); console.error(error); }
    else { toast.success('Référence supprimée'); fetchAll(); }
  };

  const bulkCreateReferences = async (refs: Partial<CostFlowReference>[], duplicateAction: 'skip' | 'overwrite' = 'skip') => {
    if (!user || refs.length === 0) return { imported: 0, skipped: 0, updated: 0, errors: [] as string[] };

    const result = { imported: 0, skipped: 0, updated: 0, errors: [] as string[] };
    const existingCodes = references.map(r => r.code);

    const newRefs = refs.filter(r => !existingCodes.includes(r.code || ''));
    const dupeRefs = refs.filter(r => existingCodes.includes(r.code || ''));

    // Insert new references
    if (newRefs.length > 0) {
      const rows = newRefs.map(ref => {
        const prices = ref.prices || {};
        return {
          user_id: user.id, code: ref.code, name: ref.name || ref.code,
          category: ref.category || 'Mécanique', revision: ref.revision || 'A',
          supplier: ref.supplier || '', currency: ref.currency || 'EUR',
          comments: ref.comments || '',
          price_vol_50: prices[50] || 0, price_vol_100: prices[100] || 0,
          price_vol_200: prices[200] || 0, price_vol_500: prices[500] || 0,
          price_vol_1000: prices[1000] || 0, price_vol_2000: prices[2000] || 0,
          price_vol_5000: prices[5000] || 0, price_vol_10000: prices[10000] || 0,
        };
      });
      const { error } = await supabase.from('costflow_references' as any).insert(rows as any);
      if (error) { result.errors.push(`Erreur insertion : ${error.message}`); }
      else { result.imported = newRefs.length; }
    }

    // Handle duplicates
    if (dupeRefs.length > 0) {
      if (duplicateAction === 'skip') {
        result.skipped = dupeRefs.length;
      } else {
        // Overwrite: update each duplicate
        for (const ref of dupeRefs) {
          const existing = references.find(r => r.code === ref.code);
          if (!existing) continue;
          const prices = ref.prices || {};
          const { error } = await supabase.from('costflow_references' as any).update({
            name: ref.name || ref.code, supplier: ref.supplier || '',
            currency: ref.currency || 'EUR', comments: ref.comments || '',
            price_vol_50: prices[50] || 0, price_vol_100: prices[100] || 0,
            price_vol_200: prices[200] || 0, price_vol_500: prices[500] || 0,
            price_vol_1000: prices[1000] || 0, price_vol_2000: prices[2000] || 0,
            price_vol_5000: prices[5000] || 0, price_vol_10000: prices[10000] || 0,
          } as any).eq('id', existing.id);
          if (error) result.errors.push(`Erreur mise à jour ${ref.code}`);
          else result.updated++;
        }
      }
    }

    fetchAll();
    return result;
  };

  // === PRODUCTS CRUD ===
  const createProduct = async (prod: Partial<CostFlowProduct>) => {
    if (!user) return;
    const { error } = await supabase.from('costflow_products' as any).insert({
      user_id: user.id, name: prod.name, family: prod.family || 'Standard',
      main_supplier: prod.main_supplier || '', coefficient: prod.coefficient || 1.3,
      price_ttc: prod.price_ttc || 0, default_volume: prod.default_volume || 500,
      comments: prod.comments || '',
    } as any);
    if (error) { toast.error('Erreur création produit'); console.error(error); }
    else { toast.success('Produit créé'); fetchAll(); }
  };

  const updateProduct = async (id: string, prod: Partial<CostFlowProduct>) => {
    if (!user) return;
    const { error } = await supabase.from('costflow_products' as any).update(prod as any).eq('id', id);
    if (error) { toast.error('Erreur mise à jour'); console.error(error); }
    else { toast.success('Produit mis à jour'); fetchAll(); }
  };

  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from('costflow_products' as any).delete().eq('id', id);
    if (error) { toast.error('Erreur suppression'); console.error(error); }
    else { toast.success('Produit supprimé'); fetchAll(); }
  };

  // === BOM CRUD ===
  const addBomEntry = async (productId: string, referenceId: string, quantity: number) => {
    if (!user) return;
    const { error } = await supabase.from('costflow_bom' as any).insert({
      user_id: user.id, product_id: productId, reference_id: referenceId, quantity,
    } as any);
    if (error) { toast.error('Erreur ajout nomenclature'); console.error(error); }
    else { fetchAll(); }
  };

  const updateBomEntry = async (id: string, quantity: number) => {
    const { error } = await supabase.from('costflow_bom' as any).update({ quantity } as any).eq('id', id);
    if (error) { toast.error('Erreur mise à jour'); console.error(error); }
    else { fetchAll(); }
  };

  const removeBomEntry = async (id: string) => {
    const { error } = await supabase.from('costflow_bom' as any).delete().eq('id', id);
    if (error) { toast.error('Erreur suppression'); console.error(error); }
    else { fetchAll(); }
  };

  // === FILE UPLOAD ===
  const uploadFile = async (referenceId: string, file: File) => {
    if (!user) return;
    const filePath = `${user.id}/${referenceId}/${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage.from('technical-plans').upload(filePath, file);
    if (uploadErr) { toast.error('Erreur upload fichier'); console.error(uploadErr); return; }

    // Get current max version
    const existingFiles = referenceFiles.filter(f => f.reference_id === referenceId);
    const maxVersion = existingFiles.length > 0 ? Math.max(...existingFiles.map(f => f.version)) : 0;

    const { error } = await supabase.from('costflow_reference_files' as any).insert({
      user_id: user.id, reference_id: referenceId, file_name: file.name,
      file_path: filePath, file_size: file.size, version: maxVersion + 1,
    } as any);
    if (error) { toast.error('Erreur enregistrement fichier'); console.error(error); }
    else { toast.success('Fichier uploadé'); fetchAll(); }
  };

  const deleteFile = async (fileId: string, filePath: string) => {
    await supabase.storage.from('technical-plans').remove([filePath]);
    const { error } = await supabase.from('costflow_reference_files' as any).delete().eq('id', fileId);
    if (error) { toast.error('Erreur suppression fichier'); console.error(error); }
    else { fetchAll(); }
  };

  const getFileUrl = (filePath: string) => {
    const { data } = supabase.storage.from('technical-plans').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const getSignedUrl = async (filePath: string) => {
    const { data, error } = await supabase.storage.from('technical-plans').createSignedUrl(filePath, 3600);
    if (error) { toast.error('Erreur accès fichier'); return null; }
    return data.signedUrl;
  };

  // === COST CALCULATIONS ===
  const calculateProductCost = (productId: string, volume: number): number => {
    const product = products.find(p => p.id === productId);
    if (!product) return 0;

    // Mode manuel : retourne directement le coût saisi
    if (product.cost_mode === 'manual') {
      return product.manual_unit_cost;
    }

    // Mode BOM : calcul depuis la nomenclature
    const productBom = bom.filter(b => b.product_id === productId);
    const nearestVolume = VOLUME_TIERS.reduce((prev, curr) =>
      Math.abs(curr - volume) < Math.abs(prev - volume) ? curr : prev
    );

    let totalCost = 0;
    for (const entry of productBom) {
      const ref = references.find(r => r.id === entry.reference_id);
      if (ref) {
        totalCost += entry.quantity * (ref.prices[nearestVolume] || 0);
      }
    }
    return totalCost * product.coefficient;
  };

  const calculateProductCosts = (productId: string): Record<number, number> => {
    const product = products.find(p => p.id === productId);
    const costs: Record<number, number> = {};
    for (const vol of VOLUME_TIERS) {
      costs[vol] = calculateProductCost(productId, vol);
    }
    return costs;
  };

  const createProductWithBom = async (prod: Partial<CostFlowProduct>, bomEntries: { referenceId: string; quantity: number }[]) => {
    if (!user) return;
    const { data, error } = await supabase.from('costflow_products' as any).insert({
      user_id: user.id, name: prod.name, family: prod.family || 'Standard',
      main_supplier: prod.main_supplier || '', coefficient: prod.coefficient || 1.3,
      price_ttc: prod.price_ttc || 0, default_volume: prod.default_volume || 500,
      comments: prod.comments || '',
    } as any).select('id').single();
    if (error || !data) { toast.error('Erreur création produit'); console.error(error); return; }

    const productId = (data as any).id;
    if (bomEntries.length > 0) {
      const bomRows = bomEntries.map(e => ({
        user_id: user.id, product_id: productId, reference_id: e.referenceId, quantity: e.quantity,
      }));
      const { error: bomError } = await supabase.from('costflow_bom' as any).insert(bomRows as any);
      if (bomError) { toast.error('Erreur ajout nomenclature'); console.error(bomError); }
    }
    toast.success(`Produit "${prod.name}" créé avec ${bomEntries.length} référence(s)`);
    fetchAll();
  };

  // === PRODUCT CATEGORIES CRUD ===
  const createProductCategory = async (cat: Partial<CostFlowProductCategory>) => {
    if (!user) return;
    const { error } = await supabase.from('costflow_product_categories' as any).insert({
      user_id: user.id, name: cat.name, description: cat.description || '',
      color: cat.color || '#6366f1',
    } as any);
    if (error) { toast.error('Erreur création catégorie'); console.error(error); }
    else { toast.success('Catégorie créée'); fetchAll(); }
  };

  const updateProductCategory = async (id: string, cat: Partial<CostFlowProductCategory>) => {
    if (!user) return;
    const { error } = await supabase.from('costflow_product_categories' as any).update(cat as any).eq('id', id);
    if (error) { toast.error('Erreur mise à jour catégorie'); console.error(error); }
    else { toast.success('Catégorie mise à jour'); fetchAll(); }
  };

  const deleteProductCategory = async (id: string) => {
    // Unlink products from this category first
    await supabase.from('costflow_products' as any).update({ category_id: null } as any).eq('category_id', id);
    const { error } = await supabase.from('costflow_product_categories' as any).delete().eq('id', id);
    if (error) { toast.error('Erreur suppression catégorie'); console.error(error); }
    else { toast.success('Catégorie supprimée'); fetchAll(); }
  };

  // === SUPPLIERS CRUD ===
  const createSupplier = async (supplier: Partial<CostFlowSupplier>) => {
    if (!user) return;
    const { error } = await supabase.from('costflow_suppliers' as any).insert({
      user_id: user.id, name: supplier.name,
      contact_name: supplier.contact_name || '', email: supplier.email || '',
      phone: supplier.phone || '', country: supplier.country || 'France',
      comments: supplier.comments || '',
    } as any);
    if (error) { toast.error('Erreur création fournisseur'); console.error(error); }
    else { toast.success('Fournisseur créé'); fetchAll(); }
  };

  const updateSupplier = async (id: string, supplier: Partial<CostFlowSupplier>) => {
    if (!user) return;
    const { error } = await supabase.from('costflow_suppliers' as any).update(supplier as any).eq('id', id);
    if (error) { toast.error('Erreur mise à jour fournisseur'); console.error(error); }
    else { toast.success('Fournisseur mis à jour'); fetchAll(); }
  };

  const deleteSupplier = async (id: string) => {
    const { error } = await supabase.from('costflow_suppliers' as any).delete().eq('id', id);
    if (error) { toast.error('Erreur suppression fournisseur'); console.error(error); }
    else { toast.success('Fournisseur supprimé'); fetchAll(); }
  };

  return {
    references, products, bom, referenceFiles, suppliers, productCategories, loading,
    createReference, updateReference, deleteReference, bulkCreateReferences,
    createProduct, updateProduct, deleteProduct, createProductWithBom,
    addBomEntry, updateBomEntry, removeBomEntry,
    uploadFile, deleteFile, getFileUrl, getSignedUrl,
    createSupplier, updateSupplier, deleteSupplier,
    createProductCategory, updateProductCategory, deleteProductCategory,
    calculateProductCost, calculateProductCosts,
    VOLUME_TIERS,
    refresh: fetchAll,
  };
}
