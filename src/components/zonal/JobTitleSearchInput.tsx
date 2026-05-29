import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface JobTitleSearchInputProps {
  value: string | null;
  onChange: (jobTitle: string | null) => void;
  placeholder?: string;
  allowCustom?: boolean;
}

export function JobTitleSearchInput({
  value,
  onChange,
  placeholder = "Search job titles...",
  allowCustom = false,
}: JobTitleSearchInputProps) {
  const [open, setOpen] = useState(false);
  const [jobTitles, setJobTitles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchJobTitles = async () => {
      setIsLoading(true);
      try {
        // Get unique job titles from mandates
        const { data: mandateData, error: mandateError } = await supabase
          .from("mandates")
          .select("job_title")
          .limit(500);

        if (mandateError) throw mandateError;

        // Get unique job titles from headcount agreements
        const { data: agreementData, error: agreementError } = await supabase
          .from("site_headcount_agreements")
          .select("job_title")
          .limit(500);

        if (agreementError) throw agreementError;

        // Combine and deduplicate
        const allTitles = [
          ...(mandateData || []).map((m) => m.job_title),
          ...(agreementData || []).map((a) => a.job_title),
        ];

        const uniqueTitles = [...new Set(allTitles)].filter(Boolean).sort();
        setJobTitles(uniqueTitles);
      } catch (error) {
        console.error("Error fetching job titles:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchJobTitles();
  }, []);

  const filteredTitles = jobTitles.filter((title) => {
    if (!searchTerm) return true;
    return title.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const showCustomOption =
    allowCustom &&
    searchTerm &&
    !filteredTitles.some(
      (title) => title.toLowerCase() === searchTerm.toLowerCase()
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value ? (
            <span className="truncate">{value}</span>
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
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput
            placeholder="Search job titles..."
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Loading..." : "No job titles found."}
            </CommandEmpty>
            <CommandGroup>
              {showCustomOption && (
                <CommandItem
                  value={searchTerm}
                  onSelect={() => {
                    onChange(searchTerm);
                    setOpen(false);
                    setSearchTerm("");
                  }}
                >
                  <Check className="mr-2 h-4 w-4 opacity-0" />
                  <span>
                    Create "<strong>{searchTerm}</strong>"
                  </span>
                </CommandItem>
              )}
              {filteredTitles.map((title) => (
                <CommandItem
                  key={title}
                  value={title}
                  onSelect={() => {
                    onChange(title === value ? null : title);
                    setOpen(false);
                    setSearchTerm("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === title ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {title}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
