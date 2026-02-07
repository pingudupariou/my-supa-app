export function formatCurrency(value: number, compact?: boolean): string {
  if (compact && Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M€`;
  }
  if (compact && Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(0)}k€`;
  }
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
