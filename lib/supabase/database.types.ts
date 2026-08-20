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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      academic_sessions: {
        Row: {
          end_date: string
          id: string
          is_current: boolean
          name: string
          school_id: string
          start_date: string
        }
        Insert: {
          end_date: string
          id?: string
          is_current?: boolean
          name: string
          school_id: string
          start_date: string
        }
        Update: {
          end_date?: string
          id?: string
          is_current?: boolean
          name?: string
          school_id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          audience_id: string | null
          audience_type: string
          body: string
          created_by: string | null
          id: string
          published_at: string | null
          school_id: string
          title: string
        }
        Insert: {
          audience_id?: string | null
          audience_type?: string
          body: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          school_id: string
          title: string
        }
        Update: {
          audience_id?: string | null
          audience_type?: string
          body?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          school_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      arms: {
        Row: {
          class_id: string
          id: string
          name: string
          school_id: string
        }
        Insert: {
          class_id: string
          id?: string
          name: string
          school_id: string
        }
        Update: {
          class_id?: string
          id?: string
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arms_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_types: {
        Row: {
          id: string
          name: string
          school_id: string
          weight: number
        }
        Insert: {
          id?: string
          name: string
          school_id: string
          weight: number
        }
        Update: {
          id?: string
          name?: string
          school_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessment_types_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          arm_id: string | null
          class_id: string
          date: string
          id: string
          marked_by: string | null
          school_id: string
          status_id: string
          student_id: string
        }
        Insert: {
          arm_id?: string | null
          class_id: string
          date: string
          id?: string
          marked_by?: string | null
          school_id: string
          status_id: string
          student_id: string
        }
        Update: {
          arm_id?: string | null
          class_id?: string
          date?: string
          id?: string
          marked_by?: string | null
          school_id?: string
          status_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_arm_id_fkey"
            columns: ["arm_id"]
            isOneToOne: false
            referencedRelation: "arms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "attendance_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_statuses: {
        Row: {
          code: string
          counts_as_present: boolean
          id: string
          label: string
          school_id: string
        }
        Insert: {
          code: string
          counts_as_present?: boolean
          id?: string
          label: string
          school_id: string
        }
        Update: {
          code?: string
          counts_as_present?: boolean
          id?: string
          label?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_statuses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          new_value: Json | null
          old_value: Json | null
          school_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          school_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      class_subjects: {
        Row: {
          arm_id: string | null
          class_id: string
          id: string
          school_id: string
          session_id: string
          subject_id: string
          teacher_id: string | null
        }
        Insert: {
          arm_id?: string | null
          class_id: string
          id?: string
          school_id: string
          session_id: string
          subject_id: string
          teacher_id?: string | null
        }
        Update: {
          arm_id?: string | null
          class_id?: string
          id?: string
          school_id?: string
          session_id?: string
          subject_id?: string
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_subjects_arm_id_fkey"
            columns: ["arm_id"]
            isOneToOne: false
            referencedRelation: "arms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          department_id: string | null
          id: string
          level: number | null
          name: string
          school_id: string
        }
        Insert: {
          department_id?: string | null
          id?: string
          level?: number | null
          name: string
          school_id: string
        }
        Update: {
          department_id?: string | null
          id?: string
          level?: number | null
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_definitions: {
        Row: {
          entity_type: string
          field_key: string
          field_type: string
          id: string
          is_required: boolean
          label: string
          options: Json | null
          school_id: string
          sort_order: number | null
        }
        Insert: {
          entity_type: string
          field_key: string
          field_type: string
          id?: string
          is_required?: boolean
          label: string
          options?: Json | null
          school_id: string
          sort_order?: number | null
        }
        Update: {
          entity_type?: string
          field_key?: string
          field_type?: string
          id?: string
          is_required?: boolean
          label?: string
          options?: Json | null
          school_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_definitions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_values: {
        Row: {
          definition_id: string
          entity_id: string
          id: string
          school_id: string
          value: Json | null
        }
        Insert: {
          definition_id: string
          entity_id: string
          id?: string
          school_id: string
          value?: Json | null
        }
        Update: {
          definition_id?: string
          entity_id?: string
          id?: string
          school_id?: string
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_values_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "custom_field_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_field_values_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          id: string
          name: string
          school_id: string
        }
        Insert: {
          id?: string
          name: string
          school_id: string
        }
        Update: {
          id?: string
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string | null
          created_at: string
          file_url: string
          id: string
          school_id: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          file_url: string
          id?: string
          school_id: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          file_url?: string
          id?: string
          school_id?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enrolments: {
        Row: {
          arm_id: string | null
          class_id: string
          id: string
          school_id: string
          session_id: string
          student_id: string
        }
        Insert: {
          arm_id?: string | null
          class_id: string
          id?: string
          school_id: string
          session_id: string
          student_id: string
        }
        Update: {
          arm_id?: string | null
          class_id?: string
          id?: string
          school_id?: string
          session_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrolments_arm_id_fkey"
            columns: ["arm_id"]
            isOneToOne: false
            referencedRelation: "arms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrolments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrolments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrolments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrolments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_structures: {
        Row: {
          amount: number
          class_id: string | null
          id: string
          name: string
          school_id: string
          session_id: string
          term_id: string | null
        }
        Insert: {
          amount: number
          class_id?: string | null
          id?: string
          name: string
          school_id: string
          session_id: string
          term_id?: string | null
        }
        Update: {
          amount?: number
          class_id?: string | null
          id?: string
          name?: string
          school_id?: string
          session_id?: string
          term_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fee_structures_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_structures_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_structures_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_structures_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_bands: {
        Row: {
          grade: string
          id: string
          max_score: number
          min_score: number
          remark: string | null
          scale_id: string
        }
        Insert: {
          grade: string
          id?: string
          max_score: number
          min_score: number
          remark?: string | null
          scale_id: string
        }
        Update: {
          grade?: string
          id?: string
          max_score?: number
          min_score?: number
          remark?: string | null
          scale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grade_bands_scale_id_fkey"
            columns: ["scale_id"]
            isOneToOne: false
            referencedRelation: "grading_scales"
            referencedColumns: ["id"]
          },
        ]
      }
      grading_scales: {
        Row: {
          id: string
          is_default: boolean | null
          name: string
          school_id: string
        }
        Insert: {
          id?: string
          is_default?: boolean | null
          name: string
          school_id: string
        }
        Update: {
          id?: string
          is_default?: boolean | null
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grading_scales_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      guardians: {
        Row: {
          email: string | null
          first_name: string
          id: string
          last_name: string
          phone: string | null
          profile_id: string | null
          relationship: string | null
          school_id: string
        }
        Insert: {
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          profile_id?: string | null
          relationship?: string | null
          school_id: string
        }
        Update: {
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          profile_id?: string | null
          relationship?: string | null
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardians_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardians_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read_at: string | null
          school_id: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read_at?: string | null
          school_id: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read_at?: string | null
          school_id?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_paid: number
          fee_structure_id: string | null
          id: string
          paid_at: string | null
          payment_method: string | null
          reference: string | null
          school_id: string
          student_id: string
        }
        Insert: {
          amount_paid: number
          fee_structure_id?: string | null
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          reference?: string | null
          school_id: string
          student_id: string
        }
        Update: {
          amount_paid?: number
          fee_structure_id?: string | null
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          reference?: string | null
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_fee_structure_id_fkey"
            columns: ["fee_structure_id"]
            isOneToOne: false
            referencedRelation: "fee_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          code: string
          description: string | null
          id: string
        }
        Insert: {
          code: string
          description?: string | null
          id?: string
        }
        Update: {
          code?: string
          description?: string | null
          id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          phone: string | null
          school_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          first_name: string
          id: string
          is_active?: boolean
          last_name: string
          phone?: string | null
          school_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          phone?: string | null
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      result_batches: {
        Row: {
          arm_id: string | null
          class_id: string
          created_at: string
          current_stage_id: string | null
          id: string
          published_at: string | null
          school_id: string
          status: string
          subject_id: string
          submitted_at: string | null
          submitted_by: string | null
          term_id: string
          workflow_template_id: string
        }
        Insert: {
          arm_id?: string | null
          class_id: string
          created_at?: string
          current_stage_id?: string | null
          id?: string
          published_at?: string | null
          school_id: string
          status?: string
          subject_id: string
          submitted_at?: string | null
          submitted_by?: string | null
          term_id: string
          workflow_template_id: string
        }
        Update: {
          arm_id?: string | null
          class_id?: string
          created_at?: string
          current_stage_id?: string | null
          id?: string
          published_at?: string | null
          school_id?: string
          status?: string
          subject_id?: string
          submitted_at?: string | null
          submitted_by?: string | null
          term_id?: string
          workflow_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "result_batches_arm_id_fkey"
            columns: ["arm_id"]
            isOneToOne: false
            referencedRelation: "arms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_batches_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_batches_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "workflow_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_batches_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_batches_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_batches_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_batches_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_batches_workflow_template_id_fkey"
            columns: ["workflow_template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      result_computation_rules: {
        Row: {
          exclude_electives_from_rank: boolean
          id: string
          rank_by: string
          ranking_enabled: boolean
          school_id: string
          show_rank_to_parents: boolean
          show_rank_to_students: boolean
        }
        Insert: {
          exclude_electives_from_rank?: boolean
          id?: string
          rank_by?: string
          ranking_enabled?: boolean
          school_id: string
          show_rank_to_parents?: boolean
          show_rank_to_students?: boolean
        }
        Update: {
          exclude_electives_from_rank?: boolean
          id?: string
          rank_by?: string
          ranking_enabled?: boolean
          school_id?: string
          show_rank_to_parents?: boolean
          show_rank_to_students?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "result_computation_rules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      result_remarks: {
        Row: {
          class_teacher_remark: string | null
          created_by: string | null
          id: string
          principal_remark: string | null
          school_id: string
          student_id: string
          term_id: string
          updated_at: string
        }
        Insert: {
          class_teacher_remark?: string | null
          created_by?: string | null
          id?: string
          principal_remark?: string | null
          school_id: string
          student_id: string
          term_id: string
          updated_at?: string
        }
        Update: {
          class_teacher_remark?: string | null
          created_by?: string | null
          id?: string
          principal_remark?: string | null
          school_id?: string
          student_id?: string
          term_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "result_remarks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_remarks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_remarks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_remarks_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      results: {
        Row: {
          assessment_type_id: string
          batch_id: string
          created_at: string
          entered_by: string | null
          id: string
          school_id: string
          score: number
          student_id: string
          subject_id: string
          term_id: string
          updated_at: string
        }
        Insert: {
          assessment_type_id: string
          batch_id: string
          created_at?: string
          entered_by?: string | null
          id?: string
          school_id: string
          score: number
          student_id: string
          subject_id: string
          term_id: string
          updated_at?: string
        }
        Update: {
          assessment_type_id?: string
          batch_id?: string
          created_at?: string
          entered_by?: string | null
          id?: string
          school_id?: string
          score?: number
          student_id?: string
          subject_id?: string
          term_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "results_assessment_type_id_fkey"
            columns: ["assessment_type_id"]
            isOneToOne: false
            referencedRelation: "assessment_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "result_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          description: string | null
          id: string
          is_system: boolean
          name: string
          school_id: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          school_id?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_settings: {
        Row: {
          key: string
          school_id: string
          value: Json
        }
        Insert: {
          key: string
          school_id: string
          value: Json
        }
        Update: {
          key?: string
          school_id?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "school_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          phone: string | null
          primary_color: string | null
          slug: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          phone?: string | null
          primary_color?: string | null
          slug: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          phone?: string | null
          primary_color?: string | null
          slug?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          created_at: string
          department_id: string | null
          employment_date: string | null
          id: string
          profile_id: string | null
          qualification: string | null
          school_id: string
          staff_no: string
          status: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          employment_date?: string | null
          id?: string
          profile_id?: string | null
          qualification?: string | null
          school_id: string
          staff_no: string
          status?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          employment_date?: string | null
          id?: string
          profile_id?: string | null
          qualification?: string | null
          school_id?: string
          staff_no?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      student_guardians: {
        Row: {
          guardian_id: string
          is_primary_contact: boolean | null
          student_id: string
        }
        Insert: {
          guardian_id: string
          is_primary_contact?: boolean | null
          student_id: string
        }
        Update: {
          guardian_id?: string
          is_primary_contact?: boolean | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_guardians_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_guardians_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          admission_no: string
          created_at: string
          date_of_birth: string | null
          first_name: string
          gender: string | null
          id: string
          last_name: string
          profile_id: string | null
          school_id: string
          status: string
        }
        Insert: {
          admission_no: string
          created_at?: string
          date_of_birth?: string | null
          first_name: string
          gender?: string | null
          id?: string
          last_name: string
          profile_id?: string | null
          school_id: string
          status?: string
        }
        Update: {
          admission_no?: string
          created_at?: string
          date_of_birth?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          last_name?: string
          profile_id?: string | null
          school_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string | null
          id: string
          name: string
          school_id: string
        }
        Insert: {
          code?: string | null
          id?: string
          name: string
          school_id: string
        }
        Update: {
          code?: string | null
          id?: string
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: string
          school_id: string
          status: string
          trial_ends_at: string | null
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan: string
          school_id: string
          status: string
          trial_ends_at?: string | null
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          school_id?: string
          status?: string
          trial_ends_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_class_assignments: {
        Row: {
          arm_id: string | null
          class_id: string
          id: string
          role: string
          school_id: string
          session_id: string
          teacher_id: string
        }
        Insert: {
          arm_id?: string | null
          class_id: string
          id?: string
          role?: string
          school_id: string
          session_id: string
          teacher_id: string
        }
        Update: {
          arm_id?: string | null
          class_id?: string
          id?: string
          role?: string
          school_id?: string
          session_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_class_assignments_arm_id_fkey"
            columns: ["arm_id"]
            isOneToOne: false
            referencedRelation: "arms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_class_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_class_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_class_assignments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_class_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      terms: {
        Row: {
          end_date: string
          id: string
          is_current: boolean
          name: string
          school_id: string
          session_id: string
          start_date: string
        }
        Insert: {
          end_date: string
          id?: string
          is_current?: boolean
          name: string
          school_id: string
          session_id: string
          start_date: string
        }
        Update: {
          end_date?: string
          id?: string
          is_current?: boolean
          name?: string
          school_id?: string
          session_id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "terms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terms_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable_entries: {
        Row: {
          arm_id: string | null
          class_id: string
          day_of_week: number
          end_time: string | null
          id: string
          period: number
          school_id: string
          start_time: string | null
          subject_id: string | null
          teacher_id: string | null
          term_id: string
        }
        Insert: {
          arm_id?: string | null
          class_id: string
          day_of_week: number
          end_time?: string | null
          id?: string
          period: number
          school_id: string
          start_time?: string | null
          subject_id?: string | null
          teacher_id?: string | null
          term_id: string
        }
        Update: {
          arm_id?: string | null
          class_id?: string
          day_of_week?: number
          end_time?: string | null
          id?: string
          period?: number
          school_id?: string
          start_time?: string | null
          subject_id?: string | null
          teacher_id?: string | null
          term_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timetable_entries_arm_id_fkey"
            columns: ["arm_id"]
            isOneToOne: false
            referencedRelation: "arms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_entries_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_entries_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_entries_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_entries_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          role_id: string
          school_id: string
          user_id: string
        }
        Insert: {
          role_id: string
          school_id: string
          user_id: string
        }
        Update: {
          role_id?: string
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_actions: {
        Row: {
          action: string
          actor_id: string | null
          batch_id: string
          comment: string | null
          created_at: string
          id: string
          school_id: string
          stage_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          batch_id: string
          comment?: string | null
          created_at?: string
          id?: string
          school_id: string
          stage_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          batch_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          school_id?: string
          stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_actions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_actions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "result_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_actions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_actions_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "workflow_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_stages: {
        Row: {
          approver_role_id: string | null
          id: string
          is_final: boolean
          name: string
          school_id: string
          sequence_order: number
          template_id: string
        }
        Insert: {
          approver_role_id?: string | null
          id?: string
          is_final?: boolean
          name: string
          school_id: string
          sequence_order: number
          template_id: string
        }
        Update: {
          approver_role_id?: string | null
          id?: string
          is_final?: boolean
          name?: string
          school_id?: string
          sequence_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_stages_approver_role_id_fkey"
            columns: ["approver_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_stages_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_stages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_templates: {
        Row: {
          id: string
          is_active: boolean
          name: string
          school_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          name: string
          school_id: string
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_school_id: { Args: never; Returns: string }
      has_permission: { Args: { perm_code: string }; Returns: boolean }
      in_teacher_scope: {
        Args: { check_arm_id: string; check_class_id: string }
        Returns: boolean
      }
      my_guardian_student_ids: { Args: never; Returns: string[] }
      my_student_id: { Args: never; Returns: string }
      seed_default_attendance_statuses: {
        Args: { target_school_id: string }
        Returns: undefined
      }
      seed_default_grading_scale: {
        Args: { target_school_id: string }
        Returns: undefined
      }
      teacher_class_scope: {
        Args: never
        Returns: {
          arm_id: string
          class_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
