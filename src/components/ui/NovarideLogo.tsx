import { cn } from '@/lib/utils';

interface NovarideLogoProps {
  variant?: 'full' | 'compact';
  color?: 'dark' | 'light';
  className?: string;
}

export function NovarideLogo({ variant = 'full', color = 'dark', className }: NovarideLogoProps) {
  const textColor = color === 'light' ? 'text-white' : 'text-foreground';
  
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className={cn(
        'font-bold tracking-tight',
        variant === 'full' ? 'text-2xl' : 'text-lg',
        textColor
      )}>
        NOVA<span className="text-accent">RIDE</span>
      </span>
    </div>
  );
}
