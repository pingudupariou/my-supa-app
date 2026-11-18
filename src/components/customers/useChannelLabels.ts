import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CLASSIFICATION_EVENT } from './classificationModel';

export type ChannelCode = 'B2C' | 'B2B' | 'OEM';
export const DEFAULT_CHANNEL_LABELS: Record<ChannelCode, string> = { B2C: 'B2C', B2B: 'B2B', OEM: 'OEM' };
let cache: Record<ChannelCode, string> = { ...DEFAULT_CHANNEL_LABELS };
/** Current display name for a channel code (lowercase accepted); falls back to the code. */
export const channelName = (code: string) => cache[code.toUpperCase() as ChannelCode] ?? code;
/** Object whose B2C/B2B/OEM entries always read the current names (for static label maps). */
export function liveChannelMap(extra: Record<string, string>, lower = false, suffix: Partial<Record<ChannelCode, string>> = {}) {
  const o: Record<string, string> = { ...extra };
  for (const c of ['B2C', 'B2B', 'OEM'] as ChannelCode[]) Object.defineProperty(o, lower ? c.toLowerCase() : c, { enumerable: true, get: () => channelName(c) + (suffix[c] ?? '') });
  return o;
}

/** Display names of the shared channels; codes (B2C/B2B/OEM) stay the keys in every calculation. */
export function useChannelLabels() {
  const [labels, setLabels] = useState(cache);
  const reload = useCallback(async () => {
    let data: unknown, error: unknown;
    try { ({ data, error } = await supabase.from('customer_channel_labels' as never).select('code,label')); } catch { return; }
    if (error || !data) return;
    const next = { ...DEFAULT_CHANNEL_LABELS };
    for (const r of data as { code: ChannelCode; label: string }[]) if (r.code in next && r.label?.trim()) next[r.code] = r.label.trim();
    cache = next; setLabels(next);
  }, []);
  useEffect(() => {
    void reload();
    window.addEventListener(CLASSIFICATION_EVENT, reload);
    return () => window.removeEventListener(CLASSIFICATION_EVENT, reload);
  }, [reload]);
  const name = useCallback((code: string) => labels[code.toUpperCase() as ChannelCode] ?? code, [labels]);
  return { labels, name, reload };
}
