import { useEffect, useState, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';

const STORAGE_PREFIX = 'novaride_';

export interface DataPersistenceOptions<T> {
  key: string;
  defaultValue: T;
  onLoad?: (data: T) => void;
}

export function useDataPersistence<T>(options: DataPersistenceOptions<T>) {
  const { key, defaultValue, onLoad } = options;
  const storageKey = `${STORAGE_PREFIX}${key}`;
  
  const [data, setData] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed;
      }
    } catch (e) {
      console.warn(`Failed to load ${key} from localStorage:`, e);
    }
    return defaultValue;
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Load initial data
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        setData(parsed);
        onLoad?.(parsed);
        setLastSaved(new Date(localStorage.getItem(`${storageKey}_timestamp`) || Date.now()));
      }
    } catch (e) {
      console.warn(`Failed to load ${key} from localStorage:`, e);
    }
  }, [storageKey, key]);

  const save = useCallback(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
      localStorage.setItem(`${storageKey}_timestamp`, new Date().toISOString());
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      toast({
        title: "Données sauvegardées",
        description: "Vos modifications ont été enregistrées avec succès.",
      });
      return true;
    } catch (e) {
      console.error(`Failed to save ${key} to localStorage:`, e);
      toast({
        title: "Erreur de sauvegarde",
        description: "Impossible d'enregistrer vos modifications.",
        variant: "destructive",
      });
      return false;
    }
  }, [storageKey, data, key]);

  const updateData = useCallback((newData: T | ((prev: T) => T)) => {
    setData(prev => {
      const updated = typeof newData === 'function' ? (newData as (prev: T) => T)(prev) : newData;
      setHasUnsavedChanges(true);
      return updated;
    });
  }, []);

  const reset = useCallback((newDefault?: T) => {
    const valueToReset = newDefault ?? defaultValue;
    setData(valueToReset);
    setHasUnsavedChanges(true);
  }, [defaultValue]);

  const clearStorage = useCallback(() => {
    localStorage.removeItem(storageKey);
    localStorage.removeItem(`${storageKey}_timestamp`);
    setData(defaultValue);
    setHasUnsavedChanges(false);
    setLastSaved(null);
  }, [storageKey, defaultValue]);

  return {
    data,
    setData: updateData,
    save,
    reset,
    clearStorage,
    hasUnsavedChanges,
    lastSaved,
  };
}

// Utility to save all financial data at once
export function saveAllFinancialData(data: Record<string, unknown>) {
  try {
    Object.entries(data).forEach(([key, value]) => {
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
      localStorage.setItem(`${STORAGE_PREFIX}${key}_timestamp`, new Date().toISOString());
    });
    return true;
  } catch (e) {
    console.error('Failed to save financial data:', e);
    return false;
  }
}

// Utility to load all financial data at once
export function loadAllFinancialData<T extends Record<string, unknown>>(keys: string[], defaults: T): T {
  const result = { ...defaults };
  keys.forEach(key => {
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      if (stored) {
        (result as Record<string, unknown>)[key] = JSON.parse(stored);
      }
    } catch (e) {
      console.warn(`Failed to load ${key}:`, e);
    }
  });
  return result;
}
