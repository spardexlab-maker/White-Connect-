
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
                },"facilities": {
                  Row: {
                    "branch_id": string,"created_at": string,"default_lab_id": string | null,"default_pharmacy_id": string | null,"description": string | null,"id": string,"is_public": boolean,"name": string,"opening_hours_note": string | null,"organization_id": string,"phone": string | null,"status": Database["public"]['Enums']["entity_status"],"status_reason": string | null,"type": Database["public"]['Enums']["facility_type"],"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "branch_id": string,"created_at"?: string,"default_lab_id"?: string | null,"default_pharmacy_id"?: string | null,"description"?: string | null,"id"?: string,"is_public"?: boolean,"name": string,"opening_hours_note"?: string | null,"organization_id": string,"phone"?: string | null,"status"?: Database["public"]['Enums']["entity_status"],"status_reason"?: string | null,"type": Database["public"]['Enums']["facility_type"],"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "branch_id"?: string,"created_at"?: string,"default_lab_id"?: string | null,"default_pharmacy_id"?: string | null,"description"?: string | null,"id"?: string,"is_public"?: boolean,"name"?: string,"opening_hours_note"?: string | null,"organization_id"?: string,"phone"?: string | null,"status"?: Database["public"]['Enums']["entity_status"],"status_reason"?: string | null,"type"?: Database["public"]['Enums']["facility_type"],"updated_at"?: string,"version"?: number
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
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"created_at": string,"email": string,"expires_at": string,"facility_id": string | null,"id": string,"invited_by": string,"organization_id": string,"revoked_at": string | null,"role": Database["public"]['Enums']["member_role"],"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email": string,"expires_at": string,"facility_id"?: string | null,"id"?: string,"invited_by": string,"organization_id": string,"revoked_at"?: string | null,"role": Database["public"]['Enums']["member_role"],"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"facility_id"?: string | null,"id"?: string,"invited_by"?: string,"organization_id"?: string,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["member_role"],"token_hash"?: string
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
"admin_retry_dead_notification":
{ Args: { "p_id": string }; Returns: undefined
                           },
"admin_set_account_status":
{ Args: { "p_reason": string,"p_status": Database["public"]['Enums']["account_status"],"p_user_id": string }; Returns: undefined
                           },
"admin_set_entity_status":
{ Args: { "p_entity": string,"p_id": string,"p_reason": string,"p_status": Database["public"]['Enums']["entity_status"] }; Returns: undefined
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
"create_account_link_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"create_invitation":
{ Args: { "p_email": string,"p_facility_id": string,"p_organization_id": string,"p_role": Database["public"]['Enums']["member_role"],"p_valid_hours"?: number }; Returns: {
              "expires_at": string,"invitation_id": string,"token": string
            }[]
                           },
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
"issue_patient_card":
{ Args: { "p_facility_id": string,"p_patient_id": string,"p_rotate"?: boolean }; Returns: Json
                           },
"link_patient_with_code":
{ Args: { "p_code": string,"p_facility_id": string,"p_patient_id": string,"p_verification_note": string }; Returns: string
                           },
"lookup_patients":
{ Args: { "p_facility_id": string,"p_kind"?: string,"p_query": string }; Returns: {
              "birth_year": number,"full_name": string,"has_account": boolean,"is_provisional": boolean,"known_here": boolean,"patient_id": string,"phone_masked": string,"public_code": string,"sex": Database["public"]['Enums']["patient_sex"]
            }[]
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
"my_patient_card":
{ Args: { "p_patient_id": string }; Returns: Json
                           },
"my_queue_status":
{ Args: { "p_appointment_id": string }; Returns: Json
                           },
"my_workspaces":
{ Args: Record<PropertyKey, never>; Returns: {
              "branch_id": string,"branch_name": string,"default_lab_id": string,"default_pharmacy_id": string,"facility_id": string,"facility_name": string,"facility_type": Database["public"]['Enums']["facility_type"],"membership_id": string,"organization_id": string,"organization_name": string,"role": Database["public"]['Enums']["member_role"],"timezone": string
            }[]
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
"reception_practitioners":
{ Args: { "p_facility_id": string }; Returns: {
              "full_name": string,"practitioner_id": string,"services": Json,"specialty": string
            }[]
                           },
"reception_quick_book":
{ Args: { "p_birth_year"?: number,"p_facility_id": string,"p_idempotency_key": string,"p_new_patient_name"?: string,"p_patient_id"?: string,"p_phone"?: string,"p_practitioner_id": string,"p_service_id"?: string,"p_sex"?: Database["public"]['Enums']["patient_sex"],"p_start"?: string }; Returns: Json
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
"revoke_consent":
{ Args: { "p_consent_id": string }; Returns: undefined
                           },
"revoke_invitation":
{ Args: { "p_invitation_id": string }; Returns: undefined
                           },
"rotate_patient_qr":
{ Args: { "p_patient_id": string }; Returns: string
                           },
"search_providers":
{ Args: { "p_city_id"?: string,"p_kind"?: string,"p_lat"?: number,"p_limit"?: number,"p_lng"?: number,"p_max_km"?: number,"p_query"?: string,"p_specialty_id"?: string }; Returns: {
              "address": string,"area": string,"branch_name": string,"city_name": string,"currency": string,"display_name": string,"distance_km": number,"facility_id": string,"facility_name": string,"latitude": number,"license_verified": boolean,"longitude": number,"min_price_minor": number,"opening_hours_note": string,"organization_name": string,"photo_path": string,"practitioner_id": string,"specialty_name": string,"title": string
            }[]
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
"set_membership_status":
{ Args: { "p_membership_id": string,"p_reason": string,"p_status": Database["public"]['Enums']["membership_status"] }; Returns: undefined
                           },
"set_reception_scope":
{ Args: { "p_allowed": boolean,"p_membership_id": string,"p_practitioner_id": string }; Returns: undefined
                           },
"set_weekly_schedule":
{ Args: { "p_facility_id": string,"p_practitioner_id": string,"p_slots": Json }; Returns: number
                           },
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
      } }
          }
          Enums: {
            "account_status": "active"|"suspended","appointment_status": "awaiting_confirmation"|"confirmed"|"checked_in"|"fulfilled"|"cancelled"|"rejected"|"no_show"|"expired","booking_source": "app"|"web"|"reception","entity_status": "pending"|"active"|"suspended"|"closed","facility_type": "clinic"|"pharmacy"|"laboratory","member_role": "doctor"|"receptionist"|"pharmacist"|"pharmacy_staff"|"lab_technician"|"lab_approver"|"facility_admin"|"organization_admin","membership_status": "active"|"suspended"|"revoked","notification_channel": "in_app"|"push"|"sms"|"email","outbox_status": "pending"|"processing"|"sent"|"failed"|"dead"|"cancelled","patient_record_status": "active"|"merged"|"deceased"|"inactive","patient_sex": "female"|"male","queue_status": "waiting"|"called"|"in_session"|"done"|"left"|"cancelled"
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
            "account_status": ["active", "suspended"],"appointment_status": ["awaiting_confirmation", "confirmed", "checked_in", "fulfilled", "cancelled", "rejected", "no_show", "expired"],"booking_source": ["app", "web", "reception"],"entity_status": ["pending", "active", "suspended", "closed"],"facility_type": ["clinic", "pharmacy", "laboratory"],"member_role": ["doctor", "receptionist", "pharmacist", "pharmacy_staff", "lab_technician", "lab_approver", "facility_admin", "organization_admin"],"membership_status": ["active", "suspended", "revoked"],"notification_channel": ["in_app", "push", "sms", "email"],"outbox_status": ["pending", "processing", "sent", "failed", "dead", "cancelled"],"patient_record_status": ["active", "merged", "deceased", "inactive"],"patient_sex": ["female", "male"],"queue_status": ["waiting", "called", "in_session", "done", "left", "cancelled"]
          }
        }
} as const
