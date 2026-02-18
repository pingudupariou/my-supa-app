import defaultHeroImg from '@/assets/hero-novaride.jpg';
import defaultCcdEvoImg from '@/assets/ccd-evo-banner.jpg';
import defaultEngineeringImg from '@/assets/novaride-engineering.jpg';
import defaultSavoirFaireImg from '@/assets/savoir-faire.jpg';
import defaultPulleyImg from '@/assets/pulley-wheels.jpg';
import defaultActionImg from '@/assets/novaride-action.jpg';
import defaultFullBikeImg from '@/assets/full-bike-ccd.jpg';
import { ExternalLink, Award, Truck, ShieldCheck, HeadphonesIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { EditableImage } from '@/components/ui/EditableImage';
import { usePageImages } from '@/hooks/usePageImages';
import { useAuth } from '@/context/AuthContext';

const PAGE_KEY = 'accueil';

const features = [
  { icon: Award, title: 'Qualité / Prix', desc: 'Optimisation des processus de fabrication pour le meilleur rapport qualité-prix.' },
  { icon: Truck, title: 'Livraison rapide', desc: 'Livraison express à l\'internationale.' },
  { icon: ShieldCheck, title: 'Garantie 4 ans', desc: 'Notre processus de développement permet de garantir nos produits 4 ans.' },
  { icon: HeadphonesIcon, title: 'Support client', desc: 'Nous sommes là pour vous renseigner et vous aider.' },
];

const productSlots = [
  { slotKey: 'product-1', name: 'CCD EVO', desc: 'Chapes de dérailleur carbone céramique', defaultImg: defaultCcdEvoImg },
  { slotKey: 'product-2', name: 'Pulley Wheels EVO', desc: 'Galets de dérailleur céramique', defaultImg: defaultPulleyImg },
  { slotKey: 'product-3', name: 'Savoir-faire', desc: 'Conception et fabrication en France', defaultImg: defaultSavoirFaireImg },
];

const gallerySlots = [
  { slotKey: 'gallery-1', defaultImg: defaultActionImg },
  { slotKey: 'gallery-2', defaultImg: defaultFullBikeImg },
  { slotKey: 'gallery-3', defaultImg: defaultCcdEvoImg },
];

export function AccueilPage() {
  const { images, setImage } = usePageImages(PAGE_KEY);
  const { getTabPermission } = useAuth();
  const canEdit = getTabPermission('home') === 'write';

  return (
    <div className="space-y-10 -mt-6">
      {/* Hero */}
      <div className="relative rounded-xl overflow-hidden h-[340px]">
        <EditableImage
          pageKey={PAGE_KEY}
          slotKey="hero"
          defaultSrc={defaultHeroImg}
          alt="Nova Ride"
          className="absolute inset-0 w-full h-full object-cover"
          canEdit={canEdit}
          customUrl={images['hero']}
          onUploaded={(url) => setImage('hero', url)}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
        <div className="relative z-10 flex flex-col justify-center h-full px-8 md:px-12 max-w-2xl">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Nova Ride</h1>
          <p className="text-white/90 text-lg mb-1">Composants carbone & céramique pour le cyclisme de performance.</p>
          <p className="text-white/70 text-sm mb-5">Conçue pour la performance, pensée pour sublimer votre configuration.</p>
          <a
            href="https://novatoride.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-white text-black font-semibold px-5 py-2.5 rounded-lg hover:bg-white/90 transition w-fit text-sm"
          >
            Visiter novatoride.com
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Produits phares */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Nos produits</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {productSlots.map((p) => (
            <Card key={p.slotKey} className="overflow-hidden group">
              <div className="h-44 overflow-hidden">
                <EditableImage
                  pageKey={PAGE_KEY}
                  slotKey={p.slotKey}
                  defaultSrc={p.defaultImg}
                  alt={p.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  canEdit={canEdit}
                  customUrl={images[p.slotKey]}
                  onUploaded={(url) => setImage(p.slotKey, url)}
                />
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold text-foreground">{p.name}</h3>
                <p className="text-sm text-muted-foreground">{p.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* À propos */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">À propos de Nova Ride</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Nova Ride conçoit et fabrique des composants haute performance pour le cyclisme : chapes de dérailleur en carbone avec roulements céramique (CCD), galets de dérailleur (Pulley Wheels) et boîtiers de pédalier (CBB).
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Basée en France et soutenue par la Région Auvergne-Rhône-Alpes, la marque allie ingénierie de précision et design pour offrir des gains de performance mesurables aux cyclistes exigeants.
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Nos produits équipent des champions du monde, dont Antonio Benito, double champion du monde de Triathlon Longue Distance.
          </p>
        </div>
        <div className="rounded-xl overflow-hidden h-60">
          <EditableImage
            pageKey={PAGE_KEY}
            slotKey="about"
            defaultSrc={defaultEngineeringImg}
            alt="Engineering Nova Ride"
            className="w-full h-full object-cover"
            canEdit={canEdit}
            customUrl={images['about']}
            onUploaded={(url) => setImage('about', url)}
          />
        </div>
      </section>

      {/* Galerie */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {gallerySlots.map((slot) => (
          <div key={slot.slotKey} className="rounded-lg overflow-hidden h-40">
            <EditableImage
              pageKey={PAGE_KEY}
              slotKey={slot.slotKey}
              defaultSrc={slot.defaultImg}
              alt={`Nova Ride ${slot.slotKey}`}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              canEdit={canEdit}
              customUrl={images[slot.slotKey]}
              onUploaded={(url) => setImage(slot.slotKey, url)}
            />
          </div>
        ))}
      </section>

      {/* Valeurs */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Pourquoi Nova Ride</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <Card key={f.title} className="text-center p-5">
                <Icon className="h-8 w-8 mx-auto mb-3 text-primary" />
                <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
