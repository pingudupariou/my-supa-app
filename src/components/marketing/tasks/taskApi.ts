import { supabase } from '@/integrations/supabase/client';

const sb = supabase as any;

export const STATUSES = [
  { v: 'a_faire', l: 'À faire' }, { v: 'en_cours', l: 'En cours' }, { v: 'en_attente', l: 'En attente' },
  { v: 'termine', l: 'Terminé' }, { v: 'annule', l: 'Annulé' },
] as const;
export const STATUS_L: Record<string, string> = Object.fromEntries(STATUSES.map((s) => [s.v, s.l]));
export const PRIORITIES = [{ v: 'haute', l: 'Haute' }, { v: 'moyenne', l: 'Moyenne' }, { v: 'basse', l: 'Basse' }] as const;
export const PRIO_L: Record<string, string> = Object.fromEntries(PRIORITIES.map((p) => [p.v, p.l]));
export const CHANNELS = ['Google Ads', 'Meta Ads', 'Shopify', 'SEO', 'Conversion', 'Développement pays'];
export const OPEN = new Set(['a_faire', 'en_cours', 'en_attente']);

export type Task = {
  id: string; title: string; description: string | null; priority: string; status: string;
  assignee_user_id: string | null; assignee_label: string | null; due_date: string | null;
  country: string | null; channel: string | null; campaign: string | null; product: string | null; results: string | null;
  source: string; source_analysis_id: string | null; source_recommendation: any; dedupe_key: string | null;
  recurrence_count: number; last_recommended_at: string | null; completed_at: string | null; created_at: string; updated_at: string;
};
export type TaskEvent = { id: string; task_id: string; kind: string; body: string; author_name: string | null; created_at: string };

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set(['le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'en', 'sur', 'pour', 'a', 'au', 'aux', 'l', 'd']);
/** Stable key for a recommendation: régie + pays + campagne + mots-clés du titre (ordre ignoré). */
export function dedupeKey(r: { category?: string | null; country?: string | null; campaign?: string | null; title: string }) {
  const words = [...new Set(norm(r.title).split(' ').filter((w) => w.length > 2 && !STOP.has(w)))].sort().slice(0, 8);
  return [norm(r.category), norm(r.country), norm(r.campaign), words.join('-')].join('|');
}

export const isLate = (t: Task) => !!t.due_date && OPEN.has(t.status) && t.due_date < new Date().toISOString().slice(0, 10);

async function me() {
  const { data } = await supabase.auth.getUser();
  const u = data.user; return { id: u?.id ?? null, name: (u?.user_metadata as any)?.display_name || u?.email || 'Utilisateur' };
}

export async function addEvent(task_id: string, kind: string, body: string) {
  const u = await me();
  const { error } = await sb.from('marketing_task_events').insert({ task_id, kind, body, author_id: u.id, author_name: u.name });
  if (error) throw error;
}

export async function saveTask(t: Partial<Task>, prev?: Task) {
  const u = await me();
  if (prev) {
    const { error } = await sb.from('marketing_tasks').update(t).eq('id', prev.id);
    if (error) throw error;
    if (t.status && t.status !== prev.status) await addEvent(prev.id, 'statut', `${STATUS_L[prev.status]} → ${STATUS_L[t.status]}`);
    if (t.results != null && t.results !== prev.results && t.results) await addEvent(prev.id, 'resultat', t.results);
    return prev.id;
  }
  const { data, error } = await sb.from('marketing_tasks').insert({ ...t, created_by: u.id }).select('id').single();
  if (error) throw error;
  await addEvent(data.id, 'creation', t.source === 'ia' ? 'Tâche créée depuis une recommandation IA' : 'Tâche créée manuellement');
  return data.id as string;
}

/** Creates a task from an AI recommendation, or bumps the existing open one if it comes back. */
export async function createFromRecommendation(a: any, analysisId: string | null): Promise<{ id: string; duplicate: boolean }> {
  const key = dedupeKey(a);
  const { data: ex } = await sb.from('marketing_tasks').select('id, recurrence_count').eq('dedupe_key', key).in('status', [...OPEN]).maybeSingle();
  const bump = async (id: string, n: number) => {
    const { error } = await sb.from('marketing_tasks').update({ recurrence_count: n + 1, last_recommended_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    await addEvent(id, 'recurrence', `Recommandation revenue dans un nouveau diagnostic (${n + 1}e fois) : ${a.title}`);
    return { id, duplicate: true };
  };
  if (ex) return bump(ex.id, ex.recurrence_count);
  const prio = a.urgency === 'immediate' || a.priority === 1 ? 'haute' : a.urgency === 'a_surveiller' ? 'basse' : 'moyenne';
  const days = a.urgency === 'immediate' ? 2 : a.urgency === 'cette_semaine' ? 7 : a.urgency === 'ce_mois' ? 30 : null;
  try {
    const id = await saveTask({
      title: a.title, description: [a.detail, a.expected_impact && `Impact attendu : ${a.expected_impact}`, a.justification && `Justification : ${a.justification}`].filter(Boolean).join('\n\n'),
      priority: prio, status: 'a_faire', channel: a.category ?? null, country: a.country ?? null, campaign: a.campaign ?? null,
      due_date: days ? new Date(Date.now() + days * 86400000).toISOString().slice(0, 10) : null,
      source: 'ia', source_analysis_id: analysisId, source_recommendation: a, dedupe_key: key, last_recommended_at: new Date().toISOString(),
    });
    return { id, duplicate: false };
  } catch (e: any) {
    if (e?.code === '23505') { const { data } = await sb.from('marketing_tasks').select('id, recurrence_count').eq('dedupe_key', key).in('status', [...OPEN]).single(); return bump(data.id, data.recurrence_count); }
    throw e;
  }
}

export async function listTasks(): Promise<Task[]> {
  const { data, error } = await sb.from('marketing_tasks').select('*').order('created_at', { ascending: false }).limit(1000);
  if (error) throw error; return data ?? [];
}
export async function listEvents(task_id: string): Promise<TaskEvent[]> {
  const { data, error } = await sb.from('marketing_task_events').select('*').eq('task_id', task_id).order('created_at', { ascending: false });
  if (error) throw error; return data ?? [];
}
