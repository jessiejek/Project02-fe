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
      announcements: {
        Row: {
          body: string
          created_at: string
          id: string
          is_active: boolean
          posted_by_user_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_active?: boolean
          posted_by_user_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_active?: boolean
          posted_by_user_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          details: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["audit_entity_type"]
          id: string
          performed_at: string
          performed_by_user_id: string | null
        }
        Insert: {
          action: string
          details?: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["audit_entity_type"]
          id?: string
          performed_at?: string
          performed_by_user_id?: string | null
        }
        Update: {
          action?: string
          details?: string | null
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["audit_entity_type"]
          id?: string
          performed_at?: string
          performed_by_user_id?: string | null
        }
        Relationships: []
      }
      booking_services: {
        Row: {
          booking_id: string
          price_at_booking: number
          service_id: string
        }
        Insert: {
          booking_id: string
          price_at_booking: number
          service_id: string
        }
        Update: {
          booking_id?: string
          price_at_booking?: number
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_services_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_services_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_unpaid_completed_visits"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["service_id"]
          },
        ]
      }
      bookings: {
        Row: {
          amount_due: number
          appointment_date: string
          booking_id: string
          cancellation_reason: string | null
          cancelled_by_user_id: string | null
          consultation_fee_snapshot: number
          created_at: string
          doctor_id: string
          is_walk_in: boolean
          notes: string | null
          patient_id: string
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          proof_submitted_at: string | null
          proof_type: Database["public"]["Enums"]["proof_type"] | null
          proof_value: string | null
          queue_number: string | null
          slot_end_time: string
          slot_start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          total_fee: number
          updated_at: string
        }
        Insert: {
          amount_due?: number
          appointment_date: string
          booking_id?: string
          cancellation_reason?: string | null
          cancelled_by_user_id?: string | null
          consultation_fee_snapshot?: number
          created_at?: string
          doctor_id: string
          is_walk_in?: boolean
          notes?: string | null
          patient_id: string
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          proof_submitted_at?: string | null
          proof_type?: Database["public"]["Enums"]["proof_type"] | null
          proof_value?: string | null
          queue_number?: string | null
          slot_end_time: string
          slot_start_time: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_fee?: number
          updated_at?: string
        }
        Update: {
          amount_due?: number
          appointment_date?: string
          booking_id?: string
          cancellation_reason?: string | null
          cancelled_by_user_id?: string | null
          consultation_fee_snapshot?: number
          created_at?: string
          doctor_id?: string
          is_walk_in?: boolean
          notes?: string | null
          patient_id?: string
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          proof_submitted_at?: string | null
          proof_type?: Database["public"]["Enums"]["proof_type"] | null
          proof_value?: string | null
          queue_number?: string | null
          slot_end_time?: string
          slot_start_time?: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_fee?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "bookings_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_ratings"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "bookings_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      clinic_accepted_payment_methods: {
        Row: {
          payment_method: Database["public"]["Enums"]["payment_method"]
        }
        Insert: {
          payment_method: Database["public"]["Enums"]["payment_method"]
        }
        Update: {
          payment_method?: Database["public"]["Enums"]["payment_method"]
        }
        Relationships: []
      }
      clinic_operating_hours: {
        Row: {
          close_time: string | null
          day_of_week: number
          is_closed: boolean
          open_time: string | null
        }
        Insert: {
          close_time?: string | null
          day_of_week: number
          is_closed?: boolean
          open_time?: string | null
        }
        Update: {
          close_time?: string | null
          day_of_week?: number
          is_closed?: boolean
          open_time?: string | null
        }
        Relationships: []
      }
      clinic_settings: {
        Row: {
          address: string
          clinic_name: string
          consent_version: number
          contact_number: string | null
          default_payment_mode: Database["public"]["Enums"]["payment_mode"]
          description: string | null
          email: string | null
          favicon_url: string | null
          id: number
          logo_url: string | null
          primary_color: string | null
          privacy_policy_text: string | null
          refund_policy: string | null
          secondary_color: string | null
          updated_at: string
          updated_by_user_id: string | null
          website_url: string | null
        }
        Insert: {
          address: string
          clinic_name: string
          consent_version?: number
          contact_number?: string | null
          default_payment_mode?: Database["public"]["Enums"]["payment_mode"]
          description?: string | null
          email?: string | null
          favicon_url?: string | null
          id?: number
          logo_url?: string | null
          primary_color?: string | null
          privacy_policy_text?: string | null
          refund_policy?: string | null
          secondary_color?: string | null
          updated_at?: string
          updated_by_user_id?: string | null
          website_url?: string | null
        }
        Update: {
          address?: string
          clinic_name?: string
          consent_version?: number
          contact_number?: string | null
          default_payment_mode?: Database["public"]["Enums"]["payment_mode"]
          description?: string | null
          email?: string | null
          favicon_url?: string | null
          id?: number
          logo_url?: string | null
          primary_color?: string | null
          privacy_policy_text?: string | null
          refund_policy?: string | null
          secondary_color?: string | null
          updated_at?: string
          updated_by_user_id?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      consultation_diagnoses: {
        Row: {
          consultation_id: string
          created_at: string
          custom_description: string | null
          icd10_code: string | null
          id: string
          type: Database["public"]["Enums"]["diagnosis_type"]
        }
        Insert: {
          consultation_id: string
          created_at?: string
          custom_description?: string | null
          icd10_code?: string | null
          id?: string
          type?: Database["public"]["Enums"]["diagnosis_type"]
        }
        Update: {
          consultation_id?: string
          created_at?: string
          custom_description?: string | null
          icd10_code?: string | null
          id?: string
          type?: Database["public"]["Enums"]["diagnosis_type"]
        }
        Relationships: [
          {
            foreignKeyName: "consultation_diagnoses_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["consultation_id"]
          },
          {
            foreignKeyName: "consultation_diagnoses_icd10_code_fkey"
            columns: ["icd10_code"]
            isOneToOne: false
            referencedRelation: "icd10_codes"
            referencedColumns: ["code"]
          },
        ]
      }
      consultations: {
        Row: {
          assessment: string | null
          booking_id: string
          chief_complaint: string | null
          completed_at: string | null
          completed_by_user_id: string | null
          consultation_id: string
          created_at: string
          doctor_id: string
          doctor_notes: string | null
          objective: string | null
          patient_id: string
          plan: string | null
          status: Database["public"]["Enums"]["consultation_status"]
          subjective: string | null
          updated_at: string
        }
        Insert: {
          assessment?: string | null
          booking_id: string
          chief_complaint?: string | null
          completed_at?: string | null
          completed_by_user_id?: string | null
          consultation_id?: string
          created_at?: string
          doctor_id: string
          doctor_notes?: string | null
          objective?: string | null
          patient_id: string
          plan?: string | null
          status?: Database["public"]["Enums"]["consultation_status"]
          subjective?: string | null
          updated_at?: string
        }
        Update: {
          assessment?: string | null
          booking_id?: string
          chief_complaint?: string | null
          completed_at?: string | null
          completed_by_user_id?: string | null
          consultation_id?: string
          created_at?: string
          doctor_id?: string
          doctor_notes?: string | null
          objective?: string | null
          patient_id?: string
          plan?: string | null
          status?: Database["public"]["Enums"]["consultation_status"]
          subjective?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "consultations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_unpaid_completed_visits"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "consultations_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "consultations_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_ratings"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "consultations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      doctor_blocked_dates: {
        Row: {
          blocked_date: string
          created_at: string
          doctor_id: string
          id: string
          reason: string | null
        }
        Insert: {
          blocked_date: string
          created_at?: string
          doctor_id: string
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_date?: string
          created_at?: string
          doctor_id?: string
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_blocked_dates_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "doctor_blocked_dates_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_ratings"
            referencedColumns: ["doctor_id"]
          },
        ]
      }
      doctor_day_statuses: {
        Row: {
          created_at: string
          doctor_id: string
          id: string
          running_late_minutes: number | null
          status: Database["public"]["Enums"]["doctor_day_status"]
          status_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          doctor_id: string
          id?: string
          running_late_minutes?: number | null
          status?: Database["public"]["Enums"]["doctor_day_status"]
          status_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          doctor_id?: string
          id?: string
          running_late_minutes?: number | null
          status?: Database["public"]["Enums"]["doctor_day_status"]
          status_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_day_statuses_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "doctor_day_statuses_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_ratings"
            referencedColumns: ["doctor_id"]
          },
        ]
      }
      doctor_favorite_medicines: {
        Row: {
          created_at: string
          doctor_id: string
          dosage: string
          generic_name: string
          id: string
          instruction: string | null
          medicine_id: string
          quantity: string
        }
        Insert: {
          created_at?: string
          doctor_id: string
          dosage: string
          generic_name: string
          id?: string
          instruction?: string | null
          medicine_id: string
          quantity: string
        }
        Update: {
          created_at?: string
          doctor_id?: string
          dosage?: string
          generic_name?: string
          id?: string
          instruction?: string | null
          medicine_id?: string
          quantity?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_favorite_medicines_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "doctor_favorite_medicines_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_ratings"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "doctor_favorite_medicines_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["medicine_id"]
          },
        ]
      }
      doctor_schedules: {
        Row: {
          created_at: string
          day_of_week: number
          doctor_id: string
          end_time: string
          id: string
          is_active: boolean
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          doctor_id: string
          end_time: string
          id?: string
          is_active?: boolean
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          doctor_id?: string
          end_time?: string
          id?: string
          is_active?: boolean
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_schedules_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "doctor_schedules_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_ratings"
            referencedColumns: ["doctor_id"]
          },
        ]
      }
      doctor_services: {
        Row: {
          created_at: string
          doctor_id: string
          duration_minutes: number
          service_id: string
        }
        Insert: {
          created_at?: string
          doctor_id: string
          duration_minutes: number
          service_id: string
        }
        Update: {
          created_at?: string
          doctor_id?: string
          duration_minutes?: number
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_services_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "doctor_services_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_ratings"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "doctor_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["service_id"]
          },
        ]
      }
      doctors: {
        Row: {
          bio: string | null
          consultation_fee: number
          created_at: string
          daily_patient_limit: number | null
          doctor_id: string
          license_number: string | null
          ptr_number: string | null
          s2_number: string | null
          slot_capacity: number
          slot_duration_minutes: number
          specialization: string
          updated_at: string
        }
        Insert: {
          bio?: string | null
          consultation_fee?: number
          created_at?: string
          daily_patient_limit?: number | null
          doctor_id: string
          license_number?: string | null
          ptr_number?: string | null
          s2_number?: string | null
          slot_capacity?: number
          slot_duration_minutes?: number
          specialization: string
          updated_at?: string
        }
        Update: {
          bio?: string | null
          consultation_fee?: number
          created_at?: string
          daily_patient_limit?: number | null
          doctor_id?: string
          license_number?: string | null
          ptr_number?: string | null
          s2_number?: string | null
          slot_capacity?: number
          slot_duration_minutes?: number
          specialization?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctors_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: true
            referencedRelation: "staff_accounts"
            referencedColumns: ["staff_id"]
          },
        ]
      }
      follow_ups: {
        Row: {
          consultation_id: string
          created_at: string
          doctor_id: string
          follow_up_date: string
          id: string
          instructions: string | null
          patient_id: string
          reason: string | null
          reminder_enabled: boolean
          status: Database["public"]["Enums"]["follow_up_status"]
          updated_at: string
        }
        Insert: {
          consultation_id: string
          created_at?: string
          doctor_id: string
          follow_up_date: string
          id?: string
          instructions?: string | null
          patient_id: string
          reason?: string | null
          reminder_enabled?: boolean
          status?: Database["public"]["Enums"]["follow_up_status"]
          updated_at?: string
        }
        Update: {
          consultation_id?: string
          created_at?: string
          doctor_id?: string
          follow_up_date?: string
          id?: string
          instructions?: string | null
          patient_id?: string
          reason?: string | null
          reminder_enabled?: boolean
          status?: Database["public"]["Enums"]["follow_up_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: true
            referencedRelation: "consultations"
            referencedColumns: ["consultation_id"]
          },
          {
            foreignKeyName: "follow_ups_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "follow_ups_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_ratings"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "follow_ups_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      icd10_codes: {
        Row: {
          code: string
          description: string
        }
        Insert: {
          code: string
          description: string
        }
        Update: {
          code?: string
          description?: string
        }
        Relationships: []
      }
      lab_orders: {
        Row: {
          clinical_indication: string | null
          consultation_id: string
          created_at: string
          doctor_id: string
          lab_order_id: string
          notes: string | null
          patient_id: string
          reason: string | null
          requested_at: string
          result_attachment_url: string | null
          specimen_type: string | null
          status: Database["public"]["Enums"]["lab_order_status"]
          test_code: string | null
          test_name: string
          updated_at: string
        }
        Insert: {
          clinical_indication?: string | null
          consultation_id: string
          created_at?: string
          doctor_id: string
          lab_order_id?: string
          notes?: string | null
          patient_id: string
          reason?: string | null
          requested_at?: string
          result_attachment_url?: string | null
          specimen_type?: string | null
          status?: Database["public"]["Enums"]["lab_order_status"]
          test_code?: string | null
          test_name: string
          updated_at?: string
        }
        Update: {
          clinical_indication?: string | null
          consultation_id?: string
          created_at?: string
          doctor_id?: string
          lab_order_id?: string
          notes?: string | null
          patient_id?: string
          reason?: string | null
          requested_at?: string
          result_attachment_url?: string | null
          specimen_type?: string | null
          status?: Database["public"]["Enums"]["lab_order_status"]
          test_code?: string | null
          test_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_orders_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["consultation_id"]
          },
          {
            foreignKeyName: "lab_orders_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "lab_orders_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_ratings"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "lab_orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      medicines: {
        Row: {
          created_at: string
          generic_name: string
          medicine_id: string
        }
        Insert: {
          created_at?: string
          generic_name: string
          medicine_id?: string
        }
        Update: {
          created_at?: string
          generic_name?: string
          medicine_id?: string
        }
        Relationships: []
      }
      patient_documents: {
        Row: {
          booking_id: string
          consultation_id: string | null
          description: string | null
          file_content_type: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          patient_id: string
          title: string | null
          uploaded_at: string
          uploaded_by_user_id: string | null
        }
        Insert: {
          booking_id: string
          consultation_id?: string | null
          description?: string | null
          file_content_type?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          patient_id: string
          title?: string | null
          uploaded_at?: string
          uploaded_by_user_id?: string | null
        }
        Update: {
          booking_id?: string
          consultation_id?: string | null
          description?: string | null
          file_content_type?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          patient_id?: string
          title?: string | null
          uploaded_at?: string
          uploaded_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_documents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "patient_documents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_unpaid_completed_visits"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "patient_documents_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["consultation_id"]
          },
          {
            foreignKeyName: "patient_documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      patient_lab_results: {
        Row: {
          booking_id: string
          consultation_id: string | null
          file_content_type: string | null
          file_name: string
          file_url: string
          id: string
          lab_order_id: string | null
          patient_id: string
          result_text: string | null
          result_title: string | null
          status: string
          uploaded_at: string
        }
        Insert: {
          booking_id: string
          consultation_id?: string | null
          file_content_type?: string | null
          file_name: string
          file_url: string
          id?: string
          lab_order_id?: string | null
          patient_id: string
          result_text?: string | null
          result_title?: string | null
          status?: string
          uploaded_at?: string
        }
        Update: {
          booking_id?: string
          consultation_id?: string | null
          file_content_type?: string | null
          file_name?: string
          file_url?: string
          id?: string
          lab_order_id?: string | null
          patient_id?: string
          result_text?: string | null
          result_title?: string | null
          status?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_lab_results_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "patient_lab_results_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_unpaid_completed_visits"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "patient_lab_results_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["consultation_id"]
          },
          {
            foreignKeyName: "patient_lab_results_lab_order_id_fkey"
            columns: ["lab_order_id"]
            isOneToOne: false
            referencedRelation: "lab_orders"
            referencedColumns: ["lab_order_id"]
          },
          {
            foreignKeyName: "patient_lab_results_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      patient_vaccinations: {
        Row: {
          administered_by: string | null
          administered_date: string | null
          consultation_id: string | null
          created_at: string
          dose_number: number | null
          expiry_date: string | null
          id: string
          lot_number: string | null
          manufacturer: string | null
          next_dose_date: string | null
          notes: string | null
          patient_id: string
          reaction_notes: string | null
          route: string | null
          site: string | null
          source: Database["public"]["Enums"]["vaccination_source"]
          status: Database["public"]["Enums"]["vaccination_status"]
          updated_at: string
          vaccine_name: string
        }
        Insert: {
          administered_by?: string | null
          administered_date?: string | null
          consultation_id?: string | null
          created_at?: string
          dose_number?: number | null
          expiry_date?: string | null
          id?: string
          lot_number?: string | null
          manufacturer?: string | null
          next_dose_date?: string | null
          notes?: string | null
          patient_id: string
          reaction_notes?: string | null
          route?: string | null
          site?: string | null
          source?: Database["public"]["Enums"]["vaccination_source"]
          status?: Database["public"]["Enums"]["vaccination_status"]
          updated_at?: string
          vaccine_name: string
        }
        Update: {
          administered_by?: string | null
          administered_date?: string | null
          consultation_id?: string | null
          created_at?: string
          dose_number?: number | null
          expiry_date?: string | null
          id?: string
          lot_number?: string | null
          manufacturer?: string | null
          next_dose_date?: string | null
          notes?: string | null
          patient_id?: string
          reaction_notes?: string | null
          route?: string | null
          site?: string | null
          source?: Database["public"]["Enums"]["vaccination_source"]
          status?: Database["public"]["Enums"]["vaccination_status"]
          updated_at?: string
          vaccine_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_vaccinations_administered_by_fkey"
            columns: ["administered_by"]
            isOneToOne: false
            referencedRelation: "staff_accounts"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "patient_vaccinations_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["consultation_id"]
          },
          {
            foreignKeyName: "patient_vaccinations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      patient_vital_readings: {
        Row: {
          booking_id: string
          created_at: string
          id: string
          patient_id: string
          recorded_at: string
          template_id: string
          updated_at: string
          value: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          patient_id: string
          recorded_at?: string
          template_id: string
          updated_at?: string
          value: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          patient_id?: string
          recorded_at?: string
          template_id?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_vital_readings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "patient_vital_readings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_unpaid_completed_visits"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "patient_vital_readings_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_vital_readings_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "vital_field_templates"
            referencedColumns: ["template_id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          blood_type: string | null
          city: string | null
          civil_status: string | null
          consent_version: number
          consented_at: string | null
          contact_number: string | null
          created_at: string
          date_of_birth: string
          email: string
          emergency_contact_name: string | null
          emergency_contact_number: string | null
          emergency_contact_relationship: string | null
          first_name: string
          hmo_card_number: string | null
          hmo_provider: string | null
          is_email_verified: boolean
          is_guest: boolean
          last_name: string
          middle_name: string | null
          patient_code: string
          patient_id: string
          philhealth_number: string | null
          sex: Database["public"]["Enums"]["sex_type"]
          updated_at: string
          user_id: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          blood_type?: string | null
          city?: string | null
          civil_status?: string | null
          consent_version?: number
          consented_at?: string | null
          contact_number?: string | null
          created_at?: string
          date_of_birth: string
          email: string
          emergency_contact_name?: string | null
          emergency_contact_number?: string | null
          emergency_contact_relationship?: string | null
          first_name: string
          hmo_card_number?: string | null
          hmo_provider?: string | null
          is_email_verified?: boolean
          is_guest?: boolean
          last_name: string
          middle_name?: string | null
          patient_code: string
          patient_id?: string
          philhealth_number?: string | null
          sex: Database["public"]["Enums"]["sex_type"]
          updated_at?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          blood_type?: string | null
          city?: string | null
          civil_status?: string | null
          consent_version?: number
          consented_at?: string | null
          contact_number?: string | null
          created_at?: string
          date_of_birth?: string
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_number?: string | null
          emergency_contact_relationship?: string | null
          first_name?: string
          hmo_card_number?: string | null
          hmo_provider?: string | null
          is_email_verified?: boolean
          is_guest?: boolean
          last_name?: string
          middle_name?: string | null
          patient_code?: string
          patient_id?: string
          philhealth_number?: string | null
          sex?: Database["public"]["Enums"]["sex_type"]
          updated_at?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          amount_received: number | null
          booking_id: string
          confirm_notes: string | null
          confirmed_at: string | null
          confirmed_by_user_id: string | null
          created_at: string
          or_number: string | null
          payment_id: string
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          reference_number: string | null
          refund_amount: number | null
          refund_reason: string | null
          refunded_at: string | null
          refunded_by_user_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          waived_at: string | null
          waived_by_user_id: string | null
          waived_reason: string | null
        }
        Insert: {
          amount: number
          amount_received?: number | null
          booking_id: string
          confirm_notes?: string | null
          confirmed_at?: string | null
          confirmed_by_user_id?: string | null
          created_at?: string
          or_number?: string | null
          payment_id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          reference_number?: string | null
          refund_amount?: number | null
          refund_reason?: string | null
          refunded_at?: string | null
          refunded_by_user_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          waived_at?: string | null
          waived_by_user_id?: string | null
          waived_reason?: string | null
        }
        Update: {
          amount?: number
          amount_received?: number | null
          booking_id?: string
          confirm_notes?: string | null
          confirmed_at?: string | null
          confirmed_by_user_id?: string | null
          created_at?: string
          or_number?: string | null
          payment_id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          reference_number?: string | null
          refund_amount?: number | null
          refund_reason?: string | null
          refunded_at?: string | null
          refunded_by_user_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          waived_at?: string | null
          waived_by_user_id?: string | null
          waived_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_unpaid_completed_visits"
            referencedColumns: ["booking_id"]
          },
        ]
      }
      prescription_groups: {
        Row: {
          booking_id: string
          created_at: string
          doctor_id: string
          group_id: string
          patient_id: string
          updated_at: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          doctor_id: string
          group_id?: string
          patient_id: string
          updated_at?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          doctor_id?: string
          group_id?: string
          patient_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescription_groups_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "prescription_groups_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_unpaid_completed_visits"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "prescription_groups_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "prescription_groups_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_ratings"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "prescription_groups_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      prescription_line_items: {
        Row: {
          created_at: string
          dosage: string
          generic_name: string
          group_id: string
          id: string
          instruction: string | null
          is_controlled_substance: boolean
          medicine_id: string
          quantity: string
        }
        Insert: {
          created_at?: string
          dosage: string
          generic_name: string
          group_id: string
          id?: string
          instruction?: string | null
          is_controlled_substance?: boolean
          medicine_id: string
          quantity: string
        }
        Update: {
          created_at?: string
          dosage?: string
          generic_name?: string
          group_id?: string
          id?: string
          instruction?: string | null
          is_controlled_substance?: boolean
          medicine_id?: string
          quantity?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescription_line_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "prescription_groups"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "prescription_line_items_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["medicine_id"]
          },
        ]
      }
      prescription_template_items: {
        Row: {
          created_at: string
          dosage: string
          generic_name: string
          id: string
          instruction: string | null
          is_controlled_substance: boolean
          medicine_id: string
          quantity: string
          template_id: string
        }
        Insert: {
          created_at?: string
          dosage: string
          generic_name: string
          id?: string
          instruction?: string | null
          is_controlled_substance?: boolean
          medicine_id: string
          quantity: string
          template_id: string
        }
        Update: {
          created_at?: string
          dosage?: string
          generic_name?: string
          id?: string
          instruction?: string | null
          is_controlled_substance?: boolean
          medicine_id?: string
          quantity?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescription_template_items_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["medicine_id"]
          },
          {
            foreignKeyName: "prescription_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "prescription_templates"
            referencedColumns: ["template_id"]
          },
        ]
      }
      prescription_templates: {
        Row: {
          created_at: string
          doctor_id: string
          is_system_template: boolean
          template_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          doctor_id: string
          is_system_template?: boolean
          template_id?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          doctor_id?: string
          is_system_template?: boolean
          template_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescription_templates_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "prescription_templates_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_ratings"
            referencedColumns: ["doctor_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      reviews: {
        Row: {
          booking_id: string
          comment: string | null
          created_at: string
          doctor_id: string
          patient_id: string
          rating: number
          review_id: string
        }
        Insert: {
          booking_id: string
          comment?: string | null
          created_at?: string
          doctor_id: string
          patient_id: string
          rating: number
          review_id?: string
        }
        Update: {
          booking_id?: string
          comment?: string | null
          created_at?: string
          doctor_id?: string
          patient_id?: string
          rating?: number
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_unpaid_completed_visits"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "reviews_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "reviews_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_ratings"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "reviews_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      services: {
        Row: {
          category: Database["public"]["Enums"]["service_category"]
          created_at: string
          description: string | null
          is_active: boolean
          name: string
          price: number
          service_id: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["service_category"]
          created_at?: string
          description?: string | null
          is_active?: boolean
          name: string
          price?: number
          service_id?: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["service_category"]
          created_at?: string
          description?: string | null
          is_active?: boolean
          name?: string
          price?: number
          service_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      soap_phrases: {
        Row: {
          body: string
          created_at: string
          doctor_id: string
          field: Database["public"]["Enums"]["soap_field"]
          id: string
          label: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          doctor_id: string
          field: Database["public"]["Enums"]["soap_field"]
          id?: string
          label: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          doctor_id?: string
          field?: Database["public"]["Enums"]["soap_field"]
          id?: string
          label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "soap_phrases_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "soap_phrases_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_ratings"
            referencedColumns: ["doctor_id"]
          },
        ]
      }
      soap_templates: {
        Row: {
          assessment: string | null
          chief_complaint: string | null
          created_at: string
          doctor_id: string
          id: string
          is_system_template: boolean
          objective: string | null
          plan: string | null
          subjective: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assessment?: string | null
          chief_complaint?: string | null
          created_at?: string
          doctor_id: string
          id?: string
          is_system_template?: boolean
          objective?: string | null
          plan?: string | null
          subjective?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assessment?: string | null
          chief_complaint?: string | null
          created_at?: string
          doctor_id?: string
          id?: string
          is_system_template?: boolean
          objective?: string | null
          plan?: string | null
          subjective?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "soap_templates_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "soap_templates_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_ratings"
            referencedColumns: ["doctor_id"]
          },
        ]
      }
      staff_accounts: {
        Row: {
          avatar_url: string | null
          contact_number: string | null
          created_at: string
          email: string
          full_name: string
          invited_at: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["staff_role"]
          staff_id: string
          status: Database["public"]["Enums"]["staff_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          contact_number?: string | null
          created_at?: string
          email: string
          full_name: string
          invited_at?: string
          revoked_at?: string | null
          role: Database["public"]["Enums"]["staff_role"]
          staff_id?: string
          status?: Database["public"]["Enums"]["staff_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          contact_number?: string | null
          created_at?: string
          email?: string
          full_name?: string
          invited_at?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          staff_id?: string
          status?: Database["public"]["Enums"]["staff_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vital_field_templates: {
        Row: {
          created_at: string
          description: string
          form_key: string
          icon: string
          is_default: boolean
          template_id: string
          unit: string
        }
        Insert: {
          created_at?: string
          description: string
          form_key: string
          icon: string
          is_default?: boolean
          template_id?: string
          unit?: string
        }
        Update: {
          created_at?: string
          description?: string
          form_key?: string
          icon?: string
          is_default?: boolean
          template_id?: string
          unit?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_daily_booking_summary: {
        Row: {
          appointment_date: string | null
          completed_count: number | null
          no_show_count: number | null
          paid_count: number | null
          revenue: number | null
          total_bookings: number | null
          unpaid_count: number | null
        }
        Relationships: []
      }
      v_doctor_ratings: {
        Row: {
          average_rating: number | null
          doctor_id: string | null
          review_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "doctors_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: true
            referencedRelation: "staff_accounts"
            referencedColumns: ["staff_id"]
          },
        ]
      }
      v_pending_follow_ups: {
        Row: {
          doctor_id: string | null
          doctor_name: string | null
          follow_up_date: string | null
          follow_up_id: string | null
          patient_id: string | null
          patient_name: string | null
          reason: string | null
          status: Database["public"]["Enums"]["follow_up_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "follow_ups_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_ratings"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "follow_ups_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      v_unpaid_completed_visits: {
        Row: {
          amount_due: number | null
          appointment_date: string | null
          booking_id: string | null
          doctor_id: string | null
          doctor_name: string | null
          patient_code: string | null
          patient_id: string | null
          patient_name: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "bookings_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_ratings"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "bookings_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["patient_id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      audit_entity_type:
        | "Booking"
        | "Patient"
        | "Doctor"
        | "Payment"
        | "Settings"
        | "Consultation"
        | "Staff"
      booking_status:
        | "Pending"
        | "ProofSubmitted"
        | "Confirmed"
        | "CheckedIn"
        | "InProgress"
        | "OnHold"
        | "Cancelled"
        | "Completed"
        | "Expired"
        | "NoShow"
        | "Rescheduled"
      consultation_status: "Draft" | "Completed" | "Amended"
      diagnosis_type: "Primary" | "Secondary" | "Differential" | "Comorbidity"
      doctor_day_status: "Available" | "RunningLate" | "UnavailableToday"
      follow_up_status: "Pending" | "Completed"
      lab_order_status: "Requested" | "Completed"
      payment_method: "Cash" | "GCash" | "Maya" | "BankTransfer"
      payment_mode: "Online" | "PayAtClinic"
      payment_status: "Unpaid" | "Paid" | "Waived" | "Refunded"
      proof_type: "ReferenceNumber" | "Screenshot"
      service_category:
        | "Consultation"
        | "Procedure"
        | "Laboratory"
        | "Diagnostic"
      sex_type: "Male" | "Female"
      soap_field:
        | "ChiefComplaint"
        | "Subjective"
        | "Objective"
        | "Assessment"
        | "Plan"
      staff_role: "Staff" | "Doctor" | "Admin"
      staff_status: "Active" | "Inactive" | "Invited" | "OnLeave"
      user_role: "Patient" | "Staff" | "Doctor" | "Admin"
      vaccination_source:
        | "AdministeredInClinic"
        | "PatientReported"
        | "ExternalRecord"
      vaccination_status: "Administered" | "Scheduled" | "Overdue"
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
      audit_entity_type: [
        "Booking",
        "Patient",
        "Doctor",
        "Payment",
        "Settings",
        "Consultation",
        "Staff",
      ],
      booking_status: [
        "Pending",
        "ProofSubmitted",
        "Confirmed",
        "CheckedIn",
        "InProgress",
        "OnHold",
        "Cancelled",
        "Completed",
        "Expired",
        "NoShow",
        "Rescheduled",
      ],
      consultation_status: ["Draft", "Completed", "Amended"],
      diagnosis_type: ["Primary", "Secondary", "Differential", "Comorbidity"],
      doctor_day_status: ["Available", "RunningLate", "UnavailableToday"],
      follow_up_status: ["Pending", "Completed"],
      lab_order_status: ["Requested", "Completed"],
      payment_method: ["Cash", "GCash", "Maya", "BankTransfer"],
      payment_mode: ["Online", "PayAtClinic"],
      payment_status: ["Unpaid", "Paid", "Waived", "Refunded"],
      proof_type: ["ReferenceNumber", "Screenshot"],
      service_category: [
        "Consultation",
        "Procedure",
        "Laboratory",
        "Diagnostic",
      ],
      sex_type: ["Male", "Female"],
      soap_field: [
        "ChiefComplaint",
        "Subjective",
        "Objective",
        "Assessment",
        "Plan",
      ],
      staff_role: ["Staff", "Doctor", "Admin"],
      staff_status: ["Active", "Inactive", "Invited", "OnLeave"],
      user_role: ["Patient", "Staff", "Doctor", "Admin"],
      vaccination_source: [
        "AdministeredInClinic",
        "PatientReported",
        "ExternalRecord",
      ],
      vaccination_status: ["Administered", "Scheduled", "Overdue"],
    },
  },
} as const
