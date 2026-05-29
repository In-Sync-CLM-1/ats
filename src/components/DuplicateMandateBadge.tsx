import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Copy } from "lucide-react";
import { Link } from "react-router-dom";

interface OtherMandate {
  id: string;
  job_title: string;
  match_score: number;
}

interface DuplicateMandateBadgeProps {
  otherMandates: OtherMandate[];
}

export function DuplicateMandateBadge({ otherMandates }: DuplicateMandateBadgeProps) {
  if (!otherMandates || otherMandates.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge variant="outline" className="cursor-pointer hover:bg-accent">
          <Copy className="w-3 h-3 mr-1" />
          Matched to {otherMandates.length} other mandate{otherMandates.length > 1 ? 's' : ''}
        </Badge>
      </PopoverTrigger>

      <PopoverContent className="w-80">
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Other Mandates</h4>
          <div className="space-y-1.5">
            {otherMandates.map((m) => (
              <div key={m.id} className="flex justify-between items-center text-sm p-2 rounded hover:bg-muted">
                <Link
                  to={`/mandates/view/${m.id}`}
                  className="hover:underline flex-1 truncate"
                >
                  {m.job_title}
                </Link>
                <Badge variant="secondary" className="ml-2 flex-shrink-0">
                  {m.match_score}%
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
