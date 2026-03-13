import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TeamMember {
  id: string;
  email: string;
  display_name: string;
}

export function useTeamMembers() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data, error } = await supabase.functions.invoke('list-team-members', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!error && Array.isArray(data)) setMembers(data);
      } catch (err) {
        console.error('Failed to load team members:', err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return { members, loading };
}
