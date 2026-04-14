import { cn } from '@/lib/utils';
import { EditableImage } from './EditableImage';
import { usePageImages } from '@/hooks/usePageImages';

interface NovarideLogoProps {
  variant?: 'full' | 'compact';
  color?: 'dark' | 'light';
  className?: string;
  canEdit?: boolean;
}

export function NovarideLogo({ variant = 'full', color = 'dark', className, canEdit = false }: NovarideLogoProps) {
  const textColor = color === 'light' ? 'text-white' : 'text-foreground';
  const { images, setImage } = usePageImages('global');
  const logoUrl = images['logo'];

  if (logoUrl) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {canEdit ? (
          <EditableImage
            pageKey="global"
            slotKey="logo"
            defaultSrc={logoUrl}
            alt="Logo"
            className={cn(
              'object-contain',
              variant === 'full' ? 'h-10 max-w-[180px]' : 'h-7 max-w-[120px]'
            )}
            canEdit={canEdit}
            customUrl={logoUrl}
            onUploaded={(url) => setImage('logo', url)}
          />
        ) : (
          <img
            src={logoUrl}
            alt="Logo"
            className={cn(
              'object-contain',
              variant === 'full' ? 'h-10 max-w-[180px]' : 'h-7 max-w-[120px]'
            )}
          />
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2 relative', className)}>
      {canEdit && (
        <EditableImage
          pageKey="global"
          slotKey="logo"
          defaultSrc=""
          alt="Ajouter un logo"
          className={cn(
            'object-contain opacity-0 absolute inset-0',
            variant === 'full' ? 'h-10' : 'h-7'
          )}
          overlayClassName="relative rounded-md"
          canEdit={canEdit}
          onUploaded={(url) => setImage('logo', url)}
        />
      )}
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
