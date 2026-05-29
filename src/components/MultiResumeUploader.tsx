import React, { useState, useCallback } from 'react';
import { Upload, FileText, Loader2, CheckCircle, X, Star, StarOff, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

export interface ParsedResumeData {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  phone_secondary?: string;
  current_company?: string;
  designation?: string;
  total_experience_years?: number;
  current_ctc_lakhs?: number;
  expected_ctc_lakhs?: number;
  notice_period_days?: number;
  key_skills?: string;
  highest_qualification?: string;
  languages?: string;
  current_location?: string;
  preferred_location?: string;
  linkedin_url?: string;
  position_applied_for?: string;
}

interface FileWithStatus {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'parsing' | 'done' | 'error';
  progress: number;
  uploadedUrl?: string;
  parsedData?: ParsedResumeData;
  isPrimary: boolean;
  error?: string;
}

interface MultiResumeUploaderProps {
  onPrimaryParsed: (data: ParsedResumeData, resumeUrl: string) => void;
  onAllUploaded?: (resumes: { url: string; fileName: string; parsedData?: ParsedResumeData; isPrimary: boolean }[]) => void;
  existingResumeUrl?: string;
  candidateId?: string;
}

export function MultiResumeUploader({ onPrimaryParsed, onAllUploaded, existingResumeUrl, candidateId }: MultiResumeUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileWithStatus[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const acceptedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ];

  const validateFile = (file: File): boolean => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
    
    if (!acceptedTypes.includes(file.type) && !validExtensions.includes(extension || '')) {
      toast.error(`Invalid file type: ${file.name}. Please upload PDF, Word document, or image.`);
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(`File too large: ${file.name}. Maximum size is 10MB.`);
      return false;
    }
    return true;
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    addFiles(selectedFiles);
    e.target.value = ''; // Reset input
  };

  const addFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(validateFile);
    const hasExistingFiles = files.length > 0;
    
    const fileItems: FileWithStatus[] = validFiles.map((file, index) => ({
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      file,
      status: 'pending',
      progress: 0,
      isPrimary: !hasExistingFiles && index === 0, // First file is primary if no existing files
    }));
    
    setFiles(prev => [...prev, ...fileItems]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const filtered = prev.filter(f => f.id !== id);
      // If removed file was primary and there are other files, make first one primary
      if (prev.find(f => f.id === id)?.isPrimary && filtered.length > 0) {
        filtered[0].isPrimary = true;
      }
      return filtered;
    });
  };

  const togglePrimary = (id: string) => {
    setFiles(prev => prev.map(f => ({
      ...f,
      isPrimary: f.id === id
    })));
  };

  const uploadAndParseAll = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    const results: { url: string; fileName: string; parsedData?: ParsedResumeData; isPrimary: boolean }[] = [];
    let primaryData: { data: ParsedResumeData; url: string } | null = null;

    for (const fileItem of files) {
      if (fileItem.status === 'done') {
        results.push({
          url: fileItem.uploadedUrl!,
          fileName: fileItem.file.name,
          parsedData: fileItem.parsedData,
          isPrimary: fileItem.isPrimary
        });
        continue;
      }

      try {
        // Update status to uploading
        setFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { ...f, status: 'uploading', progress: 20 } : f
        ));

        // Generate unique filename
        const fileExt = fileItem.file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        // Upload to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(fileName, fileItem.file);

        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('resumes')
          .getPublicUrl(fileName);

        const resumeUrl = urlData.publicUrl;

        setFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { ...f, uploadedUrl: resumeUrl, progress: 50, status: 'parsing' } : f
        ));

        // Parse the resume
        const { data: parseData, error: parseError } = await supabase.functions.invoke('parse-resume', {
          body: { fileUrl: resumeUrl }
        });

        if (parseError) {
          throw new Error(parseError.message);
        }

        const parsedData = parseData?.success && parseData?.data ? parseData.data : undefined;

        setFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { 
            ...f, 
            status: 'done', 
            progress: 100, 
            parsedData 
          } : f
        ));

        results.push({
          url: resumeUrl,
          fileName: fileItem.file.name,
          parsedData,
          isPrimary: fileItem.isPrimary
        });

        // If this is the primary file, save its data
        if (fileItem.isPrimary && parsedData) {
          primaryData = { data: parsedData, url: resumeUrl };
        }

      } catch (error) {
        console.error('Error processing file:', fileItem.file.name, error);
        setFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { 
            ...f, 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Processing failed' 
          } : f
        ));
      }
    }

    setIsProcessing(false);

    // Call callbacks
    if (primaryData) {
      onPrimaryParsed(primaryData.data, primaryData.url);
    }

    if (onAllUploaded && results.length > 0) {
      onAllUploaded(results);
    }

    const successCount = results.length;
    const errorCount = files.length - successCount;
    
    if (successCount > 0) {
      toast.success(`${successCount} resume(s) processed successfully${errorCount > 0 ? `, ${errorCount} failed` : ''}`);
    } else if (errorCount > 0) {
      toast.error(`Failed to process ${errorCount} resume(s)`);
    }
  };

  const pendingFiles = files.filter(f => f.status === 'pending');
  const hasFilesToProcess = pendingFiles.length > 0;

  return (
    <Card className="p-4 mb-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Resume Upload (AI Auto-Fill)
          </h3>
          {existingResumeUrl && files.length === 0 && (
            <a 
              href={existingResumeUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              View existing resume
            </a>
          )}
        </div>

        {/* Drag & Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
            isDragging 
              ? "border-primary bg-primary/5" 
              : "border-muted-foreground/25 hover:border-primary/50"
          )}
          onClick={() => document.getElementById('multi-resume-input')?.click()}
        >
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Drag & drop <span className="text-primary font-medium">multiple resumes</span> or <span className="text-primary">browse</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, Word, or Images (max 10MB each)
          </p>
          <input
            id="multi-resume-input"
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic,.heif"
            onChange={handleFileSelect}
            className="hidden"
            multiple
          />
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{files.length} file(s) selected</span>
              {!isProcessing && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setFiles([])}
                  className="text-xs h-7"
                >
                  Clear All
                </Button>
              )}
            </div>
            
            {files.map((fileItem) => (
              <div 
                key={fileItem.id} 
                className={cn(
                  "flex items-center justify-between bg-muted/50 rounded-lg p-3",
                  fileItem.isPrimary && "ring-1 ring-primary/50 bg-primary/5"
                )}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText className={cn(
                    "h-5 w-5 shrink-0",
                    fileItem.status === 'done' ? "text-green-600" :
                    fileItem.status === 'error' ? "text-destructive" :
                    "text-primary"
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{fileItem.file.name}</p>
                      {fileItem.isPrimary && (
                        <Badge variant="secondary" className="text-xs py-0 shrink-0">Primary</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        {(fileItem.file.size / 1024).toFixed(1)} KB
                      </p>
                      {fileItem.status === 'uploading' && (
                        <span className="text-xs text-muted-foreground">Uploading...</span>
                      )}
                      {fileItem.status === 'parsing' && (
                        <span className="text-xs text-primary">Parsing with AI...</span>
                      )}
                      {fileItem.status === 'done' && (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" /> Done
                        </span>
                      )}
                      {fileItem.status === 'error' && (
                        <span className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {fileItem.error}
                        </span>
                      )}
                    </div>
                    {(fileItem.status === 'uploading' || fileItem.status === 'parsing') && (
                      <Progress value={fileItem.progress} className="h-1 mt-1" />
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {fileItem.status === 'pending' && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => togglePrimary(fileItem.id)}
                        className="h-8 w-8"
                        title={fileItem.isPrimary ? "Primary resume (used for auto-fill)" : "Set as primary"}
                      >
                        {fileItem.isPrimary ? (
                          <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                        ) : (
                          <StarOff className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(fileItem.id)}
                        className="h-8 w-8"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {fileItem.status === 'done' && fileItem.uploadedUrl && (
                    <a 
                      href={fileItem.uploadedUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      View
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload Button */}
        {files.length > 0 && hasFilesToProcess && (
          <Button 
            onClick={uploadAndParseAll} 
            disabled={isProcessing}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Upload & Parse {pendingFiles.length} Resume{pendingFiles.length > 1 ? 's' : ''}
              </>
            )}
          </Button>
        )}

        <p className="text-xs text-muted-foreground text-center">
          ⭐ Mark one resume as primary for auto-filling the form
        </p>
      </div>
    </Card>
  );
}
