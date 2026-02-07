import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';

interface SaveButtonProps {
  onSave: () => void;
  hasUnsavedChanges?: boolean;
  lastSaved?: Date | null;
}

export function SaveButton({ onSave, hasUnsavedChanges }: SaveButtonProps) {
  return (
    <Button
      variant={hasUnsavedChanges ? 'default' : 'outline'}
      size="sm"
      onClick={onSave}
      className={hasUnsavedChanges ? 'animate-pulse-subtle' : ''}
    >
      <Save className="h-4 w-4 mr-1" />
      {hasUnsavedChanges ? 'Sauvegarder' : 'Sauvegardé'}
    </Button>
  );
}
