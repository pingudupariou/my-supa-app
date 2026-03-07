import { useState } from 'react';
import { useChatData } from '@/hooks/useChatData';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ReadOnlyWrapper } from '@/components/auth/ReadOnlyWrapper';
import { MessageCircle, Users, Settings2 } from 'lucide-react';

export function ChatPage() {
  const chat = useChatData();
  const [pseudoInput, setPseudoInput] = useState('');
  const [editingPseudo, setEditingPseudo] = useState(false);

  const handleSavePseudo = () => {
    if (pseudoInput.trim()) {
      chat.updatePseudo(pseudoInput.trim());
    }
    setEditingPseudo(false);
  };

  const uniqueUsers = new Set(chat.messages.map(m => m.user_id)).size;

  return (
    <ReadOnlyWrapper tabKey="chat">
      <div className="space-y-6">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <MessageCircle className="h-6 w-6" />
            Chat d'équipe
          </h1>
          <p className="text-sm text-muted-foreground">Échangez en temps réel avec votre équipe</p>
        </div>

        {/* KPIs + Pseudo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <MessageCircle className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{chat.messages.length}</p>
                <p className="text-xs text-muted-foreground">Messages</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{uniqueUsers}</p>
                <p className="text-xs text-muted-foreground">Participants</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Mon pseudo</span>
              </div>
              {editingPseudo ? (
                <div className="flex gap-2">
                  <Input
                    value={pseudoInput}
                    onChange={e => setPseudoInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSavePseudo()}
                    className="h-8 text-sm"
                    placeholder="Entrez un pseudo"
                    autoFocus
                  />
                  <Button size="sm" className="h-8" onClick={handleSavePseudo}>OK</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="text-sm">{chat.myPseudo || 'Non défini'}</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => { setPseudoInput(chat.myPseudo); setEditingPseudo(true); }}
                  >
                    Modifier
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Chat */}
        <Card className="overflow-hidden">
          <ChatWindow
            messages={chat.messages}
            profiles={chat.profiles}
            myPseudo={chat.myPseudo}
            onSend={chat.sendMessage}
            getPseudo={chat.getPseudo}
          />
        </Card>
      </div>
    </ReadOnlyWrapper>
  );
}
