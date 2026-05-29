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

interface ClientBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ParsedRecord {
  company_name?: string;
  contact_name?: string;
  contact_person_designation?: string;
  industry_sector?: string;
  email_id?: string;
  contact_number?: string;
}

interface ImportResult {
  success: boolean;
  total: number;
  imported: number;
  failed: number;
  failedRecords?: Array<{
    row: number;
    company_name: string;
    email: string;
    error: string;
  }>;
}

export function ClientBulkImportDialog({ open, onOpenChange, onSuccess }: ClientBulkImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRecords, setParsedRecords] = useState<ParsedRecord[]>([]);
  const [previewData, setPreviewData] = useState<ParsedRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

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
          'company_name', 'contact_name', 'contact_person_designation',
          'industry_sector', 'email_id', 'contact_number'
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

    try {
      const { data, error } = await supabase.functions.invoke('bulk-import-clients', {
        body: { records: parsedRecords }
      });

      if (error) throw error;

      setImportResult(data);

      if (data.failed === 0) {
        toast.success(`Successfully imported ${data.imported} client(s)`);
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 2000);
      } else {
        toast.warning(`Imported ${data.imported} client(s), ${data.failed} failed`);
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error("Failed to import clients");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedRecords([]);
    setPreviewData([]);
    setImportResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Bulk Import Clients</DialogTitle>
          <DialogDescription>
            Upload a CSV file with client data. Required fields: company_name (mandatory), email_id (mandatory & unique)
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
                  Supported fields: company_name, contact_name, contact_person_designation, 
                  industry_sector, email_id, contact_number
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
                <a 
                  href="/clients-import-sample.csv" 
                  download 
                  className="text-primary hover:underline"
                >
                  Download sample CSV template
                </a>
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
                            <div className="font-medium">{record.company_name || '(missing)'}</div>
                            {record.email_id && (
                              <div className="text-sm text-muted-foreground">{record.email_id}</div>
                            )}
                            <div className="flex flex-wrap gap-2 text-xs">
                              {record.contact_name && (
                                <span className="bg-background px-2 py-0.5 rounded">👤 {record.contact_name}</span>
                              )}
                              {record.industry_sector && (
                                <span className="bg-background px-2 py-0.5 rounded">🏢 {record.industry_sector}</span>
                              )}
                              {record.contact_number && (
                                <span className="bg-background px-2 py-0.5 rounded">📞 {record.contact_number}</span>
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
                    <div>✅ Successfully imported: {importResult.imported} client(s)</div>
                    {importResult.failed > 0 && (
                      <div>❌ Failed: {importResult.failed} client(s)</div>
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
                            Row {failed.row}: {failed.company_name}
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
