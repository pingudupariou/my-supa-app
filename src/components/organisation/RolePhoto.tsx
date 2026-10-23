import { cn } from '@/lib/utils';
import { UserRound } from 'lucide-react';

/** Crops an image to a centered square and returns a compact JPEG data URL (kept with the role, so saves, tab versions and PDF exports include it). */
export async function fileToAvatarDataUrl(file: File, size = 192): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Veuillez choisir une image (JPG, PNG, WebP…).');
  if (file.size > 15 * 1024 * 1024) throw new Error('Image trop lourde (15 Mo maximum).');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image illisible.'));
      el.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Traitement de l’image impossible.');
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function initials(text?: string) {
  return (text || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
}

interface RolePhotoProps {
  photo?: string;
  name?: string;
  className?: string;
  muted?: boolean;
}

export function RolePhoto({ photo, name, className, muted }: RolePhotoProps) {
  const label = initials(name);
  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-full border-2 bg-muted flex items-center justify-center',
        muted ? 'border-dashed border-muted-foreground/40' : 'border-primary/40',
        className,
      )}
    >
      {photo ? (
        <img src={photo} alt={name || 'Photo'} className="h-full w-full object-cover" />
      ) : label ? (
        <span className="text-sm font-semibold text-muted-foreground">{label}</span>
      ) : (
        <UserRound className="h-1/2 w-1/2 text-muted-foreground" />
      )}
    </div>
  );
}
