import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CrmAgendaDashboard } from './CrmAgendaDashboard';
import type { CrmMeeting, CrmReminder } from '@/hooks/useCRMData';

const pad = (n: number) => String(n).padStart(2, '0');
const localKey = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const reminder = (over: Partial<CrmReminder> & { id: string; title: string; due_date: string }): CrmReminder => ({
  user_id: 'u1', customer_id: 'c1', description: null, reminder_type: 'follow_up',
  priority: 'moyenne', is_completed: false, assigned_to: null, completed_at: null,
  business_entity_id: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  ...over,
});

const meeting = (over: Partial<CrmMeeting> & { id: string; meeting_date: string }): CrmMeeting => ({
  user_id: 'u1', customer_id: 'c1', title: 'RDV usine', duration_minutes: 60, location: null,
  participants: null, notes: null, action_items: null, status: 'planned', responsible: null,
  deleted_at: null, business_entity_id: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  ...over,
});

const reminders = [
  reminder({ id: 'r-late', title: 'Relancer le devis', due_date: localKey(-3) }),
  reminder({ id: 'r-soon', title: 'Envoyer la fiche technique', due_date: localKey(0) }),
];
const meetings = [meeting({ id: 'm1', meeting_date: `${localKey(2)}T09:00:00` })];

const renderAgenda = () => render(
  <CrmAgendaDashboard
    reminders={reminders}
    meetings={meetings}
    customers={[{ id: 'c1', company_name: 'Acme' }]}
    onComplete={vi.fn().mockResolvedValue(true)}
    onUncomplete={vi.fn().mockResolvedValue(true)}
    onSelectClient={vi.fn()}
  />,
);

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('agenda des actions repliable', () => {
  it('est ouvert par défaut avec le calendrier et les actions du jour', () => {
    renderAgenda();
    expect(screen.getByText('Lun')).toBeInTheDocument();
    expect(screen.getByText('Envoyer la fiche technique')).toBeInTheDocument();
  });

  it('se replie sur les prochaines actions et mémorise le choix', () => {
    renderAgenda();
    fireEvent.click(screen.getByLabelText("Replier l'agenda"));
    expect(screen.queryByText('Lun')).not.toBeInTheDocument();
    expect(screen.getByText(/Relancer le devis/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(localStorage.getItem('crm-agenda-open')).toBe('0');
  });

  it('rouvre le calendrier sur le jour cliqué depuis la bande repliée', () => {
    localStorage.setItem('crm-agenda-open', '0');
    renderAgenda();
    expect(screen.queryByText('Lun')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/Relancer le devis/));
    expect(screen.getByText('Lun')).toBeInTheDocument();
    expect(screen.getByText('Relancer le devis')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(localStorage.getItem('crm-agenda-open')).toBe('1');
  });
});
