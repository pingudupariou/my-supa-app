import { useState, useRef, useCallback, useEffect } from 'react';
import { Product } from '@/engine/types';
import { SectionCard } from '@/components/ui/KPICard';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCurrency } from '@/data/financialConfig';
import { GripHorizontal, Calendar, CircleDollarSign, Wrench } from 'lucide-react';

interface ProductRoadmapProps {
  products: Product[];
  years: number[];
  persistedBlocks?: Record<string, { startQ: number; durationQ: number }>;
  onBlocksChange?: (blocks: Record<string, { startQ: number; durationQ: number }>) => void;
  readOnly?: boolean;
}

interface RoadmapBlock {
  productId: string;
  startQ: number;
  durationQ: number;
}

const QUARTER_LABELS = ['T1', 'T2', 'T3', 'T4'];
const PRODUCT_COLORS = [
  { bg: 'from-blue-500/90 to-blue-700/90', border: 'border-blue-400', text: 'text-blue-100', badge: 'bg-blue-900/60' },
  { bg: 'from-amber-500/90 to-amber-700/90', border: 'border-amber-400', text: 'text-amber-100', badge: 'bg-amber-900/60' },
  { bg: 'from-emerald-500/90 to-emerald-700/90', border: 'border-emerald-400', text: 'text-emerald-100', badge: 'bg-emerald-900/60' },
  { bg: 'from-violet-500/90 to-violet-700/90', border: 'border-violet-400', text: 'text-violet-100', badge: 'bg-violet-900/60' },
  { bg: 'from-rose-500/90 to-rose-700/90', border: 'border-rose-400', text: 'text-rose-100', badge: 'bg-rose-900/60' },
  { bg: 'from-cyan-500/90 to-cyan-700/90', border: 'border-cyan-400', text: 'text-cyan-100', badge: 'bg-cyan-900/60' },
];

function computeDefaultBlock(p: Product, years: number[], totalQuarters: number): RoadmapBlock {
  const devYears = p.devAmortizationYears || 1;
  const launchYearIdx = years.indexOf(p.launchYear);
  const effectiveLaunch = launchYearIdx >= 0 ? launchYearIdx : 0;
  const startQ = Math.max(0, effectiveLaunch * 4 - devYears * 4);
  const endQ = Math.min(totalQuarters, effectiveLaunch * 4 + 2);
  return { productId: p.id, startQ, durationQ: Math.max(2, endQ - startQ) };
}

export function ProductRoadmap({ products, years, persistedBlocks, onBlocksChange, readOnly }: ProductRoadmapProps) {
  const totalQuarters = years.length * 4;
  const timelineRef = useRef<HTMLDivElement>(null);

  // Initialize blocks from persisted data or defaults
  const [blocks, setBlocks] = useState<RoadmapBlock[]>(() =>
    products.map(p => {
      if (persistedBlocks?.[p.id]) {
        return { productId: p.id, ...persistedBlocks[p.id] };
      }
      return computeDefaultBlock(p, years, totalQuarters);
    })
  );

  // Re-sync when products change
  useEffect(() => {
    setBlocks(prev => {
      const existing = new Map(prev.map(b => [b.productId, b]));
      return products.map(p => {
        if (existing.has(p.id)) return existing.get(p.id)!;
        if (persistedBlocks?.[p.id]) return { productId: p.id, ...persistedBlocks[p.id] };
        return computeDefaultBlock(p, years, totalQuarters);
      });
    });
  }, [products, years, totalQuarters, persistedBlocks]);

  // Drag state
  const [dragging, setDragging] = useState<{ productId: string; mode: 'move' | 'resize-right'; offsetQ: number } | null>(null);

  const getQuarterFromX = useCallback((clientX: number): number => {
    if (!timelineRef.current) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const qWidth = rect.width / totalQuarters;
    return Math.max(0, Math.min(totalQuarters - 1, Math.floor(x / qWidth)));
  }, [totalQuarters]);

  const handleMouseDown = useCallback((e: React.MouseEvent, productId: string, mode: 'move' | 'resize-right') => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    const q = getQuarterFromX(e.clientX);
    const block = blocks.find(b => b.productId === productId);
    if (!block) return;
    setDragging({ productId, mode, offsetQ: mode === 'move' ? q - block.startQ : 0 });
  }, [blocks, getQuarterFromX, readOnly]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const q = getQuarterFromX(e.clientX);
    setBlocks(prev => prev.map(b => {
      if (b.productId !== dragging.productId) return b;
      if (dragging.mode === 'move') {
        const newStart = Math.max(0, Math.min(totalQuarters - b.durationQ, q - dragging.offsetQ));
        return { ...b, startQ: newStart };
      } else {
        const newDuration = Math.max(1, q - b.startQ + 1);
        return { ...b, durationQ: Math.min(newDuration, totalQuarters - b.startQ) };
      }
    }));
  }, [dragging, getQuarterFromX, totalQuarters]);

  const handleMouseUp = useCallback(() => {
    if (dragging && onBlocksChange) {
      // Persist current blocks
      const blocksMap: Record<string, { startQ: number; durationQ: number }> = {};
      blocks.forEach(b => {
        // Use the latest state - we need to get it from the current blocks
        blocksMap[b.productId] = { startQ: b.startQ, durationQ: b.durationQ };
      });
      // We need to use a ref or setState callback to get latest blocks
      setBlocks(current => {
        const map: Record<string, { startQ: number; durationQ: number }> = {};
        current.forEach(b => { map[b.productId] = { startQ: b.startQ, durationQ: b.durationQ }; });
        onBlocksChange(map);
        return current;
      });
    }
    setDragging(null);
  }, [dragging, onBlocksChange, blocks]);

  const qWidth = 100 / totalQuarters;

  return (
    <SectionCard title="🗺️ Roadmap Produit">
      {!readOnly && (
        <div className="text-xs text-muted-foreground mb-3">
          Glissez les blocs pour ajuster la timeline · Étirez le bord droit pour modifier la durée
        </div>
      )}

      <div
        ref={timelineRef}
        className="relative select-none overflow-x-auto"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Year headers */}
        <div className="flex border-b-2 border-border">
          {years.map(year => (
            <div
              key={year}
              className="text-center text-sm font-bold py-2 border-r border-border bg-muted/40"
              style={{ width: `${qWidth * 4}%`, minWidth: 120 }}
            >
              {year}
            </div>
          ))}
        </div>

        {/* Quarter headers */}
        <div className="flex border-b border-border">
          {years.map(year =>
            QUARTER_LABELS.map((label, qi) => (
              <div
                key={`${year}-${qi}`}
                className="text-center text-[10px] text-muted-foreground py-1 border-r border-border/50"
                style={{ width: `${qWidth}%`, minWidth: 30 }}
              >
                {label}
              </div>
            ))
          )}
        </div>

        {/* Product rows */}
        <TooltipProvider delayDuration={200}>
          {products.map((product, idx) => {
            const block = blocks.find(b => b.productId === product.id);
            if (!block) return null;
            const colors = PRODUCT_COLORS[idx % PRODUCT_COLORS.length];
            const isDragging = dragging?.productId === product.id;

            const launchYearIdx = years.indexOf(product.launchYear);
            const launchQ = launchYearIdx >= 0 ? launchYearIdx * 4 : null;

            return (
              <div
                key={product.id}
                className="relative border-b border-border/30"
                style={{ height: 72 }}
              >
                {/* Grid lines */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {Array.from({ length: totalQuarters }).map((_, i) => (
                    <div
                      key={i}
                      className={`border-r ${i % 4 === 3 ? 'border-border/40' : 'border-border/15'}`}
                      style={{ width: `${qWidth}%` }}
                    />
                  ))}
                </div>

                {/* Launch marker */}
                {launchQ !== null && launchQ < totalQuarters && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-primary/50 z-10"
                    style={{ left: `${launchQ * qWidth}%` }}
                  >
                    <div className="absolute -top-0.5 -left-1.5 w-3.5 h-3.5 rounded-full bg-primary/80 border-2 border-background" />
                  </div>
                )}

                {/* Block */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`absolute top-2 h-[56px] rounded-lg border ${colors.border} bg-gradient-to-r ${colors.bg} shadow-lg backdrop-blur-sm transition-shadow ${isDragging ? 'shadow-xl ring-2 ring-primary/40 z-20' : 'hover:shadow-xl z-10'} ${readOnly ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
                      style={{
                        left: `${block.startQ * qWidth}%`,
                        width: `${block.durationQ * qWidth}%`,
                        minWidth: 80,
                      }}
                      onMouseDown={e => handleMouseDown(e, product.id, 'move')}
                    >
                      {/* Block content */}
                      <div className="flex items-center h-full px-2 gap-1.5 overflow-hidden">
                        <GripHorizontal className={`h-3 w-3 ${colors.text} opacity-50 flex-shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <div className={`text-xs font-bold ${colors.text} truncate`}>
                            {product.name}
                          </div>
                          <div className="flex gap-1 mt-0.5 flex-wrap">
                            {product.devCost > 0 && (
                              <span className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0 rounded-full ${colors.badge} ${colors.text} font-medium`}>
                                <Wrench className="h-2.5 w-2.5" />
                                {formatCurrency(product.devCost, true)}
                              </span>
                            )}
                            {product.priceTTC_B2C > 0 && (
                              <span className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0 rounded-full ${colors.badge} ${colors.text} font-medium`}>
                                <CircleDollarSign className="h-2.5 w-2.5" />
                                {product.priceTTC_B2C.toLocaleString()}€
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Resize handle */}
                      {!readOnly && (
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize rounded-r-lg hover:bg-white/20 transition-colors"
                          onMouseDown={e => handleMouseDown(e, product.id, 'resize-right')}
                        >
                          <div className="absolute right-0.5 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-white/40 rounded-full" />
                        </div>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <div className="space-y-1">
                      <p className="font-semibold">{product.name}</p>
                      <div className="flex gap-3 text-xs">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Lancement : {product.launchYear}</span>
                      </div>
                      {product.devCost > 0 && (
                        <p className="text-xs">CAPEX R&D : {formatCurrency(product.devCost)}</p>
                      )}
                      {product.priceTTC_B2C > 0 && (
                        <p className="text-xs">Prix TTC visé : {product.priceTTC_B2C.toLocaleString()} €</p>
                      )}
                      {product.devAmortizationYears && (
                        <p className="text-xs">Amortissement : {product.devAmortizationYears} ans</p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </TooltipProvider>

        {/* Legend */}
        {products.length > 0 && (
          <div className="flex items-center gap-4 pt-3 mt-2 border-t border-border/30 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-3 h-3 rounded-full bg-primary/80 border-2 border-background" />
              Année de lancement
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Wrench className="h-3 w-3" />
              CAPEX R&D
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CircleDollarSign className="h-3 w-3" />
              Prix TTC visé
            </div>
          </div>
        )}

        {products.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Ajoutez des produits au plan pour visualiser la roadmap</p>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
