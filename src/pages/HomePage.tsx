import { NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { NovarideLogo } from '@/components/ui/NovarideLogo';
import { 
  ArrowRight, 
  Target, 
  TrendingUp, 
  Users, 
  Package, 
  Banknote,
  Globe,
  Wrench,
  Award
} from 'lucide-react';
const heroHome = '/placeholder.svg';
const productTransmission = '/placeholder.svg';
const visionNovaride = '/placeholder.svg';
const productCcdEvo = '/placeholder.svg';

export function HomePage() {
  const kpis = [
    { label: 'CA 2025', value: '880k€', trend: '+35%' },
    { label: 'Marge Brute', value: '70%', trend: null },
    { label: 'Effectif', value: '~10', trend: null },
    { label: 'Levée cible', value: '2M€', trend: null },
  ];

  const pillars = [
    {
      icon: Target,
      title: 'Transmission Haut de Gamme',
      description: 'Spécialisation sur les composants de transmission premium pour vélos (chapes, galets, plateaux, cassettes)',
    },
    {
      icon: Globe,
      title: 'Stratégie Multicanal',
      description: 'Distribution B2C, B2B France/International et OEM avec des partenariats stratégiques',
    },
    {
      icon: Wrench,
      title: 'Innovation & Design',
      description: 'ADN d\'ingénierie combinant performance CeramicSpeed, robustesse Hope et modularité Wolf Tooth',
    },
  ];

  const roadmap = [
    {
      year: '2026',
      items: [
        'B2B France: Diversification réseau',
        'B2B International: 3-4 pays partenaires',
        'B2C: Accélération e-commerce',
        'OEM: 1er contrat pilote',
      ],
    },
    {
      year: '2027',
      items: [
        'Force de vente dédiée',
        '3-4 distributeurs internationaux',
        'Marketplaces US/Asie',
        '2-3 contrats OEM significatifs',
      ],
    },
    {
      year: '2028',
      items: [
        'Réseau direct consolidé',
        '5-6 pays actifs',
        '25-30% CA en B2C global',
        '4-5 contrats OEM réguliers',
      ],
    },
  ];

  const differentiators = [
    { brand: 'CeramicSpeed', trait: 'Performance' },
    { brand: 'Cane Creek', trait: 'Ingénierie' },
    { brand: 'Hope', trait: 'Robustesse' },
    { brand: 'Wolf Tooth', trait: 'Modularité' },
    { brand: 'Garbaruk', trait: 'Design CNC' },
    { brand: 'Chris King', trait: 'Durabilité' },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[60vh] min-h-[500px] overflow-hidden">
        <img
          src={heroHome}
          alt="Novaride - Performance, Design, Reliability"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
        
        <div className="relative h-full flex flex-col justify-center px-8 md:px-16">
          <NovarideLogo variant="full" color="light" className="mb-6" />
          <h1 className="text-white text-3xl md:text-5xl font-bold max-w-xl leading-tight mb-4">
            All is in the details.
          </h1>
          <p className="text-white/80 text-lg md:text-xl max-w-lg mb-8">
            Performance, design, reliability and fair price w/ No compromise.
          </p>
          
          <div className="flex flex-wrap gap-3">
            <NavLink to="/product">
              <Button size="lg" className="bg-primary hover:bg-primary/90">
                Explorer le Plan
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </NavLink>
            <NavLink to="/investment-summary">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                Synthèse Investisseur
              </Button>
            </NavLink>
          </div>
        </div>
      </section>

      {/* KPIs Bar */}
      <section className="bg-sidebar text-sidebar-foreground py-6 px-8">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {kpis.map((kpi, i) => (
            <div key={i} className="text-center">
              <div className="text-2xl md:text-3xl font-bold font-mono-numbers text-white">
                {kpi.value}
              </div>
              <div className="text-sm text-sidebar-foreground/70 flex items-center justify-center gap-2">
                {kpi.label}
                {kpi.trend && (
                  <Badge variant="secondary" className="text-xs bg-green-600/20 text-green-400">
                    {kpi.trend}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Vision Section */}
      <section className="py-16 px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="outline" className="mb-4">Vision</Badge>
              <h2 className="text-3xl font-bold mb-6">
                La référence pour la transmission haut de gamme
              </h2>
              <p className="text-muted-foreground mb-6">
                NOVARIDE combine le meilleur de l'industrie cycliste premium pour créer une gamme 
                de composants de transmission qui répond aux exigences des cyclistes les plus exigeants.
              </p>
              
              <div className="flex flex-wrap gap-2 mb-6">
                {differentiators.map((d, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {d.trait} <span className="text-muted-foreground ml-1">({d.brand})</span>
                  </Badge>
                ))}
              </div>
              
              <NavLink to="/valuation">
                <Button variant="outline">
                  Voir la valorisation
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </NavLink>
            </div>
            
            <div className="relative">
              <img
                src={visionNovaride}
                alt="Vision Novaride"
                className="rounded-lg shadow-2xl"
              />
              <div className="absolute -bottom-6 -left-6">
                <img
                  src={productCcdEvo}
                  alt="CCD EVO Product"
                  className="h-32 w-auto bg-white p-4 rounded-lg shadow-xl"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pillars Section */}
      <section className="py-16 px-8 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">Stratégie</Badge>
            <h2 className="text-3xl font-bold">Produit & Offre</h2>
            <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
              Nous identifions des produits logiques et les adaptons avec notre vision.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {pillars.map((pillar, i) => {
              const Icon = pillar.icon;
              return (
                <Card key={i} className="bg-card hover:shadow-lg transition-shadow">
                  <CardContent className="pt-6">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{pillar.title}</h3>
                    <p className="text-sm text-muted-foreground">{pillar.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Roadmap Section */}
      <section className="py-16 px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">Roadmap Commerciale</Badge>
            <h2 className="text-3xl font-bold">Plan de Développement 2026-2028</h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {roadmap.map((phase, i) => (
              <Card key={i} className="relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent" />
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold text-primary mb-4">{phase.year}</div>
                  <ul className="space-y-2">
                    {phase.items.map((item, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm">
                        <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-8 bg-sidebar text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Prêt à explorer le business plan ?</h2>
          <p className="text-white/70 mb-8 max-w-xl mx-auto">
            Accédez à l'ensemble des projections financières, scénarios et valorisation pour accompagner 
            la levée de fonds de NOVARIDE.
          </p>
          
          <div className="flex flex-wrap justify-center gap-4">
            <NavLink to="/">
              <Button size="lg" className="bg-white text-sidebar hover:bg-white/90">
                <Package className="mr-2 h-5 w-5" />
                Plan Produit
              </Button>
            </NavLink>
            <NavLink to="/organisation">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                <Users className="mr-2 h-5 w-5" />
                Organisation
              </Button>
            </NavLink>
            <NavLink to="/funding">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                <Banknote className="mr-2 h-5 w-5" />
                Financement
              </Button>
            </NavLink>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-8 border-t">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <NovarideLogo variant="compact" color="dark" className="text-xl" />
            <span className="text-sm text-muted-foreground">
              © 2025 NOVARIDE - Innovation française
            </span>
          </div>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <a href="https://novatoride.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
              Site officiel
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
