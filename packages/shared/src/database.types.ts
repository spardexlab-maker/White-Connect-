
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "access_audit": {
                  Row: {
                    "action": string,"actor_user_id": string | null,"entity_id": string | null,"entity_type": string,"facility_id": string | null,"id": number,"metadata": NonNullable<Json>,"occurred_at": string,"organization_id": string | null,"patient_id": string | null,"reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_user_id"?: string | null,"entity_id"?: string | null,"entity_type": string,"facility_id"?: string | null,"id"?: never,"metadata"?: NonNullable<Json>,"occurred_at"?: string,"organization_id"?: string | null,"patient_id"?: string | null,"reason"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_user_id"?: string | null,"entity_id"?: string | null,"entity_type"?: string,"facility_id"?: string | null,"id"?: never,"metadata"?: NonNullable<Json>,"occurred_at"?: string,"organization_id"?: string | null,"patient_id"?: string | null,"reason"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"ai_usage": {
                  Row: {
                    "created_at": string,"feature": string,"id": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"feature"?: string,"id"?: never,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"feature"?: string,"id"?: never,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"allergies": {
                  Row: {
                    "created_at": string,"facility_id": string | null,"id": string,"patient_id": string,"reaction": string | null,"recorded_by": string,"recorded_by_practitioner_id": string | null,"severity": string | null,"source": string,"status": string,"substance": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"facility_id"?: string | null,"id"?: string,"patient_id": string,"reaction"?: string | null,"recorded_by": string,"recorded_by_practitioner_id"?: string | null,"severity"?: string | null,"source": string,"status"?: string,"substance": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "created_at"?: string,"facility_id"?: string | null,"id"?: string,"patient_id"?: string,"reaction"?: string | null,"recorded_by"?: string,"recorded_by_practitioner_id"?: string | null,"severity"?: string | null,"source"?: string,"status"?: string,"substance"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "allergies_facility_id_fkey"
      columns: ["facility_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "allergies_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "allergies_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "allergies_recorded_by_practitioner_id_fkey"
      columns: ["recorded_by_practitioner_id"]
isOneToOne: false
      referencedRelation: "practitioner_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"appointment_events": {
                  Row: {
                    "actor_user_id": string | null,"appointment_id": string,"from_status": Database["public"]['Enums']["appointment_status"] | null,"id": number,"occurred_at": string,"reason": string | null,"to_status": Database["public"]['Enums']["appointment_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_user_id"?: string | null,"appointment_id": string,"from_status"?: Database["public"]['Enums']["appointment_status"] | null,"id"?: never,"occurred_at"?: string,"reason"?: string | null,"to_status": Database["public"]['Enums']["appointment_status"]
                  }
                  Update: {
                    "actor_user_id"?: string | null,"appointment_id"?: string,"from_status"?: Database["public"]['Enums']["appointment_status"] | null,"id"?: never,"occurred_at"?: string,"reason"?: string | null,"to_status"?: Database["public"]['Enums']["appointment_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointment_events_appointment_id_fkey"
      columns: ["appointment_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["id"]
    }
                  ]
                },"appointments": {
                  Row: {
                    "blocked_period": unknown,"booking_number": string,"buffer_minutes": number,"cancellation_cutoff_minutes": number,"confirmation_deadline": string | null,"confirmed_at": string | null,"confirmed_by": string | null,"created_at": string,"created_by": string,"currency": string,"duration_minutes": number,"facility_id": string,"holds_slot": boolean | null,"id": string,"idempotency_key": string,"patient_id": string,"patient_note": string | null,"period": unknown,"practitioner_id": string | null,"price_minor": number | null,"rescheduled_from": string | null,"resource_id": string | null,"service_id": string,"source": Database["public"]['Enums']["booking_source"],"status": Database["public"]['Enums']["appointment_status"],"status_reason": string | null,"timezone": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked_period": unknown,"booking_number"?: string,"buffer_minutes"?: number,"cancellation_cutoff_minutes"?: number,"confirmation_deadline"?: string | null,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"created_by": string,"currency"?: string,"duration_minutes": number,"facility_id": string,"holds_slot"?: never,"id"?: string,"idempotency_key": string,"patient_id": string,"patient_note"?: string | null,"period": unknown,"practitioner_id"?: string | null,"price_minor"?: number | null,"rescheduled_from"?: string | null,"resource_id"?: string | null,"service_id": string,"source": Database["public"]['Enums']["booking_source"],"status": Database["public"]['Enums']["appointment_status"],"status_reason"?: string | null,"timezone": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "blocked_period"?: unknown,"booking_number"?: string,"buffer_minutes"?: number,"cancellation_cutoff_minutes"?: number,"confirmation_deadline"?: string | null,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"created_by"?: string,"currency"?: string,"duration_minutes"?: number,"facility_id"?: string,"holds_slot"?: never,"id"?: string,"idempotency_key"?: string,"patient_id"?: string,"patient_note"?: string | null,"period"?: unknown,"practitioner_id"?: string | null,"price_minor"?: number | null,"rescheduled_from"?: string | null,"resource_id"?: string | null,"service_id"?: string,"source"?: Database["public"]['Enums']["booking_source"],"status"?: Database["public"]['Enums']["appointment_status"],"status_reason"?: string | null,"timezone"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointments_confirmed_by_fkey"
      columns: ["confirmed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointments_facility_id_fkey"
      columns: ["facility_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointments_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointments_practitioner_id_fkey"
      columns: ["practitioner_id"]
isOneToOne: false
      referencedRelation: "practitioner_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointments_rescheduled_from_fkey"
      columns: ["rescheduled_from"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointments_resource_id_fkey"
      columns: ["resource_id"]
isOneToOne: false
      referencedRelation: "facility_resources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointments_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "clinic_services"
      referencedColumns: ["id"]
    }
                  ]
                },"attachments": {
                  Row: {
                    "available_at": string | null,"created_at": string,"declared_mime": string,"declared_size": number,"detected_mime": string | null,"encounter_id": string | null,"file_name": string,"id": string,"kind": string,"lab_order_id": string | null,"patient_id": string,"rejection_reason": string | null,"status": string,"storage_path": string | null,"uploaded_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "available_at"?: string | null,"created_at"?: string,"declared_mime": string,"declared_size": number,"detected_mime"?: string | null,"encounter_id"?: string | null,"file_name": string,"id"?: string,"kind": string,"lab_order_id"?: string | null,"patient_id": string,"rejection_reason"?: string | null,"status"?: string,"storage_path"?: string | null,"uploaded_by": string
                  }
                  Update: {
                    "available_at"?: string | null,"created_at"?: string,"declared_mime"?: string,"declared_size"?: number,"detected_mime"?: string | null,"encounter_id"?: string | null,"file_name"?: string,"id"?: string,"kind"?: string,"lab_order_id"?: string | null,"patient_id"?: string,"rejection_reason"?: string | null,"status"?: string,"storage_path"?: string | null,"uploaded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attachments_encounter_id_fkey"
      columns: ["encounter_id"]
isOneToOne: false
      referencedRelation: "encounters"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attachments_lab_order_id_fkey"
      columns: ["lab_order_id"]
isOneToOne: false
      referencedRelation: "lab_orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attachments_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attachments_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_policies": {
                  Row: {
                    "booking_window_days": number,"cancellation_cutoff_minutes": number,"cancellation_policy_text": string | null,"confirmation_mode": string,"confirmation_timeout_minutes": number,"created_at": string,"facility_id": string,"id": string,"late_policy_text": string | null,"min_notice_minutes": number,"practitioner_id": string | null,"slot_step_minutes": number | null,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_window_days"?: number,"cancellation_cutoff_minutes"?: number,"cancellation_policy_text"?: string | null,"confirmation_mode"?: string,"confirmation_timeout_minutes"?: number,"created_at"?: string,"facility_id": string,"id"?: string,"late_policy_text"?: string | null,"min_notice_minutes"?: number,"practitioner_id"?: string | null,"slot_step_minutes"?: number | null,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "booking_window_days"?: number,"cancellation_cutoff_minutes"?: number,"cancellation_policy_text"?: string | null,"confirmation_mode"?: string,"confirmation_timeout_minutes"?: number,"created_at"?: string,"facility_id"?: string,"id"?: string,"late_policy_text"?: string | null,"min_notice_minutes"?: number,"practitioner_id"?: string | null,"slot_step_minutes"?: number | null,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_policies_facility_id_fkey"
      columns: ["facility_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_policies_practitioner_id_fkey"
      columns: ["practitioner_id"]
isOneToOne: false
      referencedRelation: "practitioner_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"branches": {
                  Row: {
                    "address": string | null,"area": string | null,"city_id": string | null,"created_at": string,"id": string,"latitude": number | null,"longitude": number | null,"name": string,"organization_id": string,"status": Database["public"]['Enums']["entity_status"],"timezone": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"area"?: string | null,"city_id"?: string | null,"created_at"?: string,"id"?: string,"latitude"?: number | null,"longitude"?: number | null,"name": string,"organization_id": string,"status"?: Database["public"]['Enums']["entity_status"],"timezone"?: string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "address"?: string | null,"area"?: string | null,"city_id"?: string | null,"created_at"?: string,"id"?: string,"latitude"?: number | null,"longitude"?: number | null,"name"?: string,"organization_id"?: string,"status"?: Database["public"]['Enums']["entity_status"],"timezone"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "branches_city_id_fkey"
      columns: ["city_id"]
isOneToOne: false
      referencedRelation: "cities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "branches_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"care_relationships": {
                  Row: {
                    "created_at": string,"created_by": string | null,"ended_at": string | null,"facility_id": string,"id": string,"patient_id": string,"practitioner_id": string | null,"source": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"ended_at"?: string | null,"facility_id": string,"id"?: string,"patient_id": string,"practitioner_id"?: string | null,"source": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"ended_at"?: string | null,"facility_id"?: string,"id"?: string,"patient_id"?: string,"practitioner_id"?: string | null,"source"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "care_relationships_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "care_relationships_facility_id_fkey"
      columns: ["facility_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "care_relationships_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "care_relationships_practitioner_id_fkey"
      columns: ["practitioner_id"]
isOneToOne: false
      referencedRelation: "practitioner_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"cities": {
                  Row: {
                    "country_code": string,"created_at": string,"id": string,"is_active": boolean,"name_ar": string,"name_en": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "country_code"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name_ar": string,"name_en"?: string | null
                  }
                  Update: {
                    "country_code"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name_ar"?: string,"name_en"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"clinic_services": {
                  Row: {
                    "buffer_minutes": number,"created_at": string,"currency": string,"description": string | null,"duration_minutes": number,"facility_id": string,"id": string,"is_active": boolean,"is_public": boolean,"name": string,"practitioner_id": string | null,"preparation_note": string | null,"price_minor": number | null,"resource_id": string | null,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "buffer_minutes"?: number,"created_at"?: string,"currency"?: string,"description"?: string | null,"duration_minutes": number,"facility_id": string,"id"?: string,"is_active"?: boolean,"is_public"?: boolean,"name": string,"practitioner_id"?: string | null,"preparation_note"?: string | null,"price_minor"?: number | null,"resource_id"?: string | null,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "buffer_minutes"?: number,"created_at"?: string,"currency"?: string,"description"?: string | null,"duration_minutes"?: number,"facility_id"?: string,"id"?: string,"is_active"?: boolean,"is_public"?: boolean,"name"?: string,"practitioner_id"?: string | null,"preparation_note"?: string | null,"price_minor"?: number | null,"resource_id"?: string | null,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "clinic_services_facility_id_fkey"
      columns: ["facility_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clinic_services_practitioner_id_fkey"
      columns: ["practitioner_id"]
isOneToOne: false
      referencedRelation: "practitioner_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clinic_services_resource_id_facility_id_fkey"
      columns: ["resource_id","facility_id"]
isOneToOne: false
      referencedRelation: "facility_resources"
      referencedColumns: ["id","facility_id"]
    }
                  ]
                },"clinical_notes": {
                  Row: {
                    "assessment": string | null,"correction_reason": string | null,"created_at": string,"created_by": string,"encounter_id": string,"examination": string | null,"follow_up": string | null,"free_text": string | null,"history": string | null,"id": string,"plan": string | null,"reason_for_visit": string | null,"signed_at": string | null,"signed_by": string | null,"status": string,"supersedes_id": string | null,"updated_at": string,"version": number,"version_no": number,"vitals": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "assessment"?: string | null,"correction_reason"?: string | null,"created_at"?: string,"created_by": string,"encounter_id": string,"examination"?: string | null,"follow_up"?: string | null,"free_text"?: string | null,"history"?: string | null,"id"?: string,"plan"?: string | null,"reason_for_visit"?: string | null,"signed_at"?: string | null,"signed_by"?: string | null,"status"?: string,"supersedes_id"?: string | null,"updated_at"?: string,"version"?: number,"version_no": number,"vitals"?: NonNullable<Json>
                  }
                  Update: {
                    "assessment"?: string | null,"correction_reason"?: string | null,"created_at"?: string,"created_by"?: string,"encounter_id"?: string,"examination"?: string | null,"follow_up"?: string | null,"free_text"?: string | null,"history"?: string | null,"id"?: string,"plan"?: string | null,"reason_for_visit"?: string | null,"signed_at"?: string | null,"signed_by"?: string | null,"status"?: string,"supersedes_id"?: string | null,"updated_at"?: string,"version"?: number,"version_no"?: number,"vitals"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "clinical_notes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clinical_notes_encounter_id_fkey"
      columns: ["encounter_id"]
isOneToOne: false
      referencedRelation: "encounters"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clinical_notes_signed_by_fkey"
      columns: ["signed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clinical_notes_supersedes_id_fkey"
      columns: ["supersedes_id"]
isOneToOne: false
      referencedRelation: "clinical_notes"
      referencedColumns: ["id"]
    }
                  ]
                },"clinical_tasks": {
                  Row: {
                    "created_at": string,"done_at": string | null,"encounter_id": string | null,"facility_id": string | null,"id": string,"kind": string,"lab_order_id": string | null,"patient_id": string,"practitioner_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"done_at"?: string | null,"encounter_id"?: string | null,"facility_id"?: string | null,"id"?: string,"kind": string,"lab_order_id"?: string | null,"patient_id": string,"practitioner_id": string,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"done_at"?: string | null,"encounter_id"?: string | null,"facility_id"?: string | null,"id"?: string,"kind"?: string,"lab_order_id"?: string | null,"patient_id"?: string,"practitioner_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clinical_tasks_encounter_id_fkey"
      columns: ["encounter_id"]
isOneToOne: false
      referencedRelation: "encounters"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clinical_tasks_facility_id_fkey"
      columns: ["facility_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clinical_tasks_lab_order_fk"
      columns: ["lab_order_id"]
isOneToOne: false
      referencedRelation: "lab_orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clinical_tasks_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clinical_tasks_practitioner_id_fkey"
      columns: ["practitioner_id"]
isOneToOne: false
      referencedRelation: "practitioner_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"consent_grants": {
                  Row: {
                    "created_at": string,"expires_at": string | null,"granted_by": string,"grantee_facility_id": string | null,"grantee_practitioner_id": string | null,"id": string,"patient_id": string,"purpose": string,"resource_id": string | null,"revoked_at": string | null,"scope": string,"starts_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expires_at"?: string | null,"granted_by": string,"grantee_facility_id"?: string | null,"grantee_practitioner_id"?: string | null,"id"?: string,"patient_id": string,"purpose": string,"resource_id"?: string | null,"revoked_at"?: string | null,"scope": string,"starts_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"expires_at"?: string | null,"granted_by"?: string,"grantee_facility_id"?: string | null,"grantee_practitioner_id"?: string | null,"id"?: string,"patient_id"?: string,"purpose"?: string,"resource_id"?: string | null,"revoked_at"?: string | null,"scope"?: string,"starts_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "consent_grants_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "consent_grants_grantee_facility_id_fkey"
      columns: ["grantee_facility_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "consent_grants_grantee_practitioner_id_fkey"
      columns: ["grantee_practitioner_id"]
isOneToOne: false
      referencedRelation: "practitioner_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "consent_grants_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"delay_notices": {
                  Row: {
                    "created_at": string,"created_by": string | null,"delay_minutes": number,"facility_id": string,"id": string,"message": string | null,"practitioner_id": string | null,"service_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"delay_minutes": number,"facility_id": string,"id"?: string,"message"?: string | null,"practitioner_id"?: string | null,"service_date": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"delay_minutes"?: number,"facility_id"?: string,"id"?: string,"message"?: string | null,"practitioner_id"?: string | null,"service_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "delay_notices_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "delay_notices_facility_id_fkey"
      columns: ["facility_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "delay_notices_practitioner_id_fkey"
      columns: ["practitioner_id"]
isOneToOne: false
      referencedRelation: "practitioner_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"dispatch_line_notes": {
                  Row: {
                    "created_at": string,"created_by": string,"dispatch_id": string,"doctor_reply": string | null,"doctor_seen_at": string | null,"id": string,"kind": string,"line_no": number,"note": string | null,"replied_at": string | null,"replied_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"dispatch_id": string,"doctor_reply"?: string | null,"doctor_seen_at"?: string | null,"id"?: string,"kind": string,"line_no": number,"note"?: string | null,"replied_at"?: string | null,"replied_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"dispatch_id"?: string,"doctor_reply"?: string | null,"doctor_seen_at"?: string | null,"id"?: string,"kind"?: string,"line_no"?: number,"note"?: string | null,"replied_at"?: string | null,"replied_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "dispatch_line_notes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dispatch_line_notes_dispatch_id_fkey"
      columns: ["dispatch_id"]
isOneToOne: false
      referencedRelation: "prescription_dispatches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dispatch_line_notes_replied_by_fkey"
      columns: ["replied_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"dispensing_records": {
                  Row: {
                    "batch_id": string,"dispatch_id": string,"dispensed_at": string,"dispensed_by": string,"id": string,"line_no": number,"product_id": string,"quantity": number,"sale_id": string | null,"version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_id": string,"dispatch_id": string,"dispensed_at"?: string,"dispensed_by": string,"id"?: string,"line_no": number,"product_id": string,"quantity": number,"sale_id"?: string | null,"version_id": string
                  }
                  Update: {
                    "batch_id"?: string,"dispatch_id"?: string,"dispensed_at"?: string,"dispensed_by"?: string,"id"?: string,"line_no"?: number,"product_id"?: string,"quantity"?: number,"sale_id"?: string | null,"version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "dispensing_records_batch_id_fkey"
      columns: ["batch_id"]
isOneToOne: false
      referencedRelation: "inventory_batches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dispensing_records_dispatch_id_fkey"
      columns: ["dispatch_id"]
isOneToOne: false
      referencedRelation: "prescription_dispatches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dispensing_records_dispensed_by_fkey"
      columns: ["dispensed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dispensing_records_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "pharmacy_products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dispensing_records_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dispensing_records_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "prescription_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"encounters": {
                  Row: {
                    "appointment_id": string | null,"created_at": string,"created_by": string,"ended_at": string | null,"facility_id": string,"follow_up_of": string | null,"id": string,"identity_verified": boolean,"patient_id": string,"pause_reason": string | null,"paused_at": string | null,"practitioner_id": string,"queue_entry_id": string | null,"reopen_count": number,"reopen_reason": string | null,"reopened_at": string | null,"started_at": string | null,"status": Database["public"]['Enums']["encounter_status"],"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "appointment_id"?: string | null,"created_at"?: string,"created_by": string,"ended_at"?: string | null,"facility_id": string,"follow_up_of"?: string | null,"id"?: string,"identity_verified"?: boolean,"patient_id": string,"pause_reason"?: string | null,"paused_at"?: string | null,"practitioner_id": string,"queue_entry_id"?: string | null,"reopen_count"?: number,"reopen_reason"?: string | null,"reopened_at"?: string | null,"started_at"?: string | null,"status"?: Database["public"]['Enums']["encounter_status"],"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "appointment_id"?: string | null,"created_at"?: string,"created_by"?: string,"ended_at"?: string | null,"facility_id"?: string,"follow_up_of"?: string | null,"id"?: string,"identity_verified"?: boolean,"patient_id"?: string,"pause_reason"?: string | null,"paused_at"?: string | null,"practitioner_id"?: string,"queue_entry_id"?: string | null,"reopen_count"?: number,"reopen_reason"?: string | null,"reopened_at"?: string | null,"started_at"?: string | null,"status"?: Database["public"]['Enums']["encounter_status"],"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "encounters_appointment_id_fkey"
      columns: ["appointment_id"]
isOneToOne: true
      referencedRelation: "appointments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "encounters_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "encounters_facility_id_fkey"
      columns: ["facility_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "encounters_follow_up_of_fkey"
      columns: ["follow_up_of"]
isOneToOne: false
      referencedRelation: "encounters"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "encounters_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "encounters_practitioner_id_fkey"
      columns: ["practitioner_id"]
isOneToOne: false
      referencedRelation: "practitioner_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "encounters_queue_entry_id_fkey"
      columns: ["queue_entry_id"]
isOneToOne: true
      referencedRelation: "queue_entries"
      referencedColumns: ["id"]
    }
                  ]
                },"expenses": {
                  Row: {
                    "amount_minor": number,"category": string,"created_at": string,"created_by": string,"facility_id": string,"id": string,"note": string | null,"spent_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor": number,"category": string,"created_at"?: string,"created_by": string,"facility_id": string,"id"?: string,"note"?: string | null,"spent_on"?: string
                  }
                  Update: {
                    "amount_minor"?: number,"category"?: string,"created_at"?: string,"created_by"?: string,"facility_id"?: string,"id"?: string,"note"?: string | null,"spent_on"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_facility_id_fkey"
      columns: ["facility_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    }
                  ]
                },"facilities": {
                  Row: {
                    "branch_id": string,"created_at": string,"default_lab_id": string | null,"default_pharmacy_id": string | null,"description": string | null,"home_collection": boolean,"home_collection_fee_minor": number | null,"home_collection_note": string | null,"id": string,"is_public": boolean,"name": string,"opening_hours_note": string | null,"organization_id": string,"phone": string | null,"status": Database["public"]['Enums']["entity_status"],"status_reason": string | null,"type": Database["public"]['Enums']["facility_type"],"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id": string,"created_at"?: string,"default_lab_id"?: string | null,"default_pharmacy_id"?: string | null,"description"?: string | null,"home_collection"?: boolean,"home_collection_fee_minor"?: number | null,"home_collection_note"?: string | null,"id"?: string,"is_public"?: boolean,"name": string,"opening_hours_note"?: string | null,"organization_id": string,"phone"?: string | null,"status"?: Database["public"]['Enums']["entity_status"],"status_reason"?: string | null,"type": Database["public"]['Enums']["facility_type"],"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "branch_id"?: string,"created_at"?: string,"default_lab_id"?: string | null,"default_pharmacy_id"?: string | null,"description"?: string | null,"home_collection"?: boolean,"home_collection_fee_minor"?: number | null,"home_collection_note"?: string | null,"id"?: string,"is_public"?: boolean,"name"?: string,"opening_hours_note"?: string | null,"organization_id"?: string,"phone"?: string | null,"status"?: Database["public"]['Enums']["entity_status"],"status_reason"?: string | null,"type"?: Database["public"]['Enums']["facility_type"],"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "facilities_branch_id_organization_id_fkey"
      columns: ["branch_id","organization_id"]
isOneToOne: false
      referencedRelation: "branches"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "facilities_default_lab_id_fkey"
      columns: ["default_lab_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "facilities_default_pharmacy_id_fkey"
      columns: ["default_pharmacy_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "facilities_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"facility_resources": {
                  Row: {
                    "created_at": string,"facility_id": string,"id": string,"is_active": boolean,"kind": string,"name": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"facility_id": string,"id"?: string,"is_active"?: boolean,"kind": string,"name": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "created_at"?: string,"facility_id"?: string,"id"?: string,"is_active"?: boolean,"kind"?: string,"name"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "facility_resources_facility_id_fkey"
      columns: ["facility_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    }
                  ]
                },"home_lab_request_events": {
                  Row: {
                    "at": string,"by_user": string | null,"id": number,"note": string | null,"request_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "at"?: string,"by_user"?: string | null,"id"?: never,"note"?: string | null,"request_id": string,"status": string
                  }
                  Update: {
                    "at"?: string,"by_user"?: string | null,"id"?: never,"note"?: string | null,"request_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "home_lab_request_events_by_user_fkey"
      columns: ["by_user"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "home_lab_request_events_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "home_lab_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"home_lab_requests": {
                  Row: {
                    "address": string,"collector_name": string | null,"created_at": string,"created_by": string,"id": string,"lab_facility_id": string,"lab_order_id": string | null,"latitude": number | null,"longitude": number | null,"notes": string | null,"patient_id": string,"phone": string,"preferred_date": string,"preferred_window": string,"request_number": string,"scheduled_at": string | null,"status": string,"status_reason": string | null,"test_ids": (string)[],"tests_text": string | null,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "address": string,"collector_name"?: string | null,"created_at"?: string,"created_by": string,"id"?: string,"lab_facility_id": string,"lab_order_id"?: string | null,"latitude"?: number | null,"longitude"?: number | null,"notes"?: string | null,"patient_id": string,"phone": string,"preferred_date": string,"preferred_window": string,"request_number"?: string,"scheduled_at"?: string | null,"status"?: string,"status_reason"?: string | null,"test_ids"?: (string)[],"tests_text"?: string | null,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "address"?: string,"collector_name"?: string | null,"created_at"?: string,"created_by"?: string,"id"?: string,"lab_facility_id"?: string,"lab_order_id"?: string | null,"latitude"?: number | null,"longitude"?: number | null,"notes"?: string | null,"patient_id"?: string,"phone"?: string,"preferred_date"?: string,"preferred_window"?: string,"request_number"?: string,"scheduled_at"?: string | null,"status"?: string,"status_reason"?: string | null,"test_ids"?: (string)[],"tests_text"?: string | null,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "home_lab_requests_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "home_lab_requests_lab_facility_id_fkey"
      columns: ["lab_facility_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "home_lab_requests_lab_order_id_fkey"
      columns: ["lab_order_id"]
isOneToOne: false
      referencedRelation: "lab_orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "home_lab_requests_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_batches": {
                  Row: {
                    "batch_no": string,"expiry_date": string,"id": string,"product_id": string,"quantity_on_hand": number,"received_at": string,"received_by": string | null,"supplier_id": string | null,"unit_cost_minor": number
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_no": string,"expiry_date": string,"id"?: string,"product_id": string,"quantity_on_hand": number,"received_at"?: string,"received_by"?: string | null,"supplier_id"?: string | null,"unit_cost_minor"?: number
                  }
                  Update: {
                    "batch_no"?: string,"expiry_date"?: string,"id"?: string,"product_id"?: string,"quantity_on_hand"?: number,"received_at"?: string,"received_by"?: string | null,"supplier_id"?: string | null,"unit_cost_minor"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_batches_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "pharmacy_products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_batches_received_by_fkey"
      columns: ["received_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_batches_supplier_id_fkey"
      columns: ["supplier_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"created_at": string,"email": string,"expires_at": string,"facility_id": string | null,"id": string,"invited_by": string,"organization_id": string,"reception_practitioner_id": string | null,"revoked_at": string | null,"role": Database["public"]['Enums']["member_role"],"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email": string,"expires_at": string,"facility_id"?: string | null,"id"?: string,"invited_by": string,"organization_id": string,"reception_practitioner_id"?: string | null,"revoked_at"?: string | null,"role": Database["public"]['Enums']["member_role"],"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"facility_id"?: string | null,"id"?: string,"invited_by"?: string,"organization_id"?: string,"reception_practitioner_id"?: string | null,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["member_role"],"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_accepted_by_fkey"
      columns: ["accepted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_facility_id_organization_id_fkey"
      columns: ["facility_id","organization_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "invitations_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_reception_practitioner_id_fkey"
      columns: ["reception_practitioner_id"]
isOneToOne: false
      referencedRelation: "practitioner_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"invoice_lines": {
                  Row: {
                    "description": string,"id": string,"invoice_id": string,"line_total_minor": number,"quantity": number,"unit_price_minor": number
                  }
                  ComputedFields: never
                  Insert: {
                    "description": string,"id"?: string,"invoice_id": string,"line_total_minor": number,"quantity"?: number,"unit_price_minor": number
                  }
                  Update: {
                    "description"?: string,"id"?: string,"invoice_id"?: string,"line_total_minor"?: number,"quantity"?: number,"unit_price_minor"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoice_lines_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    }
                  ]
                },"invoice_payments": {
                  Row: {
                    "amount_minor": number,"created_at": string,"id": string,"idempotency_key": string,"invoice_id": string,"method": string,"note": string | null,"received_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor": number,"created_at"?: string,"id"?: string,"idempotency_key": string,"invoice_id": string,"method"?: string,"note"?: string | null,"received_by": string
                  }
                  Update: {
                    "amount_minor"?: number,"created_at"?: string,"id"?: string,"idempotency_key"?: string,"invoice_id"?: string,"method"?: string,"note"?: string | null,"received_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoice_payments_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoice_payments_received_by_fkey"
      columns: ["received_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"invoices": {
                  Row: {
                    "appointment_id": string | null,"created_at": string,"created_by": string,"currency": string,"facility_id": string,"id": string,"invoice_number": string,"lab_order_id": string | null,"patient_id": string,"status": string,"total_minor": number,"updated_at": string,"version": number,"void_reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "appointment_id"?: string | null,"created_at"?: string,"created_by": string,"currency"?: string,"facility_id": string,"id"?: string,"invoice_number"?: string,"lab_order_id"?: string | null,"patient_id": string,"status"?: string,"total_minor"?: number,"updated_at"?: string,"version"?: number,"void_reason"?: string | null
                  }
                  Update: {
                    "appointment_id"?: string | null,"created_at"?: string,"created_by"?: string,"currency"?: string,"facility_id"?: string,"id"?: string,"invoice_number"?: string,"lab_order_id"?: string | null,"patient_id"?: string,"status"?: string,"total_minor"?: number,"updated_at"?: string,"version"?: number,"void_reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoices_appointment_id_fkey"
      columns: ["appointment_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_facility_id_fkey"
      columns: ["facility_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_lab_order_id_fkey"
      columns: ["lab_order_id"]
isOneToOne: false
      referencedRelation: "lab_orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"lab_order_items": {
                  Row: {
                    "display_name": string,"id": string,"order_id": string,"released_at": string | null,"status": Database["public"]['Enums']["lab_status"],"test_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "display_name": string,"id"?: string,"order_id": string,"released_at"?: string | null,"status"?: Database["public"]['Enums']["lab_status"],"test_id": string
                  }
                  Update: {
                    "display_name"?: string,"id"?: string,"order_id"?: string,"released_at"?: string | null,"status"?: Database["public"]['Enums']["lab_status"],"test_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lab_order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "lab_orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lab_order_items_test_id_fkey"
      columns: ["test_id"]
isOneToOne: false
      referencedRelation: "lab_test_catalog"
      referencedColumns: ["id"]
    }
                  ]
                },"lab_orders": {
                  Row: {
                    "clinical_note": string | null,"created_at": string,"created_by": string,"encounter_id": string | null,"id": string,"idempotency_key": string,"lab_facility_id": string,"order_number": string,"ordering_facility_id": string | null,"ordering_practitioner_id": string | null,"patient_id": string,"source": string,"status": Database["public"]['Enums']["lab_status"],"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "clinical_note"?: string | null,"created_at"?: string,"created_by": string,"encounter_id"?: string | null,"id"?: string,"idempotency_key": string,"lab_facility_id": string,"order_number"?: string,"ordering_facility_id"?: string | null,"ordering_practitioner_id"?: string | null,"patient_id": string,"source": string,"status"?: Database["public"]['Enums']["lab_status"],"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "clinical_note"?: string | null,"created_at"?: string,"created_by"?: string,"encounter_id"?: string | null,"id"?: string,"idempotency_key"?: string,"lab_facility_id"?: string,"order_number"?: string,"ordering_facility_id"?: string | null,"ordering_practitioner_id"?: string | null,"patient_id"?: string,"source"?: string,"status"?: Database["public"]['Enums']["lab_status"],"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "lab_orders_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lab_orders_encounter_id_fkey"
      columns: ["encounter_id"]
isOneToOne: false
      referencedRelation: "encounters"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lab_orders_lab_facility_id_fkey"
      columns: ["lab_facility_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lab_orders_ordering_facility_id_fkey"
      columns: ["ordering_facility_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lab_orders_ordering_practitioner_id_fkey"
      columns: ["ordering_practitioner_id"]
isOneToOne: false
      referencedRelation: "practitioner_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lab_orders_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"lab_results": {
                  Row: {
                    "correction_reason": string | null,"created_at": string,"entered_by": string,"id": string,"lab_flag": string | null,"notes": string | null,"order_item_id": string,"reference_range": string | null,"released_at": string | null,"released_by": string | null,"status": string,"supersedes_id": string | null,"unit": string | null,"updated_at": string,"value_numeric": number | null,"value_text": string | null,"version_no": number
                  }
                  ComputedFields: never
                  Insert: {
                    "correction_reason"?: string | null,"created_at"?: string,"entered_by": string,"id"?: string,"lab_flag"?: string | null,"notes"?: string | null,"order_item_id": string,"reference_range"?: string | null,"released_at"?: string | null,"released_by"?: string | null,"status"?: string,"supersedes_id"?: string | null,"unit"?: string | null,"updated_at"?: string,"value_numeric"?: number | null,"value_text"?: string | null,"version_no": number
                  }
                  Update: {
                    "correction_reason"?: string | null,"created_at"?: string,"entered_by"?: string,"id"?: string,"lab_flag"?: string | null,"notes"?: string | null,"order_item_id"?: string,"reference_range"?: string | null,"released_at"?: string | null,"released_by"?: string | null,"status"?: string,"supersedes_id"?: string | null,"unit"?: string | null,"updated_at"?: string,"value_numeric"?: number | null,"value_text"?: string | null,"version_no"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "lab_results_entered_by_fkey"
      columns: ["entered_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lab_results_order_item_id_fkey"
      columns: ["order_item_id"]
isOneToOne: false
      referencedRelation: "lab_order_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lab_results_released_by_fkey"
      columns: ["released_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lab_results_supersedes_id_fkey"
      columns: ["supersedes_id"]
isOneToOne: false
      referencedRelation: "lab_results"
      referencedColumns: ["id"]
    }
                  ]
                },"lab_test_catalog": {
                  Row: {
                    "code": string,"created_at": string,"id": string,"is_active": boolean,"lab_facility_id": string,"master_id": string | null,"name": string,"preparation_note": string | null,"price_minor": number | null,"reference_range_text": string | null,"specimen_type": string,"turnaround_hours": number | null,"unit": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"lab_facility_id": string,"master_id"?: string | null,"name": string,"preparation_note"?: string | null,"price_minor"?: number | null,"reference_range_text"?: string | null,"specimen_type": string,"turnaround_hours"?: number | null,"unit"?: string | null
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"lab_facility_id"?: string,"master_id"?: string | null,"name"?: string,"preparation_note"?: string | null,"price_minor"?: number | null,"reference_range_text"?: string | null,"specimen_type"?: string,"turnaround_hours"?: number | null,"unit"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "lab_test_catalog_lab_facility_id_fkey"
      columns: ["lab_facility_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lab_test_catalog_master_id_fkey"
      columns: ["master_id"]
isOneToOne: false
      referencedRelation: "lab_test_master"
      referencedColumns: ["id"]
    }
                  ]
                },"lab_test_master": {
                  Row: {
                    "category": string | null,"code": string,"created_at": string,"id": string,"is_active": boolean,"name_ar": string,"name_en": string | null,"reference_range": string | null,"sort_order": number,"specimen_type": string | null,"unit": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string | null,"code": string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name_ar": string,"name_en"?: string | null,"reference_range"?: string | null,"sort_order"?: number,"specimen_type"?: string | null,"unit"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "category"?: string | null,"code"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name_ar"?: string,"name_en"?: string | null,"reference_range"?: string | null,"sort_order"?: number,"specimen_type"?: string | null,"unit"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"medication_catalog": {
                  Row: {
                    "active_ingredient": string,"brand_name": string | null,"created_at": string,"dosage_form": string,"id": string,"is_active": boolean,"strength": string,"unit": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active_ingredient": string,"brand_name"?: string | null,"created_at"?: string,"dosage_form": string,"id"?: string,"is_active"?: boolean,"strength": string,"unit": string
                  }
                  Update: {
                    "active_ingredient"?: string,"brand_name"?: string | null,"created_at"?: string,"dosage_form"?: string,"id"?: string,"is_active"?: boolean,"strength"?: string,"unit"?: string
                  }
                  Relationships: [
                    
                  ]
                },"medication_plans": {
                  Row: {
                    "as_needed": boolean,"consent_at": string,"created_at": string,"created_by": string,"display_name": string,"dose": number | null,"dose_unit": string | null,"end_date": string | null,"id": string,"instructions": string | null,"interval_hours": number | null,"line_no": number | null,"patient_id": string,"prescription_id": string | null,"reported_medication_id": string | null,"source": string,"start_date": string,"status": string,"status_reason": string | null,"times_local": (string)[],"timezone": string,"updated_at": string,"version": number,"version_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "as_needed"?: boolean,"consent_at": string,"created_at"?: string,"created_by": string,"display_name": string,"dose"?: number | null,"dose_unit"?: string | null,"end_date"?: string | null,"id"?: string,"instructions"?: string | null,"interval_hours"?: number | null,"line_no"?: number | null,"patient_id": string,"prescription_id"?: string | null,"reported_medication_id"?: string | null,"source": string,"start_date": string,"status"?: string,"status_reason"?: string | null,"times_local"?: (string)[],"timezone"?: string,"updated_at"?: string,"version"?: number,"version_id"?: string | null
                  }
                  Update: {
                    "as_needed"?: boolean,"consent_at"?: string,"created_at"?: string,"created_by"?: string,"display_name"?: string,"dose"?: number | null,"dose_unit"?: string | null,"end_date"?: string | null,"id"?: string,"instructions"?: string | null,"interval_hours"?: number | null,"line_no"?: number | null,"patient_id"?: string,"prescription_id"?: string | null,"reported_medication_id"?: string | null,"source"?: string,"start_date"?: string,"status"?: string,"status_reason"?: string | null,"times_local"?: (string)[],"timezone"?: string,"updated_at"?: string,"version"?: number,"version_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "medication_plans_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "medication_plans_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "medication_plans_prescription_id_fkey"
      columns: ["prescription_id"]
isOneToOne: false
      referencedRelation: "prescriptions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "medication_plans_reported_medication_id_fkey"
      columns: ["reported_medication_id"]
isOneToOne: false
      referencedRelation: "patient_reported_medications"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "medication_plans_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "prescription_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "created_at": string,"facility_id": string | null,"granted_by": string | null,"id": string,"organization_id": string,"revoked_at": string | null,"role": Database["public"]['Enums']["member_role"],"status": Database["public"]['Enums']["membership_status"],"status_reason": string | null,"updated_at": string,"user_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"facility_id"?: string | null,"granted_by"?: string | null,"id"?: string,"organization_id": string,"revoked_at"?: string | null,"role": Database["public"]['Enums']["member_role"],"status"?: Database["public"]['Enums']["membership_status"],"status_reason"?: string | null,"updated_at"?: string,"user_id": string,"version"?: number
                  }
                  Update: {
                    "created_at"?: string,"facility_id"?: string | null,"granted_by"?: string | null,"id"?: string,"organization_id"?: string,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["member_role"],"status"?: Database["public"]['Enums']["membership_status"],"status_reason"?: string | null,"updated_at"?: string,"user_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_facility_id_organization_id_fkey"
      columns: ["facility_id","organization_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "memberships_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_outbox": {
                  Row: {
                    "attempts": number,"channel": Database["public"]['Enums']["notification_channel"],"created_at": string,"dedupe_key": string,"id": string,"last_error": string | null,"locked_until": string | null,"max_attempts": number,"next_attempt_at": string,"payload": NonNullable<Json>,"recipient_user_id": string,"sent_at": string | null,"status": Database["public"]['Enums']["outbox_status"],"template": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"channel": Database["public"]['Enums']["notification_channel"],"created_at"?: string,"dedupe_key": string,"id"?: string,"last_error"?: string | null,"locked_until"?: string | null,"max_attempts"?: number,"next_attempt_at"?: string,"payload"?: NonNullable<Json>,"recipient_user_id": string,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["outbox_status"],"template": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "attempts"?: number,"channel"?: Database["public"]['Enums']["notification_channel"],"created_at"?: string,"dedupe_key"?: string,"id"?: string,"last_error"?: string | null,"locked_until"?: string | null,"max_attempts"?: number,"next_attempt_at"?: string,"payload"?: NonNullable<Json>,"recipient_user_id"?: string,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["outbox_status"],"template"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_outbox_recipient_user_id_fkey"
      columns: ["recipient_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string,"created_at": string,"id": string,"link": string | null,"outbox_id": string | null,"payload": NonNullable<Json>,"read_at": string | null,"template": string,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: string,"link"?: string | null,"outbox_id"?: string | null,"payload"?: NonNullable<Json>,"read_at"?: string | null,"template": string,"title": string,"user_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: string,"link"?: string | null,"outbox_id"?: string | null,"payload"?: NonNullable<Json>,"read_at"?: string | null,"template"?: string,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_outbox_id_fkey"
      columns: ["outbox_id"]
isOneToOne: true
      referencedRelation: "notification_outbox"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"open_lab_order_items": {
                  Row: {
                    "claimed_at": string | null,"id": string,"lab_facility_id": string | null,"lab_order_id": string | null,"master_id": string | null,"name": string,"order_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "claimed_at"?: string | null,"id"?: string,"lab_facility_id"?: string | null,"lab_order_id"?: string | null,"master_id"?: string | null,"name": string,"order_id": string,"status"?: string
                  }
                  Update: {
                    "claimed_at"?: string | null,"id"?: string,"lab_facility_id"?: string | null,"lab_order_id"?: string | null,"master_id"?: string | null,"name"?: string,"order_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "open_lab_order_items_lab_facility_id_fkey"
      columns: ["lab_facility_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "open_lab_order_items_lab_order_id_fkey"
      columns: ["lab_order_id"]
isOneToOne: false
      referencedRelation: "lab_orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "open_lab_order_items_master_id_fkey"
      columns: ["master_id"]
isOneToOne: false
      referencedRelation: "lab_test_master"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "open_lab_order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "open_lab_orders"
      referencedColumns: ["id"]
    }
                  ]
                },"open_lab_orders": {
                  Row: {
                    "cancelled_at": string | null,"code": string,"created_at": string,"created_by": string,"encounter_id": string,"expires_at": string,"facility_id": string,"id": string,"note": string | null,"patient_id": string,"practitioner_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancelled_at"?: string | null,"code": string,"created_at"?: string,"created_by": string,"encounter_id": string,"expires_at"?: string,"facility_id": string,"id"?: string,"note"?: string | null,"patient_id": string,"practitioner_id": string
                  }
                  Update: {
                    "cancelled_at"?: string | null,"code"?: string,"created_at"?: string,"created_by"?: string,"encounter_id"?: string,"expires_at"?: string,"facility_id"?: string,"id"?: string,"note"?: string | null,"patient_id"?: string,"practitioner_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "open_lab_orders_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "open_lab_orders_encounter_id_fkey"
      columns: ["encounter_id"]
isOneToOne: false
      referencedRelation: "encounters"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "open_lab_orders_facility_id_fkey"
      columns: ["facility_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "open_lab_orders_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "open_lab_orders_practitioner_id_fkey"
      columns: ["practitioner_id"]
isOneToOne: false
      referencedRelation: "practitioner_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"kind": string,"name": string,"status": Database["public"]['Enums']["entity_status"],"status_reason": string | null,"updated_at": string,"verified_at": string | null,"verified_by": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"kind"?: string,"name": string,"status"?: Database["public"]['Enums']["entity_status"],"status_reason"?: string | null,"updated_at"?: string,"verified_at"?: string | null,"verified_by"?: string | null,"version"?: number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"kind"?: string,"name"?: string,"status"?: Database["public"]['Enums']["entity_status"],"status_reason"?: string | null,"updated_at"?: string,"verified_at"?: string | null,"verified_by"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "organizations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "organizations_verified_by_fkey"
      columns: ["verified_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"patient_account_links": {
                  Row: {
                    "created_at": string,"id": string,"patient_id": string,"relationship": string,"revoked_at": string | null,"user_id": string,"verified_at": string | null,"verified_by": string | null,"verified_method": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"patient_id": string,"relationship": string,"revoked_at"?: string | null,"user_id": string,"verified_at"?: string | null,"verified_by"?: string | null,"verified_method"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"patient_id"?: string,"relationship"?: string,"revoked_at"?: string | null,"user_id"?: string,"verified_at"?: string | null,"verified_by"?: string | null,"verified_method"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "patient_account_links_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_account_links_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_account_links_verified_by_fkey"
      columns: ["verified_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"patient_conditions": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"patient_id": string,"recorded_by": string,"since_year": number | null,"source": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"patient_id": string,"recorded_by": string,"since_year"?: number | null,"source": string,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"patient_id"?: string,"recorded_by"?: string,"since_year"?: number | null,"source"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "patient_conditions_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_conditions_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"patient_health_profiles": {
                  Row: {
                    "blood_type": string | null,"height_cm": number | null,"notes": string | null,"patient_id": string,"updated_at": string,"updated_by": string | null,"weight_kg": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "blood_type"?: string | null,"height_cm"?: number | null,"notes"?: string | null,"patient_id": string,"updated_at"?: string,"updated_by"?: string | null,"weight_kg"?: number | null
                  }
                  Update: {
                    "blood_type"?: string | null,"height_cm"?: number | null,"notes"?: string | null,"patient_id"?: string,"updated_at"?: string,"updated_by"?: string | null,"weight_kg"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "patient_health_profiles_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: true
      referencedRelation: "patients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_health_profiles_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"patient_identifiers": {
                  Row: {
                    "created_at": string,"id": string,"kind": string,"patient_id": string,"value": string,"verified_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"kind": string,"patient_id": string,"value": string,"verified_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"patient_id"?: string,"value"?: string,"verified_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "patient_identifiers_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_identifiers_verified_by_fkey"
      columns: ["verified_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"patient_lab_entries": {
                  Row: {
                    "created_at": string,"created_by": string,"id": string,"lab_name": string | null,"master_id": string | null,"name": string,"open_item_id": string | null,"patient_id": string,"reference_range": string | null,"taken_on": string,"unit": string | null,"value_numeric": number | null,"value_text": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"id"?: string,"lab_name"?: string | null,"master_id"?: string | null,"name": string,"open_item_id"?: string | null,"patient_id": string,"reference_range"?: string | null,"taken_on": string,"unit"?: string | null,"value_numeric"?: number | null,"value_text"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"id"?: string,"lab_name"?: string | null,"master_id"?: string | null,"name"?: string,"open_item_id"?: string | null,"patient_id"?: string,"reference_range"?: string | null,"taken_on"?: string,"unit"?: string | null,"value_numeric"?: number | null,"value_text"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "patient_lab_entries_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_lab_entries_master_id_fkey"
      columns: ["master_id"]
isOneToOne: false
      referencedRelation: "lab_test_master"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_lab_entries_open_item_id_fkey"
      columns: ["open_item_id"]
isOneToOne: false
      referencedRelation: "open_lab_order_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_lab_entries_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"patient_qr_tokens": {
                  Row: {
                    "created_at": string,"id": string,"patient_id": string,"revoked_at": string | null,"token": string | null,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"patient_id": string,"revoked_at"?: string | null,"token"?: string | null,"token_hash": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"patient_id"?: string,"revoked_at"?: string | null,"token"?: string | null,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "patient_qr_tokens_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"patient_reported_medications": {
                  Row: {
                    "created_at": string,"created_by": string,"dose_text": string | null,"id": string,"name": string,"patient_id": string,"started_on": string | null,"stopped_on": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"dose_text"?: string | null,"id"?: string,"name": string,"patient_id": string,"started_on"?: string | null,"stopped_on"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"dose_text"?: string | null,"id"?: string,"name"?: string,"patient_id"?: string,"started_on"?: string | null,"stopped_on"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "patient_reported_medications_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patient_reported_medications_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"patients": {
                  Row: {
                    "birth_date": string | null,"birth_year": number | null,"city_id": string | null,"created_at": string,"created_at_facility_id": string | null,"created_by": string | null,"full_name": string,"id": string,"is_provisional": boolean,"merged_into": string | null,"phone": string | null,"public_code": string,"sex": Database["public"]['Enums']["patient_sex"] | null,"status": Database["public"]['Enums']["patient_record_status"],"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "birth_date"?: string | null,"birth_year"?: number | null,"city_id"?: string | null,"created_at"?: string,"created_at_facility_id"?: string | null,"created_by"?: string | null,"full_name": string,"id"?: string,"is_provisional"?: boolean,"merged_into"?: string | null,"phone"?: string | null,"public_code"?: string,"sex"?: Database["public"]['Enums']["patient_sex"] | null,"status"?: Database["public"]['Enums']["patient_record_status"],"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "birth_date"?: string | null,"birth_year"?: number | null,"city_id"?: string | null,"created_at"?: string,"created_at_facility_id"?: string | null,"created_by"?: string | null,"full_name"?: string,"id"?: string,"is_provisional"?: boolean,"merged_into"?: string | null,"phone"?: string | null,"public_code"?: string,"sex"?: Database["public"]['Enums']["patient_sex"] | null,"status"?: Database["public"]['Enums']["patient_record_status"],"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "patients_city_id_fkey"
      columns: ["city_id"]
isOneToOne: false
      referencedRelation: "cities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patients_created_at_facility_id_fkey"
      columns: ["created_at_facility_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patients_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patients_merged_into_fkey"
      columns: ["merged_into"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount_minor": number,"created_at": string,"id": string,"method": string,"received_by": string,"sale_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor": number,"created_at"?: string,"id"?: string,"method"?: string,"received_by": string,"sale_id": string
                  }
                  Update: {
                    "amount_minor"?: number,"created_at"?: string,"id"?: string,"method"?: string,"received_by"?: string,"sale_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_received_by_fkey"
      columns: ["received_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["id"]
    }
                  ]
                },"pharmacy_products": {
                  Row: {
                    "barcode": string | null,"created_at": string,"id": string,"is_active": boolean,"manual_availability": string | null,"manual_availability_at": string | null,"medication_id": string | null,"name": string,"pack_description": string | null,"pharmacy_id": string,"reorder_level": number,"unit_name": string,"unit_price_minor": number,"units_per_pack": number,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "barcode"?: string | null,"created_at"?: string,"id"?: string,"is_active"?: boolean,"manual_availability"?: string | null,"manual_availability_at"?: string | null,"medication_id"?: string | null,"name": string,"pack_description"?: string | null,"pharmacy_id": string,"reorder_level"?: number,"unit_name"?: string,"unit_price_minor"?: number,"units_per_pack"?: number,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "barcode"?: string | null,"created_at"?: string,"id"?: string,"is_active"?: boolean,"manual_availability"?: string | null,"manual_availability_at"?: string | null,"medication_id"?: string | null,"name"?: string,"pack_description"?: string | null,"pharmacy_id"?: string,"reorder_level"?: number,"unit_name"?: string,"unit_price_minor"?: number,"units_per_pack"?: number,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "pharmacy_products_medication_id_fkey"
      columns: ["medication_id"]
isOneToOne: false
      referencedRelation: "medication_catalog"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pharmacy_products_pharmacy_id_fkey"
      columns: ["pharmacy_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    }
                  ]
                },"platform_admins": {
                  Row: {
                    "granted_at": string,"granted_by": string | null,"revoked_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "granted_at"?: string,"granted_by"?: string | null,"revoked_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "granted_at"?: string,"granted_by"?: string | null,"revoked_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "platform_admins_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "platform_admins_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"platform_settings": {
                  Row: {
                    "default_currency": string,"default_timezone": string,"id": boolean,"lookup_rate_limit_per_minute": number,"require_admin_mfa": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "default_currency"?: string,"default_timezone"?: string,"id"?: boolean,"lookup_rate_limit_per_minute"?: number,"require_admin_mfa"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "default_currency"?: string,"default_timezone"?: string,"id"?: boolean,"lookup_rate_limit_per_minute"?: number,"require_admin_mfa"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"practitioner_profiles": {
                  Row: {
                    "bio": string | null,"created_at": string,"full_name": string,"id": string,"license_number": string | null,"license_verified_at": string | null,"license_verified_by": string | null,"photo_path": string | null,"specialty_id": string | null,"status": Database["public"]['Enums']["entity_status"],"title": string | null,"updated_at": string,"user_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "bio"?: string | null,"created_at"?: string,"full_name": string,"id"?: string,"license_number"?: string | null,"license_verified_at"?: string | null,"license_verified_by"?: string | null,"photo_path"?: string | null,"specialty_id"?: string | null,"status"?: Database["public"]['Enums']["entity_status"],"title"?: string | null,"updated_at"?: string,"user_id": string,"version"?: number
                  }
                  Update: {
                    "bio"?: string | null,"created_at"?: string,"full_name"?: string,"id"?: string,"license_number"?: string | null,"license_verified_at"?: string | null,"license_verified_by"?: string | null,"photo_path"?: string | null,"specialty_id"?: string | null,"status"?: Database["public"]['Enums']["entity_status"],"title"?: string | null,"updated_at"?: string,"user_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "practitioner_profiles_license_verified_by_fkey"
      columns: ["license_verified_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "practitioner_profiles_specialty_id_fkey"
      columns: ["specialty_id"]
isOneToOne: false
      referencedRelation: "specialties"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "practitioner_profiles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"prescription_dispatches": {
                  Row: {
                    "id": string,"pharmacy_id": string,"prescription_id": string,"received_at": string | null,"sent_at": string,"sent_by": string,"status": string,"updated_at": string,"version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"pharmacy_id": string,"prescription_id": string,"received_at"?: string | null,"sent_at"?: string,"sent_by": string,"status"?: string,"updated_at"?: string,"version_id": string
                  }
                  Update: {
                    "id"?: string,"pharmacy_id"?: string,"prescription_id"?: string,"received_at"?: string | null,"sent_at"?: string,"sent_by"?: string,"status"?: string,"updated_at"?: string,"version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "prescription_dispatches_pharmacy_id_fkey"
      columns: ["pharmacy_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "prescription_dispatches_prescription_id_fkey"
      columns: ["prescription_id"]
isOneToOne: false
      referencedRelation: "prescriptions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "prescription_dispatches_sent_by_fkey"
      columns: ["sent_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "prescription_dispatches_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "prescription_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"prescription_events": {
                  Row: {
                    "actor_user_id": string | null,"event": string,"facility_id": string | null,"id": number,"note": string | null,"occurred_at": string,"prescription_id": string,"version_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_user_id"?: string | null,"event": string,"facility_id"?: string | null,"id"?: never,"note"?: string | null,"occurred_at"?: string,"prescription_id": string,"version_id"?: string | null
                  }
                  Update: {
                    "actor_user_id"?: string | null,"event"?: string,"facility_id"?: string | null,"id"?: never,"note"?: string | null,"occurred_at"?: string,"prescription_id"?: string,"version_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "prescription_events_facility_id_fkey"
      columns: ["facility_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "prescription_events_prescription_id_fkey"
      columns: ["prescription_id"]
isOneToOne: false
      referencedRelation: "prescriptions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "prescription_events_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "prescription_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"prescription_items": {
                  Row: {
                    "as_needed": boolean,"display_name": string,"dose": number | null,"dose_unit": string | null,"duration_days": number | null,"frequency_text": string | null,"id": string,"instructions": string | null,"interval_hours": number | null,"line_no": number,"max_daily": string | null,"medication_id": string | null,"quantity": number | null,"quantity_unit": string | null,"route": string | null,"start_date": string | null,"version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "as_needed"?: boolean,"display_name": string,"dose"?: number | null,"dose_unit"?: string | null,"duration_days"?: number | null,"frequency_text"?: string | null,"id"?: string,"instructions"?: string | null,"interval_hours"?: number | null,"line_no": number,"max_daily"?: string | null,"medication_id"?: string | null,"quantity"?: number | null,"quantity_unit"?: string | null,"route"?: string | null,"start_date"?: string | null,"version_id": string
                  }
                  Update: {
                    "as_needed"?: boolean,"display_name"?: string,"dose"?: number | null,"dose_unit"?: string | null,"duration_days"?: number | null,"frequency_text"?: string | null,"id"?: string,"instructions"?: string | null,"interval_hours"?: number | null,"line_no"?: number,"max_daily"?: string | null,"medication_id"?: string | null,"quantity"?: number | null,"quantity_unit"?: string | null,"route"?: string | null,"start_date"?: string | null,"version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "prescription_items_medication_id_fkey"
      columns: ["medication_id"]
isOneToOne: false
      referencedRelation: "medication_catalog"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "prescription_items_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "prescription_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"prescription_versions": {
                  Row: {
                    "approved_at": string | null,"approved_by": string | null,"created_at": string,"id": string,"prescription_id": string,"revision_reason": string | null,"snapshot": Json | null,"status": Database["public"]['Enums']["rx_version_status"],"verify_expires_at": string | null,"verify_token": string | null,"version_no": number
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"created_at"?: string,"id"?: string,"prescription_id": string,"revision_reason"?: string | null,"snapshot"?: Json | null,"status"?: Database["public"]['Enums']["rx_version_status"],"verify_expires_at"?: string | null,"verify_token"?: string | null,"version_no": number
                  }
                  Update: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"created_at"?: string,"id"?: string,"prescription_id"?: string,"revision_reason"?: string | null,"snapshot"?: Json | null,"status"?: Database["public"]['Enums']["rx_version_status"],"verify_expires_at"?: string | null,"verify_token"?: string | null,"version_no"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "prescription_versions_approved_by_fkey"
      columns: ["approved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "prescription_versions_prescription_id_fkey"
      columns: ["prescription_id"]
isOneToOne: false
      referencedRelation: "prescriptions"
      referencedColumns: ["id"]
    }
                  ]
                },"prescriptions": {
                  Row: {
                    "cancel_reason": string | null,"created_at": string,"created_by": string,"current_version_id": string | null,"encounter_id": string,"facility_id": string,"id": string,"idempotency_key": string,"patient_id": string,"practitioner_id": string,"rx_number": string,"status": Database["public"]['Enums']["rx_status"],"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"created_at"?: string,"created_by": string,"current_version_id"?: string | null,"encounter_id": string,"facility_id": string,"id"?: string,"idempotency_key": string,"patient_id": string,"practitioner_id": string,"rx_number"?: string,"status"?: Database["public"]['Enums']["rx_status"],"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "cancel_reason"?: string | null,"created_at"?: string,"created_by"?: string,"current_version_id"?: string | null,"encounter_id"?: string,"facility_id"?: string,"id"?: string,"idempotency_key"?: string,"patient_id"?: string,"practitioner_id"?: string,"rx_number"?: string,"status"?: Database["public"]['Enums']["rx_status"],"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "prescriptions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "prescriptions_current_version_fk"
      columns: ["current_version_id"]
isOneToOne: false
      referencedRelation: "prescription_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "prescriptions_encounter_id_fkey"
      columns: ["encounter_id"]
isOneToOne: false
      referencedRelation: "encounters"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "prescriptions_facility_id_fkey"
      columns: ["facility_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "prescriptions_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "prescriptions_practitioner_id_fkey"
      columns: ["practitioner_id"]
isOneToOne: false
      referencedRelation: "practitioner_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"id": string,"locale": string,"status": Database["public"]['Enums']["account_status"],"suspended_reason": string | null,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"id": string,"locale"?: string,"status"?: Database["public"]['Enums']["account_status"],"suspended_reason"?: string | null,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"id"?: string,"locale"?: string,"status"?: Database["public"]['Enums']["account_status"],"suspended_reason"?: string | null,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"provider_applications": {
                  Row: {
                    "accepts_walk_in": boolean,"address": string,"admin_note": string | null,"application_number": string,"appointment_minutes": number | null,"area": string | null,"bio": string | null,"city_id": string | null,"clinic_name": string,"clinic_phone": string | null,"consent": boolean,"consultation_fee_minor": number | null,"created_at": string,"email": string | null,"full_name": string,"gender": string | null,"graduation_year": number | null,"id": string,"kind": string,"languages": string | null,"latitude": number | null,"license_number": string,"longitude": number | null,"notes": string | null,"phone": string,"qualifications": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"services": NonNullable<Json>,"specialty_id": string | null,"specialty_other": string | null,"status": string,"sub_specialty": string | null,"submitted_by": string | null,"title": string | null,"updated_at": string,"version": number,"whatsapp": string | null,"working_hours": string | null,"years_experience": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accepts_walk_in"?: boolean,"address": string,"admin_note"?: string | null,"application_number"?: string,"appointment_minutes"?: number | null,"area"?: string | null,"bio"?: string | null,"city_id"?: string | null,"clinic_name": string,"clinic_phone"?: string | null,"consent": boolean,"consultation_fee_minor"?: number | null,"created_at"?: string,"email"?: string | null,"full_name": string,"gender"?: string | null,"graduation_year"?: number | null,"id"?: string,"kind"?: string,"languages"?: string | null,"latitude"?: number | null,"license_number": string,"longitude"?: number | null,"notes"?: string | null,"phone": string,"qualifications"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"services"?: NonNullable<Json>,"specialty_id"?: string | null,"specialty_other"?: string | null,"status"?: string,"sub_specialty"?: string | null,"submitted_by"?: string | null,"title"?: string | null,"updated_at"?: string,"version"?: number,"whatsapp"?: string | null,"working_hours"?: string | null,"years_experience"?: number | null
                  }
                  Update: {
                    "accepts_walk_in"?: boolean,"address"?: string,"admin_note"?: string | null,"application_number"?: string,"appointment_minutes"?: number | null,"area"?: string | null,"bio"?: string | null,"city_id"?: string | null,"clinic_name"?: string,"clinic_phone"?: string | null,"consent"?: boolean,"consultation_fee_minor"?: number | null,"created_at"?: string,"email"?: string | null,"full_name"?: string,"gender"?: string | null,"graduation_year"?: number | null,"id"?: string,"kind"?: string,"languages"?: string | null,"latitude"?: number | null,"license_number"?: string,"longitude"?: number | null,"notes"?: string | null,"phone"?: string,"qualifications"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"services"?: NonNullable<Json>,"specialty_id"?: string | null,"specialty_other"?: string | null,"status"?: string,"sub_specialty"?: string | null,"submitted_by"?: string | null,"title"?: string | null,"updated_at"?: string,"version"?: number,"whatsapp"?: string | null,"working_hours"?: string | null,"years_experience"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "provider_applications_city_id_fkey"
      columns: ["city_id"]
isOneToOne: false
      referencedRelation: "cities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "provider_applications_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "provider_applications_specialty_id_fkey"
      columns: ["specialty_id"]
isOneToOne: false
      referencedRelation: "specialties"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "provider_applications_submitted_by_fkey"
      columns: ["submitted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"provider_media": {
                  Row: {
                    "caption": string | null,"created_at": string,"facility_id": string | null,"id": string,"kind": string,"practitioner_id": string | null,"removed_at": string | null,"storage_path": string,"uploaded_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "caption"?: string | null,"created_at"?: string,"facility_id"?: string | null,"id"?: string,"kind": string,"practitioner_id"?: string | null,"removed_at"?: string | null,"storage_path": string,"uploaded_by": string
                  }
                  Update: {
                    "caption"?: string | null,"created_at"?: string,"facility_id"?: string | null,"id"?: string,"kind"?: string,"practitioner_id"?: string | null,"removed_at"?: string | null,"storage_path"?: string,"uploaded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "provider_media_facility_id_fkey"
      columns: ["facility_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "provider_media_practitioner_id_fkey"
      columns: ["practitioner_id"]
isOneToOne: false
      referencedRelation: "practitioner_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "provider_media_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"push_devices": {
                  Row: {
                    "created_at": string,"disabled_at": string | null,"failures": number,"id": string,"kind": string,"last_seen_at": string,"local_reminders": boolean,"platform": string | null,"token": string,"user_id": string,"web_keys": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"disabled_at"?: string | null,"failures"?: number,"id"?: string,"kind": string,"last_seen_at"?: string,"local_reminders"?: boolean,"platform"?: string | null,"token": string,"user_id": string,"web_keys"?: Json | null
                  }
                  Update: {
                    "created_at"?: string,"disabled_at"?: string | null,"failures"?: number,"id"?: string,"kind"?: string,"last_seen_at"?: string,"local_reminders"?: boolean,"platform"?: string | null,"token"?: string,"user_id"?: string,"web_keys"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_devices_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"queue_entries": {
                  Row: {
                    "appointment_id": string | null,"arrived_at": string,"called_at": string | null,"created_at": string,"created_by": string | null,"facility_id": string,"finished_at": string | null,"id": string,"idempotency_key": string | null,"kind": string,"patient_id": string,"practitioner_id": string | null,"priority": number,"priority_reason": string | null,"priority_set_by": string | null,"service_date": string,"started_at": string | null,"status": Database["public"]['Enums']["queue_status"],"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "appointment_id"?: string | null,"arrived_at"?: string,"called_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"facility_id": string,"finished_at"?: string | null,"id"?: string,"idempotency_key"?: string | null,"kind": string,"patient_id": string,"practitioner_id"?: string | null,"priority"?: number,"priority_reason"?: string | null,"priority_set_by"?: string | null,"service_date": string,"started_at"?: string | null,"status"?: Database["public"]['Enums']["queue_status"],"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "appointment_id"?: string | null,"arrived_at"?: string,"called_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"facility_id"?: string,"finished_at"?: string | null,"id"?: string,"idempotency_key"?: string | null,"kind"?: string,"patient_id"?: string,"practitioner_id"?: string | null,"priority"?: number,"priority_reason"?: string | null,"priority_set_by"?: string | null,"service_date"?: string,"started_at"?: string | null,"status"?: Database["public"]['Enums']["queue_status"],"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "queue_entries_appointment_id_fkey"
      columns: ["appointment_id"]
isOneToOne: true
      referencedRelation: "appointments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "queue_entries_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "queue_entries_facility_id_fkey"
      columns: ["facility_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "queue_entries_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "queue_entries_practitioner_id_fkey"
      columns: ["practitioner_id"]
isOneToOne: false
      referencedRelation: "practitioner_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "queue_entries_priority_set_by_fkey"
      columns: ["priority_set_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"reception_scopes": {
                  Row: {
                    "created_at": string,"created_by": string | null,"membership_id": string,"practitioner_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"membership_id": string,"practitioner_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"membership_id"?: string,"practitioner_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reception_scopes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reception_scopes_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reception_scopes_practitioner_id_fkey"
      columns: ["practitioner_id"]
isOneToOne: false
      referencedRelation: "practitioner_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"refunds": {
                  Row: {
                    "amount_minor": number,"created_at": string,"created_by": string,"id": string,"quantity": number,"reason": string,"restocked": boolean,"sale_line_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_minor": number,"created_at"?: string,"created_by": string,"id"?: string,"quantity": number,"reason": string,"restocked": boolean,"sale_line_id": string
                  }
                  Update: {
                    "amount_minor"?: number,"created_at"?: string,"created_by"?: string,"id"?: string,"quantity"?: number,"reason"?: string,"restocked"?: boolean,"sale_line_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "refunds_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "refunds_sale_line_id_fkey"
      columns: ["sale_line_id"]
isOneToOne: false
      referencedRelation: "sale_lines"
      referencedColumns: ["id"]
    }
                  ]
                },"reminder_jobs": {
                  Row: {
                    "dose_amount": number | null,"dose_recorded_at": string | null,"dose_status": string | null,"id": string,"plan_id": string,"queued_at": string | null,"scheduled_at": string,"snooze_count": number,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "dose_amount"?: number | null,"dose_recorded_at"?: string | null,"dose_status"?: string | null,"id"?: string,"plan_id": string,"queued_at"?: string | null,"scheduled_at": string,"snooze_count"?: number,"status"?: string
                  }
                  Update: {
                    "dose_amount"?: number | null,"dose_recorded_at"?: string | null,"dose_status"?: string | null,"id"?: string,"plan_id"?: string,"queued_at"?: string | null,"scheduled_at"?: string,"snooze_count"?: number,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reminder_jobs_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "medication_plans"
      referencedColumns: ["id"]
    }
                  ]
                },"sale_lines": {
                  Row: {
                    "batch_id": string,"id": string,"line_total_minor": number,"product_id": string,"quantity": number,"returned_quantity": number,"rx_line_no": number | null,"sale_id": string,"unit_price_minor": number
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_id": string,"id"?: string,"line_total_minor": number,"product_id": string,"quantity": number,"returned_quantity"?: number,"rx_line_no"?: number | null,"sale_id": string,"unit_price_minor": number
                  }
                  Update: {
                    "batch_id"?: string,"id"?: string,"line_total_minor"?: number,"product_id"?: string,"quantity"?: number,"returned_quantity"?: number,"rx_line_no"?: number | null,"sale_id"?: string,"unit_price_minor"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "sale_lines_batch_id_fkey"
      columns: ["batch_id"]
isOneToOne: false
      referencedRelation: "inventory_batches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sale_lines_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "pharmacy_products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sale_lines_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["id"]
    }
                  ]
                },"sales": {
                  Row: {
                    "created_at": string,"created_by": string,"currency": string,"dispatch_id": string | null,"id": string,"idempotency_key": string,"patient_id": string | null,"pharmacy_id": string,"sale_number": string,"source": string,"source_note": string | null,"total_minor": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"currency"?: string,"dispatch_id"?: string | null,"id"?: string,"idempotency_key": string,"patient_id"?: string | null,"pharmacy_id": string,"sale_number"?: string,"source": string,"source_note"?: string | null,"total_minor"?: number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"currency"?: string,"dispatch_id"?: string | null,"id"?: string,"idempotency_key"?: string,"patient_id"?: string | null,"pharmacy_id"?: string,"sale_number"?: string,"source"?: string,"source_note"?: string | null,"total_minor"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "sales_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_dispatch_id_fkey"
      columns: ["dispatch_id"]
isOneToOne: false
      referencedRelation: "prescription_dispatches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "patients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_pharmacy_id_fkey"
      columns: ["pharmacy_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    }
                  ]
                },"schedule_exceptions": {
                  Row: {
                    "created_at": string,"created_by": string | null,"facility_id": string | null,"id": string,"kind": string,"period": unknown,"practitioner_id": string | null,"reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"facility_id"?: string | null,"id"?: string,"kind": string,"period": unknown,"practitioner_id"?: string | null,"reason"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"facility_id"?: string | null,"id"?: string,"kind"?: string,"period"?: unknown,"practitioner_id"?: string | null,"reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "schedule_exceptions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "schedule_exceptions_facility_id_fkey"
      columns: ["facility_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "schedule_exceptions_practitioner_id_fkey"
      columns: ["practitioner_id"]
isOneToOne: false
      referencedRelation: "practitioner_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"schedules": {
                  Row: {
                    "created_at": string,"created_by": string | null,"end_local": string,"facility_id": string,"id": string,"practitioner_id": string | null,"start_local": string,"updated_at": string,"valid_from": string,"valid_until": string | null,"version": number,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"end_local": string,"facility_id": string,"id"?: string,"practitioner_id"?: string | null,"start_local": string,"updated_at"?: string,"valid_from"?: string,"valid_until"?: string | null,"version"?: number,"weekday": number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"end_local"?: string,"facility_id"?: string,"id"?: string,"practitioner_id"?: string | null,"start_local"?: string,"updated_at"?: string,"valid_from"?: string,"valid_until"?: string | null,"version"?: number,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "schedules_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "schedules_facility_id_fkey"
      columns: ["facility_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "schedules_practitioner_id_fkey"
      columns: ["practitioner_id"]
isOneToOne: false
      referencedRelation: "practitioner_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"specialties": {
                  Row: {
                    "code": string,"created_at": string,"id": string,"is_active": boolean,"name_ar": string,"name_en": string | null,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name_ar": string,"name_en"?: string | null,"sort_order"?: number
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name_ar"?: string,"name_en"?: string | null,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"specimens": {
                  Row: {
                    "barcode": string,"collected_at": string,"collected_by": string,"id": string,"order_id": string,"rejected_at": string | null,"rejection_reason": string | null,"specimen_type": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "barcode"?: string,"collected_at"?: string,"collected_by": string,"id"?: string,"order_id": string,"rejected_at"?: string | null,"rejection_reason"?: string | null,"specimen_type": string,"status"?: string
                  }
                  Update: {
                    "barcode"?: string,"collected_at"?: string,"collected_by"?: string,"id"?: string,"order_id"?: string,"rejected_at"?: string | null,"rejection_reason"?: string | null,"specimen_type"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "specimens_collected_by_fkey"
      columns: ["collected_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "specimens_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "lab_orders"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_movements": {
                  Row: {
                    "actor_user_id": string | null,"batch_id": string | null,"dispatch_id": string | null,"id": number,"idempotency_key": string | null,"kind": string,"occurred_at": string,"product_id": string,"quantity": number,"reason": string | null,"sale_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_user_id"?: string | null,"batch_id"?: string | null,"dispatch_id"?: string | null,"id"?: never,"idempotency_key"?: string | null,"kind": string,"occurred_at"?: string,"product_id": string,"quantity": number,"reason"?: string | null,"sale_id"?: string | null
                  }
                  Update: {
                    "actor_user_id"?: string | null,"batch_id"?: string | null,"dispatch_id"?: string | null,"id"?: never,"idempotency_key"?: string | null,"kind"?: string,"occurred_at"?: string,"product_id"?: string,"quantity"?: number,"reason"?: string | null,"sale_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_movements_batch_id_fkey"
      columns: ["batch_id"]
isOneToOne: false
      referencedRelation: "inventory_batches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_dispatch_id_fkey"
      columns: ["dispatch_id"]
isOneToOne: false
      referencedRelation: "prescription_dispatches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "pharmacy_products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_sale_fk"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_reservations": {
                  Row: {
                    "batch_id": string,"created_at": string,"created_by": string | null,"dispatch_id": string,"id": string,"line_no": number,"product_id": string,"quantity": number,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_id": string,"created_at"?: string,"created_by"?: string | null,"dispatch_id": string,"id"?: string,"line_no": number,"product_id": string,"quantity": number,"status"?: string
                  }
                  Update: {
                    "batch_id"?: string,"created_at"?: string,"created_by"?: string | null,"dispatch_id"?: string,"id"?: string,"line_no"?: number,"product_id"?: string,"quantity"?: number,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_reservations_batch_id_fkey"
      columns: ["batch_id"]
isOneToOne: false
      referencedRelation: "inventory_batches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_reservations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_reservations_dispatch_id_fkey"
      columns: ["dispatch_id"]
isOneToOne: false
      referencedRelation: "prescription_dispatches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_reservations_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "pharmacy_products"
      referencedColumns: ["id"]
    }
                  ]
                },"suppliers": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"pharmacy_id": string,"phone": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"pharmacy_id": string,"phone"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"pharmacy_id"?: string,"phone"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "suppliers_pharmacy_id_fkey"
      columns: ["pharmacy_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invitation":
{ Args: { "p_token": string }; Returns: {
              "created_at": string,
"facility_id": string | null,
"granted_by": string | null,
"id": string,
"organization_id": string,
"revoked_at": string | null,
"role": Database["public"]['Enums']["member_role"],
"status": Database["public"]['Enums']["membership_status"],
"status_reason": string | null,
"updated_at": string,
"user_id": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "memberships"
        isOneToOne: true
        isSetofReturn: false
      } },
"add_allergy":
{ Args: { "p_patient_id": string,"p_reaction"?: string,"p_severity"?: string,"p_substance": string }; Returns: {
              "created_at": string,
"facility_id": string | null,
"id": string,
"patient_id": string,
"reaction": string | null,
"recorded_by": string,
"recorded_by_practitioner_id": string | null,
"severity": string | null,
"source": string,
"status": string,
"substance": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "allergies"
        isOneToOne: true
        isSetofReturn: false
      } },
"add_condition":
{ Args: { "p_name": string,"p_patient_id": string,"p_since_year"?: number }; Returns: string
                           },
"add_expense":
{ Args: { "p_amount_minor": number,"p_category": string,"p_facility_id": string,"p_note"?: string,"p_spent_on"?: string }; Returns: {
              "amount_minor": number,
"category": string,
"created_at": string,
"created_by": string,
"facility_id": string,
"id": string,
"note": string | null,
"spent_on": string
            }
                          SetofOptions: {
        from: "*"
        to: "expenses"
        isOneToOne: true
        isSetofReturn: false
      } },
"add_provider_media":
{ Args: { "p_caption"?: string,"p_kind": string,"p_storage_path": string,"p_target_id": string }; Returns: string
                           },
"add_reported_medication":
{ Args: { "p_dose_text"?: string,"p_name": string,"p_patient_id": string,"p_started_on"?: string }; Returns: string
                           },
"add_schedule_exception":
{ Args: { "p_ends_at": string,"p_facility_id": string,"p_kind": string,"p_practitioner_id": string,"p_reason"?: string,"p_starts_at": string }; Returns: {
              "created_at": string,
"created_by": string | null,
"facility_id": string | null,
"id": string,
"kind": string,
"period": unknown,
"practitioner_id": string | null,
"reason": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "schedule_exceptions"
        isOneToOne: true
        isSetofReturn: false
      } },
"add_self_lab_result":
{ Args: { "p_lab_name"?: string,"p_master_id"?: string,"p_name": string,"p_open_item_id"?: string,"p_patient_id": string,"p_reference_range"?: string,"p_taken_on": string,"p_unit"?: string,"p_value": string }; Returns: {
              "created_at": string,
"created_by": string,
"id": string,
"lab_name": string | null,
"master_id": string | null,
"name": string,
"open_item_id": string | null,
"patient_id": string,
"reference_range": string | null,
"taken_on": string,
"unit": string | null,
"value_numeric": number | null,
"value_text": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "patient_lab_entries"
        isOneToOne: true
        isSetofReturn: false
      } },
"adjust_stock":
{ Args: { "p_batch_id": string,"p_counted_quantity": number,"p_reason": string }; Returns: undefined
                           },
"admin_create_branch":
{ Args: { "p_address"?: string,"p_area"?: string,"p_city_id"?: string,"p_latitude"?: number,"p_longitude"?: number,"p_name": string,"p_organization_id": string,"p_timezone"?: string }; Returns: {
              "address": string | null,
"area": string | null,
"city_id": string | null,
"created_at": string,
"id": string,
"latitude": number | null,
"longitude": number | null,
"name": string,
"organization_id": string,
"status": Database["public"]['Enums']["entity_status"],
"timezone": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "branches"
        isOneToOne: true
        isSetofReturn: false
      } },
"admin_create_facility":
{ Args: { "p_activate"?: boolean,"p_branch_id": string,"p_description"?: string,"p_name": string,"p_organization_id": string,"p_phone"?: string,"p_type": Database["public"]['Enums']["facility_type"] }; Returns: {
              "branch_id": string,
"created_at": string,
"default_lab_id": string | null,
"default_pharmacy_id": string | null,
"description": string | null,
"home_collection": boolean,
"home_collection_fee_minor": number | null,
"home_collection_note": string | null,
"id": string,
"is_public": boolean,
"name": string,
"opening_hours_note": string | null,
"organization_id": string,
"phone": string | null,
"status": Database["public"]['Enums']["entity_status"],
"status_reason": string | null,
"type": Database["public"]['Enums']["facility_type"],
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "facilities"
        isOneToOne: true
        isSetofReturn: false
      } },
"admin_create_organization":
{ Args: { "p_activate"?: boolean,"p_kind"?: string,"p_name": string }; Returns: {
              "created_at": string,
"created_by": string | null,
"id": string,
"kind": string,
"name": string,
"status": Database["public"]['Enums']["entity_status"],
"status_reason": string | null,
"updated_at": string,
"verified_at": string | null,
"verified_by": string | null,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "organizations"
        isOneToOne: true
        isSetofReturn: false
      } },
"admin_grant_membership":
{ Args: { "p_facility_id": string,"p_organization_id": string,"p_role": Database["public"]['Enums']["member_role"],"p_user_id": string }; Returns: {
              "created_at": string,
"facility_id": string | null,
"granted_by": string | null,
"id": string,
"organization_id": string,
"revoked_at": string | null,
"role": Database["public"]['Enums']["member_role"],
"status": Database["public"]['Enums']["membership_status"],
"status_reason": string | null,
"updated_at": string,
"user_id": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "memberships"
        isOneToOne: true
        isSetofReturn: false
      } },
"admin_move_facility":
{ Args: { "p_branch_id"?: string,"p_facility_id": string,"p_organization_id": string }; Returns: {
              "branch_id": string,
"created_at": string,
"default_lab_id": string | null,
"default_pharmacy_id": string | null,
"description": string | null,
"home_collection": boolean,
"home_collection_fee_minor": number | null,
"home_collection_note": string | null,
"id": string,
"is_public": boolean,
"name": string,
"opening_hours_note": string | null,
"organization_id": string,
"phone": string | null,
"status": Database["public"]['Enums']["entity_status"],
"status_reason": string | null,
"type": Database["public"]['Enums']["facility_type"],
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "facilities"
        isOneToOne: true
        isSetofReturn: false
      } },
"admin_retry_dead_notification":
{ Args: { "p_id": string }; Returns: undefined
                           },
"admin_set_account_status":
{ Args: { "p_reason": string,"p_status": Database["public"]['Enums']["account_status"],"p_user_id": string }; Returns: undefined
                           },
"admin_set_branch_location":
{ Args: { "p_address"?: string,"p_branch_id": string,"p_latitude": number,"p_longitude": number }; Returns: {
              "address": string | null,
"area": string | null,
"city_id": string | null,
"created_at": string,
"id": string,
"latitude": number | null,
"longitude": number | null,
"name": string,
"organization_id": string,
"status": Database["public"]['Enums']["entity_status"],
"timezone": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "branches"
        isOneToOne: true
        isSetofReturn: false
      } },
"admin_set_entity_status":
{ Args: { "p_entity": string,"p_id": string,"p_reason": string,"p_status": Database["public"]['Enums']["entity_status"] }; Returns: undefined
                           },
"admin_structure":
{ Args: Record<PropertyKey, never>; Returns: {
              "doctors": Json,"facility_id": string,"staff_count": number
            }[]
                           },
"admin_upsert_practitioner":
{ Args: { "p_full_name": string,"p_license_number"?: string,"p_mark_license_verified"?: boolean,"p_specialty_id"?: string,"p_title"?: string,"p_user_id": string }; Returns: {
              "bio": string | null,
"created_at": string,
"full_name": string,
"id": string,
"license_number": string | null,
"license_verified_at": string | null,
"license_verified_by": string | null,
"photo_path": string | null,
"specialty_id": string | null,
"status": Database["public"]['Enums']["entity_status"],
"title": string | null,
"updated_at": string,
"user_id": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "practitioner_profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"admin_upsert_practitioner_by_email":
{ Args: { "p_bio"?: string,"p_email": string,"p_full_name": string,"p_license_number"?: string,"p_mark_license_verified"?: boolean,"p_specialty_id"?: string,"p_title"?: string }; Returns: {
              "bio": string | null,
"created_at": string,
"full_name": string,
"id": string,
"license_number": string | null,
"license_verified_at": string | null,
"license_verified_by": string | null,
"photo_path": string | null,
"specialty_id": string | null,
"status": Database["public"]['Enums']["entity_status"],
"title": string | null,
"updated_at": string,
"user_id": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "practitioner_profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"ai_provider_key":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"ai_triage_begin":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"amend_clinical_note":
{ Args: { "p_fields": Json,"p_note_id": string,"p_reason": string }; Returns: {
              "assessment": string | null,
"correction_reason": string | null,
"created_at": string,
"created_by": string,
"encounter_id": string,
"examination": string | null,
"follow_up": string | null,
"free_text": string | null,
"history": string | null,
"id": string,
"plan": string | null,
"reason_for_visit": string | null,
"signed_at": string | null,
"signed_by": string | null,
"status": string,
"supersedes_id": string | null,
"updated_at": string,
"version": number,
"version_no": number,
"vitals": NonNullable<Json>
            }
                          SetofOptions: {
        from: "*"
        to: "clinical_notes"
        isOneToOne: true
        isSetofReturn: false
      } },
"approve_prescription":
{ Args: { "p_prescription_id": string,"p_revision_reason"?: string,"p_send_to_pharmacy_id"?: string }; Returns: Json
                           },
"assign_walk_in_slot":
{ Args: { "p_idempotency_key": string,"p_queue_entry_id": string,"p_service_id": string,"p_start": string }; Returns: {
              "blocked_period": unknown,
"booking_number": string,
"buffer_minutes": number,
"cancellation_cutoff_minutes": number,
"confirmation_deadline": string | null,
"confirmed_at": string | null,
"confirmed_by": string | null,
"created_at": string,
"created_by": string,
"currency": string,
"duration_minutes": number,
"facility_id": string,
"holds_slot": boolean | null,
"id": string,
"idempotency_key": string,
"patient_id": string,
"patient_note": string | null,
"period": unknown,
"practitioner_id": string | null,
"price_minor": number | null,
"rescheduled_from": string | null,
"resource_id": string | null,
"service_id": string,
"source": Database["public"]['Enums']["booking_source"],
"status": Database["public"]['Enums']["appointment_status"],
"status_reason": string | null,
"timezone": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"attach_patient_to_facility":
{ Args: { "p_facility_id": string,"p_patient_id": string,"p_verification_note": string }; Returns: undefined
                           },
"attachment_scan_queue":
{ Args: { "p_limit"?: number }; Returns: {
              "declared_mime": string,"declared_size": number,"id": string
            }[]
                           },
"attachment_scan_result":
{ Args: { "p_detected_mime": string,"p_id": string,"p_ok": boolean,"p_reason"?: string }; Returns: undefined
                           },
"book_appointment":
{ Args: { "p_facility_id": string,"p_idempotency_key": string,"p_patient_id": string,"p_patient_note"?: string,"p_practitioner_id": string,"p_service_id": string,"p_source"?: Database["public"]['Enums']["booking_source"],"p_start": string }; Returns: {
              "blocked_period": unknown,
"booking_number": string,
"buffer_minutes": number,
"cancellation_cutoff_minutes": number,
"confirmation_deadline": string | null,
"confirmed_at": string | null,
"confirmed_by": string | null,
"created_at": string,
"created_by": string,
"currency": string,
"duration_minutes": number,
"facility_id": string,
"holds_slot": boolean | null,
"id": string,
"idempotency_key": string,
"patient_id": string,
"patient_note": string | null,
"period": unknown,
"practitioner_id": string | null,
"price_minor": number | null,
"rescheduled_from": string | null,
"resource_id": string | null,
"service_id": string,
"source": Database["public"]['Enums']["booking_source"],
"status": Database["public"]['Enums']["appointment_status"],
"status_reason": string | null,
"timezone": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"book_follow_up":
{ Args: { "p_encounter_id": string,"p_note"?: string,"p_service_id"?: string,"p_start": string }; Returns: {
              "blocked_period": unknown,
"booking_number": string,
"buffer_minutes": number,
"cancellation_cutoff_minutes": number,
"confirmation_deadline": string | null,
"confirmed_at": string | null,
"confirmed_by": string | null,
"created_at": string,
"created_by": string,
"currency": string,
"duration_minutes": number,
"facility_id": string,
"holds_slot": boolean | null,
"id": string,
"idempotency_key": string,
"patient_id": string,
"patient_note": string | null,
"period": unknown,
"practitioner_id": string | null,
"price_minor": number | null,
"rescheduled_from": string | null,
"resource_id": string | null,
"service_id": string,
"source": Database["public"]['Enums']["booking_source"],
"status": Database["public"]['Enums']["appointment_status"],
"status_reason": string | null,
"timezone": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"cancel_home_lab_request":
{ Args: { "p_reason"?: string,"p_request_id": string }; Returns: undefined
                           },
"cancel_prescription":
{ Args: { "p_prescription_id": string,"p_reason": string }; Returns: undefined
                           },
"change_appointment_status":
{ Args: { "p_appointment_id": string,"p_expected_version"?: number,"p_reason"?: string,"p_to": Database["public"]['Enums']["appointment_status"] }; Returns: {
              "blocked_period": unknown,
"booking_number": string,
"buffer_minutes": number,
"cancellation_cutoff_minutes": number,
"confirmation_deadline": string | null,
"confirmed_at": string | null,
"confirmed_by": string | null,
"created_at": string,
"created_by": string,
"currency": string,
"duration_minutes": number,
"facility_id": string,
"holds_slot": boolean | null,
"id": string,
"idempotency_key": string,
"patient_id": string,
"patient_note": string | null,
"period": unknown,
"practitioner_id": string | null,
"price_minor": number | null,
"rescheduled_from": string | null,
"resource_id": string | null,
"service_id": string,
"source": Database["public"]['Enums']["booking_source"],
"status": Database["public"]['Enums']["appointment_status"],
"status_reason": string | null,
"timezone": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"collect_specimen":
{ Args: { "p_order_id": string,"p_specimen_type": string }; Returns: {
              "barcode": string,
"collected_at": string,
"collected_by": string,
"id": string,
"order_id": string,
"rejected_at": string | null,
"rejection_reason": string | null,
"specimen_type": string,
"status": string
            }
                          SetofOptions: {
        from: "*"
        to: "specimens"
        isOneToOne: true
        isSetofReturn: false
      } },
"complete_clinical_task":
{ Args: { "p_task_id": string }; Returns: undefined
                           },
"complete_lab_order":
{ Args: { "p_order_id": string,"p_results"?: Json }; Returns: {
              "clinical_note": string | null,
"created_at": string,
"created_by": string,
"encounter_id": string | null,
"id": string,
"idempotency_key": string,
"lab_facility_id": string,
"order_number": string,
"ordering_facility_id": string | null,
"ordering_practitioner_id": string | null,
"patient_id": string,
"source": string,
"status": Database["public"]['Enums']["lab_status"],
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "lab_orders"
        isOneToOne: true
        isSetofReturn: false
      } },
"correct_lab_result":
{ Args: { "p_lab_flag"?: string,"p_notes"?: string,"p_reason": string,"p_reference_range"?: string,"p_result_id": string,"p_unit"?: string,"p_value_numeric"?: number,"p_value_text"?: string }; Returns: {
              "correction_reason": string | null,
"created_at": string,
"entered_by": string,
"id": string,
"lab_flag": string | null,
"notes": string | null,
"order_item_id": string,
"reference_range": string | null,
"released_at": string | null,
"released_by": string | null,
"status": string,
"supersedes_id": string | null,
"unit": string | null,
"updated_at": string,
"value_numeric": number | null,
"value_text": string | null,
"version_no": number
            }
                          SetofOptions: {
        from: "*"
        to: "lab_results"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_account_link_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"create_invitation":
{ Args: { "p_email": string,"p_facility_id": string,"p_organization_id": string,"p_reception_practitioner_id"?: string,"p_role": Database["public"]['Enums']["member_role"],"p_valid_hours"?: number }; Returns: {
              "expires_at": string,"invitation_id": string,"token": string
            }[]
                           },
"create_invoice":
{ Args: { "p_appointment_id"?: string,"p_lab_order_id"?: string }; Returns: {
              "appointment_id": string | null,
"created_at": string,
"created_by": string,
"currency": string,
"facility_id": string,
"id": string,
"invoice_number": string,
"lab_order_id": string | null,
"patient_id": string,
"status": string,
"total_minor": number,
"updated_at": string,
"version": number,
"void_reason": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "invoices"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_medication_plan":
{ Args: { "p_dispatch_id"?: string,"p_line_no": number,"p_patient_consent": boolean,"p_prescription_id": string,"p_start_date": string,"p_times": (string)[] }; Returns: {
              "as_needed": boolean,
"consent_at": string,
"created_at": string,
"created_by": string,
"display_name": string,
"dose": number | null,
"dose_unit": string | null,
"end_date": string | null,
"id": string,
"instructions": string | null,
"interval_hours": number | null,
"line_no": number | null,
"patient_id": string,
"prescription_id": string | null,
"reported_medication_id": string | null,
"source": string,
"start_date": string,
"status": string,
"status_reason": string | null,
"times_local": (string)[],
"timezone": string,
"updated_at": string,
"version": number,
"version_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "medication_plans"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_open_lab_order":
{ Args: { "p_encounter_id": string,"p_items": Json,"p_note"?: string }; Returns: Json
                           },
"create_own_medication_plan":
{ Args: { "p_days"?: number,"p_instructions"?: string,"p_interval_hours"?: number,"p_name": string,"p_patient_id": string,"p_reported_medication_id"?: string,"p_start_date"?: string,"p_times": (string)[] }; Returns: {
              "as_needed": boolean,
"consent_at": string,
"created_at": string,
"created_by": string,
"display_name": string,
"dose": number | null,
"dose_unit": string | null,
"end_date": string | null,
"id": string,
"instructions": string | null,
"interval_hours": number | null,
"line_no": number | null,
"patient_id": string,
"prescription_id": string | null,
"reported_medication_id": string | null,
"source": string,
"start_date": string,
"status": string,
"status_reason": string | null,
"times_local": (string)[],
"timezone": string,
"updated_at": string,
"version": number,
"version_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "medication_plans"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_provisional_patient":
{ Args: { "p_birth_year"?: number,"p_facility_id": string,"p_full_name": string,"p_phone"?: string,"p_sex"?: Database["public"]['Enums']["patient_sex"] }; Returns: {
              "birth_date": string | null,
"birth_year": number | null,
"city_id": string | null,
"created_at": string,
"created_at_facility_id": string | null,
"created_by": string | null,
"full_name": string,
"id": string,
"is_provisional": boolean,
"merged_into": string | null,
"phone": string | null,
"public_code": string,
"sex": Database["public"]['Enums']["patient_sex"] | null,
"status": Database["public"]['Enums']["patient_record_status"],
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "patients"
        isOneToOne: true
        isSetofReturn: false
      } },
"delete_self_lab_result":
{ Args: { "p_entry_id": string }; Returns: undefined
                           },
"direct_sale":
{ Args: { "p_idempotency_key": string,"p_lines": Json,"p_patient_id"?: string,"p_pharmacy_id": string,"p_source": string,"p_source_note"?: string }; Returns: Json
                           },
"dispatch_due_reminders":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"dispatch_line_note":
{ Args: { "p_dispatch_id": string,"p_kind": string,"p_line_no": number,"p_note"?: string }; Returns: undefined
                           },
"dispatch_lines":
{ Args: { "p_dispatch_id": string }; Returns: Json
                           },
"dispense_prescription":
{ Args: { "p_dispatch_id": string,"p_idempotency_key": string,"p_lines": Json }; Returns: Json
                           },
"doctor_pharmacy_notes":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"encounter_context":
{ Args: { "p_encounter_id": string }; Returns: Json
                           },
"encounter_open_lab_orders":
{ Args: { "p_encounter_id": string }; Returns: Json
                           },
"encounter_orders":
{ Args: { "p_encounter_id": string }; Returns: Json
                           },
"erase_account":
{ Args: { "p_user": string }; Returns: string
                           },
"expire_pending_appointments":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"facility_day_board":
{ Args: { "p_date": string,"p_facility_id": string,"p_practitioner_id"?: string }; Returns: {
              "appointment_id": string,"arrived_at": string,"booking_number": string,"confirmation_deadline": string,"ends_at": string,"patient_code": string,"patient_id": string,"patient_name": string,"patient_phone": string,"practitioner_id": string,"practitioner_name": string,"queue_entry_id": string,"queue_status": Database["public"]['Enums']["queue_status"],"service_name": string,"source": Database["public"]['Enums']["booking_source"],"starts_at": string,"status": Database["public"]['Enums']["appointment_status"],"version": number
            }[]
                           },
"facility_members":
{ Args: { "p_facility_id": string }; Returns: {
              "created_at": string,"display_name": string,"email": string,"membership_id": string,"role": Database["public"]['Enums']["member_role"],"status": Database["public"]['Enums']["membership_status"],"user_id": string
            }[]
                           },
"facility_queue":
{ Args: { "p_date": string,"p_facility_id": string,"p_practitioner_id"?: string }; Returns: {
              "appointment_id": string,"appointment_start": string,"arrived_at": string,"duration_minutes": number,"estimated_start": string,"kind": string,"patient_code": string,"patient_id": string,"patient_name": string,"practitioner_id": string,"priority": number,"priority_reason": string,"queue_entry_id": string,"queue_position": number,"status": Database["public"]['Enums']["queue_status"]
            }[]
                           },
"facility_report":
{ Args: { "p_facility_id": string,"p_from": string,"p_to": string }; Returns: Json
                           },
"get_available_slots":
{ Args: { "p_facility_id": string,"p_for_staff"?: boolean,"p_from": string,"p_practitioner_id": string,"p_service_id": string,"p_to": string }; Returns: {
              "slot_end": string,"slot_start": string
            }[]
                           },
"get_provider_profile":
{ Args: { "p_facility_id": string,"p_practitioner_id"?: string }; Returns: Json
                           },
"grant_consent":
{ Args: { "p_expires_at"?: string,"p_facility_id"?: string,"p_patient_id": string,"p_practitioner_id"?: string,"p_purpose": string,"p_resource_id"?: string,"p_scope": string }; Returns: {
              "created_at": string,
"expires_at": string | null,
"granted_by": string,
"grantee_facility_id": string | null,
"grantee_practitioner_id": string | null,
"id": string,
"patient_id": string,
"purpose": string,
"resource_id": string | null,
"revoked_at": string | null,
"scope": string,
"starts_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "consent_grants"
        isOneToOne: true
        isSetofReturn: false
      } },
"health_profile":
{ Args: { "p_patient_id": string }; Returns: Json
                           },
"home_collection_labs":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"invoice_document":
{ Args: { "p_invoice_id": string }; Returns: Json
                           },
"issue_patient_card":
{ Args: { "p_facility_id": string,"p_patient_id": string,"p_rotate"?: boolean }; Returns: Json
                           },
"lab_check_in":
{ Args: { "p_order_id": string }; Returns: {
              "clinical_note": string | null,
"created_at": string,
"created_by": string,
"encounter_id": string | null,
"id": string,
"idempotency_key": string,
"lab_facility_id": string,
"order_number": string,
"ordering_facility_id": string | null,
"ordering_practitioner_id": string | null,
"patient_id": string,
"source": string,
"status": Database["public"]['Enums']["lab_status"],
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "lab_orders"
        isOneToOne: true
        isSetofReturn: false
      } },
"lab_choices":
{ Args: { "p_encounter_id": string }; Returns: {
              "branch": string,"is_default": boolean,"lab_id": string,"name": string,"tests": Json
            }[]
                           },
"lab_claim_open_order":
{ Args: { "p_code": string,"p_lab_facility_id": string,"p_pick": Json }; Returns: Json
                           },
"lab_home_requests":
{ Args: { "p_lab_facility_id": string }; Returns: Json
                           },
"lab_lookup_open_order":
{ Args: { "p_code": string,"p_lab_facility_id": string }; Returns: Json
                           },
"lab_order_detail":
{ Args: { "p_order_id": string }; Returns: Json
                           },
"lab_register_direct":
{ Args: { "p_idempotency_key": string,"p_lab_facility_id": string,"p_patient_id": string,"p_test_ids": (string)[] }; Returns: {
              "clinical_note": string | null,
"created_at": string,
"created_by": string,
"encounter_id": string | null,
"id": string,
"idempotency_key": string,
"lab_facility_id": string,
"order_number": string,
"ordering_facility_id": string | null,
"ordering_practitioner_id": string | null,
"patient_id": string,
"source": string,
"status": Database["public"]['Enums']["lab_status"],
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "lab_orders"
        isOneToOne: true
        isSetofReturn: false
      } },
"lab_report":
{ Args: { "p_order_id": string }; Returns: Json
                           },
"lab_update_home_request":
{ Args: { "p_collector_name"?: string,"p_note"?: string,"p_request_id": string,"p_scheduled_at"?: string,"p_status": string }; Returns: {
              "address": string,
"collector_name": string | null,
"created_at": string,
"created_by": string,
"id": string,
"lab_facility_id": string,
"lab_order_id": string | null,
"latitude": number | null,
"longitude": number | null,
"notes": string | null,
"patient_id": string,
"phone": string,
"preferred_date": string,
"preferred_window": string,
"request_number": string,
"scheduled_at": string | null,
"status": string,
"status_reason": string | null,
"test_ids": (string)[],
"tests_text": string | null,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "home_lab_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"lab_worklist":
{ Args: { "p_lab_facility_id": string,"p_status"?: Database["public"]['Enums']["lab_status"] }; Returns: {
              "created_at": string,"item_count": number,"latest_barcode": string,"order_id": string,"order_number": string,"ordering_doctor": string,"ordering_facility": string,"patient_code": string,"patient_id": string,"patient_name": string,"released_count": number,"source": string,"status": Database["public"]['Enums']["lab_status"]
            }[]
                           },
"link_patient_with_code":
{ Args: { "p_code": string,"p_facility_id": string,"p_patient_id": string,"p_verification_note": string }; Returns: string
                           },
"list_attachments":
{ Args: { "p_kind": string,"p_ref_id": string }; Returns: {
              "created_at": string,"file_name": string,"id": string,"mime": string,"rejection_reason": string,"size": number,"status": string,"storage_path": string
            }[]
                           },
"log_dose":
{ Args: { "p_amount"?: number,"p_job_id": string,"p_status": string }; Returns: Json
                           },
"lookup_patients":
{ Args: { "p_facility_id": string,"p_kind"?: string,"p_query": string }; Returns: {
              "birth_year": number,"full_name": string,"has_account": boolean,"is_provisional": boolean,"known_here": boolean,"patient_id": string,"phone_masked": string,"public_code": string,"sex": Database["public"]['Enums']["patient_sex"]
            }[]
                           },
"mark_pharmacy_notes_seen":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"medication_adherence":
{ Args: { "p_days"?: number,"p_patient_id": string }; Returns: Json
                           },
"merge_patients":
{ Args: { "p_facility_id": string,"p_reason": string,"p_source": string,"p_target": string }; Returns: undefined
                           },
"my_access_summary":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"my_appointments":
{ Args: Record<PropertyKey, never>; Returns: {
              "address": string,"appointment_id": string,"booking_number": string,"branch_name": string,"cancellation_cutoff_minutes": number,"confirmation_deadline": string,"currency": string,"ends_at": string,"facility_id": string,"facility_name": string,"patient_id": string,"patient_name": string,"practitioner_id": string,"practitioner_name": string,"price_minor": number,"service_name": string,"starts_at": string,"status": Database["public"]['Enums']["appointment_status"],"status_reason": string,"timezone": string
            }[]
                           },
"my_clinical_tasks":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"encounter_id": string,"has_critical": boolean,"kind": string,"lab_order_id": string,"order_number": string,"patient_code": string,"patient_id": string,"patient_name": string,"task_id": string
            }[]
                           },
"my_home_lab_requests":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"my_lab_orders":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"item_count": number,"lab_name": string,"order_id": string,"order_number": string,"ordering_doctor": string,"patient_name": string,"released_count": number,"status": Database["public"]['Enums']["lab_status"]
            }[]
                           },
"my_medication_plans":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"my_open_lab_orders":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"my_patient_card":
{ Args: { "p_patient_id": string }; Returns: Json
                           },
"my_prescriptions":
{ Args: Record<PropertyKey, never>; Returns: {
              "approved_at": string,"dispatch_status": string,"facility_name": string,"items": Json,"patient_name": string,"pharmacy_name": string,"practitioner_name": string,"prescription_id": string,"rx_number": string,"status": Database["public"]['Enums']["rx_status"],"version_no": number
            }[]
                           },
"my_queue_status":
{ Args: { "p_appointment_id": string }; Returns: Json
                           },
"my_recent_encounters":
{ Args: { "p_days"?: number }; Returns: Json
                           },
"my_upcoming_doses":
{ Args: { "p_hours"?: number }; Returns: Json
                           },
"my_workspaces":
{ Args: Record<PropertyKey, never>; Returns: {
              "branch_id": string,"branch_name": string,"default_lab_id": string,"default_pharmacy_id": string,"facility_id": string,"facility_name": string,"facility_type": Database["public"]['Enums']["facility_type"],"membership_id": string,"organization_id": string,"organization_name": string,"role": Database["public"]['Enums']["member_role"],"timezone": string
            }[]
                           },
"order_lab_tests":
{ Args: { "p_encounter_id": string,"p_idempotency_key": string,"p_lab_facility_id": string,"p_note"?: string,"p_test_ids": (string)[] }; Returns: {
              "clinical_note": string | null,
"created_at": string,
"created_by": string,
"encounter_id": string | null,
"id": string,
"idempotency_key": string,
"lab_facility_id": string,
"order_number": string,
"ordering_facility_id": string | null,
"ordering_practitioner_id": string | null,
"patient_id": string,
"source": string,
"status": Database["public"]['Enums']["lab_status"],
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "lab_orders"
        isOneToOne: true
        isSetofReturn: false
      } },
"organization_doctors":
{ Args: { "p_facility_id": string }; Returns: {
              "branch_name": string,"facility_id": string,"facility_name": string,"full_name": string,"license_verified": boolean,"phone": string,"practitioner_id": string,"specialty": string,"title": string
            }[]
                           },
"organization_report":
{ Args: { "p_from": string,"p_organization_id": string,"p_to": string }; Returns: Json
                           },
"otp_send_allowed":
{ Args: { "p_phone": string }; Returns: string
                           },
"outbox_claim":
{ Args: { "p_lease_seconds"?: number,"p_limit"?: number }; Returns: {
              "attempts": number,
"channel": Database["public"]['Enums']["notification_channel"],
"created_at": string,
"dedupe_key": string,
"id": string,
"last_error": string | null,
"locked_until": string | null,
"max_attempts": number,
"next_attempt_at": string,
"payload": NonNullable<Json>,
"recipient_user_id": string,
"sent_at": string | null,
"status": Database["public"]['Enums']["outbox_status"],
"template": string,
"updated_at": string,
"version": number
            }[]
                          SetofOptions: {
        from: "*"
        to: "notification_outbox"
        isOneToOne: false
        isSetofReturn: true
      } },
"outbox_complete":
{ Args: { "p_error"?: string,"p_id": string,"p_inbox_body"?: string,"p_inbox_link"?: string,"p_inbox_title"?: string,"p_success": boolean }; Returns: undefined
                           },
"patient_journey":
{ Args: Record<PropertyKey, never>; Returns: {
              "corrected": boolean,"encounter_id": string,"event_type": string,"facility_name": string,"occurred_at": string,"patient_id": string,"patient_name": string,"practitioner_name": string,"ref_id": string,"status": string,"title": string
            }[]
                           },
"patient_medical_card":
{ Args: { "p_patient_id": string }; Returns: Json
                           },
"pause_encounter":
{ Args: { "p_encounter_id": string,"p_reason"?: string }; Returns: {
              "appointment_id": string | null,
"created_at": string,
"created_by": string,
"ended_at": string | null,
"facility_id": string,
"follow_up_of": string | null,
"id": string,
"identity_verified": boolean,
"patient_id": string,
"pause_reason": string | null,
"paused_at": string | null,
"practitioner_id": string,
"queue_entry_id": string | null,
"reopen_count": number,
"reopen_reason": string | null,
"reopened_at": string | null,
"started_at": string | null,
"status": Database["public"]['Enums']["encounter_status"],
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "encounters"
        isOneToOne: true
        isSetofReturn: false
      } },
"pharmacy_choices":
{ Args: { "p_encounter_id": string }; Returns: {
              "branch": string,"is_default": boolean,"name": string,"pharmacy_id": string
            }[]
                           },
"pharmacy_inbox":
{ Args: { "p_pharmacy_id": string,"p_status"?: string }; Returns: {
              "dispatch_id": string,"facility_name": string,"item_count": number,"patient_code": string,"patient_name": string,"practitioner_name": string,"prescription_id": string,"printed_count": number,"received_at": string,"revised": boolean,"rx_number": string,"rx_status": Database["public"]['Enums']["rx_status"],"sent_at": string,"status": string,"version_no": number
            }[]
                           },
"pharmacy_mark_received":
{ Args: { "p_dispatch_id": string }; Returns: undefined
                           },
"pharmacy_prescription":
{ Args: { "p_dispatch_id": string }; Returns: Json
                           },
"pharmacy_report":
{ Args: { "p_from": string,"p_pharmacy_id": string,"p_to": string }; Returns: Json
                           },
"pharmacy_stock":
{ Args: { "p_pharmacy_id": string }; Returns: {
              "available": number,"batches": Json,"expired_on_hand": number,"low_stock": boolean,"manual_availability": string,"manual_availability_at": string,"medication": string,"name": string,"nearest_expiry": string,"on_hand": number,"product_id": string,"reorder_level": number,"reserved": number,"unit_name": string,"unit_price_minor": number,"units_per_pack": number
            }[]
                           },
"platform_overview":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"post_delay_notice":
{ Args: { "p_delay_minutes": number,"p_facility_id": string,"p_message"?: string,"p_practitioner_id": string }; Returns: {
              "created_at": string,
"created_by": string | null,
"delay_minutes": number,
"facility_id": string,
"id": string,
"message": string | null,
"practitioner_id": string | null,
"service_date": string
            }
                          SetofOptions: {
        from: "*"
        to: "delay_notices"
        isOneToOne: true
        isSetofReturn: false
      } },
"prepare_dispatch":
{ Args: { "p_dispatch_id": string,"p_lines": Json }; Returns: undefined
                           },
"prescription_document":
{ Args: { "p_prescription_id": string }; Returns: Json
                           },
"provider_media":
{ Args: { "p_facility_id": string,"p_practitioner_id"?: string }; Returns: Json
                           },
"push_device_result":
{ Args: { "p_gone"?: boolean,"p_id": string,"p_ok": boolean }; Returns: undefined
                           },
"push_store_vapid":
{ Args: { "p_value": Json }; Returns: Json
                           },
"push_targets":
{ Args: { "p_user_id": string }; Returns: Json
                           },
"push_vapid":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"queue_appointment_reminders":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"receive_stock":
{ Args: { "p_batch_no": string,"p_expiry_date": string,"p_idempotency_key": string,"p_packs": number,"p_product_id": string,"p_supplier_name"?: string,"p_unit_cost_minor": number }; Returns: {
              "batch_no": string,
"expiry_date": string,
"id": string,
"product_id": string,
"quantity_on_hand": number,
"received_at": string,
"received_by": string | null,
"supplier_id": string | null,
"unit_cost_minor": number
            }
                          SetofOptions: {
        from: "*"
        to: "inventory_batches"
        isOneToOne: true
        isSetofReturn: false
      } },
"reception_practitioners":
{ Args: { "p_facility_id": string }; Returns: {
              "full_name": string,"practitioner_id": string,"services": Json,"specialty": string
            }[]
                           },
"reception_quick_book":
{ Args: { "p_birth_year"?: number,"p_facility_id": string,"p_idempotency_key": string,"p_new_patient_name"?: string,"p_patient_id"?: string,"p_phone"?: string,"p_practitioner_id": string,"p_service_id"?: string,"p_sex"?: Database["public"]['Enums']["patient_sex"],"p_start"?: string }; Returns: Json
                           },
"reception_scope_options":
{ Args: { "p_membership_id": string }; Returns: {
              "allowed": boolean,"full_name": string,"practitioner_id": string,"specialty": string
            }[]
                           },
"record_dose":
{ Args: { "p_job_id": string,"p_status": string }; Returns: undefined
                           },
"record_invoice_payment":
{ Args: { "p_amount_minor": number,"p_idempotency_key": string,"p_invoice_id": string,"p_method"?: string,"p_note"?: string }; Returns: {
              "appointment_id": string | null,
"created_at": string,
"created_by": string,
"currency": string,
"facility_id": string,
"id": string,
"invoice_number": string,
"lab_order_id": string | null,
"patient_id": string,
"status": string,
"total_minor": number,
"updated_at": string,
"version": number,
"void_reason": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "invoices"
        isOneToOne: true
        isSetofReturn: false
      } },
"record_payment":
{ Args: { "p_amount_minor": number,"p_method"?: string,"p_sale_id": string }; Returns: undefined
                           },
"record_prescription_print":
{ Args: { "p_facility_id": string,"p_prescription_id": string }; Returns: undefined
                           },
"register_push_device":
{ Args: { "p_kind": string,"p_platform"?: string,"p_token": string,"p_web_keys"?: Json }; Returns: undefined
                           },
"register_self_patient":
{ Args: { "p_birth_date"?: string,"p_city_id"?: string,"p_full_name": string,"p_phone"?: string,"p_sex"?: Database["public"]['Enums']["patient_sex"] }; Returns: {
              "birth_date": string | null,
"birth_year": number | null,
"city_id": string | null,
"created_at": string,
"created_at_facility_id": string | null,
"created_by": string | null,
"full_name": string,
"id": string,
"is_provisional": boolean,
"merged_into": string | null,
"phone": string | null,
"public_code": string,
"sex": Database["public"]['Enums']["patient_sex"] | null,
"status": Database["public"]['Enums']["patient_record_status"],
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "patients"
        isOneToOne: true
        isSetofReturn: false
      } },
"reject_specimen":
{ Args: { "p_reason": string,"p_specimen_id": string }; Returns: undefined
                           },
"release_lab_results":
{ Args: { "p_item_ids": (string)[],"p_order_id": string }; Returns: {
              "clinical_note": string | null,
"created_at": string,
"created_by": string,
"encounter_id": string | null,
"id": string,
"idempotency_key": string,
"lab_facility_id": string,
"order_number": string,
"ordering_facility_id": string | null,
"ordering_practitioner_id": string | null,
"patient_id": string,
"source": string,
"status": Database["public"]['Enums']["lab_status"],
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "lab_orders"
        isOneToOne: true
        isSetofReturn: false
      } },
"remove_provider_media":
{ Args: { "p_media_id": string }; Returns: undefined
                           },
"reopen_encounter":
{ Args: { "p_encounter_id": string,"p_reason": string }; Returns: {
              "appointment_id": string | null,
"created_at": string,
"created_by": string,
"ended_at": string | null,
"facility_id": string,
"follow_up_of": string | null,
"id": string,
"identity_verified": boolean,
"patient_id": string,
"pause_reason": string | null,
"paused_at": string | null,
"practitioner_id": string,
"queue_entry_id": string | null,
"reopen_count": number,
"reopen_reason": string | null,
"reopened_at": string | null,
"started_at": string | null,
"status": Database["public"]['Enums']["encounter_status"],
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "encounters"
        isOneToOne: true
        isSetofReturn: false
      } },
"reply_pharmacy_note":
{ Args: { "p_note_id": string,"p_reply": string }; Returns: undefined
                           },
"request_attachment_upload":
{ Args: { "p_file_name": string,"p_kind": string,"p_mime": string,"p_ref_id": string,"p_size": number }; Returns: Json
                           },
"request_home_lab":
{ Args: { "p_address": string,"p_date": string,"p_lab_facility_id": string,"p_lab_order_id"?: string,"p_latitude"?: number,"p_longitude"?: number,"p_notes"?: string,"p_patient_id": string,"p_phone": string,"p_test_ids": (string)[],"p_window": string }; Returns: {
              "address": string,
"collector_name": string | null,
"created_at": string,
"created_by": string,
"id": string,
"lab_facility_id": string,
"lab_order_id": string | null,
"latitude": number | null,
"longitude": number | null,
"notes": string | null,
"patient_id": string,
"phone": string,
"preferred_date": string,
"preferred_window": string,
"request_number": string,
"scheduled_at": string | null,
"status": string,
"status_reason": string | null,
"test_ids": (string)[],
"tests_text": string | null,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "home_lab_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"reschedule_appointment":
{ Args: { "p_appointment_id": string,"p_idempotency_key": string,"p_new_start": string,"p_reason"?: string }; Returns: {
              "blocked_period": unknown,
"booking_number": string,
"buffer_minutes": number,
"cancellation_cutoff_minutes": number,
"confirmation_deadline": string | null,
"confirmed_at": string | null,
"confirmed_by": string | null,
"created_at": string,
"created_by": string,
"currency": string,
"duration_minutes": number,
"facility_id": string,
"holds_slot": boolean | null,
"id": string,
"idempotency_key": string,
"patient_id": string,
"patient_note": string | null,
"period": unknown,
"practitioner_id": string | null,
"price_minor": number | null,
"rescheduled_from": string | null,
"resource_id": string | null,
"service_id": string,
"source": Database["public"]['Enums']["booking_source"],
"status": Database["public"]['Enums']["appointment_status"],
"status_reason": string | null,
"timezone": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "appointments"
        isOneToOne: true
        isSetofReturn: false
      } },
"resume_encounter":
{ Args: { "p_encounter_id": string }; Returns: {
              "appointment_id": string | null,
"created_at": string,
"created_by": string,
"ended_at": string | null,
"facility_id": string,
"follow_up_of": string | null,
"id": string,
"identity_verified": boolean,
"patient_id": string,
"pause_reason": string | null,
"paused_at": string | null,
"practitioner_id": string,
"queue_entry_id": string | null,
"reopen_count": number,
"reopen_reason": string | null,
"reopened_at": string | null,
"started_at": string | null,
"status": Database["public"]['Enums']["encounter_status"],
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "encounters"
        isOneToOne: true
        isSetofReturn: false
      } },
"return_sale_line":
{ Args: { "p_quantity": number,"p_reason": string,"p_restock"?: boolean,"p_sale_line_id": string }; Returns: {
              "amount_minor": number,
"created_at": string,
"created_by": string,
"id": string,
"quantity": number,
"reason": string,
"restocked": boolean,
"sale_line_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "refunds"
        isOneToOne: true
        isSetofReturn: false
      } },
"review_provider_application":
{ Args: { "p_id": string,"p_note"?: string,"p_status": string }; Returns: undefined
                           },
"revise_prescription":
{ Args: { "p_prescription_id": string }; Returns: Json
                           },
"revoke_consent":
{ Args: { "p_consent_id": string }; Returns: undefined
                           },
"revoke_invitation":
{ Args: { "p_invitation_id": string }; Returns: undefined
                           },
"rotate_patient_qr":
{ Args: { "p_patient_id": string }; Returns: string
                           },
"rx_pending_reminders":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"save_clinical_note_draft":
{ Args: { "p_encounter_id": string,"p_expected_version"?: number,"p_fields": Json }; Returns: {
              "assessment": string | null,
"correction_reason": string | null,
"created_at": string,
"created_by": string,
"encounter_id": string,
"examination": string | null,
"follow_up": string | null,
"free_text": string | null,
"history": string | null,
"id": string,
"plan": string | null,
"reason_for_visit": string | null,
"signed_at": string | null,
"signed_by": string | null,
"status": string,
"supersedes_id": string | null,
"updated_at": string,
"version": number,
"version_no": number,
"vitals": NonNullable<Json>
            }
                          SetofOptions: {
        from: "*"
        to: "clinical_notes"
        isOneToOne: true
        isSetofReturn: false
      } },
"save_health_profile":
{ Args: { "p_birth_date"?: string,"p_blood_type"?: string,"p_height_cm"?: number,"p_notes"?: string,"p_patient_id": string,"p_weight_kg"?: number }; Returns: undefined
                           },
"save_lab_result_draft":
{ Args: { "p_lab_flag"?: string,"p_notes"?: string,"p_order_item_id": string,"p_reference_range"?: string,"p_unit"?: string,"p_value_numeric"?: number,"p_value_text"?: string }; Returns: {
              "correction_reason": string | null,
"created_at": string,
"entered_by": string,
"id": string,
"lab_flag": string | null,
"notes": string | null,
"order_item_id": string,
"reference_range": string | null,
"released_at": string | null,
"released_by": string | null,
"status": string,
"supersedes_id": string | null,
"unit": string | null,
"updated_at": string,
"value_numeric": number | null,
"value_text": string | null,
"version_no": number
            }
                          SetofOptions: {
        from: "*"
        to: "lab_results"
        isOneToOne: true
        isSetofReturn: false
      } },
"save_prescription_draft":
{ Args: { "p_encounter_id": string,"p_idempotency_key": string,"p_items": Json,"p_prescription_id"?: string }; Returns: Json
                           },
"search_medications":
{ Args: { "p_pharmacy_id"?: string,"p_query": string }; Returns: {
              "active_ingredient": string,"availability": string,"availability_updated_at": string,"brand_name": string,"dosage_form": string,"medication_id": string,"strength": string,"unit": string
            }[]
                           },
"search_providers":
{ Args: { "p_city_id"?: string,"p_kind"?: string,"p_lat"?: number,"p_limit"?: number,"p_lng"?: number,"p_max_km"?: number,"p_query"?: string,"p_specialty_id"?: string }; Returns: {
              "address": string,"area": string,"branch_name": string,"city_name": string,"currency": string,"display_name": string,"distance_km": number,"facility_id": string,"facility_name": string,"latitude": number,"license_verified": boolean,"longitude": number,"min_price_minor": number,"opening_hours_note": string,"organization_name": string,"photo_path": string,"practitioner_id": string,"specialty_name": string,"title": string
            }[]
                           },
"send_prescription_to_pharmacy":
{ Args: { "p_pharmacy_id": string,"p_prescription_id": string }; Returns: undefined
                           },
"set_booking_policy":
{ Args: { "p_booking_window_days": number,"p_cancellation_cutoff_minutes": number,"p_cancellation_policy_text"?: string,"p_confirmation_mode": string,"p_confirmation_timeout_minutes": number,"p_facility_id": string,"p_late_policy_text"?: string,"p_min_notice_minutes": number,"p_practitioner_id": string,"p_slot_step_minutes"?: number }; Returns: {
              "booking_window_days": number,
"cancellation_cutoff_minutes": number,
"cancellation_policy_text": string | null,
"confirmation_mode": string,
"confirmation_timeout_minutes": number,
"created_at": string,
"facility_id": string,
"id": string,
"late_policy_text": string | null,
"min_notice_minutes": number,
"practitioner_id": string | null,
"slot_step_minutes": number | null,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "booking_policies"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_condition_status":
{ Args: { "p_condition_id": string,"p_status": string }; Returns: undefined
                           },
"set_encounter_status":
{ Args: { "p_encounter_id": string,"p_status": Database["public"]['Enums']["encounter_status"] }; Returns: {
              "appointment_id": string | null,
"created_at": string,
"created_by": string,
"ended_at": string | null,
"facility_id": string,
"follow_up_of": string | null,
"id": string,
"identity_verified": boolean,
"patient_id": string,
"pause_reason": string | null,
"paused_at": string | null,
"practitioner_id": string,
"queue_entry_id": string | null,
"reopen_count": number,
"reopen_reason": string | null,
"reopened_at": string | null,
"started_at": string | null,
"status": Database["public"]['Enums']["encounter_status"],
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "encounters"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_home_collection":
{ Args: { "p_enabled": boolean,"p_fee_minor"?: number,"p_lab_facility_id": string,"p_note"?: string }; Returns: undefined
                           },
"set_manual_availability":
{ Args: { "p_product_id": string,"p_status": string }; Returns: undefined
                           },
"set_medication_plan_status":
{ Args: { "p_plan_id": string,"p_status": string }; Returns: undefined
                           },
"set_membership_status":
{ Args: { "p_membership_id": string,"p_reason": string,"p_status": Database["public"]['Enums']["membership_status"] }; Returns: undefined
                           },
"set_push_device_local_reminders":
{ Args: { "p_on": boolean,"p_token": string }; Returns: undefined
                           },
"set_reception_scope":
{ Args: { "p_allowed": boolean,"p_membership_id": string,"p_practitioner_id": string }; Returns: undefined
                           },
"set_weekly_schedule":
{ Args: { "p_facility_id": string,"p_practitioner_id": string,"p_slots": Json }; Returns: number
                           },
"sign_clinical_note":
{ Args: { "p_encounter_id": string }; Returns: {
              "assessment": string | null,
"correction_reason": string | null,
"created_at": string,
"created_by": string,
"encounter_id": string,
"examination": string | null,
"follow_up": string | null,
"free_text": string | null,
"history": string | null,
"id": string,
"plan": string | null,
"reason_for_visit": string | null,
"signed_at": string | null,
"signed_by": string | null,
"status": string,
"supersedes_id": string | null,
"updated_at": string,
"version": number,
"version_no": number,
"vitals": NonNullable<Json>
            }
                          SetofOptions: {
        from: "*"
        to: "clinical_notes"
        isOneToOne: true
        isSetofReturn: false
      } },
"start_encounter":
{ Args: { "p_identity_verified": boolean,"p_queue_entry_id": string }; Returns: {
              "appointment_id": string | null,
"created_at": string,
"created_by": string,
"ended_at": string | null,
"facility_id": string,
"follow_up_of": string | null,
"id": string,
"identity_verified": boolean,
"patient_id": string,
"pause_reason": string | null,
"paused_at": string | null,
"practitioner_id": string,
"queue_entry_id": string | null,
"reopen_count": number,
"reopen_reason": string | null,
"reopened_at": string | null,
"started_at": string | null,
"status": Database["public"]['Enums']["encounter_status"],
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "encounters"
        isOneToOne: true
        isSetofReturn: false
      } },
"stop_reported_medication":
{ Args: { "p_medication_id": string }; Returns: undefined
                           },
"submit_attachment":
{ Args: { "p_id": string }; Returns: undefined
                           },
"submit_provider_application":
{ Args: { "p": Json }; Returns: Json
                           },
"system_health":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"unregister_push_device":
{ Args: { "p_token": string }; Returns: undefined
                           },
"update_own_medication_plan":
{ Args: { "p_days"?: number,"p_instructions"?: string,"p_interval_hours"?: number,"p_name": string,"p_plan_id": string,"p_times": (string)[] }; Returns: {
              "as_needed": boolean,
"consent_at": string,
"created_at": string,
"created_by": string,
"display_name": string,
"dose": number | null,
"dose_unit": string | null,
"end_date": string | null,
"id": string,
"instructions": string | null,
"interval_hours": number | null,
"line_no": number | null,
"patient_id": string,
"prescription_id": string | null,
"reported_medication_id": string | null,
"source": string,
"start_date": string,
"status": string,
"status_reason": string | null,
"times_local": (string)[],
"timezone": string,
"updated_at": string,
"version": number,
"version_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "medication_plans"
        isOneToOne: true
        isSetofReturn: false
      } },
"update_queue_entry":
{ Args: { "p_priority"?: number,"p_priority_reason"?: string,"p_queue_entry_id": string,"p_status"?: Database["public"]['Enums']["queue_status"] }; Returns: {
              "appointment_id": string | null,
"arrived_at": string,
"called_at": string | null,
"created_at": string,
"created_by": string | null,
"facility_id": string,
"finished_at": string | null,
"id": string,
"idempotency_key": string | null,
"kind": string,
"patient_id": string,
"practitioner_id": string | null,
"priority": number,
"priority_reason": string | null,
"priority_set_by": string | null,
"service_date": string,
"started_at": string | null,
"status": Database["public"]['Enums']["queue_status"],
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "queue_entries"
        isOneToOne: true
        isSetofReturn: false
      } },
"upsert_clinic_service":
{ Args: { "p_buffer_minutes"?: number,"p_description"?: string,"p_duration_minutes": number,"p_facility_id": string,"p_is_active"?: boolean,"p_name": string,"p_practitioner_id"?: string,"p_preparation_note"?: string,"p_price_minor"?: number,"p_resource_id"?: string,"p_service_id"?: string }; Returns: {
              "buffer_minutes": number,
"created_at": string,
"currency": string,
"description": string | null,
"duration_minutes": number,
"facility_id": string,
"id": string,
"is_active": boolean,
"is_public": boolean,
"name": string,
"practitioner_id": string | null,
"preparation_note": string | null,
"price_minor": number | null,
"resource_id": string | null,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "clinic_services"
        isOneToOne: true
        isSetofReturn: false
      } },
"upsert_lab_test_master":
{ Args: { "p": Json }; Returns: {
              "category": string | null,
"code": string,
"created_at": string,
"id": string,
"is_active": boolean,
"name_ar": string,
"name_en": string | null,
"reference_range": string | null,
"sort_order": number,
"specimen_type": string | null,
"unit": string | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "lab_test_master"
        isOneToOne: true
        isSetofReturn: false
      } },
"upsert_pharmacy_product":
{ Args: { "p_barcode"?: string,"p_is_active"?: boolean,"p_medication_id"?: string,"p_name": string,"p_pack_description"?: string,"p_pharmacy_id": string,"p_product_id"?: string,"p_reorder_level"?: number,"p_unit_name"?: string,"p_unit_price_minor": number,"p_units_per_pack"?: number }; Returns: {
              "barcode": string | null,
"created_at": string,
"id": string,
"is_active": boolean,
"manual_availability": string | null,
"manual_availability_at": string | null,
"medication_id": string | null,
"name": string,
"pack_description": string | null,
"pharmacy_id": string,
"reorder_level": number,
"unit_name": string,
"unit_price_minor": number,
"units_per_pack": number,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "pharmacy_products"
        isOneToOne: true
        isSetofReturn: false
      } },
"verify_prescription":
{ Args: { "p_token": string }; Returns: Json
                           },
"void_invoice":
{ Args: { "p_invoice_id": string,"p_reason": string }; Returns: undefined
                           },
"web_push_public_key":
{ Args: Record<PropertyKey, never>; Returns: string
                           }
          }
          Enums: {
            "account_status": "active"|"suspended","appointment_status": "awaiting_confirmation"|"confirmed"|"checked_in"|"fulfilled"|"cancelled"|"rejected"|"no_show"|"expired","booking_source": "app"|"web"|"reception","encounter_status": "not_started"|"in_progress"|"awaiting_results"|"ready_for_review"|"completed"|"closed","entity_status": "pending"|"active"|"suspended"|"closed","facility_type": "clinic"|"pharmacy"|"laboratory","lab_status": "ordered"|"scheduled"|"checked_in"|"sample_collected"|"processing"|"pending_review"|"released"|"cancelled"|"sample_rejected","member_role": "doctor"|"receptionist"|"pharmacist"|"pharmacy_staff"|"lab_technician"|"lab_approver"|"facility_admin"|"organization_admin","membership_status": "active"|"suspended"|"revoked","notification_channel": "in_app"|"push"|"sms"|"email","outbox_status": "pending"|"processing"|"sent"|"failed"|"dead"|"cancelled","patient_record_status": "active"|"merged"|"deceased"|"inactive","patient_sex": "female"|"male","queue_status": "waiting"|"called"|"in_session"|"done"|"left"|"cancelled","rx_status": "draft"|"active"|"cancelled","rx_version_status": "draft"|"approved"|"superseded"|"cancelled"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "account_status": ["active", "suspended"],"appointment_status": ["awaiting_confirmation", "confirmed", "checked_in", "fulfilled", "cancelled", "rejected", "no_show", "expired"],"booking_source": ["app", "web", "reception"],"encounter_status": ["not_started", "in_progress", "awaiting_results", "ready_for_review", "completed", "closed"],"entity_status": ["pending", "active", "suspended", "closed"],"facility_type": ["clinic", "pharmacy", "laboratory"],"lab_status": ["ordered", "scheduled", "checked_in", "sample_collected", "processing", "pending_review", "released", "cancelled", "sample_rejected"],"member_role": ["doctor", "receptionist", "pharmacist", "pharmacy_staff", "lab_technician", "lab_approver", "facility_admin", "organization_admin"],"membership_status": ["active", "suspended", "revoked"],"notification_channel": ["in_app", "push", "sms", "email"],"outbox_status": ["pending", "processing", "sent", "failed", "dead", "cancelled"],"patient_record_status": ["active", "merged", "deceased", "inactive"],"patient_sex": ["female", "male"],"queue_status": ["waiting", "called", "in_session", "done", "left", "cancelled"],"rx_status": ["draft", "active", "cancelled"],"rx_version_status": ["draft", "approved", "superseded", "cancelled"]
          }
        }
} as const
