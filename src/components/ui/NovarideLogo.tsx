import { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { usePageImages } from '@/hooks/usePageImages';
import { supabase } from '@/integrations/supabase/client';
import { Camera, Loader2, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

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
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Fichier invalide', description: 'Veuillez sélectionner une image.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `global/logo-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('page-images').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('page-images').getPublicUrl(path);
      await supabase.from('page_images' as any).upsert(
        { page_key: 'global', slot_key: 'logo', image_url: publicUrl, updated_at: new Date().toISOString(), updated_by: (await supabase.auth.getUser()).data.user?.id } as any,
        { onConflict: 'page_key,slot_key' }
      );
      setImage('logo', publicUrl);
      toast({ title: 'Logo mis à jour' });
    } catch (err) {
      console.error('Upload error:', err);
      toast({ title: 'Erreur', description: "Impossible d'uploader le logo.", variant: 'destructive' });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const imgSize = variant === 'full' ? 'h-10 max-w-[180px]' : 'h-7 max-w-[120px]';

  return (
    <div className={cn('flex items-center gap-2 group relative', className)}>
      {logoUrl ? (
        <img src={logoUrl} alt="Logo" className={cn('object-contain', imgSize)} />
      ) : (
        <span className={cn('font-bold tracking-tight', variant === 'full' ? 'text-2xl' : 'text-lg', textColor)}>
          NOVA<span className="text-accent">RIDE</span>
        </span>
      )}

      {canEdit && (
        <>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="absolute -right-1 -top-1 z-20 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            title="Changer le logo"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          </button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        </>
      )}
    </div>
  );
}
