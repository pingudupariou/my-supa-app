import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KPICard } from '@/components/ui/KPICard';
import { Users, MapPin, TrendingUp, Calendar, ShoppingCart } from 'lucide-react';
import { CustomerList } from '@/components/crm/CustomerList';
import { CustomerDetail } from '@/components/crm/CustomerDetail';
import { CustomerMap } from '@/components/crm/CustomerMap';
import { PricingTiers } from '@/components/crm/PricingTiers';
import { UpcomingAppointments } from '@/components/crm/UpcomingAppointments';
import { useCRMData } from '@/hooks/useCRMData';

export function CRMPage() {
  const { 
    customers, 
    orders, 
    appointments,
    pricingTiers,
    isLoading,
    refreshData 
  } = useCRMData();
  
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  // Calculate KPIs
  const totalCustomers = customers.length;
  const activeCustomers = customers.filter(c => c.status === 'active').length;
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const pendingOrders = orders.filter(o => ['draft', 'confirmed', 'in_progress'].includes(o.status)).length;
  const upcomingAppointments = appointments.filter(a => !a.is_completed && new Date(a.appointment_date) >= new Date()).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">CRM</h1>
        <p className="text-muted-foreground">
          Gestion des clients, suivi commercial et commandes
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-5">
        <KPICard
          label="Total Clients"
          value={totalCustomers}
        />
        <KPICard
          label="Clients Actifs"
          value={activeCustomers}
          trend={activeCustomers > 0 ? 'up' : 'neutral'}
        />
        <KPICard
          label="CA Total"
          value={`${(totalRevenue / 1000).toFixed(0)} k€`}
        />
        <KPICard
          label="Commandes en cours"
          value={pendingOrders}
        />
        <KPICard
          label="RDV à venir"
          value={upcomingAppointments}
        />
      </div>

      {/* Main content */}
      <Tabs defaultValue="customers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="customers">
            <Users className="h-4 w-4 mr-2" />
            Clients
          </TabsTrigger>
          <TabsTrigger value="map">
            <MapPin className="h-4 w-4 mr-2" />
            Carte
          </TabsTrigger>
          <TabsTrigger value="pricing">
            <TrendingUp className="h-4 w-4 mr-2" />
            Grille Tarifaire
          </TabsTrigger>
          <TabsTrigger value="agenda">
            <Calendar className="h-4 w-4 mr-2" />
            Agenda
          </TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Customer list */}
            <div className="lg:col-span-1">
              <CustomerList
                customers={customers}
                selectedId={selectedCustomerId}
                onSelect={setSelectedCustomerId}
                onRefresh={refreshData}
              />
            </div>
            
            {/* Customer detail */}
            <div className="lg:col-span-2">
              {selectedCustomer ? (
                <CustomerDetail
                  customer={selectedCustomer}
                  orders={orders.filter(o => o.customer_id === selectedCustomerId)}
                  onRefresh={refreshData}
                />
              ) : (
                <Card className="h-full min-h-[400px] flex items-center justify-center">
                  <CardContent className="text-center text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>Sélectionnez un client pour voir ses détails</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="map" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Localisation des clients
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CustomerMap
                customers={customers}
                selectedId={selectedCustomerId}
                onSelectCustomer={setSelectedCustomerId}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing" className="space-y-4">
          <PricingTiers 
            tiers={pricingTiers} 
            onRefresh={refreshData} 
          />
        </TabsContent>

        <TabsContent value="agenda" className="space-y-4">
          <UpcomingAppointments
            appointments={appointments}
            customers={customers}
            onRefresh={refreshData}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
