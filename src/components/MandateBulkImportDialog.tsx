import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Papa from "papaparse";
import { generateMandateTemplate } from "@/lib/csvTemplateGenerator";

interface MandateBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ParsedMandateRecord {
  job_title?: string;
  client_name?: string;
  client_id?: string;
  minimum_qualification?: string;
  job_description?: string;
  job_location?: string;
  min_experience_years?: number;
  max_experience_years?: number;
  min_ctc_lakhs?: number;
  max_ctc_lakhs?: number;
  notice_period_acceptable?: number;
}

interface ImportResult {
  success: boolean;
  total: number;
  imported: number;
  failed: number;
  failedRecords?: Array<{
    row: number;
    job_title: string;
    client_name: string;
    error: string;
  }>;
}

export function MandateBulkImportDialog({ open, onOpenChange, onSuccess }: MandateBulkImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRecords, setParsedRecords] = useState<ParsedMandateRecord[]>([]);
  const [previewData, setPreviewData] = useState<ParsedMandateRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [batchProgress, setBatchProgress] = useState<{
    currentBatch: number;
    totalBatches: number;
    processedRecords: number;
    totalRecords: number;
  } | null>(null);

  const handleFileUpload = async (selectedFile: File) => {
    if (!selectedFile) return;

    setFile(selectedFile);
    setImportResult(null);

    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, company_name');

    if (clientError) {
      toast.error('Failed to load clients');
      return;
    }

    const clientMap = new Map<string, string>();
    clients?.forEach(client => {
      clientMap.set(client.company_name.toLowerCase().trim(), client.id);
    });

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        const validRecords = results.data.filter((row: any, index: number) => {
          if (index === 0) {
            const firstValue = Object.values(row)[0] as string;
            if (firstValue?.includes('Required') || firstValue?.includes('Optional')) {
              return false;
            }
          }
          return Object.values(row).some(val => 
            val !== null && val !== undefined && String(val).trim() !== ''
          );
        });

        const mappedRecords = validRecords.map((row: any) => {
          const record: any = { ...row };
          
          if (record.client_name) {
            const clientId = clientMap.get(record.client_name.toLowerCase().trim());
            if (clientId) {
              record.client_id = clientId;
            }
          }
          
          return record;
        });

        const validated = mappedRecords.filter(record => {
          if (!record.client_id) {
            console.warn(`Client not found: ${record.client_name || '(missing)'}`);
            return false;
          }
          return true;
        });

        setParsedRecords(validated);
        setPreviewData(validated.slice(0, 5));
        
        if (validated.length === 0) {
          toast.error("No valid records found in CSV file");
        } else {
          toast.success(`Found ${validated.length} valid record(s)`);
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

    const BATCH_SIZE = 50;
    const batches: ParsedMandateRecord[][] = [];
    for (let i = 0; i < parsedRecords.length; i += BATCH_SIZE) {
      batches.push(parsedRecords.slice(i, i + BATCH_SIZE));
    }

    const totalBatches = batches.length;
    console.log(`Split ${parsedRecords.length} records into ${totalBatches} batches`);

    const aggregatedResults: ImportResult = {
      success: true,
      total: parsedRecords.length,
      imported: 0,
      failed: 0,
      failedRecords: []
    };

    try {
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchNumber = batchIndex + 1;

        setBatchProgress({
          currentBatch: batchNumber,
          totalBatches: totalBatches,
          processedRecords: batchIndex * BATCH_SIZE,
          totalRecords: parsedRecords.length
        });

        toast.info(`Processing batch ${batchNumber} of ${totalBatches}...`);

        const { data, error } = await supabase.functions.invoke('bulk-import-mandates', {
          body: { records: batch }
        });

        if (error) {
          console.error(`Batch ${batchNumber} failed:`, error);
          toast.error(`Batch ${batchNumber} failed: ${error.message}`);
          
          batch.forEach((record, idx) => {
            aggregatedResults.failed++;
            aggregatedResults.failedRecords?.push({
              row: (batchIndex * BATCH_SIZE) + idx + 3,
              job_title: record.job_title || '(missing)',
              client_name: record.client_name || '(missing)',
              error: `Batch processing failed: ${error.message}`
            });
          });
          
          continue;
        }

        aggregatedResults.imported += data.imported;
        aggregatedResults.failed += data.failed;
        
        if (data.failedRecords && data.failedRecords.length > 0) {
          const adjustedFailedRecords = data.failedRecords.map((record: any) => ({
            ...record,
            row: record.row + (batchIndex * BATCH_SIZE)
          }));
          aggregatedResults.failedRecords = [
            ...(aggregatedResults.failedRecords || []),
            ...adjustedFailedRecords
          ];
        }

        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      setBatchProgress(null);
      setImportResult(aggregatedResults);

      if (aggregatedResults.failed === 0) {
        toast.success(`Successfully imported ${aggregatedResults.imported} mandate(s)`);
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 2000);
      } else {
        toast.warning(
          `Imported ${aggregatedResults.imported} mandate(s), ${aggregatedResults.failed} failed`
        );
      }

    } catch (error) {
      console.error('Import error:', error);
      setBatchProgress(null);
      toast.error(error instanceof Error ? error.message : "Failed to import mandates");
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import Mandates</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple mandates at once
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Download */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={generateMandateTemplate}
              className="flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Download CSV Template
            </Button>
          </div>

          {/* File Upload */}
          {!importResult && (
            <div className="space-y-2">
              <Input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0];
                  if (selectedFile) {
                    handleFileUpload(selectedFile);
                  }
                }}
                disabled={isProcessing}
              />
              {file && (
                <p className="text-sm text-muted-foreground">
                  Selected: {file.name}
                </p>
              )}
            </div>
          )}

          {/* Batch Progress */}
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

          {/* Preview */}
          {previewData.length > 0 && !importResult && !batchProgress && (
            <div className="space-y-2">
              <h3 className="font-semibold">Preview (first 5 records)</h3>
              <div className="border rounded-md overflow-auto max-h-64">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job Title</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Qualification</TableHead>
                      <TableHead>Location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((record, index) => (
                      <TableRow key={index}>
                        <TableCell>{record.job_title}</TableCell>
                        <TableCell>{record.client_name}</TableCell>
                        <TableCell>{record.minimum_qualification}</TableCell>
                        <TableCell>{record.job_location}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {parsedRecords.length > 5 && (
                <p className="text-sm text-muted-foreground">
                  + {parsedRecords.length - 5} more records
                </p>
              )}
            </div>
          )}

          {/* Import Results */}
          {importResult && (
            <div className="space-y-4">
              <Alert variant={importResult.failed === 0 ? "default" : "destructive"}>
                <AlertDescription>
                  <div className="space-y-2">
                    <div className="font-semibold">Import Complete</div>
                    <div className="text-sm">
                      Total: {importResult.total} | Imported: {importResult.imported} | Failed: {importResult.failed}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              {importResult.failedRecords && importResult.failedRecords.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-destructive">Failed Records</h3>
                  <div className="border rounded-md overflow-auto max-h-64">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Row</TableHead>
                          <TableHead>Job Title</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importResult.failedRecords.map((record, index) => (
                          <TableRow key={index}>
                            <TableCell>{record.row}</TableCell>
                            <TableCell>{record.job_title}</TableCell>
                            <TableCell>{record.client_name}</TableCell>
                            <TableCell className="text-destructive">{record.error}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
            <X className="w-4 h-4 mr-2" />
            {importResult ? 'Close' : 'Cancel'}
          </Button>
          {!importResult && parsedRecords.length > 0 && (
            <Button onClick={handleImport} disabled={isProcessing}>
              <Upload className="w-4 h-4 mr-2" />
              {isProcessing ? 'Importing...' : `Import ${parsedRecords.length} Mandate(s)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
