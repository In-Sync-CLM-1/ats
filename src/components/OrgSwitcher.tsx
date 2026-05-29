import { Check, Building2, ChevronDown } from 'lucide-react';
import { useOrg } from '@/contexts/OrgContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function OrgSwitcher() {
  const { currentOrg, orgs, isPlatformAdmin, switchOrg } = useOrg();

  // Platform admins have no org context — nothing to show
  if (isPlatformAdmin) {
    return (
      <Badge variant="secondary" className="gap-1">
        <Building2 className="h-3 w-3" />
        Platform Admin
      </Badge>
    );
  }

  // Single org or no orgs — no dropdown needed
  if (orgs.length <= 1) {
    if (!currentOrg) return null;
    return (
      <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <Building2 className="h-4 w-4" />
        {currentOrg.name}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 px-2">
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="max-w-[140px] truncate">{currentOrg?.name ?? 'Select org'}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {orgs.map((m) => (
          <DropdownMenuItem
            key={m.org_id}
            onSelect={() => switchOrg(m.org_id)}
            className="flex items-center justify-between gap-2"
          >
            <span className="truncate">{m.organization.name}</span>
            {currentOrg?.id === m.org_id && (
              <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
