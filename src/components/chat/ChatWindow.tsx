import { useState, useRef, useEffect, useMemo } from 'react';
import { ChatMessage } from '@/hooks/useChatData';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Send, AtSign } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Props {
  messages: ChatMessage[];
  profiles: Record<string, string>;
  myPseudo: string;
  onSend: (content: string, mentions: string[]) => void;
  getPseudo: (userId: string) => string;
  compact?: boolean;
}

export function ChatWindow({ messages, profiles, myPseudo, onSend, getPseudo, compact }: Props) {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const allUsers = useMemo(() => {
    return Object.entries(profiles)
      .filter(([uid]) => uid !== user?.id)
      .map(([uid, pseudo]) => ({ uid, pseudo }));
  }, [profiles, user]);

  const handleSend = () => {
    if (!input.trim()) return;
    // Extract mentions from @pseudo
    const mentionedIds: string[] = [];
    for (const [uid, pseudo] of Object.entries(profiles)) {
      if (pseudo && input.includes(`@${pseudo}`)) {
        mentionedIds.push(uid);
      }
    }
    onSend(input, mentionedIds);
    setInput('');
  };

  const insertMention = (pseudo: string) => {
    setInput(prev => prev + `@${pseudo} `);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups: { date: string; msgs: ChatMessage[] }[] = [];
    let currentDate = '';
    for (const msg of messages) {
      const d = format(new Date(msg.created_at), 'dd MMM yyyy', { locale: fr });
      if (d !== currentDate) {
        currentDate = d;
        groups.push({ date: d, msgs: [] });
      }
      groups[groups.length - 1].msgs.push(msg);
    }
    return groups;
  }, [messages]);

  const highlightMentions = (content: string) => {
    // Highlight @pseudo mentions
    let result = content;
    for (const [, pseudo] of Object.entries(profiles)) {
      if (pseudo) {
        result = result.replace(
          new RegExp(`@${pseudo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'),
          `<span class="bg-primary/20 text-primary font-semibold px-0.5 rounded">@${pseudo}</span>`
        );
      }
    }
    return result;
  };

  return (
    <div className={`flex flex-col ${compact ? 'h-full' : 'h-[600px]'}`}>
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-1">
        {groupedMessages.map(group => (
          <div key={group.date}>
            <div className="flex justify-center my-3">
              <Badge variant="secondary" className="text-[10px] font-normal">{group.date}</Badge>
            </div>
            {group.msgs.map((msg, i) => {
              const isMe = msg.user_id === user?.id;
              const pseudo = getPseudo(msg.user_id);
              const showPseudo = i === 0 || group.msgs[i - 1].user_id !== msg.user_id;
              const isMentioned = user && msg.mentions?.includes(user.id);
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {showPseudo && (
                    <span className={`text-[10px] font-semibold mt-2 mb-0.5 px-1 ${isMe ? 'text-primary' : 'text-muted-foreground'}`}>
                      {pseudo}
                    </span>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-1.5 text-sm ${
                      isMe
                        ? 'bg-primary text-primary-foreground'
                        : isMentioned
                        ? 'bg-accent border-2 border-primary/40'
                        : 'bg-muted'
                    }`}
                    dangerouslySetInnerHTML={{ __html: highlightMentions(msg.content) }}
                  />
                  <span className="text-[9px] text-muted-foreground/60 px-1">
                    {format(new Date(msg.created_at), 'HH:mm')}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
        {messages.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-10">Aucun message. Soyez le premier à écrire !</p>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-2 flex gap-2 items-center">
        <Popover open={showMentions} onOpenChange={setShowMentions}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <AtSign className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="start">
            {allUsers.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2">Aucun utilisateur</p>
            ) : (
              allUsers.map(u => (
                <button
                  key={u.uid}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted rounded transition-colors"
                  onClick={() => insertMention(u.pseudo)}
                >
                  @{u.pseudo}
                </button>
              ))
            )}
          </PopoverContent>
        </Popover>

        <Input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder={`Écrire en tant que ${myPseudo || 'Anonyme'}...`}
          className="h-8 text-sm"
        />
        <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleSend} disabled={!input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
