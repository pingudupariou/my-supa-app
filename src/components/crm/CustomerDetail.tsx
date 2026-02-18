import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { InteractionHistory } from './InteractionHistory';
import { B2BClient } from '@/hooks/useB2BClientsData';
import { CustomerInteraction, CustomerOpportunity, PIPELINE_STAGES } from '@/hooks/useCRMData';
import { Save, AlertCircle, Mail, Globe, FileText } from 'lucide-react';

interface CustomerDetailProps {
  client: B2BClient;
  interactions: CustomerInteraction[];
  opportunities: CustomerOpportunity[];
  onCreateInteraction: (interaction: any) => Promise<any>;
}

export function CustomerDetail({ client, interactions, opportunities, onCreateInteraction }: CustomerDetailProps) {
  const currentStage = opportunities.length > 0
    ? PIPELINE_STAGES.find(s => s.key === opportunities[0].stage)
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{client.company_name}</span>
          <div className="flex items-center gap-2">
            {currentStage && <Badge variant="outline">{currentStage.label}</Badge>}
            <Badge variant={client.is_active ? 'default' : 'secondary'}>
              {client.is_active ? 'Actif' : 'Inactif'}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Info grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Email:</span>
            <span className="ml-1">{client.contact_email || '-'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Pays:</span>
            <span className="ml-1">{client.country || '-'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Zone:</span>
            <span className="ml-2">{client.geographic_zone || '-'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Type:</span>
            <span className="ml-2">{client.client_type || '-'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Tarification:</span>
            <span className="ml-2">{client.pricing_rule || '-'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Paiement:</span>
            <span className="ml-2">{client.payment_terms || '-'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Livraison:</span>
            <span className="ml-2">{client.delivery_method || '-'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">MOQ:</span>
            <span className="ml-2">{client.moq || '-'}</span>
          </div>
          {client.contract_sign_date && (
            <div>
              <span className="text-muted-foreground">Contrat signé:</span>
              <span className="ml-2">{new Date(client.contract_sign_date).toLocaleDateString('fr-FR')}</span>
            </div>
          )}
          {client.contract_exclusivity && (
            <div>
              <Badge variant="outline" className="text-[10px]">Exclusivité</Badge>
            </div>
          )}
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

        {/* Interactions */}
        <Separator />
        <InteractionHistory
          interactions={interactions}
          customerId={client.id}
          onCreate={onCreateInteraction}
        />
      </CardContent>
    </Card>
  );
}
