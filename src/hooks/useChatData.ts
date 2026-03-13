import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export interface ChatMessage {
  id: string;
  user_id: string;
  content: string;
  mentions: string[];
  created_at: string;
  pseudo?: string;
}

export interface ChatProfile {
  user_id: string;
  pseudo: string;
}

export function useChatData() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [myPseudo, setMyPseudo] = useState('');
  const [loading, setLoading] = useState(true);
  const [unreadMentions, setUnreadMentions] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const lastReadRef = useRef<string | null>(null);

  // Load profiles
  const loadProfiles = useCallback(async () => {
    const { data } = await supabase.from('chat_profiles').select('user_id, pseudo');
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((p: any) => { map[p.user_id] = p.pseudo || p.user_id.slice(0, 8); });
      setProfiles(map);
      if (user && data.find((p: any) => p.user_id === user.id)) {
        setMyPseudo(data.find((p: any) => p.user_id === user.id)!.pseudo || '');
      }
    }
  }, [user]);

  // Load messages
  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(200);
    if (data) {
      setMessages(data.map((m: any) => ({
        ...m,
        mentions: m.mentions || [],
      })));
    }
    setLoading(false);
  }, []);

  // Initial load
  useEffect(() => {
    loadProfiles();
    loadMessages();
  }, [loadProfiles, loadMessages]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('chat-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
      }, (payload) => {
        const msg = payload.new as any;
        const newMsg: ChatMessage = {
          ...msg,
          mentions: msg.mentions || [],
        };
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });

        // Count unread messages from others
        if (user && msg.user_id !== user.id) {
          setUnreadMessages(prev => prev + 1);
        }

        // Check if user is mentioned
        if (user && msg.mentions?.includes(user.id) && msg.user_id !== user.id) {
          setUnreadMentions(prev => prev + 1);
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'chat_messages',
      }, (payload) => {
        const deletedId = (payload.old as any).id;
        setMessages(prev => prev.filter(m => m.id !== deletedId));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Send message
  const sendMessage = useCallback(async (content: string, mentions: string[] = []) => {
    if (!user || !content.trim()) return;
    const { data } = await supabase.from('chat_messages').insert({
      user_id: user.id,
      content: content.trim(),
      mentions,
    }).select().single();
    // Optimistically add if realtime doesn't catch it
    if (data) {
      setMessages(prev => {
        if (prev.some(m => m.id === data.id)) return prev;
        return [...prev, { ...data, mentions: data.mentions || [] }];
      });
    }
  }, [user]);

  // Update pseudo
  const updatePseudo = useCallback(async (pseudo: string) => {
    if (!user) return;
    const { data: existing } = await supabase
      .from('chat_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await supabase.from('chat_profiles').update({ pseudo, updated_at: new Date().toISOString() }).eq('user_id', user.id);
    } else {
      await supabase.from('chat_profiles').insert({ user_id: user.id, pseudo });
    }
    setMyPseudo(pseudo);
    setProfiles(prev => ({ ...prev, [user.id]: pseudo }));
  }, [user]);

  const clearMentions = useCallback(() => setUnreadMentions(0), []);
  const clearUnread = useCallback(() => setUnreadMessages(0), []);

  const getPseudo = useCallback((userId: string) => {
    return profiles[userId] || userId.slice(0, 8);
  }, [profiles]);

  // Delete own message
  const deleteMessage = useCallback(async (messageId: string) => {
    if (!user) return;
    await supabase.from('chat_messages').delete().eq('id', messageId).eq('user_id', user.id);
    setMessages(prev => prev.filter(m => m.id !== messageId));
  }, [user]);

  return {
    messages,
    profiles,
    myPseudo,
    loading,
    unreadMentions,
    unreadMessages,
    sendMessage,
    updatePseudo,
    clearMentions,
    clearUnread,
    getPseudo,
    loadProfiles,
    deleteMessage,
  };
}
