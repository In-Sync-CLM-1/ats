export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bulk_import_history: {
        Row: {
          can_revert: boolean | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string | null
          current_batch: number | null
          error_log: Json | null
          failed_records: number | null
          file_name: string
          id: string
          org_id: string | null
          processed_records: number | null
          reverted_at: string | null
          status: Database["public"]["Enums"]["import_status"]
          successful_records: number | null
          table_name: string
          total_batches: number
          total_records: number
          user_id: string
        }
        Insert: {
          can_revert?: boolean | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_batch?: number | null
          error_log?: Json | null
          failed_records?: number | null
          file_name: string
          id?: string
          org_id?: string | null
          processed_records?: number | null
          reverted_at?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          successful_records?: number | null
          table_name: string
          total_batches: number
          total_records: number
          user_id: string
        }
        Update: {
          can_revert?: boolean | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_batch?: number | null
          error_log?: Json | null
          failed_records?: number | null
          file_name?: string
          id?: string
          org_id?: string | null
          processed_records?: number | null
          reverted_at?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          successful_records?: number | null
          table_name?: string
          total_batches?: number
          total_records?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_import_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_import_records: {
        Row: {
          created_at: string | null
          id: string
          import_id: string
          record_id: string
          row_number: number
          table_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          import_id: string
          record_id: string
          row_number: number
          table_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          import_id?: string
          record_id?: string
          row_number?: number
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_import_records_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "bulk_import_history"
            referencedColumns: ["id"]
          },
        ]
      }
      call_dispositions: {
        Row: {
          created_at: string | null
          disposition: string
          id: string
          is_active: boolean | null
          org_id: string | null
          subdispositions: string[]
        }
        Insert: {
          created_at?: string | null
          disposition: string
          id?: string
          is_active?: boolean | null
          org_id?: string | null
          subdispositions?: string[]
        }
        Update: {
          created_at?: string | null
          disposition?: string
          id?: string
          is_active?: boolean | null
          org_id?: string | null
          subdispositions?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "call_dispositions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_logs: {
        Row: {
          analysis_json: Json | null
          analysis_quality_score: number | null
          bolna_execution_id: string | null
          call_method: string | null
          call_sid: string | null
          conversation_duration: number | null
          created_at: string
          demandcom_id: string | null
          direction: string | null
          disposition: string | null
          disposition_set_at: string | null
          disposition_set_by: string | null
          edited_contact_info: Json | null
          end_time: string | null
          exotel_response: Json | null
          from_number: string
          id: string
          initiated_by: string | null
          notes: string | null
          org_id: string | null
          recording_url: string | null
          start_time: string | null
          status: string
          subdisposition: string | null
          to_number: string
          transcript: string | null
          updated_at: string
        }
        Insert: {
          analysis_json?: Json | null
          analysis_quality_score?: number | null
          bolna_execution_id?: string | null
          call_method?: string | null
          call_sid?: string | null
          conversation_duration?: number | null
          created_at?: string
          demandcom_id?: string | null
          direction?: string | null
          disposition?: string | null
          disposition_set_at?: string | null
          disposition_set_by?: string | null
          edited_contact_info?: Json | null
          end_time?: string | null
          exotel_response?: Json | null
          from_number: string
          id?: string
          initiated_by?: string | null
          notes?: string | null
          org_id?: string | null
          recording_url?: string | null
          start_time?: string | null
          status?: string
          subdisposition?: string | null
          to_number: string
          transcript?: string | null
          updated_at?: string
        }
        Update: {
          analysis_json?: Json | null
          analysis_quality_score?: number | null
          bolna_execution_id?: string | null
          call_method?: string | null
          call_sid?: string | null
          conversation_duration?: number | null
          created_at?: string
          demandcom_id?: string | null
          direction?: string | null
          disposition?: string | null
          disposition_set_at?: string | null
          disposition_set_by?: string | null
          edited_contact_info?: Json | null
          end_time?: string | null
          exotel_response?: Json | null
          from_number?: string
          id?: string
          initiated_by?: string | null
          notes?: string | null
          org_id?: string | null
          recording_url?: string | null
          start_time?: string | null
          status?: string
          subdisposition?: string | null
          to_number?: string
          transcript?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_demandcom_id_fkey"
            columns: ["demandcom_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_disposition_set_by_fkey"
            columns: ["disposition_set_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_ai_scores: {
        Row: {
          breakdown: Json
          candidate_id: string
          category: string
          id: string
          input_hash: string | null
          org_id: string | null
          reasoning: string | null
          score: number
          scored_at: string
        }
        Insert: {
          breakdown?: Json
          candidate_id: string
          category: string
          id?: string
          input_hash?: string | null
          org_id?: string | null
          reasoning?: string | null
          score: number
          scored_at?: string
        }
        Update: {
          breakdown?: Json
          candidate_id?: string
          category?: string
          id?: string
          input_hash?: string | null
          org_id?: string | null
          reasoning?: string | null
          score?: number
          scored_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_ai_scores_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: true
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_ai_scores_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_resumes: {
        Row: {
          candidate_id: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          is_primary: boolean | null
          parsed_at: string | null
          parsed_data: Json | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          candidate_id: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          is_primary?: boolean | null
          parsed_at?: string | null
          parsed_data?: Json | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          candidate_id?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          is_primary?: boolean | null
          parsed_at?: string | null
          parsed_data?: Json | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_resumes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_resumes_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          aadhaar_number_masked: string | null
          aadhaar_verification_ref: string | null
          aadhaar_verified: boolean | null
          aadhaar_verified_address: string | null
          aadhaar_verified_dob: string | null
          aadhaar_verified_gender: string | null
          aadhaar_verified_name: string | null
          aadhar_number: string | null
          address: string | null
          application_date: string
          application_submitted_at: string | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_recruiter: string | null
          city: string | null
          country: string | null
          created_at: string
          created_by: string | null
          current_company: string | null
          current_ctc_lakhs: number | null
          current_location: string | null
          current_status: string
          designation: string | null
          email: string | null
          expected_ctc_lakhs: number | null
          first_name: string
          highest_qualification: string | null
          id: string
          internal_notes: string | null
          interview_dates: Json | null
          interview_feedback: string | null
          interview_stage: string | null
          interviewer_names: string | null
          is_fresh_application: boolean | null
          is_onboarded: boolean
          key_skills: string | null
          kyc_completed_at: string | null
          kyc_provider: string | null
          languages: string | null
          last_call_date: string | null
          last_name: string
          latest_disposition: string | null
          latest_subdisposition: string | null
          linkedin_url: string | null
          location: string | null
          next_call_date: string | null
          notice_period_days: number | null
          org_id: string | null
          pan_aadhaar_linked: string | null
          pan_category: string | null
          pan_number: string | null
          pan_verification_ref: string | null
          pan_verified: boolean | null
          pan_verified_name: string | null
          phone: string | null
          phone_secondary: string | null
          pincode: string | null
          position_applied_for: string
          preferred_location: string | null
          rating: number | null
          recruitment_status: string | null
          rejection_reason: string | null
          resume_url: string | null
          source: string | null
          source_recruiter_id: string | null
          state: string | null
          total_experience_years: number | null
          updated_at: string
        }
        Insert: {
          aadhaar_number_masked?: string | null
          aadhaar_verification_ref?: string | null
          aadhaar_verified?: boolean | null
          aadhaar_verified_address?: string | null
          aadhaar_verified_dob?: string | null
          aadhaar_verified_gender?: string | null
          aadhaar_verified_name?: string | null
          aadhar_number?: string | null
          address?: string | null
          application_date?: string
          application_submitted_at?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_recruiter?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          current_company?: string | null
          current_ctc_lakhs?: number | null
          current_location?: string | null
          current_status?: string
          designation?: string | null
          email?: string | null
          expected_ctc_lakhs?: number | null
          first_name: string
          highest_qualification?: string | null
          id?: string
          internal_notes?: string | null
          interview_dates?: Json | null
          interview_feedback?: string | null
          interview_stage?: string | null
          interviewer_names?: string | null
          is_fresh_application?: boolean | null
          is_onboarded?: boolean
          key_skills?: string | null
          kyc_completed_at?: string | null
          kyc_provider?: string | null
          languages?: string | null
          last_call_date?: string | null
          last_name: string
          latest_disposition?: string | null
          latest_subdisposition?: string | null
          linkedin_url?: string | null
          location?: string | null
          next_call_date?: string | null
          notice_period_days?: number | null
          org_id?: string | null
          pan_aadhaar_linked?: string | null
          pan_category?: string | null
          pan_number?: string | null
          pan_verification_ref?: string | null
          pan_verified?: boolean | null
          pan_verified_name?: string | null
          phone?: string | null
          phone_secondary?: string | null
          pincode?: string | null
          position_applied_for?: string
          preferred_location?: string | null
          rating?: number | null
          recruitment_status?: string | null
          rejection_reason?: string | null
          resume_url?: string | null
          source?: string | null
          source_recruiter_id?: string | null
          state?: string | null
          total_experience_years?: number | null
          updated_at?: string
        }
        Update: {
          aadhaar_number_masked?: string | null
          aadhaar_verification_ref?: string | null
          aadhaar_verified?: boolean | null
          aadhaar_verified_address?: string | null
          aadhaar_verified_dob?: string | null
          aadhaar_verified_gender?: string | null
          aadhaar_verified_name?: string | null
          aadhar_number?: string | null
          address?: string | null
          application_date?: string
          application_submitted_at?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_recruiter?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          current_company?: string | null
          current_ctc_lakhs?: number | null
          current_location?: string | null
          current_status?: string
          designation?: string | null
          email?: string | null
          expected_ctc_lakhs?: number | null
          first_name?: string
          highest_qualification?: string | null
          id?: string
          internal_notes?: string | null
          interview_dates?: Json | null
          interview_feedback?: string | null
          interview_stage?: string | null
          interviewer_names?: string | null
          is_fresh_application?: boolean | null
          is_onboarded?: boolean
          key_skills?: string | null
          kyc_completed_at?: string | null
          kyc_provider?: string | null
          languages?: string | null
          last_call_date?: string | null
          last_name?: string
          latest_disposition?: string | null
          latest_subdisposition?: string | null
          linkedin_url?: string | null
          location?: string | null
          next_call_date?: string | null
          notice_period_days?: number | null
          org_id?: string | null
          pan_aadhaar_linked?: string | null
          pan_category?: string | null
          pan_number?: string | null
          pan_verification_ref?: string | null
          pan_verified?: boolean | null
          pan_verified_name?: string | null
          phone?: string | null
          phone_secondary?: string | null
          pincode?: string | null
          position_applied_for?: string
          preferred_location?: string | null
          rating?: number | null
          recruitment_status?: string | null
          rejection_reason?: string | null
          resume_url?: string | null
          source?: string | null
          source_recruiter_id?: string | null
          state?: string | null
          total_experience_years?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_source_recruiter_id_fkey"
            columns: ["source_recruiter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandcom_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandcom_assigned_to_fkey"
            columns: ["assigned_recruiter"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          account_manager_id: string | null
          average_time_to_hire_days: number | null
          background_verification_details: string | null
          background_verification_required: boolean | null
          billing_cycle: string | null
          branch_locations: Json | null
          client_status: string
          company_name: string
          company_size_employees: number | null
          company_type: string | null
          company_website: string | null
          contact_name: string
          contact_number: string
          contact_person_designation: string
          contract_end_date: string | null
          contract_start_date: string | null
          created_at: string
          created_by: string | null
          credit_limit: number | null
          email_id: string | null
          finance_contact_email: string | null
          finance_contact_name: string | null
          finance_contact_phone: string | null
          gst_number: string | null
          head_office_location: string | null
          hiring_manager_contact: string | null
          hiring_manager_name: string | null
          hr_head_contact: string | null
          hr_head_name: string | null
          id: string
          industry_sector: string
          internal_notes: string | null
          last_interaction_date: string | null
          msa_agreement_status: string | null
          notice_period_accepted_days: number | null
          org_id: string | null
          pan_number: string | null
          payment_terms_days: number | null
          preferred_sourcing_channels: string[] | null
          registration_date: string
          salary_range_max: number | null
          salary_range_min: number | null
          secondary_contact_email: string | null
          secondary_contact_person: string | null
          secondary_contact_phone: string | null
          service_fee_percentage: number | null
          typical_hiring_volume_monthly: number | null
          typical_hiring_volume_yearly: number | null
          updated_at: string
        }
        Insert: {
          account_manager_id?: string | null
          average_time_to_hire_days?: number | null
          background_verification_details?: string | null
          background_verification_required?: boolean | null
          billing_cycle?: string | null
          branch_locations?: Json | null
          client_status?: string
          company_name: string
          company_size_employees?: number | null
          company_type?: string | null
          company_website?: string | null
          contact_name: string
          contact_number: string
          contact_person_designation?: string
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          email_id?: string | null
          finance_contact_email?: string | null
          finance_contact_name?: string | null
          finance_contact_phone?: string | null
          gst_number?: string | null
          head_office_location?: string | null
          hiring_manager_contact?: string | null
          hiring_manager_name?: string | null
          hr_head_contact?: string | null
          hr_head_name?: string | null
          id?: string
          industry_sector?: string
          internal_notes?: string | null
          last_interaction_date?: string | null
          msa_agreement_status?: string | null
          notice_period_accepted_days?: number | null
          org_id?: string | null
          pan_number?: string | null
          payment_terms_days?: number | null
          preferred_sourcing_channels?: string[] | null
          registration_date?: string
          salary_range_max?: number | null
          salary_range_min?: number | null
          secondary_contact_email?: string | null
          secondary_contact_person?: string | null
          secondary_contact_phone?: string | null
          service_fee_percentage?: number | null
          typical_hiring_volume_monthly?: number | null
          typical_hiring_volume_yearly?: number | null
          updated_at?: string
        }
        Update: {
          account_manager_id?: string | null
          average_time_to_hire_days?: number | null
          background_verification_details?: string | null
          background_verification_required?: boolean | null
          billing_cycle?: string | null
          branch_locations?: Json | null
          client_status?: string
          company_name?: string
          company_size_employees?: number | null
          company_type?: string | null
          company_website?: string | null
          contact_name?: string
          contact_number?: string
          contact_person_designation?: string
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          email_id?: string | null
          finance_contact_email?: string | null
          finance_contact_name?: string | null
          finance_contact_phone?: string | null
          gst_number?: string | null
          head_office_location?: string | null
          hiring_manager_contact?: string | null
          hiring_manager_name?: string | null
          hr_head_contact?: string | null
          hr_head_name?: string | null
          id?: string
          industry_sector?: string
          internal_notes?: string | null
          last_interaction_date?: string | null
          msa_agreement_status?: string | null
          notice_period_accepted_days?: number | null
          org_id?: string | null
          pan_number?: string | null
          payment_terms_days?: number | null
          preferred_sourcing_channels?: string[] | null
          registration_date?: string
          salary_range_max?: number | null
          salary_range_min?: number | null
          secondary_contact_email?: string | null
          secondary_contact_person?: string | null
          secondary_contact_phone?: string | null
          service_fee_percentage?: number | null
          typical_hiring_volume_monthly?: number | null
          typical_hiring_volume_yearly?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_account_manager_id_fkey"
            columns: ["account_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      demandcom_backup_swap_20250129: {
        Row: {
          activity_name: string | null
          address: string | null
          city: string | null
          company_name: string | null
          created_at: string | null
          created_by: string | null
          deppt: string | null
          designation: string | null
          emp_size: string | null
          erp_name: string | null
          erp_vendor: string | null
          generic_email_id: string | null
          id: string | null
          industry_type: string | null
          job_level_updated: string | null
          last_call_date: string | null
          latest_disposition: string | null
          latest_subdisposition: string | null
          linkedin: string | null
          location: string | null
          mobile_numb: string | null
          mobile2: string | null
          name: string | null
          official: string | null
          personal_email_id: string | null
          pincode: string | null
          state: string | null
          sub_industry: string | null
          tier: string | null
          turnover: string | null
          updated_at: string | null
          website: string | null
          zone: string | null
        }
        Insert: {
          activity_name?: string | null
          address?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string | null
          created_by?: string | null
          deppt?: string | null
          designation?: string | null
          emp_size?: string | null
          erp_name?: string | null
          erp_vendor?: string | null
          generic_email_id?: string | null
          id?: string | null
          industry_type?: string | null
          job_level_updated?: string | null
          last_call_date?: string | null
          latest_disposition?: string | null
          latest_subdisposition?: string | null
          linkedin?: string | null
          location?: string | null
          mobile_numb?: string | null
          mobile2?: string | null
          name?: string | null
          official?: string | null
          personal_email_id?: string | null
          pincode?: string | null
          state?: string | null
          sub_industry?: string | null
          tier?: string | null
          turnover?: string | null
          updated_at?: string | null
          website?: string | null
          zone?: string | null
        }
        Update: {
          activity_name?: string | null
          address?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string | null
          created_by?: string | null
          deppt?: string | null
          designation?: string | null
          emp_size?: string | null
          erp_name?: string | null
          erp_vendor?: string | null
          generic_email_id?: string | null
          id?: string | null
          industry_type?: string | null
          job_level_updated?: string | null
          last_call_date?: string | null
          latest_disposition?: string | null
          latest_subdisposition?: string | null
          linkedin?: string | null
          location?: string | null
          mobile_numb?: string | null
          mobile2?: string | null
          name?: string | null
          official?: string | null
          personal_email_id?: string | null
          pincode?: string | null
          state?: string | null
          sub_industry?: string | null
          tier?: string | null
          turnover?: string | null
          updated_at?: string | null
          website?: string | null
          zone?: string | null
        }
        Relationships: []
      }
      demandcom_pipeline: {
        Row: {
          demandcom_id: string
          entered_at: string
          exited_at: string | null
          id: string
          is_current: boolean | null
          moved_by: string | null
          notes: string | null
          stage_id: string
        }
        Insert: {
          demandcom_id: string
          entered_at?: string
          exited_at?: string | null
          id?: string
          is_current?: boolean | null
          moved_by?: string | null
          notes?: string | null
          stage_id: string
        }
        Update: {
          demandcom_id?: string
          entered_at?: string
          exited_at?: string | null
          id?: string
          is_current?: boolean | null
          moved_by?: string | null
          notes?: string | null
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_pipeline_candidate_id_fkey"
            columns: ["demandcom_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_pipeline_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandcom_pipeline_demandcom_id_fkey"
            columns: ["demandcom_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      designations: {
        Row: {
          created_at: string
          department: string | null
          description: string | null
          id: string
          is_active: boolean | null
          level: number | null
          org_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          level?: number | null
          org_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          level?: number | null
          org_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "designations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string
          body_text: string | null
          button_text: string | null
          button_url: string | null
          category: string | null
          created_at: string
          created_by: string | null
          facebook_url: string | null
          id: string
          image_url: string | null
          instagram_url: string | null
          is_active: boolean
          linkedin_url: string | null
          merge_tags: string[] | null
          name: string
          org_id: string | null
          subject: string
          twitter_url: string | null
          updated_at: string
          version: number
        }
        Insert: {
          body_html: string
          body_text?: string | null
          button_text?: string | null
          button_url?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          facebook_url?: string | null
          id?: string
          image_url?: string | null
          instagram_url?: string | null
          is_active?: boolean
          linkedin_url?: string | null
          merge_tags?: string[] | null
          name: string
          org_id?: string | null
          subject: string
          twitter_url?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          body_html?: string
          body_text?: string | null
          button_text?: string | null
          button_url?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          facebook_url?: string | null
          id?: string
          image_url?: string | null
          instagram_url?: string | null
          is_active?: boolean
          linkedin_url?: string | null
          merge_tags?: string[] | null
          name?: string
          org_id?: string | null
          subject?: string
          twitter_url?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      export_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          file_url: string | null
          filters: Json | null
          id: string
          org_id: string | null
          processed_records: number | null
          source: string
          started_at: string | null
          status: string
          total_records: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          file_url?: string | null
          filters?: Json | null
          id?: string
          org_id?: string | null
          processed_records?: number | null
          source: string
          started_at?: string | null
          status?: string
          total_records?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          file_url?: string | null
          filters?: Json | null
          id?: string
          org_id?: string | null
          processed_records?: number | null
          source?: string
          started_at?: string | null
          status?: string
          total_records?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_announcements: {
        Row: {
          announcement_type: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          image_url: string | null
          is_active: boolean | null
          link_text: string | null
          link_url: string | null
          priority: string
          published_at: string | null
          target_roles: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          announcement_type: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          link_text?: string | null
          link_url?: string | null
          priority?: string
          published_at?: string | null
          target_roles?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          announcement_type?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          link_text?: string | null
          link_url?: string | null
          priority?: string
          published_at?: string | null
          target_roles?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      general_tasks: {
        Row: {
          assigned_by: string
          assigned_to: string
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string
          id: string
          org_id: string | null
          priority: string | null
          status: string
          task_name: string
          updated_at: string | null
        }
        Insert: {
          assigned_by: string
          assigned_to: string
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date: string
          id?: string
          org_id?: string | null
          priority?: string | null
          status?: string
          task_name: string
          updated_at?: string | null
        }
        Update: {
          assigned_by?: string
          assigned_to?: string
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string
          id?: string
          org_id?: string | null
          priority?: string | null
          status?: string
          task_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "general_tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          batch_number: number
          batch_size: number
          created_at: string | null
          error_message: string | null
          id: string
          import_id: string
          offset_start: number
          status: string | null
        }
        Insert: {
          batch_number: number
          batch_size: number
          created_at?: string | null
          error_message?: string | null
          id?: string
          import_id: string
          offset_start: number
          status?: string | null
        }
        Update: {
          batch_number?: number
          batch_size?: number
          created_at?: string | null
          error_message?: string | null
          id?: string
          import_id?: string
          offset_start?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "bulk_import_history"
            referencedColumns: ["id"]
          },
        ]
      }
      import_staging: {
        Row: {
          created_at: string | null
          id: string
          import_id: string
          processed: boolean | null
          raw_data: Json
          row_number: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          import_id: string
          processed?: boolean | null
          raw_data: Json
          row_number: number
        }
        Update: {
          created_at?: string | null
          id?: string
          import_id?: string
          processed?: boolean | null
          raw_data?: Json
          row_number?: number
        }
        Relationships: []
      }
      jobs: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          latitude: number | null
          license_required: string | null
          location_city: string | null
          location_state: string | null
          location_zip: string | null
          longitude: number | null
          org_id: string | null
          salary_max: number | null
          salary_min: number | null
          specialty: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          latitude?: number | null
          license_required?: string | null
          location_city?: string | null
          location_state?: string | null
          location_zip?: string | null
          longitude?: number | null
          org_id?: string | null
          salary_max?: number | null
          salary_min?: number | null
          specialty?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          latitude?: number | null
          license_required?: string | null
          location_city?: string | null
          location_state?: string | null
          location_zip?: string | null
          longitude?: number | null
          org_id?: string | null
          salary_max?: number | null
          salary_min?: number | null
          specialty?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mandate_candidates: {
        Row: {
          candidate_id: string
          client_comment: string | null
          client_decided_at: string | null
          client_decision: string | null
          created_at: string
          created_by: string | null
          current_stage: string
          feedback: string | null
          id: string
          mandate_id: string
          notes: string | null
          stage_updated_at: string
          status: string
          submitted_date: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          client_comment?: string | null
          client_decided_at?: string | null
          client_decision?: string | null
          created_at?: string
          created_by?: string | null
          current_stage?: string
          feedback?: string | null
          id?: string
          mandate_id: string
          notes?: string | null
          stage_updated_at?: string
          status?: string
          submitted_date?: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          client_comment?: string | null
          client_decided_at?: string | null
          client_decision?: string | null
          created_at?: string
          created_by?: string | null
          current_stage?: string
          feedback?: string | null
          id?: string
          mandate_id?: string
          notes?: string | null
          stage_updated_at?: string
          status?: string
          submitted_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mandate_candidates_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandate_candidates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandate_candidates_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "mandates"
            referencedColumns: ["id"]
          },
        ]
      }
      mandates: {
        Row: {
          assigned_recruiter_id: string | null
          certifications_required: string | null
          client_feedback: string | null
          client_id: string | null
          client_turnaround_time: string | null
          closed_date: string | null
          closure_reason: string | null
          created_at: string
          created_by: string | null
          domain_knowledge: string | null
          employment_type: string
          id: string
          industry_experience: string | null
          internal_notes: string | null
          interview_rounds: number | null
          job_description: string
          job_location: string
          job_title: string
          key_responsibilities: string | null
          locations: Json | null
          mandate_id: string | null
          mandate_received_date: string
          mandate_status: string
          mandatory_skills: string[]
          max_ctc_lakhs: number
          max_experience_years: number
          min_ctc_lakhs: number
          min_experience_years: number
          minimum_qualification: string
          notice_period_acceptable: number
          number_of_positions: number
          org_id: string | null
          other_benefits: string | null
          positions_filled: number
          preferred_skills: string[] | null
          priority_level: string
          profiles_selected: number
          profiles_shortlisted: number
          profiles_submitted: number
          replacement_period_days: number
          reporting_to: string | null
          secondary_recruiter_id: string | null
          service_fee_percentage: number | null
          shift_timings: string | null
          shortlist_token: string | null
          sourcing_strategy: string | null
          special_requirements: string | null
          target_closure_date: string
          team_size: number | null
          travel_requirements: string | null
          updated_at: string
          variable_component: string | null
          work_mode: string
        }
        Insert: {
          assigned_recruiter_id?: string | null
          certifications_required?: string | null
          client_feedback?: string | null
          client_id?: string | null
          client_turnaround_time?: string | null
          closed_date?: string | null
          closure_reason?: string | null
          created_at?: string
          created_by?: string | null
          domain_knowledge?: string | null
          employment_type?: string
          id?: string
          industry_experience?: string | null
          internal_notes?: string | null
          interview_rounds?: number | null
          job_description: string
          job_location?: string
          job_title: string
          key_responsibilities?: string | null
          locations?: Json | null
          mandate_id?: string | null
          mandate_received_date?: string
          mandate_status?: string
          mandatory_skills?: string[]
          max_ctc_lakhs?: number
          max_experience_years?: number
          min_ctc_lakhs?: number
          min_experience_years?: number
          minimum_qualification?: string
          notice_period_acceptable?: number
          number_of_positions?: number
          org_id?: string | null
          other_benefits?: string | null
          positions_filled?: number
          preferred_skills?: string[] | null
          priority_level?: string
          profiles_selected?: number
          profiles_shortlisted?: number
          profiles_submitted?: number
          replacement_period_days?: number
          reporting_to?: string | null
          secondary_recruiter_id?: string | null
          service_fee_percentage?: number | null
          shift_timings?: string | null
          shortlist_token?: string | null
          sourcing_strategy?: string | null
          special_requirements?: string | null
          target_closure_date?: string
          team_size?: number | null
          travel_requirements?: string | null
          updated_at?: string
          variable_component?: string | null
          work_mode?: string
        }
        Update: {
          assigned_recruiter_id?: string | null
          certifications_required?: string | null
          client_feedback?: string | null
          client_id?: string | null
          client_turnaround_time?: string | null
          closed_date?: string | null
          closure_reason?: string | null
          created_at?: string
          created_by?: string | null
          domain_knowledge?: string | null
          employment_type?: string
          id?: string
          industry_experience?: string | null
          internal_notes?: string | null
          interview_rounds?: number | null
          job_description?: string
          job_location?: string
          job_title?: string
          key_responsibilities?: string | null
          locations?: Json | null
          mandate_id?: string | null
          mandate_received_date?: string
          mandate_status?: string
          mandatory_skills?: string[]
          max_ctc_lakhs?: number
          max_experience_years?: number
          min_ctc_lakhs?: number
          min_experience_years?: number
          minimum_qualification?: string
          notice_period_acceptable?: number
          number_of_positions?: number
          org_id?: string | null
          other_benefits?: string | null
          positions_filled?: number
          preferred_skills?: string[] | null
          priority_level?: string
          profiles_selected?: number
          profiles_shortlisted?: number
          profiles_submitted?: number
          replacement_period_days?: number
          reporting_to?: string | null
          secondary_recruiter_id?: string | null
          service_fee_percentage?: number | null
          shift_timings?: string | null
          shortlist_token?: string | null
          sourcing_strategy?: string | null
          special_requirements?: string | null
          target_closure_date?: string
          team_size?: number | null
          travel_requirements?: string | null
          updated_at?: string
          variable_component?: string | null
          work_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_projects_assigned_recruiter"
            columns: ["assigned_recruiter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_projects_client"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_projects_secondary_recruiter"
            columns: ["secondary_recruiter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          general_task_id: string | null
          id: string
          is_read: boolean | null
          message: string
          notification_type: string
          read_at: string | null
          task_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          general_task_id?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          notification_type: string
          read_at?: string | null
          task_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          general_task_id?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          notification_type?: string
          read_at?: string | null
          task_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_general_task_id_fkey"
            columns: ["general_task_id"]
            isOneToOne: false
            referencedRelation: "general_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          candidate_id: string
          created_at: string
          created_by: string | null
          ctc_lakhs: number
          decided_at: string | null
          decline_reason: string | null
          expiry_date: string
          id: string
          joining_date: string
          mandate_id: string | null
          notes: string | null
          org_id: string
          status: string
          token: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          created_by?: string | null
          ctc_lakhs: number
          decided_at?: string | null
          decline_reason?: string | null
          expiry_date: string
          id?: string
          joining_date: string
          mandate_id?: string | null
          notes?: string | null
          org_id: string
          status?: string
          token: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          created_by?: string | null
          ctc_lakhs?: number
          decided_at?: string | null
          decline_reason?: string | null
          expiry_date?: string
          id?: string
          joining_date?: string
          mandate_id?: string | null
          notes?: string | null
          org_id?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "mandates"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_documents: {
        Row: {
          created_at: string
          document_type: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          submission_id: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          document_type: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          submission_id: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          submission_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_documents_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "onboarding_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_forms: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          org_id: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          org_id?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          org_id?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_forms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_forms_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_otp_verifications: {
        Row: {
          contact: string
          created_at: string
          expires_at: string
          id: string
          otp_code: string
          type: string
          verified: boolean
        }
        Insert: {
          contact: string
          created_at?: string
          expires_at: string
          id?: string
          otp_code: string
          type: string
          verified?: boolean
        }
        Update: {
          contact?: string
          created_at?: string
          expires_at?: string
          id?: string
          otp_code?: string
          type?: string
          verified?: boolean
        }
        Relationships: []
      }
      onboarding_steps: {
        Row: {
          action_label: string | null
          content: string
          created_at: string | null
          id: string
          image_url: string | null
          step_order: number
          target_element: string | null
          target_route: string | null
          title: string
          tour_id: string
        }
        Insert: {
          action_label?: string | null
          content: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          step_order: number
          target_element?: string | null
          target_route?: string | null
          title: string
          tour_id: string
        }
        Update: {
          action_label?: string | null
          content?: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          step_order?: number
          target_element?: string | null
          target_route?: string | null
          title?: string
          tour_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_steps_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tours"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_submissions: {
        Row: {
          aadhar_number: string | null
          account_number: string | null
          ai_review_at: string | null
          ai_review_result: Json | null
          bank_name: string | null
          blood_group: string | null
          branch_name: string | null
          candidate_id: string | null
          contact_number: string
          created_at: string
          date_of_birth: string | null
          email_verified: boolean
          emergency_contact_number: string | null
          father_name: string | null
          form_id: string
          full_name: string
          gender: string | null
          id: string
          ifsc_code: string | null
          marital_status: string | null
          mother_name: string | null
          org_id: string | null
          pan_number: string | null
          permanent_address: string | null
          personal_email: string
          present_address: string | null
          qualifications: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          uan_number: string | null
          updated_at: string
        }
        Insert: {
          aadhar_number?: string | null
          account_number?: string | null
          ai_review_at?: string | null
          ai_review_result?: Json | null
          bank_name?: string | null
          blood_group?: string | null
          branch_name?: string | null
          candidate_id?: string | null
          contact_number: string
          created_at?: string
          date_of_birth?: string | null
          email_verified?: boolean
          emergency_contact_number?: string | null
          father_name?: string | null
          form_id: string
          full_name: string
          gender?: string | null
          id?: string
          ifsc_code?: string | null
          marital_status?: string | null
          mother_name?: string | null
          org_id?: string | null
          pan_number?: string | null
          permanent_address?: string | null
          personal_email: string
          present_address?: string | null
          qualifications?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          uan_number?: string | null
          updated_at?: string
        }
        Update: {
          aadhar_number?: string | null
          account_number?: string | null
          ai_review_at?: string | null
          ai_review_result?: Json | null
          bank_name?: string | null
          blood_group?: string | null
          branch_name?: string | null
          candidate_id?: string | null
          contact_number?: string
          created_at?: string
          date_of_birth?: string | null
          email_verified?: boolean
          emergency_contact_number?: string | null
          father_name?: string | null
          form_id?: string
          full_name?: string
          gender?: string | null
          id?: string
          ifsc_code?: string | null
          marital_status?: string | null
          mother_name?: string | null
          org_id?: string | null
          pan_number?: string | null
          permanent_address?: string | null
          personal_email?: string
          present_address?: string | null
          qualifications?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          uan_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_submissions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "onboarding_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_submissions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_tours: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          target_roles: string[] | null
          title: string
          tour_type: Database["public"]["Enums"]["tour_type"]
          updated_at: string | null
          version: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          target_roles?: string[] | null
          title: string
          tour_type: Database["public"]["Enums"]["tour_type"]
          updated_at?: string | null
          version: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          target_roles?: string[] | null
          title?: string
          tour_type?: Database["public"]["Enums"]["tour_type"]
          updated_at?: string | null
          version?: number
        }
        Relationships: []
      }
      org_credentials: {
        Row: {
          aadhaar_api_key: string | null
          bolna_agent_id: string | null
          bolna_caller_id: string | null
          created_at: string
          exotel_account_sid: string | null
          exotel_api_key: string | null
          exotel_api_token: string | null
          exotel_caller_id: string | null
          exotel_sender_number: string | null
          exotel_subdomain: string | null
          exotel_waba_id: string | null
          id: string
          is_configured: boolean
          org_id: string
          pan_api_key: string | null
          smtp_from_email: string | null
          smtp_from_name: string | null
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_user: string | null
          updated_at: string
        }
        Insert: {
          aadhaar_api_key?: string | null
          bolna_agent_id?: string | null
          bolna_caller_id?: string | null
          created_at?: string
          exotel_account_sid?: string | null
          exotel_api_key?: string | null
          exotel_api_token?: string | null
          exotel_caller_id?: string | null
          exotel_sender_number?: string | null
          exotel_subdomain?: string | null
          exotel_waba_id?: string | null
          id?: string
          is_configured?: boolean
          org_id: string
          pan_api_key?: string | null
          smtp_from_email?: string | null
          smtp_from_name?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          updated_at?: string
        }
        Update: {
          aadhaar_api_key?: string | null
          bolna_agent_id?: string | null
          bolna_caller_id?: string | null
          created_at?: string
          exotel_account_sid?: string | null
          exotel_api_key?: string | null
          exotel_api_token?: string | null
          exotel_caller_id?: string | null
          exotel_sender_number?: string | null
          exotel_subdomain?: string | null
          exotel_waba_id?: string | null
          id?: string
          is_configured?: boolean
          org_id?: string
          pan_api_key?: string | null
          smtp_from_email?: string | null
          smtp_from_name?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_credentials_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_memberships: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          act_today_only: boolean
          allow_low_recharge: boolean
          calling_windows: Json
          demo_host_user_id: string | null
          demo_meeting_link: string | null
          demo_reminder_agent_id: string | null
          dialing_active: boolean
          enforce_wallet_in_trial: boolean
          org_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          act_today_only?: boolean
          allow_low_recharge?: boolean
          calling_windows?: Json
          demo_host_user_id?: string | null
          demo_meeting_link?: string | null
          demo_reminder_agent_id?: string | null
          dialing_active?: boolean
          enforce_wallet_in_trial?: boolean
          org_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          act_today_only?: boolean
          allow_low_recharge?: boolean
          calling_windows?: Json
          demo_host_user_id?: string | null
          demo_meeting_link?: string | null
          demo_reminder_agent_id?: string | null
          dialing_active?: boolean
          enforce_wallet_in_trial?: boolean
          org_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_settings_demo_host_user_id_fkey"
            columns: ["demo_host_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_subscriptions: {
        Row: {
          billing_cycle_start: string
          billing_period: string
          created_at: string | null
          grace_period_end: string | null
          id: string
          last_payment_date: string | null
          lockout_date: string | null
          monthly_subscription_amount: number
          next_billing_date: string
          one_time_setup_fee: number | null
          org_id: string
          override_by: string | null
          override_reason: string | null
          readonly_period_end: string | null
          subscription_status: string
          suspension_date: string | null
          suspension_override_until: string | null
          suspension_reason: string | null
          updated_at: string | null
          user_count: number
          wallet_alert_level: string
          wallet_alert_sent_at: string | null
          wallet_auto_topup_enabled: boolean | null
          wallet_balance: number
          wallet_last_topup_date: string | null
          wallet_low_alert_threshold: number
          wallet_minimum_balance: number
        }
        Insert: {
          billing_cycle_start: string
          billing_period?: string
          created_at?: string | null
          grace_period_end?: string | null
          id?: string
          last_payment_date?: string | null
          lockout_date?: string | null
          monthly_subscription_amount?: number
          next_billing_date: string
          one_time_setup_fee?: number | null
          org_id: string
          override_by?: string | null
          override_reason?: string | null
          readonly_period_end?: string | null
          subscription_status?: string
          suspension_date?: string | null
          suspension_override_until?: string | null
          suspension_reason?: string | null
          updated_at?: string | null
          user_count?: number
          wallet_alert_level?: string
          wallet_alert_sent_at?: string | null
          wallet_auto_topup_enabled?: boolean | null
          wallet_balance?: number
          wallet_last_topup_date?: string | null
          wallet_low_alert_threshold?: number
          wallet_minimum_balance?: number
        }
        Update: {
          billing_cycle_start?: string
          billing_period?: string
          created_at?: string | null
          grace_period_end?: string | null
          id?: string
          last_payment_date?: string | null
          lockout_date?: string | null
          monthly_subscription_amount?: number
          next_billing_date?: string
          one_time_setup_fee?: number | null
          org_id?: string
          override_by?: string | null
          override_reason?: string | null
          readonly_period_end?: string | null
          subscription_status?: string
          suspension_date?: string | null
          suspension_override_until?: string | null
          suspension_reason?: string | null
          updated_at?: string | null
          user_count?: number
          wallet_alert_level?: string
          wallet_alert_sent_at?: string | null
          wallet_auto_topup_enabled?: boolean | null
          wallet_balance?: number
          wallet_last_topup_date?: string | null
          wallet_low_alert_threshold?: number
          wallet_minimum_balance?: number
        }
        Relationships: [
          {
            foreignKeyName: "organization_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          industry: string | null
          is_internal: boolean
          logo_url: string | null
          name: string
          onboarding_completed: boolean
          plan: string
          services_enabled: boolean
          slug: string
          subscription_active: boolean
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          industry?: string | null
          is_internal?: boolean
          logo_url?: string | null
          name: string
          onboarding_completed?: boolean
          plan?: string
          services_enabled?: boolean
          slug: string
          subscription_active?: boolean
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          industry?: string | null
          is_internal?: boolean
          logo_url?: string | null
          name?: string
          onboarding_completed?: boolean
          plan?: string
          services_enabled?: boolean
          slug?: string
          subscription_active?: boolean
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      password_reset_logs: {
        Row: {
          action_status: string
          admin_email: string
          admin_full_name: string | null
          admin_user_id: string
          created_at: string
          failure_reason: string | null
          id: string
          ip_address: string | null
          target_email: string
          target_full_name: string | null
          target_user_id: string
          user_agent: string | null
        }
        Insert: {
          action_status: string
          admin_email: string
          admin_full_name?: string | null
          admin_user_id: string
          created_at?: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          target_email: string
          target_full_name?: string | null
          target_user_id: string
          user_agent?: string | null
        }
        Update: {
          action_status?: string
          admin_email?: string
          admin_full_name?: string | null
          admin_user_id?: string
          created_at?: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          target_email?: string
          target_full_name?: string | null
          target_user_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string | null
          failure_reason: string | null
          id: string
          initiated_at: string | null
          initiated_by: string | null
          invoice_id: string | null
          metadata: Json | null
          org_id: string
          payment_method: string | null
          payment_status: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          transaction_type: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          initiated_at?: string | null
          initiated_by?: string | null
          invoice_id?: string | null
          metadata?: Json | null
          org_id: string
          payment_method?: string | null
          payment_status?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          transaction_type: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          initiated_at?: string | null
          initiated_by?: string | null
          invoice_id?: string | null
          metadata?: Json | null
          org_id?: string
          payment_method?: string | null
          payment_status?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          transaction_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "subscription_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          org_id: string | null
          stage_order: number
          stage_type: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          org_id?: string | null
          stage_order: number
          stage_type?: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string | null
          stage_order?: number
          stage_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          last_tour_version_seen: number | null
          onboarding_completed: boolean | null
          onboarding_skipped: boolean | null
          org_id: string | null
          phone: string | null
          referral_code: string | null
          reports_to: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          last_tour_version_seen?: number | null
          onboarding_completed?: boolean | null
          onboarding_skipped?: boolean | null
          org_id?: string | null
          phone?: string | null
          referral_code?: string | null
          reports_to?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          last_tour_version_seen?: number | null
          onboarding_completed?: boolean | null
          onboarding_skipped?: boolean | null
          org_id?: string | null
          phone?: string | null
          referral_code?: string | null
          reports_to?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      project_team_members: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          project_id: string
          role_in_project: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          project_id: string
          role_in_project?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          project_id?: string
          role_in_project?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_team_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mandates"
            referencedColumns: ["id"]
          },
        ]
      }
      project_team_notifications: {
        Row: {
          id: string
          notification_type: string
          notified_at: string
          project_id: string
          user_id: string
        }
        Insert: {
          id?: string
          notification_type?: string
          notified_at?: string
          project_id: string
          user_id: string
        }
        Update: {
          id?: string
          notification_type?: string
          notified_at?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_team_notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mandates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_team_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      public_job_applications: {
        Row: {
          candidate_id: string | null
          created_at: string | null
          id: string
          ip_address: string | null
          mandate_id: string | null
          parsed_data: Json | null
          processed_at: string | null
          recruiter_id: string | null
          referral_code: string
          resume_file_name: string
          resume_url: string
          status: string | null
          user_agent: string | null
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          mandate_id?: string | null
          parsed_data?: Json | null
          processed_at?: string | null
          recruiter_id?: string | null
          referral_code: string
          resume_file_name: string
          resume_url: string
          status?: string | null
          user_agent?: string | null
        }
        Update: {
          candidate_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          mandate_id?: string | null
          parsed_data?: Json | null
          processed_at?: string | null
          recruiter_id?: string | null
          referral_code?: string
          resume_file_name?: string
          resume_url?: string
          status?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_job_applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_job_applications_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "mandates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_job_applications_recruiter_id_fkey"
            columns: ["recruiter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_metadata: {
        Row: {
          can_be_assigned_by: Database["public"]["Enums"]["app_role"][]
          created_at: string
          description: string | null
          display_name: string
          hierarchy_level: number
          is_visible_in_ui: boolean
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          can_be_assigned_by?: Database["public"]["Enums"]["app_role"][]
          created_at?: string
          description?: string | null
          display_name: string
          hierarchy_level: number
          is_visible_in_ui?: boolean
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          can_be_assigned_by?: Database["public"]["Enums"]["app_role"][]
          created_at?: string
          description?: string | null
          display_name?: string
          hierarchy_level?: number
          is_visible_in_ui?: boolean
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      service_usage_logs: {
        Row: {
          cost: number
          created_at: string | null
          deduction_error: string | null
          id: string
          org_id: string
          quantity: number
          reference_id: string
          service_type: string
          user_id: string | null
          wallet_deducted: boolean | null
          wallet_transaction_id: string | null
        }
        Insert: {
          cost: number
          created_at?: string | null
          deduction_error?: string | null
          id?: string
          org_id: string
          quantity: number
          reference_id: string
          service_type: string
          user_id?: string | null
          wallet_deducted?: boolean | null
          wallet_transaction_id?: string | null
        }
        Update: {
          cost?: number
          created_at?: string | null
          deduction_error?: string | null
          id?: string
          org_id?: string
          quantity?: number
          reference_id?: string
          service_type?: string
          user_id?: string | null
          wallet_deducted?: boolean | null
          wallet_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_usage_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_usage_logs_wallet_transaction_id_fkey"
            columns: ["wallet_transaction_id"]
            isOneToOne: false
            referencedRelation: "wallet_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      site_coordinators: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          id: string
          site_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          site_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_coordinators_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_coordinators_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_coordinators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_headcount_agreements: {
        Row: {
          agreed_headcount: number
          available_headcount: number
          created_at: string | null
          id: string
          job_title: string
          last_updated_at: string | null
          last_updated_by: string | null
          linked_mandate_id: string | null
          notes: string | null
          open_positions: number | null
          required_female: number | null
          required_male: number | null
          site_id: string
        }
        Insert: {
          agreed_headcount?: number
          available_headcount?: number
          created_at?: string | null
          id?: string
          job_title: string
          last_updated_at?: string | null
          last_updated_by?: string | null
          linked_mandate_id?: string | null
          notes?: string | null
          open_positions?: number | null
          required_female?: number | null
          required_male?: number | null
          site_id: string
        }
        Update: {
          agreed_headcount?: number
          available_headcount?: number
          created_at?: string | null
          id?: string
          job_title?: string
          last_updated_at?: string | null
          last_updated_by?: string | null
          linked_mandate_id?: string | null
          notes?: string | null
          open_positions?: number | null
          required_female?: number | null
          required_male?: number | null
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_headcount_agreements_last_updated_by_fkey"
            columns: ["last_updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_headcount_agreements_linked_mandate_id_fkey"
            columns: ["linked_mandate_id"]
            isOneToOne: false
            referencedRelation: "mandates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_headcount_agreements_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          address: string | null
          client_id: string
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          coordinator_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          location: string | null
          org_id: string | null
          site_code: string | null
          site_name: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          client_id: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          coordinator_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          org_id?: string | null
          site_code?: string | null
          site_name: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          client_id?: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          coordinator_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          org_id?: string | null
          site_code?: string | null
          site_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_coordinator_id_fkey"
            columns: ["coordinator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_templates: {
        Row: {
          body: string
          category: string | null
          character_count: number | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          merge_tags: string[] | null
          name: string
          org_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          body: string
          category?: string | null
          character_count?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          merge_tags?: string[] | null
          name: string
          org_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          body?: string
          category?: string | null
          character_count?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          merge_tags?: string[] | null
          name?: string
          org_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "sms_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_invoices: {
        Row: {
          base_subscription_amount: number
          billing_period_end: string
          billing_period_start: string
          created_at: string | null
          due_date: string
          gst_amount: number
          id: string
          invoice_date: string
          invoice_number: string
          org_id: string
          paid_amount: number | null
          paid_at: string | null
          payment_status: string
          prorated_amount: number | null
          setup_fee: number | null
          subtotal: number
          total_amount: number
          updated_at: string | null
          user_count: number
          waive_reason: string | null
          waived_by: string | null
        }
        Insert: {
          base_subscription_amount: number
          billing_period_end: string
          billing_period_start: string
          created_at?: string | null
          due_date: string
          gst_amount: number
          id?: string
          invoice_date: string
          invoice_number: string
          org_id: string
          paid_amount?: number | null
          paid_at?: string | null
          payment_status?: string
          prorated_amount?: number | null
          setup_fee?: number | null
          subtotal: number
          total_amount: number
          updated_at?: string | null
          user_count: number
          waive_reason?: string | null
          waived_by?: string | null
        }
        Update: {
          base_subscription_amount?: number
          billing_period_end?: string
          billing_period_start?: string
          created_at?: string | null
          due_date?: string
          gst_amount?: number
          id?: string
          invoice_date?: string
          invoice_number?: string
          org_id?: string
          paid_amount?: number | null
          paid_at?: string | null
          payment_status?: string
          prorated_amount?: number | null
          setup_fee?: number | null
          subtotal?: number
          total_amount?: number
          updated_at?: string | null
          user_count?: number
          waive_reason?: string | null
          waived_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_pricing: {
        Row: {
          auto_topup_amount: number
          auto_topup_enabled: boolean | null
          call_cost_per_call: number | null
          call_cost_per_minute: number
          created_at: string | null
          created_by: string | null
          effective_from: string
          email_cost_per_unit: number
          gst_percentage: number
          id: string
          is_active: boolean | null
          min_wallet_balance: number
          one_time_setup_cost: number
          per_user_monthly_cost: number
          updated_at: string | null
          whatsapp_cost_per_unit: number
        }
        Insert: {
          auto_topup_amount?: number
          auto_topup_enabled?: boolean | null
          call_cost_per_call?: number | null
          call_cost_per_minute?: number
          created_at?: string | null
          created_by?: string | null
          effective_from?: string
          email_cost_per_unit?: number
          gst_percentage?: number
          id?: string
          is_active?: boolean | null
          min_wallet_balance?: number
          one_time_setup_cost?: number
          per_user_monthly_cost?: number
          updated_at?: string | null
          whatsapp_cost_per_unit?: number
        }
        Update: {
          auto_topup_amount?: number
          auto_topup_enabled?: boolean | null
          call_cost_per_call?: number | null
          call_cost_per_minute?: number
          created_at?: string | null
          created_by?: string | null
          effective_from?: string
          email_cost_per_unit?: number
          gst_percentage?: number
          id?: string
          is_active?: boolean | null
          min_wallet_balance?: number
          one_time_setup_cost?: number
          per_user_monthly_cost?: number
          updated_at?: string | null
          whatsapp_cost_per_unit?: number
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          created_at: string
          duration_seconds: number | null
          error_details: Json | null
          id: string
          items_failed: number | null
          items_fetched: number | null
          items_inserted: number | null
          items_updated: number | null
          status: string
          sync_id: string | null
          sync_type: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          error_details?: Json | null
          id?: string
          items_failed?: number | null
          items_fetched?: number | null
          items_inserted?: number | null
          items_updated?: number | null
          status: string
          sync_id?: string | null
          sync_type: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          error_details?: Json | null
          id?: string
          items_failed?: number | null
          items_fetched?: number | null
          items_inserted?: number | null
          items_updated?: number | null
          status?: string
          sync_id?: string | null
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_sync_id_fkey"
            columns: ["sync_id"]
            isOneToOne: false
            referencedRelation: "sync_status"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_status: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          processed_items: number | null
          started_at: string
          started_by: string | null
          status: string
          sync_type: string
          total_items: number | null
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          processed_items?: number | null
          started_at?: string
          started_by?: string | null
          status?: string
          sync_type: string
          total_items?: number | null
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          processed_items?: number | null
          started_at?: string
          started_by?: string | null
          status?: string
          sync_type?: string
          total_items?: number | null
        }
        Relationships: []
      }
      team_members: {
        Row: {
          id: string
          is_active: boolean | null
          joined_at: string
          org_id: string | null
          role_in_team: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean | null
          joined_at?: string
          org_id?: string | null
          role_in_team?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          is_active?: boolean | null
          joined_at?: string
          org_id?: string | null
          role_in_team?: string | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          org_id: string | null
          team_lead_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          org_id?: string | null
          team_lead_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string | null
          team_lead_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_announcement_views: {
        Row: {
          announcement_id: string
          dismissed: boolean | null
          id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          announcement_id: string
          dismissed?: boolean | null
          id?: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          announcement_id?: string
          dismissed?: boolean | null
          id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_announcement_views_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "feature_announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_designations: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          designation_id: string
          id: string
          is_current: boolean | null
          org_id: string | null
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          designation_id: string
          id?: string
          is_current?: boolean | null
          org_id?: string | null
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          designation_id?: string
          id?: string
          is_current?: boolean | null
          org_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_designations_designation_id_fkey"
            columns: ["designation_id"]
            isOneToOne: false
            referencedRelation: "designations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_designations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_onboarding_progress: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_step_id: string | null
          id: string
          status: Database["public"]["Enums"]["onboarding_status"] | null
          tour_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_step_id?: string | null
          id?: string
          status?: Database["public"]["Enums"]["onboarding_status"] | null
          tour_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_step_id?: string | null
          id?: string
          status?: Database["public"]["Enums"]["onboarding_status"] | null
          tour_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_onboarding_progress_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "onboarding_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_onboarding_progress_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tours"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          org_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          admin_reason: string | null
          amount: number
          balance_after: number
          balance_before: number
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          org_id: string
          payment_transaction_id: string | null
          quantity: number | null
          reference_id: string | null
          reference_type: string | null
          transaction_type: string
          unit_cost: number | null
        }
        Insert: {
          admin_reason?: string | null
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          org_id: string
          payment_transaction_id?: string | null
          quantity?: number | null
          reference_id?: string | null
          reference_type?: string | null
          transaction_type: string
          unit_cost?: number | null
        }
        Update: {
          admin_reason?: string | null
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          org_id?: string
          payment_transaction_id?: string | null
          quantity?: number | null
          reference_id?: string | null
          reference_type?: string | null
          transaction_type?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_connectors: {
        Row: {
          connector_type: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string | null
          rate_limit_per_minute: number
          target_table: string
          updated_at: string
          webhook_config: Json | null
          webhook_token: string
        }
        Insert: {
          connector_type: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id?: string | null
          rate_limit_per_minute?: number
          target_table?: string
          updated_at?: string
          webhook_config?: Json | null
          webhook_token: string
        }
        Update: {
          connector_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string | null
          rate_limit_per_minute?: number
          target_table?: string
          updated_at?: string
          webhook_config?: Json | null
          webhook_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_connectors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          created_at: string
          demandcom_id: string | null
          error_message: string | null
          http_status_code: number
          id: string
          ip_address: string | null
          job_id: string | null
          request_id: string
          request_payload: Json | null
          response_payload: Json | null
          status: string
          webhook_connector_id: string | null
        }
        Insert: {
          created_at?: string
          demandcom_id?: string | null
          error_message?: string | null
          http_status_code: number
          id?: string
          ip_address?: string | null
          job_id?: string | null
          request_id: string
          request_payload?: Json | null
          response_payload?: Json | null
          status: string
          webhook_connector_id?: string | null
        }
        Update: {
          created_at?: string
          demandcom_id?: string | null
          error_message?: string | null
          http_status_code?: number
          id?: string
          ip_address?: string | null
          job_id?: string | null
          request_id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
          webhook_connector_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_candidate_id_fkey"
            columns: ["demandcom_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_logs_demandcom_id_fkey"
            columns: ["demandcom_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_logs_webhook_connector_id_fkey"
            columns: ["webhook_connector_id"]
            isOneToOne: false
            referencedRelation: "webhook_connectors"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          body: string
          buttons: Json | null
          category: string | null
          created_at: string
          created_by: string | null
          footer: string | null
          header_content: string | null
          header_type: string | null
          id: string
          is_active: boolean | null
          language_code: string | null
          merge_tags: string[] | null
          name: string
          org_id: string | null
          updated_at: string
          variable_mapping: Json | null
        }
        Insert: {
          body: string
          buttons?: Json | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          footer?: string | null
          header_content?: string | null
          header_type?: string | null
          id?: string
          is_active?: boolean | null
          language_code?: string | null
          merge_tags?: string[] | null
          name: string
          org_id?: string | null
          updated_at?: string
          variable_mapping?: Json | null
        }
        Update: {
          body?: string
          buttons?: Json | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          footer?: string | null
          header_content?: string | null
          header_type?: string | null
          id?: string
          is_active?: boolean | null
          language_code?: string | null
          merge_tags?: string[] | null
          name?: string
          org_id?: string | null
          updated_at?: string
          variable_mapping?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_candidate_onboarding: {
        Args: { p_reviewer_id: string; p_submission_id: string }
        Returns: undefined
      }
      calculate_distance: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      calculate_monthly_amount: { Args: { _org_id: string }; Returns: number }
      can_access_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_site: {
        Args: { _site_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_user: {
        Args: { _accessor_id: string; _target_id: string }
        Returns: boolean
      }
      check_and_update_subscription_status: {
        Args: { _org_id: string }
        Returns: undefined
      }
      check_webhook_rate_limit: {
        Args: { _limit: number; _webhook_id: string }
        Returns: boolean
      }
      deduct_from_wallet: {
        Args: {
          _amount: number
          _org_id: string
          _quantity: number
          _reference_id: string
          _service_type: string
          _unit_cost: number
          _user_id: string
        }
        Returns: Json
      }
      generate_mandate_id: { Args: never; Returns: string }
      generate_project_number: { Args: never; Returns: string }
      get_active_pricing: {
        Args: never
        Returns: {
          auto_topup_amount: number
          call_cost_per_call: number
          call_cost_per_minute: number
          email_cost_per_unit: number
          gst_percentage: number
          min_wallet_balance: number
          one_time_setup_cost: number
          per_user_monthly_cost: number
          whatsapp_cost_per_unit: number
        }[]
      }
      get_client_shortlist: { Args: { p_token: string }; Returns: Json }
      get_daily_record_counts: {
        Args: { days: number }
        Returns: {
          created_count: number
          date: string
          updated_count: number
        }[]
      }
      get_offer: { Args: { p_token: string }; Returns: Json }
      get_project_creator_name: { Args: { _user_id: string }; Returns: string }
      get_user_designation_level: {
        Args: { _user_id: string }
        Returns: number
      }
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
      get_user_org_id_unlocked: { Args: { _user_id: string }; Returns: string }
      get_user_org_ids: { Args: { _user_id: string }; Returns: string[] }
      has_org_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["org_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_current_org_locked: { Args: never; Returns: boolean }
      is_org_locked: { Args: { _org_id: string }; Returns: boolean }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      is_project_team_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      process_bulk_import_batch: {
        Args: { p_import_id: string; p_table_name: string; p_user_id: string }
        Returns: Json
      }
      respond_to_offer: {
        Args: { p_decision: string; p_reason?: string; p_token: string }
        Returns: undefined
      }
      submit_client_feedback: {
        Args: {
          p_candidate_id: string
          p_comment?: string
          p_decision: string
          p_token: string
        }
        Returns: undefined
      }
      submit_public_application: {
        Args: {
          p_candidate: Json
          p_mandate_ids?: string[]
          p_parsed_data?: Json
          p_referral_code: string
          p_resume_file_name?: string
          p_resume_url?: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "manager"
        | "user"
        | "client"
        | "platform_admin"
        | "admin_administration"
        | "admin_tech"
        | "agent"
        | "csbd"
        | "leadership"
        | "zonal_coordinator"
      import_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
      onboarding_status: "not_started" | "in_progress" | "completed" | "skipped"
      org_role: "org_admin" | "member"
      priority_level: "high" | "medium" | "low"
      recommendation_status: "pending" | "completed" | "dismissed"
      recommendation_type:
        | "contact"
        | "campaign"
        | "follow_up"
        | "placement"
        | "re_engage"
        | "update_profile"
      tour_type: "initial" | "feature_update"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "admin",
        "manager",
        "user",
        "client",
        "platform_admin",
        "admin_administration",
        "admin_tech",
        "agent",
        "csbd",
        "leadership",
        "zonal_coordinator",
      ],
      import_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "cancelled",
      ],
      onboarding_status: ["not_started", "in_progress", "completed", "skipped"],
      org_role: ["org_admin", "member"],
      priority_level: ["high", "medium", "low"],
      recommendation_status: ["pending", "completed", "dismissed"],
      recommendation_type: [
        "contact",
        "campaign",
        "follow_up",
        "placement",
        "re_engage",
        "update_profile",
      ],
      tour_type: ["initial", "feature_update"],
    },
  },
} as const
