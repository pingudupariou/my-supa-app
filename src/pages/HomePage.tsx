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
  Award,
  Bike,
  Shield,
  Cog,
  ChevronRight,
  MapPin,
  Star,
} from 'lucide-react';
import heroImage from '@/assets/hero-novaride.jpg';
import actionImage from '@/assets/novaride-action.jpg';
import engineeringImage from '@/assets/novaride-engineering.jpg';

export function HomePage() {
  const kpis = [
    { label: 'CA 2025', value: '880k€', trend: '+35%', icon: TrendingUp },
    { label: 'Marge Brute', value: '70%', trend: null, icon: Target },
    { label: 'Effectif', value: '~10', trend: null, icon: Users },
    { label: 'Levée cible', value: '2M€', trend: null, icon: Banknote },
  ];

  const products = [
    {
      name: 'Chapes Carbone Céramique',
      series: 'CCD / CCD EVO / CCD AERO',
      description: 'Chapes de dérailleur en carbone avec roulements céramiques hybrides pour Shimano et SRAM',
      price: 'À partir de 219€',
    },
    {
      name: 'Galets de Dérailleur',
      series: 'Pulley Wheels EVO',
      description: 'Galets haute performance en aluminium CNC avec roulements céramiques sans entretien',
      price: 'À partir de 129€',
    },
    {
      name: 'Boîtiers de Pédalier',
      series: 'CBB',
      description: 'Boîtiers de pédalier céramique pour tous standards (BSA, BB86, T47, PF30)',
      price: 'À partir de 219€',
    },
    {
      name: 'Pattes de Dérailleur UDH',
      series: 'UDH Derailleur Mounts',
      description: 'Pattes Direct Mount CNC pour un alignement parfait et un shifting chirurgical',
      price: 'Nouveau',
    },
  ];

  const pillars = [
    {
      icon: Cog,
      title: 'Ingénierie Française',
      description: 'Conception et design en France, prototypage rapide, validation en conditions réelles avec des athlètes professionnels.',
    },
    {
      icon: Globe,
      title: 'Distribution Multicanal',
      description: 'B2C via notre e-commerce, B2B avec un réseau de distributeurs France & International, OEM pour les marques de vélos.',
    },
    {
      icon: Shield,
      title: 'Qualité & Garantie 4 ans',
      description: 'Processus de fabrication optimisé, contrôle qualité rigoureux, garantie 4 ans sur tous nos produits.',
    },
  ];

  const roadmap = [
    {
      year: '2026',
      phase: 'Expansion',
      items: [
        'Diversification réseau B2B France',
        '3-4 pays partenaires internationaux',
        'Accélération e-commerce B2C',
        '1er contrat pilote OEM',
      ],
    },
    {
      year: '2027',
      phase: 'Accélération',
      items: [
        'Force de vente dédiée',
        '3-4 distributeurs internationaux',
        'Marketplaces US/Asie',
        '2-3 contrats OEM significatifs',
      ],
    },
    {
      year: '2028',
      phase: 'Consolidation',
      items: [
        'Réseau direct consolidé',
        '5-6 pays actifs',
        '25-30% CA en B2C global',
        '4-5 contrats OEM réguliers',
      ],
    },
  ];

  const trustpoints = [
    { icon: Star, label: 'Trustpilot', value: '4.8/5' },
    { icon: Award, label: 'Garantie', value: '4 ans' },
    { icon: MapPin, label: 'Siège', value: 'Auvergne-Rhône-Alpes' },
    { icon: Bike, label: 'Athlètes', value: 'World Champions' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* ═══════════════════════════════════════ HERO ═══════════════════════════ */}
      <section className="relative h-[70vh] min-h-[550px] overflow-hidden">
        <img
          src={heroImage}
          alt="Nova Ride - Composants de transmission premium"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/20" />
        
        <div className="relative h-full flex flex-col justify-center px-8 md:px-16 max-w-7xl mx-auto">
          <div className="mb-3">
            <Badge className="bg-destructive/90 text-destructive-foreground border-none text-xs tracking-wider uppercase">
              Soutenue par la Région Auvergne-Rhône-Alpes
            </Badge>
          </div>
          
          <NovarideLogo variant="full" color="light" className="mb-4" />
          
          <h1 className="text-white text-4xl md:text-6xl font-bold max-w-2xl leading-[1.1] mb-4 tracking-tight">
            All is in the <span className="text-destructive">details.</span>
          </h1>
          
          <p className="text-white/70 text-lg md:text-xl max-w-lg mb-3 leading-relaxed">
            Composants de transmission premium pour le cyclisme haute performance.
          </p>
          <p className="text-white/50 text-sm max-w-lg mb-8">
            Performance, design, fiabilité et prix juste — sans compromis.
          </p>
          
          <div className="flex flex-wrap gap-3">
            <NavLink to="/product">
              <Button size="lg" className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold">
                Explorer le Business Plan
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </NavLink>
            <NavLink to="/investment-summary">
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 backdrop-blur-sm">
                Synthèse Investisseur
              </Button>
            </NavLink>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ KPIs BAR ═══════════════════════════════ */}
      <section className="bg-primary text-primary-foreground py-5 px-8 border-b border-white/10">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {kpis.map((kpi, i) => {
            const Icon = kpi.icon;
            return (
              <div key={i} className="flex items-center gap-3">
                <div className="h-10 w-10 rounded bg-white/10 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-white/80" />
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-bold font-mono-numbers text-white">
                    {kpi.value}
                  </div>
                  <div className="text-xs text-white/50 flex items-center gap-1.5">
                    {kpi.label}
                    {kpi.trend && (
                      <span className="text-green-400 font-semibold">{kpi.trend}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══════════════════════════ QUI SOMMES-NOUS ═══════════════════════════ */}
      <section className="py-20 px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <Badge variant="outline" className="mb-4 text-xs uppercase tracking-wider">Qui sommes-nous</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-6 leading-tight">
                La référence française en <span className="text-destructive">transmission premium</span>
              </h2>
              <p className="text-muted-foreground mb-4 leading-relaxed">
                NOVA RIDE conçoit et commercialise des composants de transmission haute performance 
                pour le cyclisme : chapes de dérailleur carbone-céramique, galets, boîtiers de pédalier 
                et pattes de dérailleur.
              </p>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Notre ADN d'ingénierie combine la performance de CeramicSpeed, la robustesse de Hope 
                et la modularité de Wolf Tooth — le tout à un prix accessible et avec une garantie de 4 ans.
              </p>
              
              <div className="grid grid-cols-2 gap-3 mb-8">
                {trustpoints.map((tp, i) => {
                  const Icon = tp.icon;
                  return (
                    <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
                      <Icon className="h-4 w-4 text-destructive" />
                      <div>
                        <div className="text-xs text-muted-foreground">{tp.label}</div>
                        <div className="text-sm font-semibold">{tp.value}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <a href="https://novatoride.com" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="group">
                  Visiter novatoride.com
                  <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </a>
            </div>
            
            <div className="relative">
              <img
                src={actionImage}
                alt="Cycliste professionnel en action"
                className="rounded-lg shadow-2xl w-full aspect-square object-cover"
              />
              <div className="absolute -bottom-6 -left-6 bg-background p-3 rounded-lg shadow-xl border">
                <img
                  src={engineeringImage}
                  alt="Ingénierie de précision"
                  className="h-28 w-28 rounded object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ PRODUITS ═══════════════════════════════ */}
      <section className="py-20 px-8 bg-primary text-primary-foreground">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-white/10 text-white/80 border-white/20 text-xs uppercase tracking-wider">
              Nos Produits
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Ce que nous fabriquons
            </h2>
            <p className="text-white/50 mt-3 max-w-xl mx-auto">
              Composants de transmission premium pour le cyclisme route, gravel et VTT.
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {products.map((product, i) => (
              <div
                key={i}
                className="bg-white/5 border border-white/10 rounded-lg p-5 hover:bg-white/10 transition-colors group"
              >
                <div className="text-xs text-white/40 font-mono-numbers mb-1">{product.series}</div>
                <h3 className="font-semibold text-white text-base mb-2">{product.name}</h3>
                <p className="text-white/50 text-xs leading-relaxed mb-4">{product.description}</p>
                <div className="text-destructive font-semibold text-sm">{product.price}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════ POUR QUI ═══════════════════════════════════ */}
      <section className="py-20 px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <Badge variant="outline" className="mb-4 text-xs uppercase tracking-wider">Pour qui</Badge>
            <h2 className="text-3xl md:text-4xl font-bold">Nos clients & canaux</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              Une stratégie multicanal pour couvrir l'ensemble du marché cycliste premium.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                channel: 'B2C',
                target: 'Cyclistes passionnés',
                description: 'Vente directe via notre boutique en ligne novatoride.com et les marketplaces spécialisées. Le canal le plus rentable.',
                share: '25-30%',
              },
              {
                channel: 'B2B',
                target: 'Magasins & Distributeurs',
                description: 'Réseau de revendeurs en France et à l\'international. Partenariats avec des distributeurs spécialisés dans le cyclisme premium.',
                share: '60-65%',
              },
              {
                channel: 'OEM',
                target: 'Marques de vélos',
                description: 'Fourniture de composants en marque blanche ou co-branding pour les fabricants de vélos haut de gamme.',
                share: '10-15%',
              },
            ].map((ch, i) => (
              <Card key={i} className="bg-card border hover:shadow-lg transition-shadow overflow-hidden">
                <div className="h-1 bg-destructive" />
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="secondary" className="text-xs font-bold">{ch.channel}</Badge>
                    <span className="text-sm font-mono-numbers text-muted-foreground">{ch.share} du CA</span>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{ch.target}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{ch.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════ STRATÉGIE ═══════════════════════════════ */}
      <section className="py-20 px-8 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <Badge variant="outline" className="mb-4 text-xs uppercase tracking-wider">Stratégie</Badge>
            <h2 className="text-3xl md:text-4xl font-bold">Nos piliers</h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {pillars.map((pillar, i) => {
              const Icon = pillar.icon;
              return (
                <Card key={i} className="bg-card hover:shadow-lg transition-shadow">
                  <CardContent className="pt-6">
                    <div className="h-12 w-12 rounded-lg bg-destructive/10 flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6 text-destructive" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{pillar.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{pillar.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════ ROADMAP ═══════════════════════════════════ */}
      <section className="py-20 px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <Badge variant="outline" className="mb-4 text-xs uppercase tracking-wider">Roadmap Commerciale</Badge>
            <h2 className="text-3xl md:text-4xl font-bold">Plan de Développement 2026-2028</h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {roadmap.map((phase, i) => (
              <Card key={i} className="relative overflow-hidden border-2 hover:border-destructive/30 transition-colors">
                <div className="absolute top-0 left-0 w-full h-1 bg-destructive" />
                <CardContent className="pt-6">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-3xl font-bold text-destructive font-mono-numbers">{phase.year}</span>
                    <Badge variant="outline" className="text-xs">{phase.phase}</Badge>
                  </div>
                  <ul className="space-y-2.5 mt-4">
                    {phase.items.map((item, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm">
                        <ChevronRight className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
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

      {/* ═══════════════════════════════ CTA ════════════════════════════════ */}
      <section className="py-20 px-8 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
            Prêt à explorer le business plan ?
          </h2>
          <p className="text-white/50 mb-10 max-w-xl mx-auto leading-relaxed">
            Accédez à l'ensemble des projections financières, scénarios et valorisation 
            pour accompagner la levée de fonds de NOVA RIDE.
          </p>
          
          <div className="flex flex-wrap justify-center gap-4">
            <NavLink to="/product">
              <Button size="lg" className="bg-white text-primary hover:bg-white/90 font-semibold">
                <Package className="mr-2 h-5 w-5" />
                Plan Produit
              </Button>
            </NavLink>
            <NavLink to="/previsionnel">
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10">
                <TrendingUp className="mr-2 h-5 w-5" />
                Prévisionnel
              </Button>
            </NavLink>
            <NavLink to="/funding">
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10">
                <Banknote className="mr-2 h-5 w-5" />
                Financement
              </Button>
            </NavLink>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ FOOTER ════════════════════════════════ */}
      <footer className="py-8 px-8 border-t">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <NovarideLogo variant="compact" color="dark" className="text-xl" />
            <span className="text-sm text-muted-foreground">
              © 2025 NOVA RIDE — Innovation française • Auvergne-Rhône-Alpes
            </span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="https://novatoride.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
              novatoride.com
            </a>
            <NavLink to="/investment-summary" className="hover:text-foreground transition-colors">
              Synthèse Investisseur
            </NavLink>
          </div>
        </div>
      </footer>
    </div>
  );
}
