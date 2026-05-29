import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { PieChartIcon } from "lucide-react";

interface DispositionData {
  name: string;
  value: number;
  color: string;
}

const DISPOSITION_COLORS: Record<string, string> = {
  "Interested": "#10b981",
  "Not Interested": "#ef4444",
  "Callback": "#f59e0b",
  "No Answer": "#6b7280",
  "Busy": "#8b5cf6",
  "Wrong Number": "#ec4899",
  "Other": "#3b82f6",
};

export function DispositionChart() {
  const { data: dispositionData, isLoading } = useQuery({
    queryKey: ["disposition-analytics"],
    queryFn: async (): Promise<DispositionData[]> => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("call_logs")
        .select("disposition")
        .gte("created_at", today.toISOString())
        .not("disposition", "is", null);

      if (error) throw error;

      // Count dispositions
      const counts: Record<string, number> = {};
      data?.forEach((call) => {
        if (call.disposition) {
          counts[call.disposition] = (counts[call.disposition] || 0) + 1;
        }
      });

      // Convert to chart data
      return Object.entries(counts).map(([name, value]) => ({
        name,
        value,
        color: DISPOSITION_COLORS[name] || DISPOSITION_COLORS["Other"],
      }));
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5" />
            Disposition Analytics
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  if (!dispositionData || dispositionData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5" />
            Disposition Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={PieChartIcon}
            title="No data yet"
            description="Make some calls to see disposition analytics"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PieChartIcon className="h-5 w-5" />
          Today's Dispositions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={dispositionData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {dispositionData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>

        <div className="mt-4 space-y-2">
          {dispositionData.map((item) => (
            <div key={item.name} className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span>{item.name}</span>
              </div>
              <span className="font-medium">{item.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
