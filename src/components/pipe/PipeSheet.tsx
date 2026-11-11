import { Fragment, useState } from 'react';
import type { PipeOrder } from './pipeModel';

const eur = (v: number | null) => (v === null ? '—' : v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }));
const d = (v: string | null) => (v ? new Date(v).toLocaleDateString('fr-FR') : '');
const CIBLE: Record<string, string> = { b2b: 'B2B', oem: 'OEM', b2c: 'B2C / à classer' };
const BAND: Record<string, string> = { b2b: 'bg-muted/60', oem: 'bg-accent/40', b2c: 'bg-secondary/60' };
const isPaid = (o: PipeOrder) => /^(fully_)?paid$/.test(o.payment_status ?? '');
const isBilled = (o: PipeOrder) => /^(fully_)?billed$/.test(o.billing_status ?? '');
const pieces = (o: PipeOrder) => o.lines.reduce((s, l) => s + (l.quantity ?? 0), 0);
const sum = (l: PipeOrder[], k: 'total_ht' | 'total_ttc' | 'unbilled' | 'unpaid') => l.reduce((s, o) => s + (o[k] ?? 0), 0);

/** Spreadsheet-style view modelled on the KPI file: month band, target, order ref, paid yes/no, amounts, subtotals. */
export function PipeSheet({ orders }: { orders: PipeOrder[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const months = new Map<string, PipeOrder[]>();
  for (const o of [...orders].sort((a, b) => (b.dated_at ?? '').localeCompare(a.dated_at ?? '') || a.channel.localeCompare(b.channel))) {
    const k = (o.dated_at ?? '').slice(0, 7) || '—';
    months.set(k, [...(months.get(k) ?? []), o]);
  }
  const th = 'border border-border bg-primary/15 px-2 py-1.5 text-center font-semibold';
  const td = 'border border-border px-2 py-1';
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr><th colSpan={13} className="border border-border bg-primary/25 py-1.5 text-center text-sm font-bold">Pipe commercial mensuel</th></tr>
          <tr>
            {['Mois', 'Cible', 'Réf. BC', 'Livraison prévue', 'Nb pièces', 'Expédition', 'Facturation', 'Payé', 'Client', 'Total TTC', 'Total HT', 'Reste à facturer', 'Reste à encaisser'].map((h) => <th key={h} className={th}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {[...months.entries()].map(([m, list]) => (
            <Fragment key={m}>
              {list.map((o, i) => (
                <Fragment key={o.id}>
                  <tr className={`cursor-pointer hover:bg-accent/30 ${BAND[o.channel]}`} onClick={() => setOpen(open === o.id ? null : o.id)}>
                    {i === 0 && <td rowSpan={list.length + list.filter((x) => x.id === open).length} className={`${td} bg-primary/10 text-center font-semibold capitalize [writing-mode:vertical-rl] rotate-180`}>
                      {m === '—' ? '—' : new Date(`${m}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</td>}
                    <td className={`${td} text-center`} title={o.channel_rule ? `Règle : ${o.channel_rule}` : 'Classement de Statistiques commerciales'}>{o.channel_rule ? o.channel.toUpperCase() : CIBLE[o.channel]}{o.channel_rule && <span className="block text-[10px] text-muted-foreground">{o.channel_rule}</span>}</td>
                    <td className={`${td} text-center font-medium`}>{o.label}</td>
                    <td className={`${td} text-center`}>{d(o.shipping_at)}</td>
                    <td className={`${td} text-center`}>{pieces(o) || ''}</td>
                    <td className={`${td} text-center`}>{o.shipping_status === 'shipped' ? 'Fait' : o.shipping_status === 'partially_shipped' ? 'Partiel' : 'En attente'}</td>
                    <td className={`${td} text-center ${isBilled(o) ? '' : 'bg-primary/10'}`}>{isBilled(o) ? 'Facturé' : o.billing_status === 'partially_billed' ? 'En partie' : 'Non'}</td>
                    <td className={`${td} text-center font-medium ${isPaid(o) ? 'bg-primary/20 text-primary' : 'bg-destructive/15 text-destructive'}`}>{isPaid(o) ? 'Oui' : o.payment_status === 'partially_paid' ? 'Partiel' : 'Non'}</td>
                    <td className={td}>{o.customer ?? '—'}</td>
                    <td className={`${td} text-right`}>{eur(o.total_ttc)}</td>
                    <td className={`${td} text-right`}>{eur(o.total_ht)}</td>
                    <td className={`${td} text-right font-medium`}>{eur(o.unbilled)}</td>
                    <td className={`${td} text-right`}>{eur(o.unpaid)}</td>
                  </tr>
                  {open === o.id && (
                    <tr><td colSpan={12} className={`${td} bg-background`}>
                      <div className="mb-1 text-muted-foreground">Facturé {eur(o.billed)} · Encaissé {eur(o.paid)} · Statut {o.status}</div>
                      {o.lines.map((l, j) => <div key={j}>{l.sku ?? '—'} — {l.label ?? '—'} : {l.quantity ?? '—'} (expédié {l.shipped ?? 0})</div>)}
                    </td></tr>
                  )}
                </Fragment>
              ))}
              <tr className="bg-primary/15 font-semibold">
                <td colSpan={9} className={`${td} text-right`}>Sous-total ({list.length} BC)</td>
                <td className={`${td} text-right`}>{eur(sum(list, 'total_ttc'))}</td>
                <td className={`${td} text-right`}>{eur(sum(list, 'total_ht'))}</td>
                <td className={`${td} text-right`}>{eur(sum(list, 'unbilled'))}</td>
                <td className={`${td} text-right`}>{eur(sum(list, 'unpaid'))}</td>
              </tr>
            </Fragment>
          ))}
          {!orders.length && <tr><td colSpan={13} className={`${td} py-6 text-center text-muted-foreground`}>Aucune commande pour ces filtres.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
