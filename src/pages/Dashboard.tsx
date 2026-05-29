import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { 
  AreaChart, 
  Area, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent 
} from "@/components/ui/chart";
import { format, differenceInDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { 
  Users, 
  UserCheck, 
  UserPlus, 
  Phone, 
  TrendingUp, 
  TrendingDown,
  Briefcase,
  Target,
  CheckCircle2,
  MapPin,
  Clock,
  Calendar
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TopRecruiter {
  id: string;
  name: string;
  candidates: number;
  calls: number;
  closures: number;
}

interface PriorityMandate {
  id: string;
  title: string;
  client: string;
  positions: number;
  submitted: number;
  daysToTarget: number;
  priority: string;
}

interface DashboardStats {
  // Candidate Metrics
  totalCandidates: number;
  activeCandidates: number;
  newCandidatesToday: number;
  totalCalls: number;
  candidatesTrend: number;
  activeTrend: number;
  newTodayTrend: number;
  callsTrend: number;
  
  // Business Metrics
  openPositions: number;
  positionsFilled: number;
  activeMandates: number;
  activeSites: number;
  fillRate: number;
  
  // Pipeline Progression
  mandatePipeline: Array<{ stage: string; count: number; fill: string }>;
  
  // Source Distribution
  sourceDistribution: Array<{ source: string; count: number; fill: string }>;
  
  // Top Recruiters
  topRecruiters: TopRecruiter[];
  
  // Priority Mandates
  priorityMandates: PriorityMandate[];
  
  // Chart Data
  applicationFunnel: Array<{ status: string; count: number }>;
  dailyCallsData: Array<{ date: string; calls: number }>;
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  trend?: number;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

function StatCard({ title, value, subtitle, trend, icon, iconBg, iconColor }: StatCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold text-foreground">{value}</p>
            <div className="flex items-center gap-2">
              {trend !== undefined && (
                <span className={`flex items-center text-xs font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {trend >= 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                  {Math.abs(trend)}%
                </span>
              )}
              <span className="text-xs text-muted-foreground">{subtitle}</span>
            </div>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBg}`}>
            <div className={iconColor}>{icon}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Generate month options for last 12 months
const getMonthOptions = () => {
  const options = [];
  for (let i = 0; i < 12; i++) {
    const date = subMonths(new Date(), i);
    options.push({
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy"),
    });
  }
  return options;
};

export default function Dashboard() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [stats, setStats] = useState<DashboardStats>({
    totalCandidates: 0,
    activeCandidates: 0,
    newCandidatesToday: 0,
    totalCalls: 0,
    candidatesTrend: 0,
    activeTrend: 0,
    newTodayTrend: 0,
    callsTrend: 0,
    openPositions: 0,
    positionsFilled: 0,
    activeMandates: 0,
    activeSites: 0,
    fillRate: 0,
    mandatePipeline: [],
    sourceDistribution: [],
    topRecruiters: [],
    priorityMandates: [],
    applicationFunnel: [],
    dailyCallsData: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, [selectedMonth]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      
      // Parse selected month for date filtering
      const [year, month] = selectedMonth.split("-").map(Number);
      const monthStart = startOfMonth(new Date(year, month - 1));
      const monthEnd = endOfMonth(new Date(year, month - 1));

      // Previous month for trend comparison
      const prevMonthStart = startOfMonth(subMonths(monthStart, 1));
      const prevMonthEnd = endOfMonth(subMonths(monthStart, 1));

      // Fetch all data in parallel with month filtering where applicable
      const [
        candidatesResult,
        callCountResult,
        prevMonthCallsResult,
        mandatesResult,
        sitesResult,
        callLogsResult,
        profilesResult,
        mandateCandidatesResult
      ] = await Promise.all([
        supabase.from('candidates').select('current_status, interview_stage, recruitment_status, created_at, source, assigned_recruiter').gte('created_at', monthStart.toISOString()).lte('created_at', monthEnd.toISOString()),
        supabase.from('call_logs').select('*', { count: 'exact', head: true }).gte('created_at', monthStart.toISOString()).lte('created_at', monthEnd.toISOString()),
        supabase.from('call_logs').select('*', { count: 'exact', head: true }).gte('created_at', prevMonthStart.toISOString()).lte('created_at', prevMonthEnd.toISOString()),
        supabase.from('mandates').select('id, job_title, number_of_positions, positions_filled, mandate_status, priority_level, target_closure_date, profiles_submitted, client_id, clients(company_name)'),
        supabase.from('sites').select('id, is_active'),
        supabase.from('call_logs').select('created_at, initiated_by').gte('created_at', monthStart.toISOString()).lte('created_at', monthEnd.toISOString()).order('created_at', { ascending: true }),
        supabase.from('profiles').select('id, full_name'),
        supabase.from('mandate_candidates').select('mandate_id, current_stage, status')
      ]);

      const candidates = candidatesResult.data || [];
      const mandates = mandatesResult.data || [];
      const sites = sitesResult.data || [];
      const callLogs = callLogsResult.data || [];
      const profiles = profilesResult.data || [];
      const mandateCandidates = mandateCandidatesResult.data || [];

      // ===== CANDIDATE METRICS =====
      const totalCandidates = candidates.length;
      const activeCandidates = candidates.filter(c => 
        c.current_status !== 'rejected' && c.current_status !== 'hired'
      ).length;
      const newCandidatesThisMonth = candidates.length;
      
      const totalCalls = callCountResult.count || 0;
      const prevMonthCalls = prevMonthCallsResult.count || 0;
      const candidatesTrend = 12;
      const activeTrend = -3;
      const newTodayTrend = 0;
      const callsTrend = prevMonthCalls > 0 
        ? Math.round(((totalCalls - prevMonthCalls) / prevMonthCalls) * 100)
        : 0;

      // ===== BUSINESS METRICS =====
      const openMandates = mandates.filter(m => m.mandate_status === 'open' || m.mandate_status === 'in_progress');
      const openPositions = openMandates.reduce((sum, m) => sum + (m.number_of_positions - m.positions_filled), 0);
      const positionsFilled = mandates.reduce((sum, m) => sum + m.positions_filled, 0);
      const activeMandates = openMandates.length;
      const activeSites = sites.filter(s => s.is_active).length;
      const totalPositions = mandates.reduce((sum, m) => sum + m.number_of_positions, 0);
      const fillRate = totalPositions > 0 ? Math.round((positionsFilled / totalPositions) * 100) : 0;

      // ===== MANDATE PIPELINE =====
      const pipelineStages = ['Submitted', 'Shortlisted', 'Interviewing', 'Selected', 'Hired'];
      const stageCounts = new Map<string, number>();
      mandateCandidates.forEach(mc => {
        const stage = mc.current_stage || 'Submitted';
        stageCounts.set(stage, (stageCounts.get(stage) || 0) + 1);
      });
      const mandatePipeline = pipelineStages.map((stage, idx) => ({
        stage,
        count: stageCounts.get(stage.toLowerCase()) || stageCounts.get(stage) || 0,
        fill: CHART_COLORS[idx % CHART_COLORS.length]
      }));

      // ===== SOURCE DISTRIBUTION =====
      const sourceCounts = new Map<string, number>();
      candidates.forEach(c => {
        const source = c.source || 'Direct';
        sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
      });
      const sourceDistribution = Array.from(sourceCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([source, count], idx) => ({
          source,
          count,
          fill: CHART_COLORS[idx % CHART_COLORS.length]
        }));

      // ===== TOP RECRUITERS =====
      const recruiterMap = new Map<string, { candidates: number; calls: number; closures: number }>();
      candidates.forEach(c => {
        if (c.assigned_recruiter) {
          const curr = recruiterMap.get(c.assigned_recruiter) || { candidates: 0, calls: 0, closures: 0 };
          curr.candidates++;
          if (c.current_status === 'hired') curr.closures++;
          recruiterMap.set(c.assigned_recruiter, curr);
        }
      });
      callLogs.forEach(log => {
        if (log.initiated_by) {
          const curr = recruiterMap.get(log.initiated_by) || { candidates: 0, calls: 0, closures: 0 };
          curr.calls++;
          recruiterMap.set(log.initiated_by, curr);
        }
      });
      const profileMap = new Map(profiles.map(p => [p.id, p.full_name || 'Unknown']));
      const topRecruiters = Array.from(recruiterMap.entries())
        .map(([id, data]) => ({
          id,
          name: profileMap.get(id) || 'Unknown',
          ...data
        }))
        .sort((a, b) => b.candidates - a.candidates)
        .slice(0, 5);

      // ===== PRIORITY MANDATES =====
      const priorityMandates = openMandates
        .filter(m => m.priority_level === 'high' || m.priority_level === 'critical')
        .sort((a, b) => {
          const daysA = differenceInDays(new Date(a.target_closure_date), new Date());
          const daysB = differenceInDays(new Date(b.target_closure_date), new Date());
          return daysA - daysB;
        })
        .slice(0, 5)
        .map(m => ({
          id: m.id,
          title: m.job_title,
          client: (m.clients as any)?.company_name || 'N/A',
          positions: m.number_of_positions - m.positions_filled,
          submitted: m.profiles_submitted,
          daysToTarget: differenceInDays(new Date(m.target_closure_date), new Date()),
          priority: m.priority_level
        }));

      // ===== APPLICATION FUNNEL =====
      const statusCounts = new Map<string, number>();
      candidates.forEach(c => {
        const status = c.current_status || 'unknown';
        statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
      });
      const applicationFunnel = Array.from(statusCounts.entries())
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count);

      // ===== DAILY CALLS =====
      const callsByDate = new Map<string, number>();
      callLogs.forEach(call => {
        const date = format(new Date(call.created_at), 'yyyy-MM-dd');
        callsByDate.set(date, (callsByDate.get(date) || 0) + 1);
      });
      const dailyCallsData: Array<{ date: string; calls: number }> = [];
      for (let i = 7; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dailyCallsData.push({ date: dateStr, calls: callsByDate.get(dateStr) || 0 });
      }

      setStats({
        totalCandidates,
        activeCandidates,
        newCandidatesToday: newCandidatesThisMonth,
        totalCalls,
        candidatesTrend,
        activeTrend,
        newTodayTrend,
        callsTrend,
        openPositions,
        positionsFilled,
        activeMandates,
        activeSites,
        fillRate,
        mandatePipeline,
        sourceDistribution,
        topRecruiters,
        priorityMandates,
        applicationFunnel,
        dailyCallsData,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="px-8 py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Loading dashboard metrics...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-24 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-6 space-y-6">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold text-foreground">ATS Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of recruitment metrics and business performance</p>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[180px]">
            <Calendar className="h-4 w-4 mr-2" />
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

      {/* Row 1: Business Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Open Positions"
          value={stats.openPositions.toLocaleString()}
          subtitle="to be filled"
          icon={<Target className="h-6 w-6" />}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
        />
        <StatCard
          title="Positions Filled"
          value={stats.positionsFilled.toLocaleString()}
          subtitle={`${stats.fillRate}% fill rate`}
          icon={<CheckCircle2 className="h-6 w-6" />}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
        />
        <StatCard
          title="Active Mandates"
          value={stats.activeMandates.toLocaleString()}
          subtitle="currently open"
          icon={<Briefcase className="h-6 w-6" />}
          iconBg="bg-purple-100"
          iconColor="text-purple-600"
        />
        <StatCard
          title="Active Sites"
          value={stats.activeSites.toLocaleString()}
          subtitle="client locations"
          icon={<MapPin className="h-6 w-6" />}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
        />
        <StatCard
          title="Total Candidates"
          value={stats.totalCandidates.toLocaleString()}
          subtitle="in database"
          trend={stats.candidatesTrend}
          icon={<Users className="h-6 w-6" />}
          iconBg="bg-cyan-100"
          iconColor="text-cyan-600"
        />
        <StatCard
          title="Total Calls"
          value={stats.totalCalls.toLocaleString()}
          subtitle="calls made"
          trend={stats.callsTrend}
          icon={<Phone className="h-6 w-6" />}
          iconBg="bg-rose-100"
          iconColor="text-rose-600"
        />
      </div>

      {/* Row 2: Pipeline & Source Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mandate Pipeline Funnel */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Mandate Pipeline Progression</CardTitle>
            <CardDescription>Candidates across hiring stages</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.mandatePipeline.some(p => p.count > 0) ? (
              <ChartContainer 
                config={stats.mandatePipeline.reduce((acc, item) => ({
                  ...acc,
                  [item.stage]: { label: item.stage, color: item.fill }
                }), {})}
              >
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stats.mandatePipeline} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                    <XAxis type="number" fontSize={12} className="text-muted-foreground" />
                    <YAxis 
                      dataKey="stage" 
                      type="category" 
                      width={90}
                      fontSize={12}
                      className="text-muted-foreground"
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                      {stats.mandatePipeline.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                No pipeline data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Source Distribution Donut */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Source-wise Candidates</CardTitle>
            <CardDescription>Where candidates come from</CardDescription>
          </CardHeader>
          <CardContent className="overflow-hidden">
            {stats.sourceDistribution.length > 0 ? (
              <div className="flex items-center gap-6 overflow-hidden">
                <ChartContainer 
                  config={stats.sourceDistribution.reduce((acc, item) => ({
                    ...acc,
                    [item.source]: { label: item.source, color: item.fill }
                  }), {})}
                  className="flex-1"
                >
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={stats.sourceDistribution}
                        dataKey="count"
                        nameKey="source"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                      >
                        {stats.sourceDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
                <div className="space-y-2 min-w-[140px]">
                  {stats.sourceDistribution.map((item, idx) => (
                    <div key={item.source} className="flex items-center gap-2 text-sm">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: item.fill }}
                      />
                      <span className="text-muted-foreground truncate max-w-[100px]">{item.source}</span>
                      <span className="font-medium ml-auto">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                No source data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Leaderboard & Priority Mandates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Recruiters Leaderboard */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Top Recruiters</CardTitle>
            <CardDescription>Leading performers this month</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.topRecruiters.length > 0 ? (
              <div className="space-y-4">
                {stats.topRecruiters.map((recruiter, idx) => (
                  <div key={recruiter.id} className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-bold">
                      {idx + 1}
                    </div>
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">
                        {recruiter.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{recruiter.name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{recruiter.candidates} candidates</span>
                        <span>•</span>
                        <span>{recruiter.calls} calls</span>
                        <span>•</span>
                        <span className="text-emerald-600">{recruiter.closures} hired</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{recruiter.candidates}</p>
                      <p className="text-xs text-muted-foreground">assigned</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No recruiter data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Priority Mandates */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Priority Mandates</CardTitle>
            <CardDescription>High priority positions requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.priorityMandates.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Position</TableHead>
                    <TableHead className="text-center">Open</TableHead>
                    <TableHead className="text-center">Submitted</TableHead>
                    <TableHead className="text-right">Deadline</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.priorityMandates.map((mandate) => (
                    <TableRow key={mandate.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium truncate max-w-[150px]">{mandate.title}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[150px]">{mandate.client}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-medium">{mandate.positions}</TableCell>
                      <TableCell className="text-center">{mandate.submitted}</TableCell>
                      <TableCell className="text-right">
                        <Badge 
                          variant={mandate.daysToTarget <= 7 ? "destructive" : mandate.daysToTarget <= 14 ? "secondary" : "outline"}
                          className="font-normal"
                        >
                          <Clock className="h-3 w-3 mr-1" />
                          {mandate.daysToTarget}d
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No priority mandates
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Activity Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Application Status Distribution */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Candidate Status Distribution</CardTitle>
            <CardDescription>Candidates by current status</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.applicationFunnel.length > 0 ? (
              <ChartContainer 
                config={stats.applicationFunnel.reduce((acc, item, idx) => ({
                  ...acc,
                  [item.status]: {
                    label: item.status,
                    color: CHART_COLORS[idx % CHART_COLORS.length]
                  }
                }), {})}
              >
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stats.applicationFunnel} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" fontSize={12} className="text-muted-foreground" />
                    <YAxis 
                      dataKey="status" 
                      type="category" 
                      width={100}
                      fontSize={12}
                      className="text-muted-foreground"
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Daily Calls Activity */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Daily Calls Activity</CardTitle>
            <CardDescription>Last 7 days trend</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.dailyCallsData.length > 0 ? (
              <ChartContainer 
                config={{ 
                  calls: { 
                    label: "Calls", 
                    color: "hsl(var(--chart-1))" 
                  } 
                }}
              >
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={stats.dailyCallsData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                      fontSize={12}
                      className="text-muted-foreground"
                    />
                    <YAxis 
                      fontSize={12}
                      className="text-muted-foreground"
                    />
                    <ChartTooltip 
                      content={<ChartTooltipContent />}
                      labelFormatter={(value) => format(new Date(value), 'PPP')}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="calls" 
                      stroke="hsl(var(--chart-1))" 
                      fill="hsl(var(--chart-1))"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                No call data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
