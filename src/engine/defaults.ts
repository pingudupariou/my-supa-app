// ============================================
// DONNÉES PAR DÉFAUT DU MODÈLE FINANCIER
// ============================================

import {
  Product,
  Role,
  Expense,
  GlobalAssumptions,
  Scenario,
  FundingRound,
  UseOfFunds,
  CapTableEntry,
  FinancialModel,
} from './types';

// ==================
// PRODUITS PAR DÉFAUT
// ==================

export const defaultProducts: Product[] = [
  {
    id: 'ccd-evo',
    name: 'CCD EVO',
    category: 'B2C',
    launchYear: 2025,
    devCost: 150000,
    devAmortizationYears: 5,
    unitCost: 380,
    priceTTC_B2C: 1490,
    priceHT: 1241.67,
    priceHT_B2B: 690,
    priceHT_OEM: 520,
    vatRate: 0.20,
    coef_shop: 1.8,
    coef_dist: 1.4,
    coef_oem: 1.5,
    volumesByYear: { 2025: 150, 2026: 300, 2027: 500, 2028: 700, 2029: 900, 2030: 1100 },
    volumesByChannel: {
      B2C: { 2025: 50, 2026: 80, 2027: 100, 2028: 120, 2029: 140, 2030: 160 },
      B2B: { 2025: 80, 2026: 150, 2027: 250, 2028: 350, 2029: 450, 2030: 550 },
      OEM: { 2025: 20, 2026: 70, 2027: 150, 2028: 230, 2029: 310, 2030: 390 },
    },
  },
  {
    id: 'roues-aero',
    name: 'Roues Aéro Elite',
    category: 'B2C',
    launchYear: 2026,
    devCost: 250000,
    devAmortizationYears: 5,
    unitCost: 650,
    priceTTC_B2C: 2490,
    priceHT: 2075,
    priceHT_B2B: 1200,
    priceHT_OEM: 900,
    vatRate: 0.20,
    coef_shop: 1.7,
    coef_dist: 1.35,
    coef_oem: 1.4,
    volumesByYear: { 2026: 100, 2027: 200, 2028: 350, 2029: 500, 2030: 650 },
    volumesByChannel: {
      B2C: { 2026: 30, 2027: 50, 2028: 80, 2029: 110, 2030: 140 },
      B2B: { 2026: 50, 2027: 100, 2028: 180, 2029: 260, 2030: 340 },
      OEM: { 2026: 20, 2027: 50, 2028: 90, 2029: 130, 2030: 170 },
    },
  },
  {
    id: 'guidons',
    name: 'Guidons Intégrés',
    category: 'B2C',
    launchYear: 2026,
    devCost: 80000,
    devAmortizationYears: 5,
    unitCost: 180,
    priceTTC_B2C: 890,
    priceHT: 741.67,
    priceHT_B2B: 420,
    priceHT_OEM: 320,
    vatRate: 0.20,
    coef_shop: 1.6,
    coef_dist: 1.3,
    coef_oem: 1.35,
    volumesByYear: { 2026: 150, 2027: 280, 2028: 430, 2029: 580, 2030: 730 },
    volumesByChannel: {
      B2C: { 2026: 50, 2027: 80, 2028: 120, 2029: 160, 2030: 200 },
      B2B: { 2026: 70, 2027: 140, 2028: 220, 2029: 300, 2030: 380 },
      OEM: { 2026: 30, 2027: 60, 2028: 90, 2029: 120, 2030: 150 },
    },
  },
  {
    id: 'transmission',
    name: 'Transmission Aéro',
    category: 'B2C',
    launchYear: 2027,
    devCost: 180000,
    devAmortizationYears: 5,
    unitCost: 420,
    priceTTC_B2C: 1590,
    priceHT: 1325,
    priceHT_B2B: 750,
    priceHT_OEM: 580,
    vatRate: 0.20,
    coef_shop: 1.75,
    coef_dist: 1.35,
    coef_oem: 1.45,
    volumesByYear: { 2027: 80, 2028: 180, 2029: 300, 2030: 440 },
    volumesByChannel: {
      B2C: { 2027: 20, 2028: 40, 2029: 60, 2030: 90 },
      B2B: { 2027: 40, 2028: 100, 2029: 170, 2030: 250 },
      OEM: { 2027: 20, 2028: 40, 2029: 70, 2030: 100 },
    },
  },
];

// ==================
// ORGANIGRAMME PAR DÉFAUT
// ==================

export const defaultRoles: Role[] = [
  // Direction
  { id: 'ceo', title: 'Directeur Général', department: 'Admin', startYear: 2024, annualCostLoaded: 85000 },
  { id: 'daf', title: 'Directeur Financier', department: 'Admin', startYear: 2024, annualCostLoaded: 65000 },
  
  // R&D
  { id: 'cto', title: 'Directeur Technique', department: 'R&D', startYear: 2024, annualCostLoaded: 75000 },
  { id: 'ing-rd-1', title: 'Ingénieur Mécanique', department: 'R&D', startYear: 2024, annualCostLoaded: 55000 },
  { id: 'ing-rd-2', title: 'Ingénieur Composite', department: 'R&D', startYear: 2026, annualCostLoaded: 52000 },
  { id: 'ing-rd-3', title: 'Ingénieur Simulation', department: 'R&D', startYear: 2027, annualCostLoaded: 55000 },
  
  // Production
  { id: 'resp-prod', title: 'Responsable Production', department: 'Production', startYear: 2024, annualCostLoaded: 60000 },
  { id: 'tech-1', title: 'Technicien Process', department: 'Production', startYear: 2024, annualCostLoaded: 42000 },
  { id: 'tech-2', title: 'Technicien Qualité', department: 'Production', startYear: 2026, annualCostLoaded: 40000 },
  { id: 'supply', title: 'Resp. Supply Chain', department: 'Production', startYear: 2028, annualCostLoaded: 58000 },
  
  // Commercial
  { id: 'dir-com', title: 'Directeur Commercial', department: 'Sales', startYear: 2024, annualCostLoaded: 70000 },
  { id: 'com-export', title: 'Commercial Export', department: 'Sales', startYear: 2026, annualCostLoaded: 48000 },
  { id: 'am', title: 'Account Manager', department: 'Sales', startYear: 2027, annualCostLoaded: 50000 },
  
  // Support
  { id: 'resp-mkt', title: 'Responsable Marketing', department: 'Support', startYear: 2024, annualCostLoaded: 55000 },
  { id: 'digital', title: 'Digital Manager', department: 'Support', startYear: 2027, annualCostLoaded: 45000 },
  { id: 'rh', title: 'Responsable RH', department: 'Support', startYear: 2024, annualCostLoaded: 50000 },
  { id: 'compta', title: 'Comptable', department: 'Support', startYear: 2028, annualCostLoaded: 42000 },
];

// ==================
// CHARGES PAR DÉFAUT
// ==================

export const defaultExpenses: Expense[] = [
  // R&D
  {
    id: 'rd-proto',
    name: 'Prototypage & Essais',
    category: 'R&D',
    startYear: 2025,
    baseAnnualCost: 40000,
    evolutionType: 'linked_to_revenue',
    revenueRatio: 0.03,
    description: 'Matériaux de prototypage, tests en soufflerie, essais terrain',
  },
  {
    id: 'rd-licences',
    name: 'Licences logiciels CAO/CFD',
    category: 'R&D',
    startYear: 2025,
    baseAnnualCost: 25000,
    evolutionType: 'fixed',
    description: 'SolidWorks, ANSYS, licences annuelles',
  },
  
  // Production
  {
    id: 'prod-outillage',
    name: 'Outillage & Moules',
    category: 'Production',
    startYear: 2025,
    baseAnnualCost: 50000,
    evolutionType: 'step',
    steps: [
      { year: 2026, newAnnualCost: 80000 },
      { year: 2027, newAnnualCost: 60000 },
      { year: 2028, newAnnualCost: 40000 },
    ],
    description: 'Investissements outillage pour nouveaux produits',
  },
  {
    id: 'prod-maintenance',
    name: 'Maintenance équipements',
    category: 'Production',
    startYear: 2025,
    baseAnnualCost: 15000,
    evolutionType: 'growth_rate',
    growthRate: 0.05,
    description: 'Contrats de maintenance machines CNC et équipements',
  },
  
  // Sales & Marketing
  {
    id: 'mkt-digital',
    name: 'Marketing Digital',
    category: 'Sales & Marketing',
    startYear: 2025,
    baseAnnualCost: 60000,
    evolutionType: 'linked_to_revenue',
    revenueRatio: 0.05,
    description: 'SEO, SEA, réseaux sociaux, content marketing',
  },
  {
    id: 'mkt-events',
    name: 'Salons & Événements',
    category: 'Sales & Marketing',
    startYear: 2025,
    baseAnnualCost: 40000,
    evolutionType: 'step',
    steps: [
      { year: 2026, newAnnualCost: 60000 },
      { year: 2027, newAnnualCost: 80000 },
    ],
    description: 'Eurobike, Sea Otter, salons régionaux',
  },
  {
    id: 'sales-commissions',
    name: 'Commissions commerciales',
    category: 'Sales & Marketing',
    startYear: 2025,
    baseAnnualCost: 0,
    evolutionType: 'linked_to_revenue',
    revenueRatio: 0.03,
    description: 'Commissions agents et commerciaux terrain',
  },
  
  // G&A
  {
    id: 'ga-loyer',
    name: 'Loyer & Charges locatives',
    category: 'G&A',
    startYear: 2025,
    baseAnnualCost: 48000,
    evolutionType: 'step',
    steps: [
      { year: 2027, newAnnualCost: 72000 },
    ],
    description: 'Locaux R&D et bureaux, extension 2027',
  },
  {
    id: 'ga-assurances',
    name: 'Assurances',
    category: 'G&A',
    startYear: 2025,
    baseAnnualCost: 20000,
    evolutionType: 'linked_to_revenue',
    revenueRatio: 0.015,
    description: 'RC Pro, assurance produit, multirisque',
  },
  {
    id: 'ga-compta',
    name: 'Comptabilité & Juridique',
    category: 'G&A',
    startYear: 2025,
    baseAnnualCost: 25000,
    evolutionType: 'growth_rate',
    growthRate: 0.03,
    description: 'Expert-comptable, avocat, commissaire aux comptes',
  },
  
  // Logistics
  {
    id: 'log-transport',
    name: 'Transport & Expédition',
    category: 'Logistics',
    startYear: 2025,
    baseAnnualCost: 0,
    evolutionType: 'linked_to_volume',
    volumeRatio: 12,
    description: 'Coût moyen par unité expédiée',
  },
  {
    id: 'log-stockage',
    name: 'Stockage & Entreposage',
    category: 'Logistics',
    startYear: 2025,
    baseAnnualCost: 18000,
    evolutionType: 'growth_rate',
    growthRate: 0.15,
    description: 'Surface de stockage croissante avec les volumes',
  },
  
  // IT & Tools
  {
    id: 'it-infra',
    name: 'Infrastructure IT',
    category: 'IT & Tools',
    startYear: 2025,
    baseAnnualCost: 12000,
    evolutionType: 'step',
    steps: [
      { year: 2026, newAnnualCost: 18000 },
      { year: 2028, newAnnualCost: 24000 },
    ],
    description: 'Cloud, serveurs, sécurité',
  },
  {
    id: 'it-erp',
    name: 'ERP & Outils métier',
    category: 'IT & Tools',
    startYear: 2025,
    baseAnnualCost: 15000,
    evolutionType: 'growth_rate',
    growthRate: 0.10,
    description: 'Licences ERP, CRM, gestion stock',
  },
];

// ==================
// HYPOTHÈSES GLOBALES
// ==================

export const defaultAssumptions: GlobalAssumptions = {
  inflationRate: 0.02,
  priceIncreaseRate: 0.03,
  paymentDelayDays: 45,
  vatRate: 0.20,
  baseYear: 2025,
};

// ==================
// SCÉNARIOS PAR DÉFAUT
// ==================

export const defaultScenarios: Scenario[] = [
  {
    id: 'conservative',
    name: 'Prudent',
    description: 'Croissance modérée, volumes réduits de 20%, recrutements décalés',
    modifiers: {
      volumeMultiplier: 0.8,
      hiringDelayYears: 1,
      expenseModifiers: {
        marketingMultiplier: 0.8,
      },
    },
  },
  {
    id: 'base',
    name: 'Base',
    description: 'Trajectoire nominale selon le plan produit et RH',
    modifiers: {
      volumeMultiplier: 1,
      priceMultiplier: 1,
    },
  },
  {
    id: 'ambitious',
    name: 'Ambitieux',
    description: 'Succès commercial rapide, volumes +30%, investissements marketing accrus',
    modifiers: {
      volumeMultiplier: 1.3,
      priceMultiplier: 1.05,
      expenseModifiers: {
        marketingMultiplier: 1.5,
      },
    },
  },
];

// ==================
// FINANCEMENT PAR DÉFAUT
// ==================

export const defaultFundingRounds: FundingRound[] = [
  {
    id: 'seed',
    name: 'Seed',
    amount: 1500000,
    preMoneyValuation: 4000000,
    year: 2025,
    quarter: 'Q1',
  },
];

export const defaultUseOfFunds: UseOfFunds = {
  hiring: 800000,
  inventory: 300000,
  rd: 250000,
  marketing: 350000,
  buffer: 300000,
};

export const defaultCapTable: CapTableEntry[] = [
  { shareholder: 'Fondateurs', sharesPercentage: 70, type: 'founder' },
  { shareholder: 'Business Angels', sharesPercentage: 10, type: 'investor' },
  { shareholder: 'Seed', sharesPercentage: 20, type: 'investor' },
];

// ==================
// MODÈLE COMPLET PAR DÉFAUT
// ==================

export const defaultFinancialModel: FinancialModel = {
  products: defaultProducts,
  roles: defaultRoles,
  expenses: defaultExpenses,
  assumptions: defaultAssumptions,
  scenarios: defaultScenarios,
  fundingRounds: defaultFundingRounds,
  useOfFunds: defaultUseOfFunds,
  capTable: defaultCapTable,
};
