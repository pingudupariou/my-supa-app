import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { NovarideLogo } from '@/components/ui/NovarideLogo';
import {
  ArrowRight,
  Package,
  Users,
  Receipt,
  LineChart,
  Banknote,
  BarChart3,
  TrendingUp,
  FileText,
  MessageSquare,
  Cog,
  Clock,
  Database,
  LogOut,
  Shield,
  Globe,
  Wrench,
  Award,
  Target,
} from 'lucide-react';

import heroUdh from '@/assets/hero-udh.jpg';
import savoirFaire from '@/assets/savoir-faire.jpg';
import composantsHero from '@/assets/composants-hero.jpg';
import ccdGold from '@/assets/ccd-gold.jpg';
import pulleyWheels from '@/assets/pulley-wheels.jpg';
import fullBikeCcd from '@/assets/full-bike-ccd.jpg';
import ccdEvoBanner from '@/assets/ccd-evo-banner.jpg';
import ccdEvoDev from '@/assets/ccd-evo-dev.jpg';

interface NavItem {
  to: string;
  label: string;
  icon: typeof Package;
  tabKey: string;
  description: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Prévisionnel',
    items: [
      { to: '/', label: 'Plan Produit', icon: Package, tabKey: 'product-plan', description: 'Gamme, pricing et volumes' },
      { to: '/organisation', label: 'Organisation', icon: Users, tabKey: 'organisation', description: 'Équipe et masse salariale' },
      { to: '/charges', label: 'Charges', icon: Receipt, tabKey: 'charges', description: 'Charges fixes et variables' },
      { to: '/scenarios', label: 'Scénarios', icon: BarChart3, tabKey: 'scenarios', description: 'Hypothèses et projections' },
      { to: '/previsionnel', label: 'Prévisionnel', icon: LineChart, tabKey: 'previsionnel', description: 'P&L, trésorerie, BFR' },
    ],
  },
  {
    label: 'Investisseur',
    items: [
      { to: '/funding', label: 'Financement', icon: Banknote, tabKey: 'funding', description: 'Besoin et allocation' },
      { to: '/valuation', label: 'Valorisation', icon: TrendingUp, tabKey: 'valuation', description: 'Méthodes et dilution' },
      { to: '/investment-summary', label: 'Synthèse', icon: FileText, tabKey: 'investment-summary', description: 'Deck investisseur' },
    ],
  },
  {
    label: 'Opérations',
    items: [
      { to: '/crm', label: 'CRM', icon: MessageSquare, tabKey: 'crm', description: 'Clients et commandes' },
      { to: '/costflow', label: 'Production & BE', icon: Cog, tabKey: 'costflow', description: 'BOM, fournisseurs, planning' },
      { to: '/timetracking', label: "Suivi d'activité", icon: Clock, tabKey: 'timetracking', description: 'Temps et catégories' },
      { to: '/snapshots', label: 'Sauvegardes', icon: Database, tabKey: 'snapshots', description: 'Historique et restauration' },
    ],
  },
];

export function HomePage() {
  const { signOut, isAdmin, getTabPermission } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const visibleGroups = navGroups.map(group => ({
    ...group,
    items: group.items.filter(item => getTabPermission(item.tabKey) !== 'hidden'),
  })).filter(group => group.items.length > 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="bg-sidebar text-sidebar-foreground px-6 py-3 flex items-center justify-between">
        <NovarideLogo variant="full" color="light" />
        <div className="flex items-center gap-3">
          {isAdmin && (
            <NavLink to="/permissions">
              <Button variant="ghost" size="sm" className="text-sidebar-foreground/70 hover:text-sidebar-foreground">
                <Shield className="h-4 w-4 mr-1" /> Admin
              </Button>
            </NavLink>
          )}
          <Button variant="ghost" size="sm" className="text-sidebar-foreground/70 hover:text-sidebar-foreground" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-1" /> Déconnexion
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative h-[55vh] min-h-[420px] overflow-hidden">
        <img src={heroUdh} alt="Nova Ride UDH Derailleur" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
        <div className="relative h-full flex flex-col justify-center px-8 md:px-16 max-w-4xl">
          <Badge className="w-fit mb-4 bg-primary/90 text-primary-foreground">Composants de transmission premium</Badge>
          <h1 className="text-white text-3xl md:text-5xl font-bold leading-tight mb-3">
            All is in the details.
          </h1>
          <p className="text-white/80 text-lg md:text-xl max-w-lg mb-6">
            Performance, design, fiabilité et prix juste — sans compromis.
          </p>
          <div className="flex flex-wrap gap-3">
            <NavLink to="/investment-summary">
              <Button size="lg" className="bg-primary hover:bg-primary/90">
                Synthèse Investisseur <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </NavLink>
            <a href="https://novatoride.com" target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                <Globe className="mr-2 h-5 w-5" /> novatoride.com
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Qui sommes-nous */}
      <section className="py-16 px-8">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <Badge variant="outline" className="mb-4">Qui sommes-nous</Badge>
            <h2 className="text-3xl font-bold mb-4">Ingénierie française au service du cyclisme</h2>
            <p className="text-muted-foreground mb-4">
              Chez Nova Ride, tout le monde joue son rôle, des premières esquisses à l'expédition du produit fini.
              Des composants conçus avec passion et transparence — voici notre ADN.
            </p>
            <p className="text-muted-foreground mb-6">
              Nous accordons une attention minutieuse à chaque détail pour vous offrir des produits performants et durables.
              Chaque composant est conçu, prototypé et testé en interne.
            </p>
            <div className="flex gap-6 text-sm">
              <div><span className="text-2xl font-bold text-primary">4 ans</span><br /><span className="text-muted-foreground">Garantie</span></div>
              <div><span className="text-2xl font-bold text-primary">100%</span><br /><span className="text-muted-foreground">Céramique</span></div>
              <div><span className="text-2xl font-bold text-primary">7075-T6</span><br /><span className="text-muted-foreground">Aluminium</span></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <img src={savoirFaire} alt="Notre savoir-faire" className="rounded-lg shadow-lg col-span-2 h-48 w-full object-cover" />
            <img src={ccdEvoDev} alt="Conception 3D" className="rounded-lg shadow-lg h-40 w-full object-cover" />
            <img src={ccdGold} alt="CCD Gold Edition" className="rounded-lg shadow-lg h-40 w-full object-cover" />
          </div>
        </div>
      </section>

      {/* Nos produits */}
      <section className="py-16 px-8 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">Nos composants</Badge>
            <h2 className="text-3xl font-bold">Transmission haut de gamme</h2>
            <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
              Chapes de dérailleur, galets céramique, boîtiers de pédalier — conçus pour la performance.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="overflow-hidden group hover:shadow-lg transition-shadow">
              <img src={ccdEvoBanner} alt="CCD EVO" className="h-48 w-full object-cover group-hover:scale-105 transition-transform" />
              <CardContent className="pt-4">
                <h3 className="font-semibold text-lg">CCD EVO</h3>
                <p className="text-sm text-muted-foreground">Chapes de dérailleur surdimensionnées avec roulements 100% céramique. Carbone 3K, optimisation topologique.</p>
              </CardContent>
            </Card>
            <Card className="overflow-hidden group hover:shadow-lg transition-shadow">
              <img src={pulleyWheels} alt="Galets EVO" className="h-48 w-full object-cover group-hover:scale-105 transition-transform" />
              <CardContent className="pt-4">
                <h3 className="font-semibold text-lg">Galets de dérailleur EVO</h3>
                <p className="text-sm text-muted-foreground">Aluminium 7075-T6, roulements secs céramique. Friction minimale, zéro entretien.</p>
              </CardContent>
            </Card>
            <Card className="overflow-hidden group hover:shadow-lg transition-shadow">
              <img src={fullBikeCcd} alt="Vélo équipé CCD" className="h-48 w-full object-cover group-hover:scale-105 transition-transform" />
              <CardContent className="pt-4">
                <h3 className="font-semibold text-lg">Écosystème complet</h3>
                <p className="text-sm text-muted-foreground">Compatibles Shimano & SRAM, route, gravel et VTT. 7 coloris disponibles.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Navigation - Onglets */}
      <section className="py-16 px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">Business Plan</Badge>
            <h2 className="text-3xl font-bold">Accéder aux modules</h2>
            <p className="text-muted-foreground mt-2">
              Explorez l'ensemble des projections financières, de la stratégie produit à la valorisation.
            </p>
          </div>

          {visibleGroups.map((group, gi) => (
            <div key={gi} className="mb-10">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="h-1 w-6 bg-primary rounded-full" />
                {group.label}
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {group.items.map(item => {
                  const Icon = item.icon;
                  return (
                    <NavLink key={item.to} to={item.to}>
                      <Card className="h-full hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group">
                        <CardContent className="pt-5 flex items-start gap-4">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium group-hover:text-primary transition-colors">{item.label}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{item.description}</div>
                          </div>
                        </CardContent>
                      </Card>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Savoir-faire */}
      <section className="py-16 px-8 bg-sidebar text-white">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <img src={composantsHero} alt="Nova Ride en action" className="rounded-lg shadow-2xl" />
          <div>
            <Badge className="mb-4 bg-white/10 text-white border-white/20">Notre savoir-faire</Badge>
            <h2 className="text-3xl font-bold mb-4">De l'idée à votre vélo</h2>
            <div className="space-y-4 text-white/80">
              <div className="flex items-start gap-3">
                <Target className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p><strong className="text-white">Idéation & CAO</strong> — Conception 3D, optimisation topologique et simulation FEA.</p>
              </div>
              <div className="flex items-start gap-3">
                <Wrench className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p><strong className="text-white">Prototypage</strong> — Impression 3D, usinage CNC et tests itératifs en interne.</p>
              </div>
              <div className="flex items-start gap-3">
                <Award className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p><strong className="text-white">Validation</strong> — Tests de contrainte, fatigue et terrain réel. 100% testés, 100% garantis.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-8 border-t">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <NovarideLogo variant="compact" color="dark" className="text-xl" />
            <span className="text-sm text-muted-foreground">© 2025 NOVARIDE — Innovation française</span>
          </div>
          <a href="https://novatoride.com" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground">
            novatoride.com
          </a>
        </div>
      </footer>
    </div>
  );
}