import { cn } from '@/lib/utils';

interface HeroBannerProps {
  image?: string;
  title: string;
  subtitle?: string;
  height?: 'sm' | 'md' | 'lg';
}

export function HeroBanner({ title, subtitle, height = 'sm' }: HeroBannerProps) {
  const heightClass = {
    sm: 'h-24',
    md: 'h-40',
    lg: 'h-56',
  }[height];

  return (
    <div className={cn(
      'relative rounded-lg overflow-hidden bg-gradient-to-r from-sidebar to-sidebar/80',
      heightClass
    )}>
      <div className="relative h-full flex flex-col justify-center px-6">
        <h1 className="text-white text-xl md:text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-white/70 text-sm mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}
