import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTimeTrackingData } from '@/hooks/useTimeTrackingData';
import { TimeEntryManager } from '@/components/timetracking/TimeEntryManager';
import { CategoryManager } from '@/components/timetracking/CategoryManager';
import { Loader2 } from 'lucide-react';

export function TimeTrackingPage() {
  const data = useTimeTrackingData();

  if (data.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Suivi d'activité</h1>
        <p className="text-sm text-muted-foreground">Enregistrez votre temps par jour et par tâche</p>
      </div>

      <Tabs defaultValue="entries" className="space-y-4">
        <TabsList>
          <TabsTrigger value="entries">📋 Mes entrées</TabsTrigger>
          {data.canManageCategories && (
            <TabsTrigger value="categories">🏷️ Catégories</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="entries">
          <TimeEntryManager
            entries={data.entries}
            categories={data.categories}
            onCreateEntry={data.createEntry}
            onUpdateEntry={data.updateEntry}
            onDeleteEntry={data.deleteEntry}
          />
        </TabsContent>

        {data.canManageCategories && (
          <TabsContent value="categories">
            <CategoryManager
              categories={data.categories}
              onCreateCategory={data.createCategory}
              onUpdateCategory={data.updateCategory}
              onDeleteCategory={data.deleteCategory}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
