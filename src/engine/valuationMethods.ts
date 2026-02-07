// ============================================
// MÉTHODES DE VALORISATION PRE-MONEY
// ============================================

export type ValuationMethod = 
  | 'revenue_multiple' 
  | 'ebitda_multiple' 
  | 'dcf' 
  | 'scorecard' 
  | 'berkus' 
  | 'risk_factor';

export interface ValuationMethodConfig {
  id: ValuationMethod;
  name: string;
  description: string;
  applicability: string;
}

export const VALUATION_METHODS: ValuationMethodConfig[] = [
  {
    id: 'revenue_multiple',
    name: 'Multiple de CA',
    description: 'Valorisation basée sur un multiple du chiffre d\'affaires projeté',
    applicability: 'Startups en croissance avec CA significatif',
  },
  {
    id: 'ebitda_multiple',
    name: 'Multiple d\'EBITDA',
    description: 'Valorisation basée sur un multiple de l\'EBITDA projeté',
    applicability: 'Entreprises rentables ou proches de la rentabilité',
  },
  {
    id: 'dcf',
    name: 'DCF Simplifié',
    description: 'Actualisation des flux de trésorerie futurs',
    applicability: 'Modèles économiques établis avec visibilité long terme',
  },
  {
    id: 'scorecard',
    name: 'Scorecard (Comparables)',
    description: 'Pondération de facteurs qualitatifs vs startups similaires',
    applicability: 'Startups early-stage avec peu de métriques financières',
  },
  {
    id: 'berkus',
    name: 'Méthode Berkus',
    description: 'Attribution de valeur à 5 critères clés du projet',
    applicability: 'Pre-revenue, évaluation du potentiel',
  },
  {
    id: 'risk_factor',
    name: 'Risk Factor Summation',
    description: 'Ajustement d\'une valorisation de base selon 12 facteurs de risque',
    applicability: 'Startups early-stage, ajustement du risque',
  },
];

// ==================
// PARAMÈTRES PAR MÉTHODE
// ==================

export interface RevenueMultipleParams {
  projectedRevenue: number; // CA projeté (généralement A3 ou A5)
  multiple: number; // Typiquement 2-8x selon secteur
}

export interface EBITDAMultipleParams {
  projectedEBITDA: number; // EBITDA projeté
  multiple: number; // Typiquement 6-12x selon secteur
}

export interface DCFParams {
  cashFlows: number[]; // Flux de trésorerie projetés (5-7 ans)
  discountRate: number; // Taux d'actualisation (typiquement 15-30% pour startup)
  terminalGrowthRate: number; // Taux de croissance terminal (2-3%)
}

export interface ScorecardParams {
  baseValuation: number; // Valorisation moyenne du secteur
  factors: {
    team: number; // -30% à +30%
    market: number;
    product: number;
    competition: number;
    marketing: number;
    fundingNeed: number;
  };
}

export interface BerkusParams {
  soundIdea: number; // 0 à 500k€
  prototype: number;
  qualityManagement: number;
  strategicRelationships: number;
  productRollout: number;
}

export interface RiskFactorParams {
  baseValuation: number;
  factors: {
    managementRisk: number; // -2 à +2
    businessStage: number;
    legislation: number;
    manufacturing: number;
    salesMarketing: number;
    fundingCapital: number;
    competition: number;
    technology: number;
    litigation: number;
    international: number;
    reputation: number;
    potentialExit: number;
  };
}

// ==================
// CALCULS DE VALORISATION
// ==================

export function calculateRevenueMultipleValuation(params: RevenueMultipleParams): number {
  return params.projectedRevenue * params.multiple;
}

export function calculateEBITDAMultipleValuation(params: EBITDAMultipleParams): number {
  return params.projectedEBITDA * params.multiple;
}

export function calculateDCFValuation(params: DCFParams): number {
  const { cashFlows, discountRate, terminalGrowthRate } = params;
  
  // Valeur actualisée des flux
  let pvCashFlows = 0;
  cashFlows.forEach((cf, i) => {
    pvCashFlows += cf / Math.pow(1 + discountRate, i + 1);
  });
  
  // Valeur terminale (Gordon Growth)
  const lastCashFlow = cashFlows[cashFlows.length - 1] || 0;
  const terminalValue = (lastCashFlow * (1 + terminalGrowthRate)) / (discountRate - terminalGrowthRate);
  const pvTerminalValue = terminalValue / Math.pow(1 + discountRate, cashFlows.length);
  
  return pvCashFlows + pvTerminalValue;
}

export function calculateScorecardValuation(params: ScorecardParams): number {
  const { baseValuation, factors } = params;
  
  // Poids standard des facteurs
  const weights = {
    team: 0.30,
    market: 0.25,
    product: 0.15,
    competition: 0.10,
    marketing: 0.10,
    fundingNeed: 0.10,
  };
  
  let multiplier = 1;
  Object.entries(factors).forEach(([key, adjustment]) => {
    const weight = weights[key as keyof typeof weights] || 0;
    multiplier += weight * adjustment;
  });
  
  return baseValuation * multiplier;
}

export function calculateBerkusValuation(params: BerkusParams): number {
  return Object.values(params).reduce((sum, val) => sum + val, 0);
}

export function calculateRiskFactorValuation(params: RiskFactorParams): number {
  const { baseValuation, factors } = params;
  
  // Chaque facteur ajuste de ±250k€ par point
  const adjustmentPerPoint = 250000;
  
  const totalAdjustment = Object.values(factors).reduce((sum, val) => sum + val, 0) * adjustmentPerPoint;
  
  return baseValuation + totalAdjustment;
}

// ==================
// FONCTION PRINCIPALE DE CALCUL
// ==================

export interface ValuationResult {
  method: ValuationMethod;
  value: number;
  confidence: 'low' | 'medium' | 'high';
  notes?: string;
}

export function calculateValuation(
  method: ValuationMethod,
  params: Record<string, any>
): ValuationResult {
  let value = 0;
  let confidence: 'low' | 'medium' | 'high' = 'medium';
  let notes = '';
  
  switch (method) {
    case 'revenue_multiple':
      value = calculateRevenueMultipleValuation(params as RevenueMultipleParams);
      confidence = params.projectedRevenue > 500000 ? 'high' : 'medium';
      notes = `Multiple de ${params.multiple}x sur CA de ${(params.projectedRevenue / 1000000).toFixed(1)}M€`;
      break;
      
    case 'ebitda_multiple':
      value = calculateEBITDAMultipleValuation(params as EBITDAMultipleParams);
      confidence = params.projectedEBITDA > 0 ? 'high' : 'low';
      notes = `Multiple de ${params.multiple}x sur EBITDA de ${(params.projectedEBITDA / 1000).toFixed(0)}k€`;
      break;
      
    case 'dcf':
      value = calculateDCFValuation(params as DCFParams);
      confidence = 'medium';
      notes = `Taux d'actualisation: ${(params.discountRate * 100).toFixed(0)}%`;
      break;
      
    case 'scorecard':
      value = calculateScorecardValuation(params as ScorecardParams);
      confidence = 'low';
      notes = 'Basé sur comparables secteur';
      break;
      
    case 'berkus':
      value = calculateBerkusValuation(params as BerkusParams);
      confidence = 'low';
      notes = 'Méthode qualitative pour early-stage';
      break;
      
    case 'risk_factor':
      value = calculateRiskFactorValuation(params as RiskFactorParams);
      confidence = 'low';
      notes = 'Ajustements sur 12 facteurs de risque';
      break;
  }
  
  return { method, value, confidence, notes };
}

// ==================
// VALORISATION MOYENNE
// ==================

export function calculateAverageValuation(results: ValuationResult[]): number {
  if (results.length === 0) return 0;
  
  // Pondération par niveau de confiance
  const weights = { high: 3, medium: 2, low: 1 };
  
  let weightedSum = 0;
  let totalWeight = 0;
  
  results.forEach(result => {
    const weight = weights[result.confidence];
    weightedSum += result.value * weight;
    totalWeight += weight;
  });
  
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}
