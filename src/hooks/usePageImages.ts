import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function usePageImages(pageKey: string) {
  const [images, setImages] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await supabase
          .from('page_images' as any)
          .select('slot_key, image_url')
          .eq('page_key', pageKey);
        
        if (data) {
          const map: Record<string, string> = {};
          (data as any[]).forEach((row: any) => {
            map[row.slot_key] = row.image_url;
          });
          setImages(map);
        }
      } catch {}
      setLoaded(true);
    };
    fetch();
  }, [pageKey]);

  const setImage = useCallback((slotKey: string, url: string) => {
    setImages(prev => ({ ...prev, [slotKey]: url }));
  }, []);

  return { images, loaded, setImage };
}
