import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { B2BClient } from '@/hooks/useB2BClientsData';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Mail, RefreshCw, Users, Save, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

type Contact = { name: string; email: string; mobile: string };
const EMPTY: Contact = { name: '', email: '', mobile: '' };
const pad = (list: Contact[] | null | undefined) =>
  [0, 1, 2].map((i) => ({ ...EMPTY, ...(Array.isArray(list) ? list[i] : undefined) }));

export function CustomerContacts({ client, onSaved }: { client: B2BClient; onSaved?: () => void }) {
  const [email, setEmail] = useState(client.contact_email ?? '');
  const [contacts, setContacts] = useState<Contact[]>(pad(client.contacts));
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const tried = useRef<string | null>(null);

  useEffect(() => {
    setEmail(client.contact_email ?? '');
    setContacts(pad(client.contacts));
    setDirty(false);
  }, [client.id]);

  const fetchErplain = async (silent: boolean) => {
    if (!client.erplain_customer_id) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('erplain-sync', { body: { action: 'customer_contact', customerId: client.erplain_customer_id } });
    setLoading(false);
    if (error || data?.status !== 'success') { if (!silent) toast.error("Lecture Erplain impossible : " + (data?.message ?? error?.message ?? '')); return; }
    if (!data.email) { if (!silent) toast.info("Aucune adresse e-mail dans la fiche Erplain."); return; }
    setEmail(data.email);
    const upd: any = { contact_email: data.email };
    if (!client.contact_phone && data.phone) upd.contact_phone = data.phone;
    const { error: e2 } = await supabase.from('b2b_clients').update(upd).eq('id', client.id);
    if (e2) toast.error(e2.message); else onSaved?.();
    if (!e2 && !silent) toast.success('E-mail récupéré depuis Erplain');
  };

  // Auto: fill the e-mail from Erplain once when the record is linked and has none.
  useEffect(() => {
    if (client.erplain_customer_id && !client.contact_email && tried.current !== client.id) {
      tried.current = client.id;
      fetchErplain(true);
    }
  }, [client.id, client.erplain_customer_id, client.contact_email]);

  const setField = (i: number, k: keyof Contact, v: string) => {
    setContacts((c) => c.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
    setDirty(true);
  };

  const save = async () => {
    const clean = contacts.map((c) => ({ name: c.name.trim(), email: c.email.trim(), mobile: c.mobile.trim() }))
      .filter((c) => c.name || c.email || c.mobile);
    const bad = clean.find((c) => c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email));
    if (bad) { toast.error(`Adresse e-mail invalide : ${bad.email}`); return; }
    const { error } = await supabase.from('b2b_clients').update({ contacts: clean, contact_email: email.trim() || null } as any).eq('id', client.id);
    if (error) { toast.error(error.message); return; }
    setDirty(false);
    onSaved?.();
    toast.success('Contacts enregistrés');
  };

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium w-28">E-mail société</span>
        <Input className="h-8 flex-1" type="email" value={email} placeholder={client.erplain_customer_id ? 'Récupéré depuis Erplain' : 'Client non relié à Erplain'}
          onChange={(e) => { setEmail(e.target.value); setDirty(true); }} />
        {client.erplain_customer_id && (
          <Button size="sm" variant="outline" className="h-8" onClick={() => fetchErplain(false)} disabled={loading} title="Relire l'e-mail dans Erplain">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="ml-1">Erplain</span>
          </Button>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Contacts</span>
        </div>
        <div className="space-y-2">
          {contacts.map((c, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[1.2fr_1.4fr_1fr] gap-2 items-center">
              <Input className="h-8" placeholder={`Contact ${i + 1} — nom`} value={c.name} onChange={(e) => setField(i, 'name', e.target.value)} />
              <Input className="h-8" type="email" placeholder="E-mail" value={c.email} onChange={(e) => setField(i, 'email', e.target.value)} />
              <div className="relative">
                <Smartphone className="h-3.5 w-3.5 absolute left-2 top-2.5 text-muted-foreground" />
                <Input className="h-8 pl-7" type="tel" placeholder="Mobile" value={c.mobile} onChange={(e) => setField(i, 'mobile', e.target.value)} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {dirty && (
        <div className="flex justify-end">
          <Button size="sm" onClick={save}><Save className="h-3.5 w-3.5 mr-1" />Enregistrer les contacts</Button>
        </div>
      )}
    </div>
  );
}
