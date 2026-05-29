import React, { useState, useCallback } from 'react';
import { Upload, FileText, Loader2, CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ParsedResumeData {
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

interface ResumeUploaderProps {
  onDataParsed: (data: ParsedResumeData, resumeUrl: string) => void;
  existingResumeUrl?: string;
}

export function ResumeUploader({ onDataParsed, existingResumeUrl }: ResumeUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(existingResumeUrl || null);

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
    // Also check by extension for HEIC files that may have wrong MIME type
    const extension = file.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
    
    if (!acceptedTypes.includes(file.type) && !validExtensions.includes(extension || '')) {
      toast.error('Invalid file type. Please upload a PDF, Word document, or image (JPEG, PNG, WebP, HEIC).');
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 10MB.');
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
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && validateFile(droppedFile)) {
      setFile(droppedFile);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && validateFile(selectedFile)) {
      setFile(selectedFile);
    }
  };

  const uploadAndParse = async () => {
    if (!file) return;

    try {
      setUploading(true);
      
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(fileName, file);

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('resumes')
        .getPublicUrl(fileName);

      const resumeUrl = urlData.publicUrl;
      setUploadedUrl(resumeUrl);
      setUploading(false);

      // Now parse the resume
      setParsing(true);
      toast.info('Parsing resume with AI...');

      const { data: parseData, error: parseError } = await supabase.functions.invoke('parse-resume', {
        body: { fileUrl: resumeUrl }
      });

      if (parseError) {
        throw new Error(parseError.message);
      }

      if (parseData?.error) {
        throw new Error(parseData.error);
      }

      if (parseData?.success && parseData?.data) {
        toast.success('Resume parsed successfully!');
        onDataParsed(parseData.data, resumeUrl);
      } else {
        throw new Error('Failed to extract data from resume');
      }

    } catch (error) {
      console.error('Error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process resume');
    } finally {
      setUploading(false);
      setParsing(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setUploadedUrl(null);
  };

  const isProcessing = uploading || parsing;

  return (
    <Card className="p-4 mb-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Resume Upload (AI Auto-Fill)
          </h3>
          {uploadedUrl && !file && (
            <a 
              href={uploadedUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              View uploaded resume
            </a>
          )}
        </div>

        {!file ? (
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
            onClick={() => document.getElementById('resume-input')?.click()}
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Drag & drop a resume or <span className="text-primary">browse</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, Word, or Image (max 10MB)
            </p>
            <input
              id="resume-input"
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic,.heif"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        ) : (
          <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium truncate max-w-[200px]">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isProcessing && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearFile}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}

        {file && (
          <Button 
            onClick={uploadAndParse} 
            disabled={isProcessing}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : parsing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Parsing with AI...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Upload & Parse Resume
              </>
            )}
          </Button>
        )}

        {uploadedUrl && !file && (
          <p className="text-xs text-muted-foreground text-center">
            Resume already uploaded. Upload a new file to re-parse.
          </p>
        )}
      </div>
    </Card>
  );
}
