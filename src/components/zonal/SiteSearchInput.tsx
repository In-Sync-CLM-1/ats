import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Site {
  id: string;
  site_name: string;
  location: string | null;
  client: {
    company_name: string;
  };
}

interface SiteSearchInputProps {
  value: string | null;
  onChange: (siteId: string | null) => void;
  isAdmin?: boolean;
  clientId?: string | null;
  disabled?: boolean;
  placeholder?: string;
}

export function SiteSearchInput({
  value,
  onChange,
  isAdmin = false,
  clientId = null,
  disabled = false,
  placeholder = "Search sites...",
}: SiteSearchInputProps) {
  const [open, setOpen] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchSites = async () => {
      setIsLoading(true);
      setSites([]);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        if (isAdmin) {
          // Admin can see all sites, optionally filtered by client
          let query = supabase
            .from("sites")
            .select(`
              id,
              site_name,
              location,
              client:clients!inner(company_name)
            `)
            .eq("is_active", true)
            .order("site_name")
            .limit(100);

          if (clientId) {
            query = query.eq("client_id", clientId);
          }

          const { data, error } = await query;

          if (error) throw error;
          setSites((data || []).map((s: any) => ({
            id: s.id,
            site_name: s.site_name,
            location: s.location,
            client: { company_name: s.client.company_name },
          })));
        } else {
          // Coordinator can only see sites where they are the coordinator
          let query = supabase
            .from("sites")
            .select(`
              id,
              site_name,
              location,
              client:clients!inner(company_name)
            `)
            .eq("coordinator_id", user.id)
            .eq("is_active", true)
            .order("site_name");

          if (clientId) {
            query = query.eq("client_id", clientId);
          }

          const { data, error } = await query;

          if (error) throw error;
          setSites((data || []).map((s: any) => ({
            id: s.id,
            site_name: s.site_name,
            location: s.location,
            client: { company_name: s.client.company_name },
          })));
        }
      } catch (error) {
        console.error("Error fetching sites:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSites();
  }, [isAdmin, clientId]);

  const selectedSite = sites.find((site) => site.id === value);

  const filteredSites = sites.filter((site) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      site.site_name.toLowerCase().includes(search) ||
      site.client.company_name.toLowerCase().includes(search) ||
      site.location?.toLowerCase().includes(search)
    );
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {selectedSite ? (
            <span className="truncate">
              {selectedSite.site_name} ({selectedSite.client.company_name})
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <div className="flex items-center gap-1 ml-2">
            {value && (
              <X
                className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0">
        <Command>
          <CommandInput
            placeholder="Search sites..."
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Loading..." : "No sites found."}
            </CommandEmpty>
            <CommandGroup>
              {filteredSites.map((site) => (
                <CommandItem
                  key={site.id}
                  value={site.id}
                  onSelect={() => {
                    onChange(site.id === value ? null : site.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === site.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{site.site_name}</span>
                    <span className="text-sm text-muted-foreground">
                      {site.client.company_name}
                      {site.location && ` • ${site.location}`}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
