import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { EChart, viz, vizAxisLabel, vizSplitLine, vizTooltip } from "@/components/charts/EChart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { Phone, Users, Calendar, Award, TrendingUp } from "lucide-react";

interface RecruiterStats {
  recruiter_id: string;
  recruiter_name: string;
  total_calls: number;
  connected_calls: number;
  interviews_arranged: number;
  offers_made: number;
  candidates_hired: number;
  connection_rate: number;
  interview_rate: number;
}

interface DailyActivity {
  date: string;
  calls: number;
}

interface StageData {
  stage: string;
  count: number;
}

interface RecruiterOption {
  id: string;
  name: string;
}

export default function RecruiterPerformance() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [selectedRecruiter, setSelectedRecruiter] = useState<string>("all");
  const [recruiters, setRecruiters] = useState<RecruiterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [recruiterStats, setRecruiterStats] = useState<RecruiterStats[]>([]);
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([]);
  const [stageData, setStageData] = useState<StageData[]>([]);
  
  const [totalKPIs, setTotalKPIs] = useState({
    totalCalls: 0,
    connectedCalls: 0,
    interviewsArranged: 0,
    offersMade: 0,
    candidatesHired: 0,
    connectionRate: 0,
  });

  // Generate last 12 months for dropdown
  const getMonthOptions = () => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      months.push({
        value: format(date, "yyyy-MM"),
        label: format(date, "MMMM yyyy"),
      });
    }
    return months;
  };

  useEffect(() => {
    fetchRecruiters();
  }, []);

  useEffect(() => {
    fetchRecruiterPerformance();
  }, [selectedMonth, selectedRecruiter]);

  const fetchRecruiters = async () => {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .order("full_name");
    
    if (profiles) {
      setRecruiters(profiles.map(p => ({ id: p.id, name: p.full_name || "Unknown" })));
    }
  };

  const fetchRecruiterPerformance = async () => {
    try {
      setLoading(true);
      const [year, month] = selectedMonth.split("-");
      const startDate = startOfMonth(new Date(parseInt(year), parseInt(month) - 1));
      const endDate = endOfMonth(startDate);

      // Fetch all recruiters from profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name");

      if (!profiles) return;

      // Fetch call logs for the month (with optional recruiter filter)
      let callLogsQuery = supabase
        .from("call_logs")
        .select("initiated_by, conversation_duration, created_at")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());
      
      if (selectedRecruiter !== "all") {
        callLogsQuery = callLogsQuery.eq("initiated_by", selectedRecruiter);
      }
      
      const { data: callLogs } = await callLogsQuery;

      // Fetch candidates data for interview/offer/hired metrics (with optional recruiter filter)
      let candidatesQuery = supabase
        .from("candidates")
        .select("assigned_recruiter, interview_stage, current_status, updated_at")
        .gte("updated_at", startDate.toISOString())
        .lte("updated_at", endDate.toISOString());
      
      if (selectedRecruiter !== "all") {
        candidatesQuery = candidatesQuery.eq("assigned_recruiter", selectedRecruiter);
      }
      
      const { data: candidates } = await candidatesQuery;

      // Process recruiter stats
      const statsMap = new Map<string, RecruiterStats>();
      
      profiles.forEach((profile) => {
        statsMap.set(profile.id, {
          recruiter_id: profile.id,
          recruiter_name: profile.full_name || "Unknown",
          total_calls: 0,
          connected_calls: 0,
          interviews_arranged: 0,
          offers_made: 0,
          candidates_hired: 0,
          connection_rate: 0,
          interview_rate: 0,
        });
      });

      // Count calls
      callLogs?.forEach((log) => {
        if (log.initiated_by && statsMap.has(log.initiated_by)) {
          const stats = statsMap.get(log.initiated_by)!;
          stats.total_calls++;
          if (log.conversation_duration && log.conversation_duration > 0) {
            stats.connected_calls++;
          }
        }
      });

      // Count interviews, offers, hires
      candidates?.forEach((candidate) => {
        if (candidate.assigned_recruiter && statsMap.has(candidate.assigned_recruiter)) {
          const stats = statsMap.get(candidate.assigned_recruiter)!;
          
          // Interview stages
          if (candidate.interview_stage && 
              (candidate.interview_stage.toLowerCase().includes("interview") ||
               candidate.interview_stage.toLowerCase().includes("screening"))) {
            stats.interviews_arranged++;
          }
          
          // Offer stages
          if (candidate.interview_stage &&
              (candidate.interview_stage.toLowerCase().includes("offer") ||
               candidate.interview_stage.toLowerCase().includes("selected"))) {
            stats.offers_made++;
          }
          
          // Hired
          if (candidate.current_status === "hired" || 
              candidate.interview_stage?.toLowerCase().includes("joined")) {
            stats.candidates_hired++;
          }
        }
      });

      // Calculate rates
      statsMap.forEach((stats) => {
        if (stats.total_calls > 0) {
          stats.connection_rate = (stats.connected_calls / stats.total_calls) * 100;
        }
        if (stats.connected_calls > 0) {
          stats.interview_rate = (stats.interviews_arranged / stats.connected_calls) * 100;
        }
      });

      const statsArray = Array.from(statsMap.values())
        .filter(s => s.total_calls > 0) // Only show recruiters with activity
        .sort((a, b) => b.total_calls - a.total_calls);

      setRecruiterStats(statsArray);

      // Calculate total KPIs
      const totals = statsArray.reduce(
        (acc, curr) => ({
          totalCalls: acc.totalCalls + curr.total_calls,
          connectedCalls: acc.connectedCalls + curr.connected_calls,
          interviewsArranged: acc.interviewsArranged + curr.interviews_arranged,
          offersMade: acc.offersMade + curr.offers_made,
          candidatesHired: acc.candidatesHired + curr.candidates_hired,
          connectionRate: 0,
        }),
        { totalCalls: 0, connectedCalls: 0, interviewsArranged: 0, offersMade: 0, candidatesHired: 0, connectionRate: 0 }
      );
      totals.connectionRate = totals.totalCalls > 0 ? (totals.connectedCalls / totals.totalCalls) * 100 : 0;
      setTotalKPIs(totals);

      // Daily activity data
      const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });
      const dailyCallsMap = new Map<string, number>();
      
      callLogs?.forEach((log) => {
        const dateKey = format(new Date(log.created_at), "yyyy-MM-dd");
        dailyCallsMap.set(dateKey, (dailyCallsMap.get(dateKey) || 0) + 1);
      });

      const dailyData = daysInMonth.map((day) => ({
        date: format(day, "MMM dd"),
        calls: dailyCallsMap.get(format(day, "yyyy-MM-dd")) || 0,
      }));
      setDailyActivity(dailyData);

      // Stage funnel data
      const stageCounts = {
        "Sourcing": candidates?.filter(c => !c.interview_stage || c.current_status === "applied").length || 0,
        "Screening": candidates?.filter(c => c.interview_stage?.toLowerCase().includes("screen")).length || 0,
        "Interview": candidates?.filter(c => c.interview_stage?.toLowerCase().includes("interview")).length || 0,
        "Offer": candidates?.filter(c => c.interview_stage?.toLowerCase().includes("offer")).length || 0,
        "Hired": candidates?.filter(c => c.current_status === "hired").length || 0,
      };

      setStageData(Object.entries(stageCounts).map(([stage, count]) => ({ stage, count })));

    } catch (error) {
      console.error("Error fetching recruiter performance:", error);
    } finally {
      setLoading(false);
    }
  };

  // Recruiter Leaderboard — lollipop (2px stem + dot), one hue, sorted
  const leaderboardOption = useMemo(() => {
    const rows = recruiterStats.slice(0, 10).map((r) => ({ name: r.recruiter_name, value: r.total_calls }))
      .sort((a, b) => a.value - b.value);
    if (!rows.length) return null;
    return {
      grid: { left: 130, right: 48, top: 12, bottom: 30 },
      tooltip: {
        ...vizTooltip,
        trigger: 'item',
        formatter: (p: { name: string; value: number }) => `<b>${p.name}</b><br/>${p.value} calls`,
      },
      xAxis: { type: 'value', axisLabel: vizAxisLabel, splitLine: vizSplitLine },
      yAxis: {
        type: 'category',
        data: rows.map((r) => r.name),
        axisLabel: { ...vizAxisLabel, fontSize: 12 },
        axisLine: { lineStyle: { color: viz.axis } },
        axisTick: { show: false },
      },
      series: [
        { type: 'bar', data: rows.map((r) => r.value), barWidth: 2, itemStyle: { color: viz.blueSoft }, silent: true },
        {
          type: 'scatter',
          data: rows.map((r) => ({ name: r.name, value: r.value })),
          symbolSize: 11,
          itemStyle: { color: viz.blue, borderColor: viz.surface, borderWidth: 2 },
          label: {
            show: true, position: 'right', distance: 6, color: viz.inkSecondary, fontSize: 11,
            formatter: (p: { value: number }) => p.value.toLocaleString(),
          },
        },
      ],
    };
  }, [recruiterStats]);

  // Recruitment Funnel — a real funnel, single-hue ordinal ramp
  const funnelOption = useMemo(() => {
    if (!stageData.length) return null;
    const total = stageData[0]?.count || 1;
    return {
      tooltip: {
        ...vizTooltip,
        trigger: 'item',
        formatter: (p: { name: string; value: number }) =>
          `<b>${p.name}</b><br/>${p.value.toLocaleString()} candidates · ${Math.round((p.value / total) * 100)}%`,
      },
      series: [{
        type: 'funnel',
        sort: 'none',
        left: 10, right: 10, top: 8, bottom: 8,
        minSize: '14%', maxSize: '94%',
        gap: 4,
        itemStyle: { borderColor: viz.surface, borderWidth: 2 },
        label: {
          position: 'inside', fontSize: 12,
          formatter: (p: { name: string; value: number }) => `${p.name}  ·  ${p.value.toLocaleString()}`,
        },
        data: stageData.map((s, i) => ({
          name: s.stage, value: s.count,
          itemStyle: { color: viz.ramp5[Math.min(i, viz.ramp5.length - 1)] },
          label: { color: i < 2 ? viz.ink : '#ffffff' },
        })),
      }],
    };
  }, [stageData]);

  // Daily Activity — line with soft area
  const trendOption = useMemo(() => {
    if (!dailyActivity.length) return null;
    return {
      grid: { left: 44, right: 24, top: 20, bottom: 34 },
      tooltip: {
        ...vizTooltip,
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: viz.axis, width: 1 } },
      },
      xAxis: {
        type: 'category',
        data: dailyActivity.map((d) => d.date),
        axisLabel: vizAxisLabel,
        axisLine: { lineStyle: { color: viz.axis } },
        axisTick: { show: false },
        boundaryGap: false,
      },
      yAxis: { type: 'value', axisLabel: vizAxisLabel, splitLine: vizSplitLine },
      series: [{
        name: 'Calls',
        type: 'line',
        data: dailyActivity.map((d) => d.calls),
        lineStyle: { color: viz.blue, width: 2 },
        itemStyle: { color: viz.blue, borderColor: viz.surface, borderWidth: 2 },
        symbol: 'circle',
        symbolSize: 8,
        areaStyle: { color: viz.blue, opacity: 0.06 },
      }],
    };
  }, [dailyActivity]);

  // Conversion — dumbbell: connection% and interview% per recruiter
  const conversionOption = useMemo(() => {
    const rows = recruiterStats.slice(0, 5);
    if (!rows.length) return null;
    return {
      grid: { left: 130, right: 48, top: 12, bottom: 56 },
      legend: {
        bottom: 0,
        icon: 'circle',
        textStyle: { color: viz.inkSecondary, fontSize: 12 },
        data: ['Connection %', 'Interview %'],
      },
      tooltip: {
        ...vizTooltip,
        trigger: 'item',
        formatter: (p: { seriesName: string; name: string; value: number[] | number }) => {
          const v = Array.isArray(p.value) ? p.value[0] : p.value;
          return `<b>${p.name}</b><br/>${p.seriesName}: ${Math.round(Number(v))}%`;
        },
      },
      xAxis: {
        type: 'value', max: 100,
        axisLabel: { ...vizAxisLabel, formatter: '{value}%' },
        splitLine: vizSplitLine,
      },
      yAxis: {
        type: 'category',
        data: rows.map((r) => r.recruiter_name),
        axisLabel: { ...vizAxisLabel, fontSize: 12 },
        axisLine: { lineStyle: { color: viz.axis } },
        axisTick: { show: false },
      },
      series: [
        {
          type: 'custom',
          silent: true,
          renderItem: (params: { dataIndex: number }, api: { value: (i: number) => number; coord: (v: [number, number]) => [number, number] }) => {
            const [x1, y] = api.coord([api.value(0), params.dataIndex]);
            const [x2] = api.coord([api.value(1), params.dataIndex]);
            return { type: 'line', shape: { x1, y1: y, x2, y2: y }, style: { stroke: viz.axis, lineWidth: 2 } };
          },
          data: rows.map((r) => [r.connection_rate, r.interview_rate]),
          z: 1,
        },
        {
          name: 'Connection %', type: 'scatter',
          data: rows.map((r) => ({ name: r.recruiter_name, value: [r.connection_rate, r.recruiter_name] })),
          symbolSize: 11, itemStyle: { color: viz.blue, borderColor: viz.surface, borderWidth: 2 }, z: 2,
        },
        {
          name: 'Interview %', type: 'scatter',
          data: rows.map((r) => ({ name: r.recruiter_name, value: [r.interview_rate, r.recruiter_name] })),
          symbolSize: 11, itemStyle: { color: viz.orange, borderColor: viz.surface, borderWidth: 2 }, z: 2,
        },
      ],
    };
  }, [recruiterStats]);

  if (loading) {
    return (
      <div className="px-8 py-6">
        <h1 className="text-3xl font-bold mb-2">Recruiter Performance</h1>
        <p className="text-muted-foreground">Loading performance metrics...</p>
      </div>
    );
  }

  return (
    <div className="px-8 py-6 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Recruiter Performance Dashboard</h1>
          <p className="text-muted-foreground">Track calling activities and recruitment metrics</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={selectedRecruiter} onValueChange={setSelectedRecruiter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select recruiter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Recruiters</SelectItem>
              {recruiters.map((recruiter) => (
                <SelectItem key={recruiter.id} value={recruiter.id}>
                  {recruiter.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {getMonthOptions().map((month) => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-sm font-medium">Total Calls Made</CardDescription>
              <div className="bg-blue-100 p-2 rounded-full">
                <Phone className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold text-primary">{totalKPIs.totalCalls.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">calls initiated this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-sm font-medium">Connected Calls</CardDescription>
              <div className="bg-green-100 p-2 rounded-full">
                <Phone className="h-4 w-4 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold text-primary">{totalKPIs.connectedCalls.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {totalKPIs.connectionRate.toFixed(1)}% connection rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-sm font-medium">Interviews Arranged</CardDescription>
              <div className="bg-purple-100 p-2 rounded-full">
                <Calendar className="h-4 w-4 text-purple-600" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold text-primary">{totalKPIs.interviewsArranged.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">candidates in interview</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-sm font-medium">Offers Made</CardDescription>
              <div className="bg-amber-100 p-2 rounded-full">
                <Award className="h-4 w-4 text-amber-600" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold text-primary">{totalKPIs.offersMade.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">offers extended</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-sm font-medium">Candidates Hired</CardDescription>
              <div className="bg-emerald-100 p-2 rounded-full">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold text-primary">{totalKPIs.candidatesHired.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">successfully hired</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recruiter Leaderboard */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Recruiter Leaderboard</CardTitle>
            <CardDescription>Top performers by calls made</CardDescription>
          </CardHeader>
          <CardContent>
            {leaderboardOption ? (
              <EChart option={leaderboardOption} height={300} />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">No data</div>
            )}
          </CardContent>
        </Card>

        {/* Stage Funnel */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Recruitment Funnel</CardTitle>
            <CardDescription>Candidates at each stage</CardDescription>
          </CardHeader>
          <CardContent>
            {funnelOption ? (
              <EChart option={funnelOption} height={300} />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">No data</div>
            )}
          </CardContent>
        </Card>

        {/* Daily Activity Trend */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Daily Activity Trend</CardTitle>
            <CardDescription>Calls per day this month</CardDescription>
          </CardHeader>
          <CardContent>
            {trendOption ? (
              <EChart option={trendOption} height={300} />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">No data</div>
            )}
          </CardContent>
        </Card>

        {/* Conversion Metrics */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Top Performers - Conversion Rates</CardTitle>
            <CardDescription>Interview and connection rates</CardDescription>
          </CardHeader>
          <CardContent>
            {conversionOption ? (
              <EChart option={conversionOption} height={300} />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">No data</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recruiter Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Detailed Recruiter Breakdown</CardTitle>
          <CardDescription>Complete performance metrics for all recruiters</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recruiter</TableHead>
                  <TableHead className="text-right">Calls Made</TableHead>
                  <TableHead className="text-right">Connected</TableHead>
                  <TableHead className="text-right">Connection %</TableHead>
                  <TableHead className="text-right">Interviews</TableHead>
                  <TableHead className="text-right">Offers</TableHead>
                  <TableHead className="text-right">Hired</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recruiterStats.length > 0 ? (
                  recruiterStats.map((stat) => (
                    <TableRow key={stat.recruiter_id}>
                      <TableCell className="font-medium">{stat.recruiter_name}</TableCell>
                      <TableCell className="text-right">{stat.total_calls}</TableCell>
                      <TableCell className="text-right">{stat.connected_calls}</TableCell>
                      <TableCell className="text-right">{stat.connection_rate.toFixed(1)}%</TableCell>
                      <TableCell className="text-right">{stat.interviews_arranged}</TableCell>
                      <TableCell className="text-right">{stat.offers_made}</TableCell>
                      <TableCell className="text-right">{stat.candidates_hired}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No data available
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
