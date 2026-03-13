import { useState } from 'react';
import { useChatData } from '@/hooks/useChatData';
import { ChatWindow } from './ChatWindow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { MessageCircle, X, Minus, Settings2 } from 'lucide-react';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';

export function FloatingChat() {
  const chat = useChatData();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [editingPseudo, setEditingPseudo] = useState(false);
  const [pseudoInput, setPseudoInput] = useState('');

  const handleOpen = () => {
    setOpen(true);
    setMinimized(false);
    chat.clearMentions();
    chat.clearUnread();
  };

  const handleSavePseudo = () => {
    if (pseudoInput.trim()) {
      chat.updatePseudo(pseudoInput.trim());
    }
    setEditingPseudo(false);
  };

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
      >
        <MessageCircle className="h-5 w-5" />
        {(chat.unreadMentions > 0 || chat.unreadMessages > 0) && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center animate-pulse">
            {chat.unreadMentions || chat.unreadMessages}
          </span>
        )}
      </button>
    );
  }

  if (minimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => { setMinimized(false); chat.clearMentions(); chat.clearUnread(); }}
          className="h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center relative"
        >
          <MessageCircle className="h-5 w-5" />
          {(chat.unreadMentions > 0 || chat.unreadMessages > 0) && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center animate-pulse">
              {chat.unreadMentions || chat.unreadMessages}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 z-50 w-80 h-[450px] shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Chat</span>
          <Badge variant="secondary" className="text-[10px]">{chat.myPseudo || 'Anonyme'}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Popover open={editingPseudo} onOpenChange={setEditingPseudo}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPseudoInput(chat.myPseudo)}>
                <Settings2 className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="end">
              <p className="text-xs font-medium mb-2">Modifier mon pseudo</p>
              <div className="flex gap-2">
                <Input
                  value={pseudoInput}
                  onChange={e => setPseudoInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSavePseudo()}
                  className="h-7 text-xs"
                  placeholder="Mon pseudo"
                />
                <Button size="sm" className="h-7 text-xs" onClick={handleSavePseudo}>OK</Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setMinimized(true)}>
            <Minus className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Chat content */}
      <div className="flex-1 min-h-0">
        <ChatWindow
          messages={chat.messages}
          profiles={chat.profiles}
          myPseudo={chat.myPseudo}
          onSend={chat.sendMessage}
          getPseudo={chat.getPseudo}
          compact
        />
      </div>
    </Card>
  );
}
