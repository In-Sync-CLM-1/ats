import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";

interface Location {
  city: string;
  location: string;
}

interface LocationsInputProps {
  value: Location[];
  onChange: (locations: Location[]) => void;
}

export function LocationsInput({ value = [], onChange }: LocationsInputProps) {
  const addLocation = () => {
    onChange([...value, { city: "", location: "" }]);
  };

  const removeLocation = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updateLocation = (index: number, field: keyof Location, val: string) => {
    const updated = [...value];
    updated[index] = { ...updated[index], [field]: val };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {value.map((loc, index) => (
        <div key={index} className="flex gap-2 items-start">
          <div className="flex-1 grid grid-cols-2 gap-2">
            <Input
              placeholder="City"
              value={loc.city}
              onChange={(e) => updateLocation(index, "city", e.target.value)}
            />
            <Input
              placeholder="Full Location"
              value={loc.location}
              onChange={(e) => updateLocation(index, "location", e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeLocation(index)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addLocation}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Location
      </Button>
    </div>
  );
}
