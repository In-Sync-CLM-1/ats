import React, { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText, CheckCircle2, XCircle, AlertCircle, RotateCcw, Loader2, Download, History } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { CsvColumnMapper, DbColumn } from './CsvColumnMapper';

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableName: 'candidates' | 'clients' | 'mandates';
  onSuccess?: () => void;
  dbColumns: DbColumn[];
  templateDownloadUrl?: string;
}

interface ImportSession {
  id: string;
  table_name: string;
  file_name: string;
  status: string;
  total_records: number;
  processed_records: number;
  successful_records: number;
  failed_records: number;
  error_log: Array<{ row: number; error: string; data?: Record<string, unknown> }>;
  can_revert: boolean;
  reverted_at: string | null;
  created_at: string;
  completed_at: string | null;
}

type ImportStep = 'upload' | 'mapping' | 'processing' | 'complete';

const MAX_RECORDS = 500000;

export default function BulkImportDialog({
  open,
  onOpenChange,
  tableName,
  onSuccess,
  dbColumns,
  templateDownloadUrl
}: BulkImportDialogProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importSession, setImportSession] = useState<ImportSession | null>(null);
  const [importHistory, setImportHistory] = useState<ImportSession[]>([]);
  const [activeTab, setActiveTab] = useState<'import' | 'history'>('import');

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setStep('upload');
      setFile(null);
      setCsvHeaders([]);
      setCsvData([]);
      setIsProcessing(false);
      setImportSession(null);
    }
  }, [open]);

  // Fetch import history when dialog opens
  useEffect(() => {
    if (open) {
      fetchImportHistory();
    }
  }, [open, tableName]);

  const fetchImportHistory = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-import-history', {
        body: null,
        headers: { 'Content-Type': 'application/json' }
      });

      if (error) throw error;
      
      // Filter by table name on client side since we're using query params
      const filteredImports = (data?.imports || []).filter(
        (imp: ImportSession) => imp.table_name === tableName
      );
      setImportHistory(filteredImports);
    } catch (error) {
      console.error('Failed to fetch import history:', error);
    }
  };

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    if (!uploadedFile.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    setFile(uploadedFile);

    Papa.parse(uploadedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as Record<string, string>[];
        
        if (data.length === 0) {
          toast.error('CSV file is empty');
          return;
        }

        if (data.length > MAX_RECORDS) {
          toast.error(`Maximum ${MAX_RECORDS.toLocaleString()} records allowed`);
          return;
        }

        const headers = Object.keys(data[0] || {}).filter(h => h.trim());
        setCsvHeaders(headers);
        setCsvData(data);
        setStep('mapping');
      },
      error: (error) => {
        toast.error(`Failed to parse CSV: ${error.message}`);
      }
    });
  }, []);

  const handleMappingConfirmed = async (mappings: Record<string, string>) => {
    setStep('processing');
    setIsProcessing(true);

    try {
      // Transform data based on mappings (mappings is csvColumn -> dbColumn)
      const transformedData = csvData.map(row => {
        const transformed: Record<string, string> = {};
        Object.entries(mappings).forEach(([csvColumn, dbColumn]) => {
          if (dbColumn) {
            transformed[dbColumn] = row[csvColumn] || '';
          }
        });
        return transformed;
      });

      // Create import session
      const { data: sessionData, error: sessionError } = await supabase.functions.invoke('create-import-session', {
        body: {
          tableName,
          fileName: file?.name || 'import.csv',
          totalRecords: transformedData.length
        }
      });

      if (sessionError || !sessionData?.success) {
        throw new Error(sessionData?.error || 'Failed to create import session');
      }

      const importId = sessionData.importId;

      // Process import using hybrid method
      const { data: processData, error: processError } = await supabase.functions.invoke('process-import-hybrid', {
        body: {
          importId,
          records: transformedData,
          tableName
        }
      });

      if (processError || !processData?.success) {
        throw new Error(processData?.error || 'Failed to process import');
      }

      // Fetch final import status
      const { data: historyData } = await supabase.functions.invoke('get-import-history', {
        body: null
      });

      const finalSession = (historyData?.imports || []).find(
        (imp: ImportSession) => imp.id === importId
      );

      if (finalSession) {
        setImportSession(finalSession);
      }

      setStep('complete');
      
      if (processData.result?.inserted > 0) {
        toast.success(`Successfully imported ${processData.result.inserted} records`);
        onSuccess?.();
      }

    } catch (error) {
      console.error('Import error:', error);
      toast.error(error instanceof Error ? error.message : 'Import failed');
      setStep('upload');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!importSession) return;

    try {
      const { data, error } = await supabase.functions.invoke('cancel-import', {
        body: { importId: importSession.id }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Failed to cancel import');
      }

      toast.success('Import cancelled');
      setStep('upload');
      setImportSession(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to cancel');
    }
  };

  const handleRevert = async (importId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('revert-import', {
        body: { importId }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Failed to revert import');
      }

      toast.success(`Reverted ${data.deletedCount} records`);
      fetchImportHistory();
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to revert');
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      onOpenChange(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      pending: { variant: 'secondary', label: 'Pending' },
      processing: { variant: 'default', label: 'Processing' },
      completed: { variant: 'default', label: 'Completed' },
      partial: { variant: 'outline', label: 'Partial' },
      failed: { variant: 'destructive', label: 'Failed' },
      cancelled: { variant: 'secondary', label: 'Cancelled' }
    };
    const config = variants[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Import {tableName.charAt(0).toUpperCase() + tableName.slice(1)}</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple records at once
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'import' | 'history')} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="import">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="import" className="flex-1 overflow-auto">
            {step === 'upload' && (
              <div className="space-y-4 p-4">
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload a CSV file with up to {MAX_RECORDS.toLocaleString()} records
                  </p>
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="max-w-xs mx-auto"
                  />
                </div>

                {templateDownloadUrl && (
                  <div className="flex justify-center">
                    <Button variant="outline" size="sm" asChild>
                      <a href={templateDownloadUrl} download>
                        <Download className="h-4 w-4 mr-2" />
                        Download Template
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            )}

            {step === 'mapping' && (
              <div className="p-4">
                <CsvColumnMapper
                  csvHeaders={csvHeaders}
                  csvData={csvData}
                  dbColumns={dbColumns}
                  onMappingConfirmed={handleMappingConfirmed}
                  onCancel={() => setStep('upload')}
                />
              </div>
            )}

            {step === 'processing' && (
              <div className="space-y-6 p-8 text-center">
                <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
                <div>
                  <h3 className="font-semibold mb-2">Processing Import</h3>
                  <p className="text-sm text-muted-foreground">
                    Importing {csvData.length.toLocaleString()} records...
                  </p>
                </div>
                <Progress value={50} className="w-full max-w-md mx-auto" />
              </div>
            )}

            {step === 'complete' && importSession && (
              <div className="space-y-6 p-4">
                <div className="text-center">
                  {importSession.failed_records === 0 ? (
                    <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  ) : importSession.successful_records > 0 ? (
                    <AlertCircle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
                  ) : (
                    <XCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
                  )}
                  <h3 className="font-semibold text-lg mb-2">Import Complete</h3>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{importSession.successful_records}</p>
                    <p className="text-sm text-muted-foreground">Imported</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold text-red-600">{importSession.failed_records}</p>
                    <p className="text-sm text-muted-foreground">Failed</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{importSession.total_records}</p>
                    <p className="text-sm text-muted-foreground">Total</p>
                  </div>
                </div>

                {importSession.error_log && importSession.error_log.length > 0 && (
                  <div className="border rounded-lg">
                    <div className="p-3 border-b bg-muted/50">
                      <h4 className="font-medium">Failed Records</h4>
                    </div>
                    <ScrollArea className="h-48">
                      <div className="p-3 space-y-2">
                        {importSession.error_log.slice(0, 50).map((err, idx) => (
                          <div key={idx} className="text-sm p-2 bg-destructive/10 rounded">
                            <span className="font-medium">Row {err.row}:</span> {err.error}
                          </div>
                        ))}
                        {importSession.error_log.length > 50 && (
                          <p className="text-sm text-muted-foreground text-center">
                            And {importSession.error_log.length - 50} more errors...
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  {importSession.can_revert && !importSession.reverted_at && importSession.successful_records > 0 && (
                    <Button variant="outline" onClick={() => handleRevert(importSession.id)}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Revert Import
                    </Button>
                  )}
                  <Button onClick={handleClose}>Close</Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="flex-1 overflow-auto">
            <ScrollArea className="h-[400px]">
              <div className="space-y-3 p-4">
                {importHistory.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No import history found
                  </p>
                ) : (
                  importHistory.map((imp) => (
                    <div key={imp.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{imp.file_name}</span>
                        </div>
                        {getStatusBadge(imp.status)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <span className="text-green-600">{imp.successful_records} imported</span>
                        {imp.failed_records > 0 && (
                          <span className="text-red-600 ml-2">{imp.failed_records} failed</span>
                        )}
                        <span className="ml-2">• {new Date(imp.created_at).toLocaleDateString()}</span>
                      </div>
                      {imp.can_revert && !imp.reverted_at && imp.successful_records > 0 && 
                       ['completed', 'partial'].includes(imp.status) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRevert(imp.id)}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Revert
                        </Button>
                      )}
                      {imp.reverted_at && (
                        <Badge variant="secondary">Reverted</Badge>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
