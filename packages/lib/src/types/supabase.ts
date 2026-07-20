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
      academic_years: {
        Row: {
          ends_on: string | null
          id: string
          is_current: boolean
          label: string
          school_id: string
          starts_on: string | null
        }
        Insert: {
          ends_on?: string | null
          id?: string
          is_current?: boolean
          label: string
          school_id: string
          starts_on?: string | null
        }
        Update: {
          ends_on?: string | null
          id?: string
          is_current?: boolean
          label?: string
          school_id?: string
          starts_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academic_years_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          academic_year_id: string
          activity_date: string
          cost_aed: number
          created_at: string
          created_by: string | null
          curriculum_link: string | null
          deadline: string | null
          depart_time: string | null
          description_ar: string | null
          description_en: string
          event_location: string | null
          grade_level: string | null
          id: string
          kind: Database["public"]["Enums"]["activity_kind"]
          return_time: string | null
          risk_pdf_path: string | null
          school_id: string
          supervisor_ratio: string | null
          target_sections: string[] | null
          title: string
          transport: string | null
        }
        Insert: {
          academic_year_id: string
          activity_date: string
          cost_aed?: number
          created_at?: string
          created_by?: string | null
          curriculum_link?: string | null
          deadline?: string | null
          depart_time?: string | null
          description_ar?: string | null
          description_en: string
          event_location?: string | null
          grade_level?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["activity_kind"]
          return_time?: string | null
          risk_pdf_path?: string | null
          school_id: string
          supervisor_ratio?: string | null
          target_sections?: string[] | null
          title: string
          transport?: string | null
        }
        Update: {
          academic_year_id?: string
          activity_date?: string
          cost_aed?: number
          created_at?: string
          created_by?: string | null
          curriculum_link?: string | null
          deadline?: string | null
          depart_time?: string | null
          description_ar?: string | null
          description_en?: string
          event_location?: string | null
          grade_level?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["activity_kind"]
          return_time?: string | null
          risk_pdf_path?: string | null
          school_id?: string
          supervisor_ratio?: string | null
          target_sections?: string[] | null
          title?: string
          transport?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permission_slips_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_slips_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_briefings: {
        Row: {
          academic_year_id: string | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          ai_model: string | null
          body: string
          briefing_date: string
          cost_usd: number | null
          data_snapshot: Json | null
          generated_at: string
          id: string
          school_id: string
          scope: string
        }
        Insert: {
          academic_year_id?: string | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          ai_model?: string | null
          body: string
          briefing_date: string
          cost_usd?: number | null
          data_snapshot?: Json | null
          generated_at?: string
          id?: string
          school_id: string
          scope?: string
        }
        Update: {
          academic_year_id?: string | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          ai_model?: string | null
          body?: string
          briefing_date?: string
          cost_usd?: number | null
          data_snapshot?: Json | null
          generated_at?: string
          id?: string
          school_id?: string
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_briefings_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_briefings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_ledger: {
        Row: {
          cache_hit: boolean | null
          cost_usd: number
          created_at: string | null
          error_code: string | null
          id: string
          input_tokens: number
          is_background: boolean
          model: string
          output_tokens: number
          request_kind: string
          school_id: string
        }
        Insert: {
          cache_hit?: boolean | null
          cost_usd?: number
          created_at?: string | null
          error_code?: string | null
          id?: string
          input_tokens?: number
          is_background: boolean
          model: string
          output_tokens?: number
          request_kind: string
          school_id: string
        }
        Update: {
          cache_hit?: boolean | null
          cost_usd?: number
          created_at?: string | null
          error_code?: string | null
          id?: string
          input_tokens?: number
          is_background?: boolean
          model?: string
          output_tokens?: number
          request_kind?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_ledger_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          academic_year_id: string | null
          author_id: string | null
          body_ar: string | null
          body_en: string
          created_at: string
          expires_at: string | null
          id: string
          pinned: boolean
          published_at: string | null
          school_id: string
          target_grades: string[] | null
          target_roles: Database["public"]["Enums"]["user_role"][]
          title: string
        }
        Insert: {
          academic_year_id?: string | null
          author_id?: string | null
          body_ar?: string | null
          body_en: string
          created_at?: string
          expires_at?: string | null
          id?: string
          pinned?: boolean
          published_at?: string | null
          school_id: string
          target_grades?: string[] | null
          target_roles?: Database["public"]["Enums"]["user_role"][]
          title: string
        }
        Update: {
          academic_year_id?: string | null
          author_id?: string | null
          body_ar?: string | null
          body_en?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          pinned?: boolean
          published_at?: string | null
          school_id?: string
          target_grades?: string[] | null
          target_roles?: Database["public"]["Enums"]["user_role"][]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
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
      applicants: {
        Row: {
          academic_year_id: string | null
          converted_student_id: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone_e164: string | null
          school_id: string
          source: string | null
          stage: Database["public"]["Enums"]["admission_stage"]
          target_grade: string
        }
        Insert: {
          academic_year_id?: string | null
          converted_student_id?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone_e164?: string | null
          school_id: string
          source?: string | null
          stage?: Database["public"]["Enums"]["admission_stage"]
          target_grade: string
        }
        Update: {
          academic_year_id?: string | null
          converted_student_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone_e164?: string | null
          school_id?: string
          source?: string | null
          stage?: Database["public"]["Enums"]["admission_stage"]
          target_grade?: string
        }
        Relationships: [
          {
            foreignKeyName: "applicants_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicants_converted_student_id_fkey"
            columns: ["converted_student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicants_school_id_fkey1"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      application_grades: {
        Row: {
          actual: string | null
          application_id: string | null
          grade_kind: Database["public"]["Enums"]["grade_kind"]
          id: string
          label: string
          predicted: string | null
          school_id: string
          student_id: string | null
          validated_by: string | null
          validated_on: string | null
          value: string | null
        }
        Insert: {
          actual?: string | null
          application_id?: string | null
          grade_kind: Database["public"]["Enums"]["grade_kind"]
          id?: string
          label: string
          predicted?: string | null
          school_id: string
          student_id?: string | null
          validated_by?: string | null
          validated_on?: string | null
          value?: string | null
        }
        Update: {
          actual?: string | null
          application_id?: string | null
          grade_kind?: Database["public"]["Enums"]["grade_kind"]
          id?: string
          label?: string
          predicted?: string | null
          school_id?: string
          student_id?: string | null
          validated_by?: string | null
          validated_on?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_grades_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_grades_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_grades_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          application_id: string | null
          applied_on: string | null
          country: string | null
          course: string | null
          created_at: string
          deadline: string | null
          docs_done: number
          docs_total: number
          fit_tag: string | null
          id: string
          notes: string | null
          offer_deadline: string | null
          offer_received: boolean
          school_id: string
          status: Database["public"]["Enums"]["university_app_status"]
          student_id: string
          university_name: string
        }
        Insert: {
          application_id?: string | null
          applied_on?: string | null
          country?: string | null
          course?: string | null
          created_at?: string
          deadline?: string | null
          docs_done?: number
          docs_total?: number
          fit_tag?: string | null
          id?: string
          notes?: string | null
          offer_deadline?: string | null
          offer_received?: boolean
          school_id: string
          status?: Database["public"]["Enums"]["university_app_status"]
          student_id: string
          university_name: string
        }
        Update: {
          application_id?: string | null
          applied_on?: string | null
          country?: string | null
          course?: string | null
          created_at?: string
          deadline?: string | null
          docs_done?: number
          docs_total?: number
          fit_tag?: string | null
          id?: string
          notes?: string | null
          offer_deadline?: string | null
          offer_received?: boolean
          school_id?: string
          status?: Database["public"]["Enums"]["university_app_status"]
          student_id?: string
          university_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_applications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_applications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_results: {
        Row: {
          assessment_id: string
          id: string
          is_excused: boolean | null
          recorded_at: string | null
          school_id: string
          score: number | null
          student_id: string
          teacher_comment: string | null
        }
        Insert: {
          assessment_id: string
          id?: string
          is_excused?: boolean | null
          recorded_at?: string | null
          school_id: string
          score?: number | null
          student_id: string
          teacher_comment?: string | null
        }
        Update: {
          assessment_id?: string
          id?: string
          is_excused?: boolean | null
          recorded_at?: string | null
          school_id?: string
          score?: number | null
          student_id?: string
          teacher_comment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_results_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_results_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          created_at: string | null
          held_on: string | null
          id: string
          kind: Database["public"]["Enums"]["assessment_kind"]
          label: string
          max_score: number
          notes: string | null
          school_id: string
          section_id: string
          subject_id: string
          teacher_id: string | null
          weight_in_term: number | null
        }
        Insert: {
          created_at?: string | null
          held_on?: string | null
          id?: string
          kind: Database["public"]["Enums"]["assessment_kind"]
          label: string
          max_score: number
          notes?: string | null
          school_id: string
          section_id: string
          subject_id: string
          teacher_id?: string | null
          weight_in_term?: number | null
        }
        Update: {
          created_at?: string | null
          held_on?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["assessment_kind"]
          label?: string
          max_score?: number
          notes?: string | null
          school_id?: string
          section_id?: string
          subject_id?: string
          teacher_id?: string | null
          weight_in_term?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assessments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_marks: {
        Row: {
          bell_period_id: string | null
          created_at: string | null
          id: string
          marked_by_teacher_id: string | null
          marked_on: string
          notes: string | null
          notified_channel: Database["public"]["Enums"]["comm_channel"] | null
          notified_parent_at: string | null
          reason: string | null
          school_id: string
          section_id: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Insert: {
          bell_period_id?: string | null
          created_at?: string | null
          id?: string
          marked_by_teacher_id?: string | null
          marked_on: string
          notes?: string | null
          notified_channel?: Database["public"]["Enums"]["comm_channel"] | null
          notified_parent_at?: string | null
          reason?: string | null
          school_id: string
          section_id?: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Update: {
          bell_period_id?: string | null
          created_at?: string | null
          id?: string
          marked_by_teacher_id?: string | null
          marked_on?: string
          notes?: string | null
          notified_channel?: Database["public"]["Enums"]["comm_channel"] | null
          notified_parent_at?: string | null
          reason?: string | null
          school_id?: string
          section_id?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_marks_bell_period_id_fkey"
            columns: ["bell_period_id"]
            isOneToOne: false
            referencedRelation: "bell_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marks_marked_by_teacher_id_fkey"
            columns: ["marked_by_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marks_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_label: string | null
          actor_user_id: string | null
          id: string
          metadata: Json | null
          object_id: string | null
          object_kind: string | null
          occurred_at: string | null
          school_id: string
        }
        Insert: {
          action: string
          actor_label?: string | null
          actor_user_id?: string | null
          id?: string
          metadata?: Json | null
          object_id?: string | null
          object_kind?: string | null
          occurred_at?: string | null
          school_id: string
        }
        Update: {
          action?: string
          actor_label?: string | null
          actor_user_id?: string | null
          id?: string
          metadata?: Json | null
          object_id?: string | null
          object_kind?: string | null
          occurred_at?: string | null
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      behaviour_notes: {
        Row: {
          created_at: string | null
          id: string
          kind: Database["public"]["Enums"]["behaviour_kind"]
          note: string
          observed_on: string
          school_id: string
          section_id: string | null
          student_id: string
          teacher_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["behaviour_kind"]
          note: string
          observed_on: string
          school_id: string
          section_id?: string | null
          student_id: string
          teacher_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["behaviour_kind"]
          note?: string
          observed_on?: string
          school_id?: string
          section_id?: string | null
          student_id?: string
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "behaviour_notes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "behaviour_notes_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "behaviour_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "behaviour_notes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      bell_periods: {
        Row: {
          academic_year_id: string
          day_of_week: string
          ends_at: string
          id: string
          is_teaching: boolean | null
          period_label: string | null
          period_number: number
          school_id: string
          starts_at: string
        }
        Insert: {
          academic_year_id: string
          day_of_week: string
          ends_at: string
          id?: string
          is_teaching?: boolean | null
          period_label?: string | null
          period_number: number
          school_id: string
          starts_at: string
        }
        Update: {
          academic_year_id?: string
          day_of_week?: string
          ends_at?: string
          id?: string
          is_teaching?: boolean | null
          period_label?: string | null
          period_number?: number
          school_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bell_periods_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bell_periods_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_drafts: {
        Row: {
          created_at: string | null
          drafted_ar: string | null
          drafted_en: string | null
          edited_ar: string | null
          edited_en: string | null
          id: string
          parent_id: string | null
          school_id: string
          sent_at: string | null
          sent_message_id: string | null
          sent_via: Database["public"]["Enums"]["comm_channel"] | null
          slot_values: Json | null
          snoozed_until: string | null
          status: Database["public"]["Enums"]["comm_draft_status"] | null
          student_id: string | null
          teacher_id: string | null
          template_id: string | null
        }
        Insert: {
          created_at?: string | null
          drafted_ar?: string | null
          drafted_en?: string | null
          edited_ar?: string | null
          edited_en?: string | null
          id?: string
          parent_id?: string | null
          school_id: string
          sent_at?: string | null
          sent_message_id?: string | null
          sent_via?: Database["public"]["Enums"]["comm_channel"] | null
          slot_values?: Json | null
          snoozed_until?: string | null
          status?: Database["public"]["Enums"]["comm_draft_status"] | null
          student_id?: string | null
          teacher_id?: string | null
          template_id?: string | null
        }
        Update: {
          created_at?: string | null
          drafted_ar?: string | null
          drafted_en?: string | null
          edited_ar?: string | null
          edited_en?: string | null
          id?: string
          parent_id?: string | null
          school_id?: string
          sent_at?: string | null
          sent_message_id?: string | null
          sent_via?: Database["public"]["Enums"]["comm_channel"] | null
          slot_values?: Json | null
          snoozed_until?: string | null
          status?: Database["public"]["Enums"]["comm_draft_status"] | null
          student_id?: string | null
          teacher_id?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comm_drafts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_drafts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_drafts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_drafts_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_drafts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "comm_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_templates: {
        Row: {
          ai_prompt_ar: string | null
          ai_prompt_en: string | null
          channel: Database["public"]["Enums"]["comm_channel"]
          created_at: string | null
          display_order: number | null
          guardrails: string[] | null
          id: string
          is_manhaj_default: boolean | null
          length_cap_words: number | null
          name_ar: string | null
          name_en: string
          required_slots: string[] | null
          school_id: string
          template_code: string
          tone: Database["public"]["Enums"]["comm_tone"] | null
        }
        Insert: {
          ai_prompt_ar?: string | null
          ai_prompt_en?: string | null
          channel: Database["public"]["Enums"]["comm_channel"]
          created_at?: string | null
          display_order?: number | null
          guardrails?: string[] | null
          id?: string
          is_manhaj_default?: boolean | null
          length_cap_words?: number | null
          name_ar?: string | null
          name_en: string
          required_slots?: string[] | null
          school_id: string
          template_code: string
          tone?: Database["public"]["Enums"]["comm_tone"] | null
        }
        Update: {
          ai_prompt_ar?: string | null
          ai_prompt_en?: string | null
          channel?: Database["public"]["Enums"]["comm_channel"]
          created_at?: string | null
          display_order?: number | null
          guardrails?: string[] | null
          id?: string
          is_manhaj_default?: boolean | null
          length_cap_words?: number | null
          name_ar?: string | null
          name_en?: string
          required_slots?: string[] | null
          school_id?: string
          template_code?: string
          tone?: Database["public"]["Enums"]["comm_tone"] | null
        }
        Relationships: [
          {
            foreignKeyName: "comm_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_records: {
        Row: {
          academic_year_id: string
          consent_kind: Database["public"]["Enums"]["consent_kind"]
          granted: boolean
          granted_at: string | null
          granted_via: string | null
          id: string
          notes: string | null
          parent_id: string | null
          revoked_at: string | null
          school_id: string
          student_id: string
        }
        Insert: {
          academic_year_id: string
          consent_kind: Database["public"]["Enums"]["consent_kind"]
          granted: boolean
          granted_at?: string | null
          granted_via?: string | null
          id?: string
          notes?: string | null
          parent_id?: string | null
          revoked_at?: string | null
          school_id: string
          student_id: string
        }
        Update: {
          academic_year_id?: string
          consent_kind?: Database["public"]["Enums"]["consent_kind"]
          granted?: boolean
          granted_at?: string | null
          granted_via?: string | null
          id?: string
          notes?: string | null
          parent_id?: string | null
          revoked_at?: string | null
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_records_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      course_catalog: {
        Row: {
          academic_year_id: string
          elective_bundle_id: string | null
          grade_level: string
          id: string
          kind: Database["public"]["Enums"]["elective_kind"]
          notes: string | null
          school_id: string
          stage: Database["public"]["Enums"]["curriculum_stage"]
          subject_id: string
        }
        Insert: {
          academic_year_id: string
          elective_bundle_id?: string | null
          grade_level: string
          id?: string
          kind: Database["public"]["Enums"]["elective_kind"]
          notes?: string | null
          school_id: string
          stage: Database["public"]["Enums"]["curriculum_stage"]
          subject_id: string
        }
        Update: {
          academic_year_id?: string
          elective_bundle_id?: string | null
          grade_level?: string
          id?: string
          kind?: Database["public"]["Enums"]["elective_kind"]
          notes?: string | null
          school_id?: string
          stage?: Database["public"]["Enums"]["curriculum_stage"]
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_catalog_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_catalog_bundle_fk"
            columns: ["elective_bundle_id"]
            isOneToOne: false
            referencedRelation: "elective_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_catalog_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_catalog_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      course_selection_forms: {
        Row: {
          academic_year_id: string
          grade_level: string
          id: string
          locked_by_admin_id: string | null
          school_id: string
          status: Database["public"]["Enums"]["selection_status"]
          student_id: string
          submitted_at: string | null
          submitted_by_parent_id: string | null
        }
        Insert: {
          academic_year_id: string
          grade_level: string
          id?: string
          locked_by_admin_id?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["selection_status"]
          student_id: string
          submitted_at?: string | null
          submitted_by_parent_id?: string | null
        }
        Update: {
          academic_year_id?: string
          grade_level?: string
          id?: string
          locked_by_admin_id?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["selection_status"]
          student_id?: string
          submitted_at?: string | null
          submitted_by_parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_selection_forms_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_selection_forms_locked_by_admin_id_fkey"
            columns: ["locked_by_admin_id"]
            isOneToOne: false
            referencedRelation: "school_admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_selection_forms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_selection_forms_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_selection_forms_submitted_by_parent_id_fkey"
            columns: ["submitted_by_parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      course_selection_picks: {
        Row: {
          bundle_id: string
          form_id: string
          subject_id: string
        }
        Insert: {
          bundle_id: string
          form_id: string
          subject_id: string
        }
        Update: {
          bundle_id?: string
          form_id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_selection_picks_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "elective_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_selection_picks_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "course_selection_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_selection_picks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      elective_bundles: {
        Row: {
          academic_year_id: string
          display_order: number | null
          grade_level: string
          id: string
          label: string
          pick_count: number
          school_id: string
        }
        Insert: {
          academic_year_id: string
          display_order?: number | null
          grade_level: string
          id?: string
          label: string
          pick_count?: number
          school_id: string
        }
        Update: {
          academic_year_id?: string
          display_order?: number | null
          grade_level?: string
          id?: string
          label?: string
          pick_count?: number
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "elective_bundles_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "elective_bundles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      elective_options: {
        Row: {
          bundle_id: string
          display_order: number | null
          subject_id: string
        }
        Insert: {
          bundle_id: string
          display_order?: number | null
          subject_id: string
        }
        Update: {
          bundle_id?: string
          display_order?: number | null
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "elective_options_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "elective_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "elective_options_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_checkins: {
        Row: {
          checked_by: string | null
          checked_on: string
          goal_id: string
          id: string
          notes: string | null
          progress_pct: number | null
          source: Database["public"]["Enums"]["goal_checkin_source"]
          value: number | null
        }
        Insert: {
          checked_by?: string | null
          checked_on?: string
          goal_id: string
          id?: string
          notes?: string | null
          progress_pct?: number | null
          source?: Database["public"]["Enums"]["goal_checkin_source"]
          value?: number | null
        }
        Update: {
          checked_by?: string | null
          checked_on?: string
          goal_id?: string
          id?: string
          notes?: string | null
          progress_pct?: number | null
          source?: Database["public"]["Enums"]["goal_checkin_source"]
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "goal_checkins_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "student_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_reflections: {
        Row: {
          audience: string | null
          body: string
          created_at: string
          goal_id: string
          id: string
          month: string | null
          mood: string | null
          student_id: string
        }
        Insert: {
          audience?: string | null
          body: string
          created_at?: string
          goal_id: string
          id?: string
          month?: string | null
          mood?: string | null
          student_id: string
        }
        Update: {
          audience?: string | null
          body?: string
          created_at?: string
          goal_id?: string
          id?: string
          month?: string | null
          mood?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_reflections_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "student_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_reflections_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          metadata: Json | null
          role: Database["public"]["Enums"]["user_role"]
          school_id: string
          status: Database["public"]["Enums"]["invitation_status"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          metadata?: Json | null
          role: Database["public"]["Enums"]["user_role"]
          school_id: string
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          metadata?: Json | null
          role?: Database["public"]["Enums"]["user_role"]
          school_id?: string
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          amount_aed: number
          description: string
          display_order: number | null
          id: string
          invoice_id: string
        }
        Insert: {
          amount_aed?: number
          description: string
          display_order?: number | null
          id?: string
          invoice_id: string
        }
        Update: {
          amount_aed?: number
          description?: string
          display_order?: number | null
          id?: string
          invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          academic_year_id: string
          amount_owed_aed: number
          created_at: string
          due_on: string
          id: string
          invoice_number: string
          issued_on: string
          notes: string | null
          paid_on: string | null
          parent_id: string | null
          reference_code: string | null
          school_id: string
          status: Database["public"]["Enums"]["invoice_status"]
          student_id: string
          what_for: string | null
        }
        Insert: {
          academic_year_id: string
          amount_owed_aed?: number
          created_at?: string
          due_on: string
          id?: string
          invoice_number: string
          issued_on: string
          notes?: string | null
          paid_on?: string | null
          parent_id?: string | null
          reference_code?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["invoice_status"]
          student_id: string
          what_for?: string | null
        }
        Update: {
          academic_year_id?: string
          amount_owed_aed?: number
          created_at?: string
          due_on?: string
          id?: string
          invoice_number?: string
          issued_on?: string
          notes?: string | null
          paid_on?: string | null
          parent_id?: string | null
          reference_code?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          student_id?: string
          what_for?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applicants: {
        Row: {
          ai_summary: string | null
          cover_letter_md: string | null
          created_at: string
          cv_url: string | null
          email: string
          full_name: string
          id: string
          interview_date: string | null
          job_posting_id: string | null
          phone_e164: string | null
          school_id: string
          screening_notes: string | null
          status: Database["public"]["Enums"]["applicant_status"]
        }
        Insert: {
          ai_summary?: string | null
          cover_letter_md?: string | null
          created_at?: string
          cv_url?: string | null
          email: string
          full_name: string
          id?: string
          interview_date?: string | null
          job_posting_id?: string | null
          phone_e164?: string | null
          school_id: string
          screening_notes?: string | null
          status?: Database["public"]["Enums"]["applicant_status"]
        }
        Update: {
          ai_summary?: string | null
          cover_letter_md?: string | null
          created_at?: string
          cv_url?: string | null
          email?: string
          full_name?: string
          id?: string
          interview_date?: string | null
          job_posting_id?: string | null
          phone_e164?: string | null
          school_id?: string
          screening_notes?: string | null
          status?: Database["public"]["Enums"]["applicant_status"]
        }
        Relationships: [
          {
            foreignKeyName: "applicants_job_posting_id_fkey"
            columns: ["job_posting_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicants_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      job_postings: {
        Row: {
          closes_on: string | null
          created_at: string
          created_by: string | null
          department: string | null
          description_md: string | null
          id: string
          is_open: boolean
          requirements_md: string | null
          school_id: string
          title: string
        }
        Insert: {
          closes_on?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          description_md?: string | null
          id?: string
          is_open?: boolean
          requirements_md?: string | null
          school_id: string
          title: string
        }
        Update: {
          closes_on?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          description_md?: string | null
          id?: string
          is_open?: boolean
          requirements_md?: string | null
          school_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_postings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_followups: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          is_done: boolean
          lesson_id: string | null
          priority: string
          school_id: string
          section_id: string | null
          student_id: string | null
          tag: string | null
          target_teacher_id: string | null
          teacher_id: string
          title: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_done?: boolean
          lesson_id?: string | null
          priority?: string
          school_id: string
          section_id?: string | null
          student_id?: string | null
          tag?: string | null
          target_teacher_id?: string | null
          teacher_id: string
          title: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_done?: boolean
          lesson_id?: string | null
          priority?: string
          school_id?: string
          section_id?: string | null
          student_id?: string | null
          tag?: string | null
          target_teacher_id?: string | null
          teacher_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_followups_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_followups_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_followups_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_followups_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_followups_target_teacher_id_fkey"
            columns: ["target_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_followups_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          cover_teacher_id: string | null
          created_at: string | null
          held_on: string
          homework_description: string | null
          homework_due_date: string | null
          id: string
          learning_objective: string | null
          plan_kind: Database["public"]["Enums"]["lesson_plan_kind"]
          plan_notes: string | null
          planned_for_week: string | null
          pre_class_checklist: Json
          resources_url: string | null
          school_id: string
          section_id: string
          smartboard_artifact_path: string | null
          subject_id: string
          teacher_id: string | null
          teacher_voice_memo_path: string | null
          timetable_slot_id: string | null
          topic: string | null
        }
        Insert: {
          cover_teacher_id?: string | null
          created_at?: string | null
          held_on: string
          homework_description?: string | null
          homework_due_date?: string | null
          id?: string
          learning_objective?: string | null
          plan_kind?: Database["public"]["Enums"]["lesson_plan_kind"]
          plan_notes?: string | null
          planned_for_week?: string | null
          pre_class_checklist?: Json
          resources_url?: string | null
          school_id: string
          section_id: string
          smartboard_artifact_path?: string | null
          subject_id: string
          teacher_id?: string | null
          teacher_voice_memo_path?: string | null
          timetable_slot_id?: string | null
          topic?: string | null
        }
        Update: {
          cover_teacher_id?: string | null
          created_at?: string | null
          held_on?: string
          homework_description?: string | null
          homework_due_date?: string | null
          id?: string
          learning_objective?: string | null
          plan_kind?: Database["public"]["Enums"]["lesson_plan_kind"]
          plan_notes?: string | null
          planned_for_week?: string | null
          pre_class_checklist?: Json
          resources_url?: string | null
          school_id?: string
          section_id?: string
          smartboard_artifact_path?: string | null
          subject_id?: string
          teacher_id?: string | null
          teacher_voice_memo_path?: string | null
          timetable_slot_id?: string | null
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_cover_teacher_id_fkey"
            columns: ["cover_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_timetable_slot_id_fkey"
            columns: ["timetable_slot_id"]
            isOneToOne: false
            referencedRelation: "timetable_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          kind: Database["public"]["Enums"]["notification_kind"]
          read_at: string | null
          school_id: string
          title: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          kind: Database["public"]["Enums"]["notification_kind"]
          read_at?: string | null
          school_id: string
          title: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          kind?: Database["public"]["Enums"]["notification_kind"]
          read_at?: string | null
          school_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      parents: {
        Row: {
          avatar_url: string | null
          email: string | null
          full_name: string
          id: string
          phone_e164: string | null
          preferred_lang: string | null
          school_id: string
          user_id: string | null
          verified_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          email?: string | null
          full_name: string
          id?: string
          phone_e164?: string | null
          preferred_lang?: string | null
          school_id: string
          user_id?: string | null
          verified_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone_e164?: string | null
          preferred_lang?: string | null
          school_id?: string
          user_id?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_slips: {
        Row: {
          activity_id: string
          id: string
          notes: string | null
          parent_id: string | null
          payment_ref: string | null
          responded_at: string | null
          signed_at: string | null
          signed_by_parent_id: string | null
          signed_name: string | null
          status: Database["public"]["Enums"]["slip_status"]
          student_id: string
        }
        Insert: {
          activity_id: string
          id?: string
          notes?: string | null
          parent_id?: string | null
          payment_ref?: string | null
          responded_at?: string | null
          signed_at?: string | null
          signed_by_parent_id?: string | null
          signed_name?: string | null
          status?: Database["public"]["Enums"]["slip_status"]
          student_id: string
        }
        Update: {
          activity_id?: string
          id?: string
          notes?: string | null
          parent_id?: string | null
          payment_ref?: string | null
          responded_at?: string | null
          signed_at?: string | null
          signed_by_parent_id?: string | null
          signed_name?: string | null
          status?: Database["public"]["Enums"]["slip_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_slip_responses_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_slip_responses_slip_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_slip_responses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_slips_signed_by_parent_id_fkey"
            columns: ["signed_by_parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_statements: {
        Row: {
          application_id: string | null
          body: string | null
          created_at: string
          id: string
          reviewed_by: string | null
          school_id: string
          status: Database["public"]["Enums"]["ps_status"]
          student_id: string
          updated_at: string
          version: number
        }
        Insert: {
          application_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          reviewed_by?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["ps_status"]
          student_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          application_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          reviewed_by?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["ps_status"]
          student_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "personal_statements_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_statements_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_statements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_statements_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      regulatory_report_catalog: {
        Row: {
          deadline_cadence: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          regulator: string | null
          report_type: Database["public"]["Enums"]["regulatory_report_kind"]
          required_fields: Json | null
          school_id: string
          template_ref: string | null
        }
        Insert: {
          deadline_cadence?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          regulator?: string | null
          report_type: Database["public"]["Enums"]["regulatory_report_kind"]
          required_fields?: Json | null
          school_id: string
          template_ref?: string | null
        }
        Update: {
          deadline_cadence?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          regulator?: string | null
          report_type?: Database["public"]["Enums"]["regulatory_report_kind"]
          required_fields?: Json | null
          school_id?: string
          template_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regulatory_report_catalog_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      report_archive: {
        Row: {
          delete_after: string | null
          deleted_at: string | null
          generated_at: string
          id: string
          parent_id: string | null
          report_kind: Database["public"]["Enums"]["report_archive_kind"]
          school_id: string
          scope: Database["public"]["Enums"]["report_archive_scope"]
          scope_ref_id: string | null
          sent_at: string | null
          storage_path: string
          student_id: string | null
        }
        Insert: {
          delete_after?: string | null
          deleted_at?: string | null
          generated_at?: string
          id?: string
          parent_id?: string | null
          report_kind: Database["public"]["Enums"]["report_archive_kind"]
          school_id: string
          scope: Database["public"]["Enums"]["report_archive_scope"]
          scope_ref_id?: string | null
          sent_at?: string | null
          storage_path: string
          student_id?: string | null
        }
        Update: {
          delete_after?: string | null
          deleted_at?: string | null
          generated_at?: string
          id?: string
          parent_id?: string | null
          report_kind?: Database["public"]["Enums"]["report_archive_kind"]
          school_id?: string
          scope?: Database["public"]["Enums"]["report_archive_scope"]
          scope_ref_id?: string | null
          sent_at?: string | null
          storage_path?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_archive_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_archive_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_archive_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      report_submissions: {
        Row: {
          academic_year_id: string | null
          catalog_id: string
          created_at: string
          file_url: string | null
          id: string
          notes: string | null
          period_label: string
          school_id: string
          status: Database["public"]["Enums"]["report_submission_status"]
          submitted_at: string | null
          submitted_by: string | null
          term_id: string | null
        }
        Insert: {
          academic_year_id?: string | null
          catalog_id: string
          created_at?: string
          file_url?: string | null
          id?: string
          notes?: string | null
          period_label: string
          school_id: string
          status?: Database["public"]["Enums"]["report_submission_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          term_id?: string | null
        }
        Update: {
          academic_year_id?: string | null
          catalog_id?: string
          created_at?: string
          file_url?: string | null
          id?: string
          notes?: string | null
          period_label?: string
          school_id?: string
          status?: Database["public"]["Enums"]["report_submission_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          term_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_submissions_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_submissions_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "regulatory_report_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_submissions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_submissions_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_flags: {
        Row: {
          academic_year_id: string
          category: string
          created_at: string
          flagged_by: string | null
          id: string
          owner_id: string | null
          reason: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          school_id: string
          severity: Database["public"]["Enums"]["risk_level"]
          status: Database["public"]["Enums"]["flag_status"]
          student_id: string
        }
        Insert: {
          academic_year_id: string
          category: string
          created_at?: string
          flagged_by?: string | null
          id?: string
          owner_id?: string | null
          reason: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          school_id: string
          severity: Database["public"]["Enums"]["risk_level"]
          status?: Database["public"]["Enums"]["flag_status"]
          student_id: string
        }
        Update: {
          academic_year_id?: string
          category?: string
          created_at?: string
          flagged_by?: string | null
          id?: string
          owner_id?: string | null
          reason?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          school_id?: string
          severity?: Database["public"]["Enums"]["risk_level"]
          status?: Database["public"]["Enums"]["flag_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_flags_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_flags_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_flags_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_flags_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          capacity: number | null
          code: string
          equipment: string[] | null
          floor_building: string | null
          id: string
          is_schedulable: boolean | null
          name: string | null
          notes: string | null
          room_type: string | null
          school_id: string
        }
        Insert: {
          capacity?: number | null
          code: string
          equipment?: string[] | null
          floor_building?: string | null
          id?: string
          is_schedulable?: boolean | null
          name?: string | null
          notes?: string | null
          room_type?: string | null
          school_id: string
        }
        Update: {
          capacity?: number | null
          code?: string
          equipment?: string[] | null
          floor_building?: string | null
          id?: string
          is_schedulable?: boolean | null
          name?: string | null
          notes?: string | null
          room_type?: string | null
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      rubric_criteria: {
        Row: {
          ai_suggested: boolean
          axis_code: string
          axis_name_ar: string
          axis_name_en: string
          description_ar: string | null
          description_en: string | null
          display_order: number | null
          id: string
          rubric_id: string
          scale_max: number
          scale_min: number
        }
        Insert: {
          ai_suggested?: boolean
          axis_code: string
          axis_name_ar: string
          axis_name_en: string
          description_ar?: string | null
          description_en?: string | null
          display_order?: number | null
          id?: string
          rubric_id: string
          scale_max?: number
          scale_min?: number
        }
        Update: {
          ai_suggested?: boolean
          axis_code?: string
          axis_name_ar?: string
          axis_name_en?: string
          description_ar?: string | null
          description_en?: string | null
          display_order?: number | null
          id?: string
          rubric_id?: string
          scale_max?: number
          scale_min?: number
        }
        Relationships: [
          {
            foreignKeyName: "rubric_criteria_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "rubrics"
            referencedColumns: ["id"]
          },
        ]
      }
      rubric_scores: {
        Row: {
          axis_code: string
          created_at: string | null
          id: string
          notes: string | null
          rubric_id: string
          school_id: string
          score: number
          scored_by_teacher_id: string | null
          scored_for_month: string
          source: string | null
          student_id: string
          subject_id: string | null
        }
        Insert: {
          axis_code: string
          created_at?: string | null
          id?: string
          notes?: string | null
          rubric_id: string
          school_id: string
          score: number
          scored_by_teacher_id?: string | null
          scored_for_month: string
          source?: string | null
          student_id: string
          subject_id?: string | null
        }
        Update: {
          axis_code?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          rubric_id?: string
          school_id?: string
          score?: number
          scored_by_teacher_id?: string | null
          scored_for_month?: string
          source?: string | null
          student_id?: string
          subject_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rubric_scores_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "rubrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rubric_scores_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rubric_scores_scored_by_teacher_id_fkey"
            columns: ["scored_by_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rubric_scores_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rubric_scores_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      rubrics: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_manhaj_default: boolean | null
          name: string
          school_id: string
          version: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_manhaj_default?: boolean | null
          name: string
          school_id: string
          version?: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_manhaj_default?: boolean | null
          name?: string
          school_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "rubrics_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_admins: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          hire_date: string | null
          id: string
          invited_by: string | null
          is_active: boolean
          phone_e164: string | null
          role: Database["public"]["Enums"]["admin_role"]
          school_id: string
          status: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          hire_date?: string | null
          id?: string
          invited_by?: string | null
          is_active?: boolean
          phone_e164?: string | null
          role?: Database["public"]["Enums"]["admin_role"]
          school_id: string
          status?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          hire_date?: string | null
          id?: string
          invited_by?: string | null
          is_active?: boolean
          phone_e164?: string | null
          role?: Database["public"]["Enums"]["admin_role"]
          school_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_admins_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "school_admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_admins_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          country_code: string
          id: string
          name: string
          timezone: string
        }
        Insert: {
          country_code: string
          id?: string
          name: string
          timezone?: string
        }
        Update: {
          country_code?: string
          id?: string
          name?: string
          timezone?: string
        }
        Relationships: []
      }
      section_subjects: {
        Row: {
          id: string
          section_id: string
          subject_id: string
          weekly_periods: number
        }
        Insert: {
          id?: string
          section_id: string
          subject_id: string
          weekly_periods: number
        }
        Update: {
          id?: string
          section_id?: string
          subject_id?: string
          weekly_periods?: number
        }
        Relationships: [
          {
            foreignKeyName: "section_subjects_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          academic_year_id: string
          capacity: number | null
          code: string
          form_teacher_id: string | null
          grade_level: string | null
          head_teacher_id: string | null
          id: string
          is_mapped: boolean
          label: string | null
          mapped_at: string | null
          mapped_by: string | null
          notes: string | null
          room_id: string | null
          school_id: string
          stream: string | null
        }
        Insert: {
          academic_year_id: string
          capacity?: number | null
          code: string
          form_teacher_id?: string | null
          grade_level?: string | null
          head_teacher_id?: string | null
          id?: string
          is_mapped?: boolean
          label?: string | null
          mapped_at?: string | null
          mapped_by?: string | null
          notes?: string | null
          room_id?: string | null
          school_id: string
          stream?: string | null
        }
        Update: {
          academic_year_id?: string
          capacity?: number | null
          code?: string
          form_teacher_id?: string | null
          grade_level?: string | null
          head_teacher_id?: string | null
          id?: string
          is_mapped?: boolean
          label?: string | null
          mapped_at?: string | null
          mapped_by?: string | null
          notes?: string | null
          room_id?: string | null
          school_id?: string
          stream?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sections_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sections_form_teacher_id_fkey"
            columns: ["form_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sections_head_teacher_id_fkey"
            columns: ["head_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sections_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sections_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      source_imports: {
        Row: {
          file_sha256: string
          filename: string
          id: string
          imported_at: string
          imported_by: string | null
          notes: string | null
          row_count: number | null
          school_id: string
          sheet_name: string | null
        }
        Insert: {
          file_sha256: string
          filename: string
          id?: string
          imported_at?: string
          imported_by?: string | null
          notes?: string | null
          row_count?: number | null
          school_id: string
          sheet_name?: string | null
        }
        Update: {
          file_sha256?: string
          filename?: string
          id?: string
          imported_at?: string
          imported_by?: string | null
          notes?: string | null
          row_count?: number | null
          school_id?: string
          sheet_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_imports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_absences: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          ends_on: string
          id: string
          reason: Database["public"]["Enums"]["absence_reason"]
          reason_notes: string | null
          school_id: string
          starts_on: string
          status: Database["public"]["Enums"]["absence_status"]
          sub_teacher_id: string | null
          teacher_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          ends_on: string
          id?: string
          reason: Database["public"]["Enums"]["absence_reason"]
          reason_notes?: string | null
          school_id: string
          starts_on: string
          status?: Database["public"]["Enums"]["absence_status"]
          sub_teacher_id?: string | null
          teacher_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          ends_on?: string
          id?: string
          reason?: Database["public"]["Enums"]["absence_reason"]
          reason_notes?: string | null
          school_id?: string
          starts_on?: string
          status?: Database["public"]["Enums"]["absence_status"]
          sub_teacher_id?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_absences_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_absences_sub_teacher_id_fkey"
            columns: ["sub_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_absences_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      staffing_categories: {
        Row: {
          description: string | null
          id: string
          label: string
          school_id: string
        }
        Insert: {
          description?: string | null
          id?: string
          label: string
          school_id: string
        }
        Update: {
          description?: string | null
          id?: string
          label?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staffing_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      student_enrollments: {
        Row: {
          enrolled_on: string | null
          section_id: string
          student_id: string
        }
        Insert: {
          enrolled_on?: string | null
          section_id: string
          student_id: string
        }
        Update: {
          enrolled_on?: string | null
          section_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_enrollments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_goals: {
        Row: {
          academic_year_id: string
          created_at: string
          created_by_id: string | null
          created_by_role: Database["public"]["Enums"]["goal_created_by"]
          description: string | null
          due_on: string | null
          id: string
          kind: Database["public"]["Enums"]["goal_kind"]
          metric: Database["public"]["Enums"]["goal_metric_kind"] | null
          school_id: string
          status: Database["public"]["Enums"]["goal_status"]
          student_id: string
          target_value: number | null
          title: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          created_by_id?: string | null
          created_by_role: Database["public"]["Enums"]["goal_created_by"]
          description?: string | null
          due_on?: string | null
          id?: string
          kind: Database["public"]["Enums"]["goal_kind"]
          metric?: Database["public"]["Enums"]["goal_metric_kind"] | null
          school_id: string
          status?: Database["public"]["Enums"]["goal_status"]
          student_id: string
          target_value?: number | null
          title: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          created_by_id?: string | null
          created_by_role?: Database["public"]["Enums"]["goal_created_by"]
          description?: string | null
          due_on?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["goal_kind"]
          metric?: Database["public"]["Enums"]["goal_metric_kind"] | null
          school_id?: string
          status?: Database["public"]["Enums"]["goal_status"]
          student_id?: string
          target_value?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_goals_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_goals_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_goals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_health: {
        Row: {
          allergies: string | null
          conditions: string | null
          consent_emergency_care: boolean
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_rel: string | null
          id: string
          medications: string | null
          school_id: string
          student_id: string
          updated_at: string
          updated_by_parent_id: string | null
        }
        Insert: {
          allergies?: string | null
          conditions?: string | null
          consent_emergency_care?: boolean
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_rel?: string | null
          id?: string
          medications?: string | null
          school_id: string
          student_id: string
          updated_at?: string
          updated_by_parent_id?: string | null
        }
        Update: {
          allergies?: string | null
          conditions?: string | null
          consent_emergency_care?: boolean
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_rel?: string | null
          id?: string
          medications?: string | null
          school_id?: string
          student_id?: string
          updated_at?: string
          updated_by_parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_health_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_health_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_health_updated_by_parent_id_fkey"
            columns: ["updated_by_parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      student_parents: {
        Row: {
          is_primary: boolean | null
          parent_id: string
          relationship: string
          student_id: string
        }
        Insert: {
          is_primary?: boolean | null
          parent_id: string
          relationship: string
          student_id: string
        }
        Update: {
          is_primary?: boolean | null
          parent_id?: string
          relationship?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_parents_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_parents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_test_scores: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          school_id: string
          score_numeric: number | null
          score_raw: string | null
          student_id: string
          subscores: Json | null
          taken_on: string | null
          test_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          school_id: string
          score_numeric?: number | null
          score_raw?: string | null
          student_id: string
          subscores?: Json | null
          taken_on?: string | null
          test_name: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          school_id?: string
          score_numeric?: number | null
          score_raw?: string | null
          student_id?: string
          subscores?: Json | null
          taken_on?: string | null
          test_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_test_scores_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_test_scores_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          advisor_id: string | null
          current_ay_id: string | null
          current_section_id: string | null
          date_of_birth: string | null
          enrolled_on: string | null
          external_ref: string | null
          full_name_ar: string | null
          full_name_en: string
          gender: string | null
          id: string
          nationality: string | null
          notes: string | null
          photo_url: string | null
          school_id: string
          user_id: string | null
          withdrawn_on: string | null
          withdrawn_reason: string | null
        }
        Insert: {
          advisor_id?: string | null
          current_ay_id?: string | null
          current_section_id?: string | null
          date_of_birth?: string | null
          enrolled_on?: string | null
          external_ref?: string | null
          full_name_ar?: string | null
          full_name_en: string
          gender?: string | null
          id?: string
          nationality?: string | null
          notes?: string | null
          photo_url?: string | null
          school_id: string
          user_id?: string | null
          withdrawn_on?: string | null
          withdrawn_reason?: string | null
        }
        Update: {
          advisor_id?: string | null
          current_ay_id?: string | null
          current_section_id?: string | null
          date_of_birth?: string | null
          enrolled_on?: string | null
          external_ref?: string | null
          full_name_ar?: string | null
          full_name_en?: string
          gender?: string | null
          id?: string
          nationality?: string | null
          notes?: string | null
          photo_url?: string | null
          school_id?: string
          user_id?: string | null
          withdrawn_on?: string | null
          withdrawn_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_current_ay_id_fkey"
            columns: ["current_ay_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_current_section_id_fkey"
            columns: ["current_section_id"]
            isOneToOne: false
            referencedRelation: "sections"
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
      study_blocks: {
        Row: {
          block_date: string | null
          color_hex: string | null
          created_at: string
          end_time: string
          id: string
          kind: Database["public"]["Enums"]["study_block_kind"]
          origin: Database["public"]["Enums"]["study_block_origin"]
          school_id: string
          start_time: string
          student_id: string
          subject_id: string | null
          title: string
        }
        Insert: {
          block_date?: string | null
          color_hex?: string | null
          created_at?: string
          end_time: string
          id?: string
          kind?: Database["public"]["Enums"]["study_block_kind"]
          origin?: Database["public"]["Enums"]["study_block_origin"]
          school_id: string
          start_time: string
          student_id: string
          subject_id?: string | null
          title: string
        }
        Update: {
          block_date?: string | null
          color_hex?: string | null
          created_at?: string
          end_time?: string
          id?: string
          kind?: Database["public"]["Enums"]["study_block_kind"]
          origin?: Database["public"]["Enums"]["study_block_origin"]
          school_id?: string
          start_time?: string
          student_id?: string
          subject_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_blocks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_blocks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_blocks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string
          department: string | null
          id: string
          is_ap: boolean | null
          is_self_study: boolean | null
          name_ar: string | null
          name_en: string
          school_id: string
        }
        Insert: {
          code: string
          department?: string | null
          id?: string
          is_ap?: boolean | null
          is_self_study?: boolean | null
          name_ar?: string | null
          name_en: string
          school_id: string
        }
        Update: {
          code?: string
          department?: string | null
          id?: string
          is_ap?: boolean | null
          is_self_study?: boolean | null
          name_ar?: string | null
          name_en?: string
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
      substitute_sheets: {
        Row: {
          ack_at: string | null
          created_at: string
          for_date: string
          id: string
          pdf_path: string | null
          school_id: string
          staff_absence_id: string
          sub_teacher_id: string | null
          version: number
        }
        Insert: {
          ack_at?: string | null
          created_at?: string
          for_date: string
          id?: string
          pdf_path?: string | null
          school_id: string
          staff_absence_id: string
          sub_teacher_id?: string | null
          version?: number
        }
        Update: {
          ack_at?: string | null
          created_at?: string
          for_date?: string
          id?: string
          pdf_path?: string | null
          school_id?: string
          staff_absence_id?: string
          sub_teacher_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "substitute_sheets_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitute_sheets_staff_absence_id_fkey"
            columns: ["staff_absence_id"]
            isOneToOne: false
            referencedRelation: "staff_absences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitute_sheets_sub_teacher_id_fkey"
            columns: ["sub_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      substitutions: {
        Row: {
          absence_id: string | null
          assigned_by: string | null
          created_at: string
          id: string
          notes: string | null
          school_id: string
          slot_id: string
          substitute_teacher_id: string
        }
        Insert: {
          absence_id?: string | null
          assigned_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          school_id: string
          slot_id: string
          substitute_teacher_id: string
        }
        Update: {
          absence_id?: string | null
          assigned_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          school_id?: string
          slot_id?: string
          substitute_teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "substitutions_absence_id_fkey"
            columns: ["absence_id"]
            isOneToOne: false
            referencedRelation: "staff_absences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: true
            referencedRelation: "timetable_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_substitute_teacher_id_fkey"
            columns: ["substitute_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_contracts: {
        Row: {
          academic_year_id: string
          contract_type: string | null
          notes: string | null
          teacher_id: string
          weekly_period_assigned: number | null
          weekly_period_cap: number
        }
        Insert: {
          academic_year_id: string
          contract_type?: string | null
          notes?: string | null
          teacher_id: string
          weekly_period_assigned?: number | null
          weekly_period_cap: number
        }
        Update: {
          academic_year_id?: string
          contract_type?: string | null
          notes?: string | null
          teacher_id?: string
          weekly_period_assigned?: number | null
          weekly_period_cap?: number
        }
        Relationships: [
          {
            foreignKeyName: "teacher_contracts_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_contracts_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: true
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_references: {
        Row: {
          application_id: string | null
          author_teacher_id: string
          base_reference_id: string | null
          created_at: string
          id: string
          ref_kind: string
          school_id: string
          status: Database["public"]["Enums"]["ref_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          application_id?: string | null
          author_teacher_id: string
          base_reference_id?: string | null
          created_at?: string
          id?: string
          ref_kind: string
          school_id: string
          status?: Database["public"]["Enums"]["ref_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          application_id?: string | null
          author_teacher_id?: string
          base_reference_id?: string | null
          created_at?: string
          id?: string
          ref_kind?: string
          school_id?: string
          status?: Database["public"]["Enums"]["ref_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_references_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_references_author_teacher_id_fkey"
            columns: ["author_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_references_base_reference_id_fkey"
            columns: ["base_reference_id"]
            isOneToOne: false
            referencedRelation: "teacher_references"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_references_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_references_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_section_subject: {
        Row: {
          id: string
          section_id: string
          source_cell: string | null
          subject_id: string
          teacher_id: string
          weekly_periods: number
        }
        Insert: {
          id?: string
          section_id: string
          source_cell?: string | null
          subject_id: string
          teacher_id: string
          weekly_periods: number
        }
        Update: {
          id?: string
          section_id?: string
          source_cell?: string | null
          subject_id?: string
          teacher_id?: string
          weekly_periods?: number
        }
        Relationships: [
          {
            foreignKeyName: "teacher_section_subject_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_section_subject_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_section_subject_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          email: string | null
          employment_status: string | null
          full_name: string
          hire_date: string | null
          id: string
          is_form_teacher: boolean
          notes: string | null
          phone_e164: string | null
          primary_dept: string | null
          primary_subject_text: string | null
          qualifications: string[] | null
          school_id: string
          staffing_category_id: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          email?: string | null
          employment_status?: string | null
          full_name: string
          hire_date?: string | null
          id?: string
          is_form_teacher?: boolean
          notes?: string | null
          phone_e164?: string | null
          primary_dept?: string | null
          primary_subject_text?: string | null
          qualifications?: string[] | null
          school_id: string
          staffing_category_id?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          email?: string | null
          employment_status?: string | null
          full_name?: string
          hire_date?: string | null
          id?: string
          is_form_teacher?: boolean
          notes?: string | null
          phone_e164?: string | null
          primary_dept?: string | null
          primary_subject_text?: string | null
          qualifications?: string[] | null
          school_id?: string
          staffing_category_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teachers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teachers_staffing_category_id_fkey"
            columns: ["staffing_category_id"]
            isOneToOne: false
            referencedRelation: "staffing_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      terms: {
        Row: {
          academic_year_id: string
          ends_on: string
          id: string
          kind: Database["public"]["Enums"]["term_kind"]
          label: string
          notes: string | null
          school_id: string
          starts_on: string
        }
        Insert: {
          academic_year_id: string
          ends_on: string
          id?: string
          kind: Database["public"]["Enums"]["term_kind"]
          label: string
          notes?: string | null
          school_id: string
          starts_on: string
        }
        Update: {
          academic_year_id?: string
          ends_on?: string
          id?: string
          kind?: Database["public"]["Enums"]["term_kind"]
          label?: string
          notes?: string | null
          school_id?: string
          starts_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "terms_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable_slots: {
        Row: {
          academic_year_id: string
          bell_period_id: string
          id: string
          is_locked: boolean | null
          notes: string | null
          room_id: string | null
          school_id: string
          section_id: string
          source: string | null
          subject_id: string
          teacher_id: string
        }
        Insert: {
          academic_year_id: string
          bell_period_id: string
          id?: string
          is_locked?: boolean | null
          notes?: string | null
          room_id?: string | null
          school_id: string
          section_id: string
          source?: string | null
          subject_id: string
          teacher_id: string
        }
        Update: {
          academic_year_id?: string
          bell_period_id?: string
          id?: string
          is_locked?: boolean | null
          notes?: string | null
          room_id?: string | null
          school_id?: string
          section_id?: string
          source?: string | null
          subject_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timetable_slots_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_bell_period_id_fkey"
            columns: ["bell_period_id"]
            isOneToOne: false
            referencedRelation: "bell_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      university_outcomes: {
        Row: {
          admit_rate: number | null
          admits: number | null
          applicants: number | null
          cohort_year: number | null
          course: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["outcome_kind"]
          school_id: string
          source: string | null
          university: string
        }
        Insert: {
          admit_rate?: number | null
          admits?: number | null
          applicants?: number | null
          cohort_year?: number | null
          course?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["outcome_kind"]
          school_id: string
          source?: string | null
          university: string
        }
        Update: {
          admit_rate?: number | null
          admits?: number | null
          applicants?: number | null
          cohort_year?: number | null
          course?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["outcome_kind"]
          school_id?: string
          source?: string | null
          university?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_outcomes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      user_schools: {
        Row: {
          created_at: string
          display_role: Database["public"]["Enums"]["user_role"] | null
          role: string
          school_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_role?: Database["public"]["Enums"]["user_role"] | null
          role?: string
          school_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_role?: Database["public"]["Enums"]["user_role"] | null
          role?: string
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_schools_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_assessment_oversight: {
        Row: {
          assessment: string | null
          class: string | null
          external_ref: string | null
          grade: string | null
          held_on: string | null
          max_score: number | null
          school_id: string | null
          score: number | null
          student: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      v_elective_demand: {
        Row: {
          academic_year_id: string | null
          bundle_label: string | null
          grade_level: string | null
          picks: number | null
          subject_code: string | null
          subject_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_selection_forms_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
        ]
      }
      v_teacher_load: {
        Row: {
          slack: number | null
          teacher_id: string | null
          weekly_period_assigned: number | null
          weekly_period_cap: number | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_contracts_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: true
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_school_id_to_jwt: { Args: { event: Json }; Returns: Json }
      manhaj_dashboard_data_public: {
        Args: { p_school_name: string }
        Returns: Json
      }
      manhaj_log_ai_usage: {
        Args: {
          p_cache_hit: boolean
          p_cost_usd: number
          p_input_tokens: number
          p_is_background: boolean
          p_model: string
          p_output_tokens: number
          p_request_kind: string
          p_school_name: string
        }
        Returns: undefined
      }
      manhaj_public_counts: { Args: { p_school_name: string }; Returns: Json }
      seed_manhaj_ip: { Args: { p_school_id: string }; Returns: undefined }
      set_tenant_search_path: {
        Args: { p_school_id: string }
        Returns: undefined
      }
      submit_course_selection_public: {
        Args: {
          p_academic_year_label: string
          p_grade_level: string
          p_picks: Json
          p_school_name: string
          p_student_name: string
        }
        Returns: Json
      }
      tenant_id: { Args: never; Returns: string }
    }
    Enums: {
      absence_reason:
        | "sick"
        | "personal"
        | "professional_development"
        | "emergency"
        | "maternity_paternity"
        | "unpaid"
      absence_status: "pending" | "approved" | "rejected" | "cancelled"
      activity_kind: "trip" | "event" | "workshop" | "other"
      admin_role:
        | "principal"
        | "vice_principal"
        | "head_of_department"
        | "curriculum_coordinator"
        | "finance_admin"
        | "operations_admin"
        | "it_admin"
      admission_stage:
        | "new"
        | "review"
        | "interview"
        | "offer"
        | "accepted"
        | "rejected"
        | "withdrawn"
      applicant_status:
        | "new"
        | "screening"
        | "interview"
        | "offer_sent"
        | "accepted"
        | "rejected"
        | "withdrawn"
      assessment_kind:
        | "quiz"
        | "test"
        | "exam"
        | "project"
        | "homework"
        | "presentation"
      attendance_status: "present" | "absent" | "late" | "excused" | "unknown"
      behaviour_kind: "positive" | "concern" | "observation"
      comm_channel: "whatsapp" | "email" | "both"
      comm_draft_status: "draft" | "sent" | "discarded" | "snoozed"
      comm_tone: "warm" | "formal" | "urgent" | "celebratory"
      consent_kind:
        | "whatsapp_comms"
        | "ai_drafted_reports"
        | "lecture_recording"
        | "data_processing"
        | "trip_photography"
        | "trip_participation"
      curriculum_stage: "EY" | "PRIMARY" | "MIDDLE" | "IGCSE" | "AS" | "A2"
      elective_kind:
        | "compulsory"
        | "elective_pick_one"
        | "elective_pair"
        | "pe_art"
      flag_status: "open" | "in_progress" | "resolved"
      goal_checkin_source: "student" | "auto"
      goal_created_by: "teacher" | "parent" | "student" | "admin"
      goal_kind: "academic" | "behavioural" | "personal" | "university_prep"
      goal_metric_kind:
        | "assessment_pct"
        | "self_streak"
        | "rubric_axis"
        | "self_count"
      goal_status: "on_track" | "at_risk" | "met" | "missed"
      grade_kind:
        | "igcse"
        | "as_level"
        | "a2_level"
        | "ib"
        | "sat"
        | "ielts"
        | "toefl"
        | "other"
      invitation_status: "pending" | "accepted" | "expired" | "revoked"
      invoice_status:
        | "draft"
        | "unpaid"
        | "paid"
        | "overdue"
        | "partial"
        | "cancelled"
      lesson_plan_kind: "standard" | "substitute" | "exam" | "field_trip"
      notification_kind:
        | "attendance_alert"
        | "grade_posted"
        | "message_received"
        | "announcement"
        | "permission_slip"
        | "invoice"
        | "goal_update"
        | "system"
      outcome_kind: "historic" | "benchmark"
      ps_status: "draft" | "submitted" | "reviewed" | "final"
      ref_status: "requested" | "drafted" | "sent"
      regulatory_report_kind:
        | "moe_monthly"
        | "moe_annual"
        | "caa_accreditation"
        | "attendance_summary"
        | "exam_results"
        | "hr_headcount"
        | "custom"
      report_archive_kind:
        | "parent_digest"
        | "absence_summary"
        | "regulatory"
        | "fee_statement"
        | "other"
      report_archive_scope: "school" | "section" | "student" | "teacher"
      report_submission_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "approved"
        | "rejected"
        | "resubmit_required"
      risk_level: "low" | "medium" | "high" | "critical"
      selection_status: "draft" | "submitted" | "locked" | "overridden"
      slip_status: "not_started" | "draft" | "signed" | "declined"
      study_block_kind: "study" | "free"
      study_block_origin: "suggested" | "edited"
      term_kind: "term" | "holiday" | "break" | "exam-week"
      university_app_status:
        | "researching"
        | "in_progress"
        | "submitted"
        | "interview"
        | "admitted"
        | "rejected"
        | "withdrawn"
      user_role: "admin" | "teacher" | "parent" | "student"
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
      absence_reason: [
        "sick",
        "personal",
        "professional_development",
        "emergency",
        "maternity_paternity",
        "unpaid",
      ],
      absence_status: ["pending", "approved", "rejected", "cancelled"],
      activity_kind: ["trip", "event", "workshop", "other"],
      admin_role: [
        "principal",
        "vice_principal",
        "head_of_department",
        "curriculum_coordinator",
        "finance_admin",
        "operations_admin",
        "it_admin",
      ],
      admission_stage: [
        "new",
        "review",
        "interview",
        "offer",
        "accepted",
        "rejected",
        "withdrawn",
      ],
      applicant_status: [
        "new",
        "screening",
        "interview",
        "offer_sent",
        "accepted",
        "rejected",
        "withdrawn",
      ],
      assessment_kind: [
        "quiz",
        "test",
        "exam",
        "project",
        "homework",
        "presentation",
      ],
      attendance_status: ["present", "absent", "late", "excused", "unknown"],
      behaviour_kind: ["positive", "concern", "observation"],
      comm_channel: ["whatsapp", "email", "both"],
      comm_draft_status: ["draft", "sent", "discarded", "snoozed"],
      comm_tone: ["warm", "formal", "urgent", "celebratory"],
      consent_kind: [
        "whatsapp_comms",
        "ai_drafted_reports",
        "lecture_recording",
        "data_processing",
        "trip_photography",
        "trip_participation",
      ],
      curriculum_stage: ["EY", "PRIMARY", "MIDDLE", "IGCSE", "AS", "A2"],
      elective_kind: [
        "compulsory",
        "elective_pick_one",
        "elective_pair",
        "pe_art",
      ],
      flag_status: ["open", "in_progress", "resolved"],
      goal_checkin_source: ["student", "auto"],
      goal_created_by: ["teacher", "parent", "student", "admin"],
      goal_kind: ["academic", "behavioural", "personal", "university_prep"],
      goal_metric_kind: [
        "assessment_pct",
        "self_streak",
        "rubric_axis",
        "self_count",
      ],
      goal_status: ["on_track", "at_risk", "met", "missed"],
      grade_kind: [
        "igcse",
        "as_level",
        "a2_level",
        "ib",
        "sat",
        "ielts",
        "toefl",
        "other",
      ],
      invitation_status: ["pending", "accepted", "expired", "revoked"],
      invoice_status: [
        "draft",
        "unpaid",
        "paid",
        "overdue",
        "partial",
        "cancelled",
      ],
      lesson_plan_kind: ["standard", "substitute", "exam", "field_trip"],
      notification_kind: [
        "attendance_alert",
        "grade_posted",
        "message_received",
        "announcement",
        "permission_slip",
        "invoice",
        "goal_update",
        "system",
      ],
      outcome_kind: ["historic", "benchmark"],
      ps_status: ["draft", "submitted", "reviewed", "final"],
      ref_status: ["requested", "drafted", "sent"],
      regulatory_report_kind: [
        "moe_monthly",
        "moe_annual",
        "caa_accreditation",
        "attendance_summary",
        "exam_results",
        "hr_headcount",
        "custom",
      ],
      report_archive_kind: [
        "parent_digest",
        "absence_summary",
        "regulatory",
        "fee_statement",
        "other",
      ],
      report_archive_scope: ["school", "section", "student", "teacher"],
      report_submission_status: [
        "draft",
        "submitted",
        "under_review",
        "approved",
        "rejected",
        "resubmit_required",
      ],
      risk_level: ["low", "medium", "high", "critical"],
      selection_status: ["draft", "submitted", "locked", "overridden"],
      slip_status: ["not_started", "draft", "signed", "declined"],
      study_block_kind: ["study", "free"],
      study_block_origin: ["suggested", "edited"],
      term_kind: ["term", "holiday", "break", "exam-week"],
      university_app_status: [
        "researching",
        "in_progress",
        "submitted",
        "interview",
        "admitted",
        "rejected",
        "withdrawn",
      ],
      user_role: ["admin", "teacher", "parent", "student"],
    },
  },
} as const
