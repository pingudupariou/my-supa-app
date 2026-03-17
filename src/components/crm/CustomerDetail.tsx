import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InteractionHistory } from './InteractionHistory';
import { CrmMeetingManager } from './CrmMeetingManager';
import { CrmReminderManager } from './CrmReminderManager';
import { B2BClient } from '@/hooks/useB2BClientsData';
import { CustomerInteraction, CustomerOpportunity, CrmMeeting, CrmReminder, PIPELINE_STAGES } from '@/hooks/useCRMData';
import { Mail, Phone, Globe, FileText, Calendar, Bell, MessageSquare, Building2 } from 'lucide-react';

interface CustomerDetailProps {
  client: B2BClient;
  interactions: CustomerInteraction[];
  opportunities: CustomerOpportunity[];
  meetings: CrmMeeting[];
  reminders: CrmReminder[];
  onCreateInteraction: (interaction: any) => Promise<any>;
  onCreateMeeting: (meeting: any) => Promise<any>;
  onUpdateMeeting: (id: string, updates: any) => Promise<boolean>;
  onDeleteMeeting: (id: string) => Promise<boolean>;
  onRestoreMeeting?: (id: string) => Promise<boolean>;
  onPermanentDeleteMeeting?: (id: string) => Promise<boolean>;
  getTrashedMeetings?: () => Promise<CrmMeeting[]>;
  onCreateReminder: (reminder: any) => Promise<any>;
  onCompleteReminder: (id: string) => Promise<boolean>;
  onUncompleteReminder?: (id: string) => Promise<boolean>;
  onDeleteReminder: (id: string) => Promise<boolean>;
  isAdmin?: boolean;
  selectedEntityName?: string;
}

export function CustomerDetail({
  client, interactions, opportunities, meetings, reminders,
  onCreateInteraction, onCreateMeeting, onUpdateMeeting, onDeleteMeeting,
  onRestoreMeeting, onPermanentDeleteMeeting, getTrashedMeetings,
  onCreateReminder, onCompleteReminder, onUncompleteReminder, onDeleteReminder,
  isAdmin, selectedEntityName,
}: CustomerDetailProps) {
  const currentStage = opportunities.length > 0
    ? PIPELINE_STAGES.find(s => s.key === opportunities[0].stage)
    : null;

  const pendingReminders = reminders.filter(r => !r.is_completed).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{client.company_name}</span>
          <div className="flex items-center gap-2">
            {pendingReminders > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                <Bell className="h-3 w-3 mr-0.5" />{pendingReminders}
              </Badge>
            )}
            {currentStage && <Badge variant="outline">{currentStage.label}</Badge>}
            <Badge variant={client.is_active ? 'default' : 'secondary'}>
              {client.is_active ? 'Actif' : 'Inactif'}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Email:</span>
            <span className="ml-1">{client.contact_email || '-'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Tél:</span>
            <span className="ml-1">{client.contact_phone || '-'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Pays:</span>
            <span className="ml-1">{client.country || '-'}</span>
          </div>
          <div><span className="text-muted-foreground">Zone:</span><span className="ml-2">{client.geographic_zone || '-'}</span></div>
          <div><span className="text-muted-foreground">Type:</span><span className="ml-2">{client.client_type || '-'}</span></div>
          <div><span className="text-muted-foreground">Tarification:</span><span className="ml-2">{client.pricing_rule || '-'}</span></div>
          <div><span className="text-muted-foreground">Paiement:</span><span className="ml-2">{client.payment_terms || '-'}</span></div>
        </div>

        {/* Notes */}
        {client.notes && (
          <>
            <Separator />
            <div className="p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-1.5 mb-1">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-medium">Notes</span>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{client.notes}</p>
            </div>
          </>
        )}

        {/* Opportunities summary */}
        {opportunities.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-medium text-sm mb-2">Opportunités ({opportunities.length})</h4>
              <div className="space-y-1">
                {opportunities.map(opp => {
                  const stage = PIPELINE_STAGES.find(s => s.key === opp.stage);
                  return (
                    <div key={opp.id} className="flex justify-between items-center text-sm p-2 bg-muted/30 rounded">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{stage?.label || opp.stage}</Badge>
                        {opp.contact_name && <span className="text-muted-foreground">{opp.contact_name}</span>}
                      </div>
                      <span className="font-mono text-xs">
                        {(opp.estimated_amount || 0).toLocaleString('fr-FR')} € · {opp.probability}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Tabbed content: Interactions, Meetings, Reminders */}
        <Separator />
        <Tabs defaultValue="meetings" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="meetings" className="flex-1 text-xs">
              <Calendar className="h-3.5 w-3.5 mr-1" />RDV ({meetings.length})
            </TabsTrigger>
            <TabsTrigger value="reminders" className="flex-1 text-xs">
              <Bell className="h-3.5 w-3.5 mr-1" />Rappels ({pendingReminders})
            </TabsTrigger>
            <TabsTrigger value="interactions" className="flex-1 text-xs">
              <MessageSquare className="h-3.5 w-3.5 mr-1" />Historique ({interactions.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="meetings" className="mt-3">
            <CrmMeetingManager
              meetings={meetings}
              customerId={client.id}
              onCreate={onCreateMeeting}
              onUpdate={onUpdateMeeting}
              onDelete={onDeleteMeeting}
              onRestore={onRestoreMeeting}
              onPermanentDelete={onPermanentDeleteMeeting}
              getTrashedMeetings={getTrashedMeetings}
              isAdmin={isAdmin}
            />
          </TabsContent>
          <TabsContent value="reminders" className="mt-3">
            <CrmReminderManager
              reminders={reminders}
              customers={[{ id: client.id, company_name: client.company_name }]}
              customerId={client.id}
              onCreate={onCreateReminder}
              onComplete={onCompleteReminder}
              onUncomplete={onUncompleteReminder}
              onDelete={onDeleteReminder}
            />
          </TabsContent>
          <TabsContent value="interactions" className="mt-3">
            <InteractionHistory
              interactions={interactions}
              customerId={client.id}
              onCreate={onCreateInteraction}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
