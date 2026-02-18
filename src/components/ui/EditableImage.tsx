import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface EditableImageProps {
  pageKey: string;
  slotKey: string;
  defaultSrc: string;
  alt: string;
  className?: string;
  overlayClassName?: string;
  canEdit: boolean;
  customUrl?: string | null;
  onUploaded?: (url: string) => void;
}

export function EditableImage({
  pageKey,
  slotKey,
  defaultSrc,
  alt,
  className = '',
  overlayClassName = '',
  canEdit,
  customUrl,
  onUploaded,
}: EditableImageProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const src = customUrl || defaultSrc;

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
      const path = `${pageKey}/${slotKey}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('page-images')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('page-images')
        .getPublicUrl(path);

      // Save to page_images table
      await supabase.from('page_images' as any).upsert(
        {
          page_key: pageKey,
          slot_key: slotKey,
          image_url: publicUrl,
          updated_at: new Date().toISOString(),
          updated_by: (await supabase.auth.getUser()).data.user?.id,
        } as any,
        { onConflict: 'page_key,slot_key' }
      );

      onUploaded?.(publicUrl);
      toast({ title: 'Image mise à jour' });
    } catch (err) {
      console.error('Upload error:', err);
      toast({ title: 'Erreur', description: "Impossible d'uploader l'image.", variant: 'destructive' });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="relative group">
      <img src={src} alt={alt} className={className} />
      {overlayClassName && <div className={overlayClassName} />}
      {canEdit && (
        <>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="absolute top-2 right-2 z-20 bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            title="Changer l'image"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
        </>
      )}
    </div>
  );
}
