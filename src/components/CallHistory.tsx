import { Fragment, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Phone, PlayCircle, Search, FileText, Plus, Edit2, BrainCircuit, Loader2, Bot, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CallDispositionDialog } from "./CallDispositionDialog";

interface CallHistoryProps {
  candidateId?: string;
  limit?: number;
  showFilters?: boolean;
}

interface CallLog {
  id: string;
  call_sid: string;
  demandcom_id: string | null;
  initiated_by: string | null;
  from_number: string;
  to_number: string;
  status: string;
  call_method: string | null;
  conversation_duration: number;
  recording_url: string | null;
  transcript: string | null;
  analysis_json: Record<string, any> | null;
  analysis_quality_score: number | null;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  disposition: string | null;
  subdisposition: string | null;
  notes: string | null;
  disposition_set_by: string | null;
  disposition_set_at: string | null;
  candidate?: {
    first_name: string;
    last_name: string;
    phone: string;
  };
  initiated_by_profile?: {
    full_name: string;
    email: string;
  };
}

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'completed':
      return 'default';
    case 'no-answer':
    case 'busy':
      return 'secondary';
    case 'failed':
    case 'canceled':
      return 'destructive';
    case 'initiated':
    case 'ringing':
    case 'in-progress':
      return 'outline';
    default:
      return 'outline';
  }
};

const formatDuration = (seconds: number) => {
  if (seconds === 0) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export function CallHistory({ candidateId, limit = 50, showFilters = true }: CallHistoryProps) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dispositionDialogOpen, setDispositionDialogOpen] = useState(false);
  const [selectedCallLog, setSelectedCallLog] = useState<CallLog | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null);
  const [userToggled, setUserToggled] = useState(false);

  const toggleAnalysis = (id: string) => {
    setUserToggled(true);
    setExpandedAnalysis(expandedAnalysis === id ? null : id);
  };

  const { data: callLogs, isLoading, refetch } = useQuery({
    queryKey: ['call-logs', candidateId, statusFilter, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('call_logs')
        .select(`
          *,
          candidate:candidates!demandcom_id (
            first_name,
            last_name,
            phone
          ),
          initiated_by_profile:profiles!call_logs_initiated_by_fkey (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (candidateId) {
        query = query.eq('demandcom_id', candidateId);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (searchQuery) {
        query = query.or(`to_number.ilike.%${searchQuery}%,from_number.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching call logs:', error);
        throw error;
      }

      return data as CallLog[];
    },
  });

  const analyzeRecording = async (callLogId: string) => {
    setAnalyzingId(callLogId);
    try {
      const resp = await supabase.functions.invoke("analyze-call-recording", {
        body: { call_log_id: callLogId },
      });
      if (resp.error) throw resp.error;
      if (resp.data?.error) throw new Error(resp.data.error);
      await refetch();
      setExpandedAnalysis(callLogId);
      toast.success("Call analysis complete");
    } catch (err: any) {
      toast.error(err.message || "Analysis failed");
    } finally {
      setAnalyzingId(null);
    }
  };

  // On a candidate's timeline, surface the newest AI-analyzed call open by
  // default — the latest summary is what a recruiter opens this tab for.
  useEffect(() => {
    if (!candidateId || userToggled || expandedAnalysis || !callLogs?.length) return;
    const newest = callLogs.find((l) => l.analysis_json);
    if (newest) setExpandedAnalysis(newest.id);
  }, [candidateId, userToggled, expandedAnalysis, callLogs]);

  // Real-time subscription for call logs
  useEffect(() => {
    const channel = supabase
      .channel('call-logs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_logs',
          ...(candidateId && { filter: `demandcom_id=eq.${candidateId}` }),
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [candidateId, refetch]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading call history...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showFilters && (
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by phone number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="no-answer">No Answer</SelectItem>
              <SelectItem value="busy">Busy</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="initiated">Initiated</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {!callLogs || callLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 border rounded-lg">
          <Phone className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No call history yet</p>
          <p className="text-sm text-muted-foreground">Call logs will appear here once you make calls</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                {!candidateId && <TableHead>Contact</TableHead>}
                <TableHead>Phone Number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Disposition</TableHead>
                <TableHead>Initiated By</TableHead>
                <TableHead>Recording / AI</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {callLogs.map((log) => (
                <Fragment key={log.id}>
                <TableRow>
                  <TableCell className="whitespace-nowrap">
                    {log.created_at && format(new Date(log.created_at), 'dd MMM yyyy, HH:mm')}
                  </TableCell>
                  {!candidateId && (
                    <TableCell className="whitespace-nowrap">
                      {log.candidate ? `${log.candidate.first_name} ${log.candidate.last_name}` : '-'}
                    </TableCell>
                  )}
                  <TableCell className="font-mono text-sm">{log.to_number}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={getStatusColor(log.status)}>
                        {log.status.replace('-', ' ')}
                      </Badge>
                      {log.call_method === 'bolna' && (
                        <Badge variant="outline" className="gap-1 text-purple-700 border-purple-300">
                          <Bot className="h-3 w-3" />
                          AI Agent
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{formatDuration(log.conversation_duration)}</TableCell>
                  <TableCell>
                    {log.disposition ? (
                      <div className="space-y-1">
                        <Badge variant="default">{log.disposition}</Badge>
                        {log.subdisposition && (
                          <div className="text-xs text-muted-foreground">{log.subdisposition}</div>
                        )}
                        {log.notes && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 px-2">
                                <FileText className="h-3 w-3" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80">
                              <div className="space-y-2">
                                <h4 className="font-medium text-sm">Notes</h4>
                                <p className="text-sm text-muted-foreground">{log.notes}</p>
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {log.initiated_by_profile?.full_name || log.initiated_by_profile?.email || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        {log.recording_url ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(log.recording_url!, '_blank')}
                            title="Play recording"
                          >
                            <PlayCircle className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                        {(log.recording_url || log.transcript) && !log.analysis_json && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={analyzingId === log.id}
                            onClick={() => analyzeRecording(log.id)}
                            title="Analyse with AI"
                          >
                            {analyzingId === log.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <BrainCircuit className="h-4 w-4 text-purple-500" />
                            }
                          </Button>
                        )}
                        {log.analysis_json && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-green-700 border-green-300 hover:bg-green-50"
                            onClick={() => toggleAnalysis(log.id)}
                          >
                            <BrainCircuit className="h-4 w-4" />
                            AI Summary
                            {expandedAnalysis === log.id
                              ? <ChevronUp className="h-3 w-3" />
                              : <ChevronDown className="h-3 w-3" />}
                          </Button>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {log.disposition ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedCallLog(log);
                          setDispositionDialogOpen(true);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedCallLog(log);
                          setDispositionDialogOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
                {expandedAnalysis === log.id && log.analysis_json && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={candidateId ? 8 : 9} className="bg-muted/40 p-4">
                      <div className={`grid gap-4 ${log.transcript ? 'md:grid-cols-2' : ''}`}>
                        {log.transcript && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              Transcript
                            </h4>
                            <div className="text-sm text-muted-foreground whitespace-pre-line max-h-64 overflow-y-auto rounded border bg-background p-3 leading-relaxed">
                              {log.transcript}
                            </div>
                          </div>
                        )}
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold flex items-center gap-2">
                            <BrainCircuit className="h-4 w-4 text-purple-600" />
                            AI Analysis
                            {log.analysis_quality_score != null && (
                              <Badge variant="outline" className="ml-auto text-green-700 border-green-300">
                                Quality {log.analysis_quality_score}/100
                              </Badge>
                            )}
                          </h4>
                          {log.analysis_json.summary && (
                            <p className="text-sm">{log.analysis_json.summary}</p>
                          )}
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {log.analysis_json.interest_level && (
                              <div className="rounded border bg-background p-2">
                                <p className="text-xs text-muted-foreground">Interest Level</p>
                                <p className="font-medium capitalize">{log.analysis_json.interest_level}</p>
                              </div>
                            )}
                            {log.analysis_json.expected_ctc && (
                              <div className="rounded border bg-background p-2">
                                <p className="text-xs text-muted-foreground">Expected CTC</p>
                                <p className="font-medium">₹{(log.analysis_json.expected_ctc / 100000).toFixed(0)}L</p>
                              </div>
                            )}
                            {log.analysis_json.notice_period_days != null && (
                              <div className="rounded border bg-background p-2">
                                <p className="text-xs text-muted-foreground">Notice Period</p>
                                <p className="font-medium">{log.analysis_json.notice_period_days} days</p>
                              </div>
                            )}
                            {log.analysis_json.joining_date && (
                              <div className="rounded border bg-background p-2">
                                <p className="text-xs text-muted-foreground">Joining Date</p>
                                <p className="font-medium">{log.analysis_json.joining_date}</p>
                              </div>
                            )}
                          </div>
                          {log.analysis_json.next_step && (
                            <p className="text-sm border-l-2 border-purple-300 pl-3">
                              <span className="font-medium">Next step:</span> {log.analysis_json.next_step}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {selectedCallLog && (
        <CallDispositionDialog
          open={dispositionDialogOpen}
          onOpenChange={setDispositionDialogOpen}
          callLogId={selectedCallLog.id}
          existingDisposition={{
            disposition: selectedCallLog.disposition,
            subdisposition: selectedCallLog.subdisposition,
            notes: selectedCallLog.notes,
          }}
        />
      )}
    </div>
  );
}