import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, PhoneCall, Clock, TrendingUp, AlertCircle, Calendar } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface CallStats {
  totalCalls: number;
  connectedCalls: number;
  avgDuration: number;
  connectionRate: number;
  pendingDispositions: number;
  scheduledCallbacks: number;
}

export function CallKPICards() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["call-kpis"],
    queryFn: async (): Promise<CallStats> => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get today's calls
      const { data: todayCalls, error: callsError } = await supabase
        .from("call_logs")
        .select("conversation_duration, disposition")
        .gte("created_at", today.toISOString());

      if (callsError) throw callsError;

      const totalCalls = todayCalls?.length || 0;
      const connectedCalls = todayCalls?.filter(call => 
        call.conversation_duration && call.conversation_duration > 0
      ).length || 0;
      
      const totalDuration = todayCalls?.reduce((sum, call) => 
        sum + (call.conversation_duration || 0), 0
      ) || 0;
      const avgDuration = connectedCalls > 0 ? Math.round(totalDuration / connectedCalls) : 0;
      
      const connectionRate = totalCalls > 0 ? Math.round((connectedCalls / totalCalls) * 100) : 0;
      
      const pendingDispositions = todayCalls?.filter(call => !call.disposition).length || 0;

      // Get scheduled callbacks for today
      const { data: callbacks, error: callbacksError } = await supabase
        .from("candidates")
        .select("id")
        .lte("next_call_date", new Date().toISOString())
        .not("next_call_date", "is", null);

      if (callbacksError) throw callbacksError;
      const scheduledCallbacks = callbacks?.length || 0;

      return {
        totalCalls,
        connectedCalls,
        avgDuration,
        connectionRate,
        pendingDispositions,
        scheduledCallbacks,
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  const kpiCards = [
    {
      title: "Today's Calls",
      value: stats?.totalCalls || 0,
      icon: Phone,
      description: "Total calls made",
      bgColor: "bg-blue-100",
      iconColor: "text-blue-600",
    },
    {
      title: "Connected Calls",
      value: stats?.connectedCalls || 0,
      icon: PhoneCall,
      description: "Calls with conversation",
      bgColor: "bg-green-100",
      iconColor: "text-green-600",
    },
    {
      title: "Avg. Duration",
      value: `${Math.floor((stats?.avgDuration || 0) / 60)}:${String((stats?.avgDuration || 0) % 60).padStart(2, '0')}`,
      icon: Clock,
      description: "Average call time",
      bgColor: "bg-purple-100",
      iconColor: "text-purple-600",
    },
    {
      title: "Connection Rate",
      value: `${stats?.connectionRate || 0}%`,
      icon: TrendingUp,
      description: "Successful connections",
      bgColor: "bg-orange-100",
      iconColor: "text-orange-600",
    },
    {
      title: "Pending Dispositions",
      value: stats?.pendingDispositions || 0,
      icon: AlertCircle,
      description: "Calls without disposition",
      bgColor: "bg-red-100",
      iconColor: "text-red-600",
    },
    {
      title: "Scheduled Callbacks",
      value: stats?.scheduledCallbacks || 0,
      icon: Calendar,
      description: "Due today or overdue",
      bgColor: "bg-indigo-100",
      iconColor: "text-indigo-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {kpiCards.map((kpi) => (
        <Card key={kpi.title}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                {kpi.title}
              </CardTitle>
              <div className={`${kpi.bgColor} p-2 rounded-full`}>
                <kpi.icon className={`h-4 w-4 ${kpi.iconColor}`} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{kpi.value}</div>
            <p className="text-xs text-muted-foreground">
              {kpi.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
