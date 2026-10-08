import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function WorkshopDisclosure({ title, children }: { title: string; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return <section className="border-t border-border py-3">
    <Button variant="ghost" className="gap-2" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} data-readonly-allow="true">
      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}{title}
    </Button>
    {expanded && <div className="pt-3">{children}</div>}
  </section>;
}