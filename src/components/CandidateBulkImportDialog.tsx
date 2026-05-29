import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import Papa from "papaparse";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CandidateBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ParsedRecord {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  position_applied_for?: string;
  current_status?: string;
  total_experience_years?: string;
  expected_ctc_lakhs?: string;
  notice_period_days?: string;
  assigned_recruiter?: string;
}

interface ImportResult {
  success: boolean;
  total: number;
  imported: number;
  failed: number;
  failedRecords?: Array<{
    row: number;
    first_name: string;
    email: string;
    error: string;
  }>;
}

export function CandidateBulkImportDialog({ open, onOpenChange, onSuccess }: CandidateBulkImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRecords, setParsedRecords] = useState<ParsedRecord[]>([]);
  const [previewData, setPreviewData] = useState<ParsedRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [batchProgress, setBatchProgress] = useState<{
    currentBatch: number;
    totalBatches: number;
    processedRecords: number;
    totalRecords: number;
  } | null>(null);

  const handleFileUpload = (selectedFile: File) => {
    if (!selectedFile) return;

    setFile(selectedFile);
    setImportResult(null);

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        // Filter out completely empty records
        const validRecords = results.data.filter((row: any) => {
          return Object.values(row).some(val => 
            val !== null && val !== undefined && String(val).trim() !== ''
          );
        });

        // Clean records - only extract expected fields
        const expectedFields = [
          'first_name', 'last_name', 'email', 'phone',
          'position_applied_for', 'current_status',
          'total_experience_years', 'expected_ctc_lakhs',
          'notice_period_days', 'assigned_recruiter'
        ];

        const cleanedRecords = validRecords.map((row: any) => {
          const cleaned: ParsedRecord = {};
          
          expectedFields.forEach(field => {
            if (row[field] !== undefined && row[field] !== null) {
              const value = String(row[field]).trim();
              if (value) {
                cleaned[field as keyof ParsedRecord] = value;
              }
            }
          });
          
          return cleaned;
        });

        // Check max file size
        if (cleanedRecords.length > 5000) {
          toast.error(`File exceeds maximum limit of 5000 records. Found ${cleanedRecords.length} records.`);
          return;
        }

        setParsedRecords(cleanedRecords);
        setPreviewData(cleanedRecords.slice(0, 5));
        
        if (cleanedRecords.length === 0) {
          toast.error("No valid records found in CSV file");
        } else {
          toast.success(`Found ${cleanedRecords.length} valid record(s)`);
        }
      },
      error: (error) => {
        console.error('CSV parsing error:', error);
        toast.error("Failed to parse CSV file");
      }
    });
  };

  const handleImport = async () => {
    if (parsedRecords.length === 0) {
      toast.error("No records to import");
      return;
    }

    setIsProcessing(true);
    setImportResult(null);

    // Split records into batches of 500
    const BATCH_SIZE = 500;
    const batches: ParsedRecord[][] = [];
    for (let i = 0; i < parsedRecords.length; i += BATCH_SIZE) {
      batches.push(parsedRecords.slice(i, i + BATCH_SIZE));
    }

    const totalBatches = batches.length;
    const aggregatedResults: ImportResult = {
      success: true,
      total: parsedRecords.length,
      imported: 0,
      failed: 0,
      failedRecords: []
    };

    try {
      // Process each batch sequentially
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchNumber = batchIndex + 1;

        // Update progress
        setBatchProgress({
          currentBatch: batchNumber,
          totalBatches: totalBatches,
          processedRecords: batchIndex * BATCH_SIZE,
          totalRecords: parsedRecords.length
        });

        toast.info(`Processing batch ${batchNumber} of ${totalBatches}...`);

        // Call edge function with this batch
        const { data, error } = await supabase.functions.invoke('bulk-import-candidates', {
          body: { records: batch }
        });

        if (error) {
          throw new Error(`Batch ${batchNumber} failed: ${error.message}`);
        }

        // Aggregate results
        aggregatedResults.imported += data.imported;
        aggregatedResults.failed += data.failed;
        
        if (data.failedRecords && data.failedRecords.length > 0) {
          // Adjust row numbers to account for batches
          const adjustedFailedRecords = data.failedRecords.map((record: any) => ({
            ...record,
            row: record.row + (batchIndex * BATCH_SIZE)
          }));
          aggregatedResults.failedRecords = [
            ...(aggregatedResults.failedRecords || []),
            ...adjustedFailedRecords
          ];
        }
      }

      // Clear progress and show final results
      setBatchProgress(null);
      setImportResult(aggregatedResults);

      if (aggregatedResults.failed === 0) {
        toast.success(`Successfully imported ${aggregatedResults.imported} candidate(s)`);
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 2000);
      } else {
        toast.warning(
          `Imported ${aggregatedResults.imported} candidate(s), ${aggregatedResults.failed} failed`
        );
      }
    } catch (error) {
      console.error('Import error:', error);
      setBatchProgress(null);
      toast.error(error instanceof Error ? error.message : "Failed to import candidates");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedRecords([]);
    setPreviewData([]);
    setImportResult(null);
    setBatchProgress(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Bulk Import Candidates</DialogTitle>
          <DialogDescription>
            Upload a CSV file with candidate data. Required fields: first_name, email (unique), phone (10 digits)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Upload Section */}
          {!file && (
            <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-4">
              <div className="flex justify-center">
                <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold mb-2">Upload CSV File</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Supported fields: first_name, last_name, email, phone, position_applied_for, 
                  current_status, total_experience_years, expected_ctc_lakhs, notice_period_days, assigned_recruiter
                </p>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0];
                    if (selectedFile) handleFileUpload(selectedFile);
                  }}
                  className="max-w-xs mx-auto"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                <button
                  type="button"
                  onClick={() => {
                    const csvContent = [
                      'first_name,last_name,email,phone,position_applied_for,current_status,total_experience_years,expected_ctc_lakhs,notice_period_days,assigned_recruiter',
                    ].join('\n');

                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);

                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'candidates-import-sample.csv';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    URL.revokeObjectURL(url);
                  }}
                  className="text-primary hover:underline cursor-pointer bg-transparent border-none p-0"
                >
                  Download CSV template
                </button>
              </div>
            </div>
          )}

          {/* Preview Section */}
          {file && parsedRecords.length > 0 && !importResult && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Found <strong>{parsedRecords.length}</strong> valid record(s) in <strong>{file.name}</strong>
                </AlertDescription>
              </Alert>

              {/* Batch Progress Indicator */}
              {batchProgress && (
                <Alert>
                  <Upload className="h-4 w-4 animate-pulse" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <div className="font-semibold">
                        Processing batch {batchProgress.currentBatch} of {batchProgress.totalBatches}
                      </div>
                      <div className="text-sm">
                        {batchProgress.processedRecords} / {batchProgress.totalRecords} records processed
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${(batchProgress.processedRecords / batchProgress.totalRecords) * 100}%` 
                          }}
                        />
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div>
                <h4 className="font-semibold mb-2 text-sm">Preview (first 5 records)</h4>
                <ScrollArea className="h-[300px] rounded-md border">
                  <div className="p-4 space-y-3">
                    {previewData.map((record, idx) => (
                      <div key={idx} className="p-3 bg-muted/50 rounded-md space-y-1">
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-semibold text-muted-foreground min-w-[30px]">
                            #{idx + 1}
                          </span>
                          <div className="flex-1 space-y-1">
                            <div className="font-medium">
                              {record.first_name || '(missing)'} {record.last_name || ''}
                            </div>
                            {record.email && (
                              <div className="text-sm text-muted-foreground">{record.email}</div>
                            )}
                            {record.phone && (
                              <div className="text-sm text-muted-foreground">📞 {record.phone}</div>
                            )}
                            <div className="flex flex-wrap gap-2 text-xs">
                              {record.position_applied_for && (
                                <span className="bg-background px-2 py-0.5 rounded">💼 {record.position_applied_for}</span>
                              )}
                              {record.total_experience_years && (
                                <span className="bg-background px-2 py-0.5 rounded">📅 {record.total_experience_years}y exp</span>
                              )}
                              {record.expected_ctc_lakhs && (
                                <span className="bg-background px-2 py-0.5 rounded">💰 ₹{record.expected_ctc_lakhs}L</span>
                              )}
                              {record.current_status && (
                                <span className="bg-background px-2 py-0.5 rounded">📊 {record.current_status}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {parsedRecords.length > 5 && (
                      <div className="text-center text-sm text-muted-foreground pt-2">
                        ... and {parsedRecords.length - 5} more record(s)
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}

          {/* Import Results Section */}
          {importResult && (
            <div className="space-y-4">
              <Alert variant={importResult.failed === 0 ? "default" : "destructive"}>
                {importResult.failed === 0 ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  <div className="font-semibold mb-1">Import Complete</div>
                  <div className="space-y-1 text-sm">
                    <div>✅ Successfully imported: {importResult.imported} candidate(s)</div>
                    {importResult.failed > 0 && (
                      <div>❌ Failed: {importResult.failed} candidate(s)</div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>

              {importResult.failedRecords && importResult.failedRecords.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 text-sm flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive" />
                    Failed Records
                  </h4>
                  <ScrollArea className="h-[200px] rounded-md border">
                    <div className="p-4 space-y-2">
                      {importResult.failedRecords.map((failed, idx) => (
                        <div key={idx} className="p-3 bg-destructive/10 rounded-md text-sm">
                          <div className="font-medium">
                            Row {failed.row}: {failed.first_name}
                          </div>
                          <div className="text-muted-foreground">{failed.email}</div>
                          <div className="text-destructive mt-1">{failed.error}</div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
            {importResult ? 'Close' : 'Cancel'}
          </Button>
          {!importResult && parsedRecords.length > 0 && (
            <Button onClick={handleImport} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Upload className="mr-2 h-4 w-4 animate-pulse" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import {parsedRecords.length} Record(s)
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
