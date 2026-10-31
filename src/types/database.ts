
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
            "activity_log": {
                  Row: {
                    "action": Database["public"]['Enums']["audit_action"],"changed_at": string,"changed_by": string | null,"changed_fields": (string)[] | null,"id": number,"new_data": Json | null,"old_data": Json | null,"project_id": string | null,"reason": string | null,"record_id": string | null,"table_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": Database["public"]['Enums']["audit_action"],"changed_at"?: string,"changed_by"?: string | null,"changed_fields"?: (string)[] | null,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"project_id"?: string | null,"reason"?: string | null,"record_id"?: string | null,"table_name": string
                  }
                  Update: {
                    "action"?: Database["public"]['Enums']["audit_action"],"changed_at"?: string,"changed_by"?: string | null,"changed_fields"?: (string)[] | null,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"project_id"?: string | null,"reason"?: string | null,"record_id"?: string | null,"table_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"blocks": {
                  Row: {
                    "created_at": string,"created_by": string | null,"deleted_at": string | null,"id": string,"kind": Database["public"]['Enums']["block_kind"],"name": string,"project_id": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["block_kind"],"name": string,"project_id": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["block_kind"],"name"?: string,"project_id"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "blocks_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "blocks_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "blocks_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "v_project_inventory"
      referencedColumns: ["project_id"]
    }
                  ]
                },"clients": {
                  Row: {
                    "address": string | null,"auth_user_id": string | null,"city": string | null,"cnic": string | null,"cnic_back_path": string | null,"cnic_front_path": string | null,"country": string,"created_at": string,"created_by": string | null,"deleted_at": string | null,"email": string | null,"full_name": string,"guardian_name": string | null,"id": string,"is_overseas": boolean,"nationality": string,"nok_cnic": string | null,"nok_name": string | null,"nok_phone": string | null,"nok_relation": string | null,"notes": string | null,"passport_no": string | null,"phone": string,"photo_path": string | null,"relation_type": string | null,"search_digits": string | null,"updated_at": string,"whatsapp": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"auth_user_id"?: string | null,"city"?: string | null,"cnic"?: string | null,"cnic_back_path"?: string | null,"cnic_front_path"?: string | null,"country"?: string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"email"?: string | null,"full_name": string,"guardian_name"?: string | null,"id"?: string,"is_overseas"?: boolean,"nationality"?: string,"nok_cnic"?: string | null,"nok_name"?: string | null,"nok_phone"?: string | null,"nok_relation"?: string | null,"notes"?: string | null,"passport_no"?: string | null,"phone": string,"photo_path"?: string | null,"relation_type"?: string | null,"search_digits"?: never,"updated_at"?: string,"whatsapp"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"auth_user_id"?: string | null,"city"?: string | null,"cnic"?: string | null,"cnic_back_path"?: string | null,"cnic_front_path"?: string | null,"country"?: string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"email"?: string | null,"full_name"?: string,"guardian_name"?: string | null,"id"?: string,"is_overseas"?: boolean,"nationality"?: string,"nok_cnic"?: string | null,"nok_name"?: string | null,"nok_phone"?: string | null,"nok_relation"?: string | null,"notes"?: string | null,"passport_no"?: string | null,"phone"?: string,"photo_path"?: string | null,"relation_type"?: string | null,"search_digits"?: never,"updated_at"?: string,"whatsapp"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "clients_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"commission_receipts": {
                  Row: {
                    "amount": number,"commission_id": string,"created_at": string,"created_by": string | null,"id": string,"received_on": string,"reference_no": string | null,"status": Database["public"]['Enums']["record_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"commission_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"received_on": string,"reference_no"?: string | null,"status"?: Database["public"]['Enums']["record_status"]
                  }
                  Update: {
                    "amount"?: number,"commission_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"received_on"?: string,"reference_no"?: string | null,"status"?: Database["public"]['Enums']["record_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "commission_receipts_commission_id_fkey"
      columns: ["commission_id"]
isOneToOne: false
      referencedRelation: "commissions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "commission_receipts_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"commissions": {
                  Row: {
                    "agent_id": string | null,"amount": number,"base_amount": number,"created_at": string,"created_by": string | null,"dealer_id": string | null,"earned_amount": number,"id": string,"lease_id": string | null,"project_id": string,"rate_pct": number,"received_amount": number,"sale_id": string | null,"status": Database["public"]['Enums']["commission_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "agent_id"?: string | null,"amount"?: number,"base_amount"?: number,"created_at"?: string,"created_by"?: string | null,"dealer_id"?: string | null,"earned_amount"?: number,"id"?: string,"lease_id"?: string | null,"project_id": string,"rate_pct": number,"received_amount"?: number,"sale_id"?: string | null,"status"?: Database["public"]['Enums']["commission_status"],"updated_at"?: string
                  }
                  Update: {
                    "agent_id"?: string | null,"amount"?: number,"base_amount"?: number,"created_at"?: string,"created_by"?: string | null,"dealer_id"?: string | null,"earned_amount"?: number,"id"?: string,"lease_id"?: string | null,"project_id"?: string,"rate_pct"?: number,"received_amount"?: number,"sale_id"?: string | null,"status"?: Database["public"]['Enums']["commission_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "commissions_agent_id_fkey"
      columns: ["agent_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "commissions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "commissions_dealer_id_fkey"
      columns: ["dealer_id"]
isOneToOne: false
      referencedRelation: "dealers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "commissions_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "commissions_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "v_project_inventory"
      referencedColumns: ["project_id"]
    },{
      foreignKeyName: "commissions_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "commissions_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "v_sale_ledger"
      referencedColumns: ["sale_id"]
    },{
      foreignKeyName: "commissions_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "v_sale_summary"
      referencedColumns: ["sale_id"]
    }
                  ]
                },"company_settings": {
                  Row: {
                    "address": string | null,"company_name": string,"default_lease_commission_pct": number,"default_rent_increment_pct": number,"default_sale_commission_pct": number,"discount_approval_threshold_pct": number,"email": string | null,"id": boolean,"logo_path": string | null,"partner_name": string,"phone": string | null,"updated_at": string,"website": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"company_name"?: string,"default_lease_commission_pct"?: number,"default_rent_increment_pct"?: number,"default_sale_commission_pct"?: number,"discount_approval_threshold_pct"?: number,"email"?: string | null,"id"?: boolean,"logo_path"?: string | null,"partner_name"?: string,"phone"?: string | null,"updated_at"?: string,"website"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"company_name"?: string,"default_lease_commission_pct"?: number,"default_rent_increment_pct"?: number,"default_sale_commission_pct"?: number,"discount_approval_threshold_pct"?: number,"email"?: string | null,"id"?: boolean,"logo_path"?: string | null,"partner_name"?: string,"phone"?: string | null,"updated_at"?: string,"website"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"dealers": {
                  Row: {
                    "agency": string | null,"cnic": string | null,"created_at": string,"created_by": string | null,"default_commission_pct": number | null,"deleted_at": string | null,"email": string | null,"id": string,"is_active": boolean,"name": string,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "agency"?: string | null,"cnic"?: string | null,"created_at"?: string,"created_by"?: string | null,"default_commission_pct"?: number | null,"deleted_at"?: string | null,"email"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "agency"?: string | null,"cnic"?: string | null,"created_at"?: string,"created_by"?: string | null,"default_commission_pct"?: number | null,"deleted_at"?: string | null,"email"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "dealers_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"doc_sequences": {
                  Row: {
                    "doc_type": string,"last_no": number,"project_id": string,"year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "doc_type": string,"last_no"?: number,"project_id": string,"year": number
                  }
                  Update: {
                    "doc_type"?: string,"last_no"?: number,"project_id"?: string,"year"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "doc_sequences_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "doc_sequences_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "v_project_inventory"
      referencedColumns: ["project_id"]
    }
                  ]
                },"document_templates": {
                  Row: {
                    "created_at": string,"created_by": string | null,"doc_type": Database["public"]['Enums']["document_type"],"id": string,"is_active": boolean,"project_id": string | null,"ref_prefix": string,"sections": NonNullable<Json>,"title": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"doc_type": Database["public"]['Enums']["document_type"],"id"?: string,"is_active"?: boolean,"project_id"?: string | null,"ref_prefix": string,"sections"?: NonNullable<Json>,"title": string,"version"?: number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"doc_type"?: Database["public"]['Enums']["document_type"],"id"?: string,"is_active"?: boolean,"project_id"?: string | null,"ref_prefix"?: string,"sections"?: NonNullable<Json>,"title"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "document_templates_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_templates_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "document_templates_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "v_project_inventory"
      referencedColumns: ["project_id"]
    }
                  ]
                },"floors": {
                  Row: {
                    "block_id": string,"created_at": string,"created_by": string | null,"deleted_at": string | null,"id": string,"label": string,"level": number,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "block_id": string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"id"?: string,"label": string,"level": number,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "block_id"?: string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"id"?: string,"label"?: string,"level"?: number,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "floors_block_id_fkey"
      columns: ["block_id"]
isOneToOne: false
      referencedRelation: "blocks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "floors_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"installments": {
                  Row: {
                    "amount_due": number,"amount_paid": number,"amount_pending": number,"created_at": string,"created_by": string | null,"days_overdue": number,"deleted_at": string | null,"due_date": string | null,"id": string,"label": string,"late_fee": number,"late_fee_paid": number,"sale_id": string,"seq": number,"status": Database["public"]['Enums']["installment_status"],"type": Database["public"]['Enums']["installment_type"],"updated_at": string,"waived_amount": number
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_due": number,"amount_paid"?: number,"amount_pending"?: number,"created_at"?: string,"created_by"?: string | null,"days_overdue"?: number,"deleted_at"?: string | null,"due_date"?: string | null,"id"?: string,"label": string,"late_fee"?: number,"late_fee_paid"?: number,"sale_id": string,"seq": number,"status"?: Database["public"]['Enums']["installment_status"],"type": Database["public"]['Enums']["installment_type"],"updated_at"?: string,"waived_amount"?: number
                  }
                  Update: {
                    "amount_due"?: number,"amount_paid"?: number,"amount_pending"?: number,"created_at"?: string,"created_by"?: string | null,"days_overdue"?: number,"deleted_at"?: string | null,"due_date"?: string | null,"id"?: string,"label"?: string,"late_fee"?: number,"late_fee_paid"?: number,"sale_id"?: string,"seq"?: number,"status"?: Database["public"]['Enums']["installment_status"],"type"?: Database["public"]['Enums']["installment_type"],"updated_at"?: string,"waived_amount"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "installments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "installments_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "installments_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "v_sale_ledger"
      referencedColumns: ["sale_id"]
    },{
      foreignKeyName: "installments_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "v_sale_summary"
      referencedColumns: ["sale_id"]
    }
                  ]
                },"payment_allocations": {
                  Row: {
                    "amount": number,"component": string,"created_at": string,"created_by": string | null,"id": string,"installment_id": string,"payment_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"component"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"installment_id": string,"payment_id": string
                  }
                  Update: {
                    "amount"?: number,"component"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"installment_id"?: string,"payment_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_allocations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_allocations_installment_id_fkey"
      columns: ["installment_id"]
isOneToOne: false
      referencedRelation: "installments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_allocations_installment_id_fkey"
      columns: ["installment_id"]
isOneToOne: false
      referencedRelation: "v_receivables"
      referencedColumns: ["installment_id"]
    },{
      foreignKeyName: "payment_allocations_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_plans": {
                  Row: {
                    "created_at": string,"created_by": string | null,"deleted_at": string | null,"down_payment_pct": number,"frequency": Database["public"]['Enums']["plan_frequency"] | null,"id": string,"installment_pct": number,"is_active": boolean,"is_default": boolean,"kind": Database["public"]['Enums']["plan_kind"],"name": string,"possession_pct": number,"project_id": string | null,"tenure_months": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"down_payment_pct"?: number,"frequency"?: Database["public"]['Enums']["plan_frequency"] | null,"id"?: string,"installment_pct"?: number,"is_active"?: boolean,"is_default"?: boolean,"kind": Database["public"]['Enums']["plan_kind"],"name": string,"possession_pct"?: number,"project_id"?: string | null,"tenure_months"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"down_payment_pct"?: number,"frequency"?: Database["public"]['Enums']["plan_frequency"] | null,"id"?: string,"installment_pct"?: number,"is_active"?: boolean,"is_default"?: boolean,"kind"?: Database["public"]['Enums']["plan_kind"],"name"?: string,"possession_pct"?: number,"project_id"?: string | null,"tenure_months"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_plans_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_plans_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_plans_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "v_project_inventory"
      referencedColumns: ["project_id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"bank_name": string | null,"bounced_reason": string | null,"cleared_on": string | null,"created_at": string,"created_by": string | null,"id": string,"instrument_date": string | null,"instrument_no": string | null,"instrument_status": Database["public"]['Enums']["instrument_status"],"mode": Database["public"]['Enums']["payment_mode"],"notes": string | null,"payer_client_id": string | null,"project_id": string,"receipt_no": string,"received_by": string | null,"received_on": string,"reversal_reason": string | null,"reversed_at": string | null,"reversed_by": string | null,"sale_id": string,"status": Database["public"]['Enums']["record_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"bank_name"?: string | null,"bounced_reason"?: string | null,"cleared_on"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"instrument_date"?: string | null,"instrument_no"?: string | null,"instrument_status"?: Database["public"]['Enums']["instrument_status"],"mode": Database["public"]['Enums']["payment_mode"],"notes"?: string | null,"payer_client_id"?: string | null,"project_id": string,"receipt_no": string,"received_by"?: string | null,"received_on": string,"reversal_reason"?: string | null,"reversed_at"?: string | null,"reversed_by"?: string | null,"sale_id": string,"status"?: Database["public"]['Enums']["record_status"],"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"bank_name"?: string | null,"bounced_reason"?: string | null,"cleared_on"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"instrument_date"?: string | null,"instrument_no"?: string | null,"instrument_status"?: Database["public"]['Enums']["instrument_status"],"mode"?: Database["public"]['Enums']["payment_mode"],"notes"?: string | null,"payer_client_id"?: string | null,"project_id"?: string,"receipt_no"?: string,"received_by"?: string | null,"received_on"?: string,"reversal_reason"?: string | null,"reversed_at"?: string | null,"reversed_by"?: string | null,"sale_id"?: string,"status"?: Database["public"]['Enums']["record_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_payer_client_id_fkey"
      columns: ["payer_client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_payer_client_id_fkey"
      columns: ["payer_client_id"]
isOneToOne: false
      referencedRelation: "v_receivables"
      referencedColumns: ["client_id"]
    },{
      foreignKeyName: "payments_payer_client_id_fkey"
      columns: ["payer_client_id"]
isOneToOne: false
      referencedRelation: "v_sale_summary"
      referencedColumns: ["primary_client_id"]
    },{
      foreignKeyName: "payments_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "v_project_inventory"
      referencedColumns: ["project_id"]
    },{
      foreignKeyName: "payments_received_by_fkey"
      columns: ["received_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_reversed_by_fkey"
      columns: ["reversed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "v_sale_ledger"
      referencedColumns: ["sale_id"]
    },{
      foreignKeyName: "payments_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "v_sale_summary"
      referencedColumns: ["sale_id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string | null,"full_name": string,"id": string,"is_active": boolean,"phone": string | null,"role": Database["public"]['Enums']["app_role"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"full_name": string,"id": string,"is_active"?: boolean,"phone"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string,"id"?: string,"is_active"?: boolean,"phone"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"project_document_settings": {
                  Row: {
                    "allotment_countersign_days": number | null,"approval_noc_ref": string | null,"delay_compensation_basis": string | null,"discrepancy_report_days": number | null,"display_name": string | null,"dispute_window_days": number,"execution_city": string | null,"full_address": string | null,"letterhead_bottom_mm": number,"letterhead_head_left_mm": number | null,"letterhead_head_top_mm": number | null,"letterhead_left_mm": number,"letterhead_path": string | null,"letterhead_right_mm": number,"letterhead_top_mm": number,"managing_director_name": string | null,"marketed_by": string,"ndc_validity_days": number,"possession_timeline": string | null,"project_id": string,"refund_days_after_resale": number | null,"seller_account_title": string | null,"seller_legal_name": string,"seller_legal_status": string | null,"seller_ntn": string | null,"seller_office_address": string | null,"signatory_cnic": string | null,"signatory_name": string | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "allotment_countersign_days"?: number | null,"approval_noc_ref"?: string | null,"delay_compensation_basis"?: string | null,"discrepancy_report_days"?: number | null,"display_name"?: string | null,"dispute_window_days"?: number,"execution_city"?: string | null,"full_address"?: string | null,"letterhead_bottom_mm"?: number,"letterhead_head_left_mm"?: number | null,"letterhead_head_top_mm"?: number | null,"letterhead_left_mm"?: number,"letterhead_path"?: string | null,"letterhead_right_mm"?: number,"letterhead_top_mm"?: number,"managing_director_name"?: string | null,"marketed_by"?: string,"ndc_validity_days"?: number,"possession_timeline"?: string | null,"project_id": string,"refund_days_after_resale"?: number | null,"seller_account_title"?: string | null,"seller_legal_name"?: string,"seller_legal_status"?: string | null,"seller_ntn"?: string | null,"seller_office_address"?: string | null,"signatory_cnic"?: string | null,"signatory_name"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "allotment_countersign_days"?: number | null,"approval_noc_ref"?: string | null,"delay_compensation_basis"?: string | null,"discrepancy_report_days"?: number | null,"display_name"?: string | null,"dispute_window_days"?: number,"execution_city"?: string | null,"full_address"?: string | null,"letterhead_bottom_mm"?: number,"letterhead_head_left_mm"?: number | null,"letterhead_head_top_mm"?: number | null,"letterhead_left_mm"?: number,"letterhead_path"?: string | null,"letterhead_right_mm"?: number,"letterhead_top_mm"?: number,"managing_director_name"?: string | null,"marketed_by"?: string,"ndc_validity_days"?: number,"possession_timeline"?: string | null,"project_id"?: string,"refund_days_after_resale"?: number | null,"seller_account_title"?: string | null,"seller_legal_name"?: string,"seller_legal_status"?: string | null,"seller_ntn"?: string | null,"seller_office_address"?: string | null,"signatory_cnic"?: string | null,"signatory_name"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_document_settings_project_id_fkey"
      columns: ["project_id"]
isOneToOne: true
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_document_settings_project_id_fkey"
      columns: ["project_id"]
isOneToOne: true
      referencedRelation: "v_project_inventory"
      referencedColumns: ["project_id"]
    },{
      foreignKeyName: "project_document_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"projects": {
                  Row: {
                    "cancel_after_consecutive_missed": number | null,"cancellation_deduction_pct": number | null,"code": string,"construction_min_paid_pct": number | null,"corner_premium_pct": number,"cover_image_path": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"description": string | null,"down_payment_balance_days": number | null,"full_payment_discount_pct": number | null,"full_payment_possession_charge_pct": number,"id": string,"is_active": boolean,"late_fee_cap_pct": number | null,"late_fee_grace_days": number,"late_fee_method": Database["public"]['Enums']["late_fee_method"],"late_fee_rate": number,"location": string | null,"logo_path": string | null,"marla_per_kanal": number,"name": string,"sort_order": number,"sqft_per_marla": number,"status": Database["public"]['Enums']["project_status"],"type": Database["public"]['Enums']["project_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_after_consecutive_missed"?: number | null,"cancellation_deduction_pct"?: number | null,"code": string,"construction_min_paid_pct"?: number | null,"corner_premium_pct"?: number,"cover_image_path"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"description"?: string | null,"down_payment_balance_days"?: number | null,"full_payment_discount_pct"?: number | null,"full_payment_possession_charge_pct"?: number,"id"?: string,"is_active"?: boolean,"late_fee_cap_pct"?: number | null,"late_fee_grace_days"?: number,"late_fee_method"?: Database["public"]['Enums']["late_fee_method"],"late_fee_rate"?: number,"location"?: string | null,"logo_path"?: string | null,"marla_per_kanal"?: number,"name": string,"sort_order"?: number,"sqft_per_marla"?: number,"status"?: Database["public"]['Enums']["project_status"],"type": Database["public"]['Enums']["project_type"],"updated_at"?: string
                  }
                  Update: {
                    "cancel_after_consecutive_missed"?: number | null,"cancellation_deduction_pct"?: number | null,"code"?: string,"construction_min_paid_pct"?: number | null,"corner_premium_pct"?: number,"cover_image_path"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"description"?: string | null,"down_payment_balance_days"?: number | null,"full_payment_discount_pct"?: number | null,"full_payment_possession_charge_pct"?: number,"id"?: string,"is_active"?: boolean,"late_fee_cap_pct"?: number | null,"late_fee_grace_days"?: number,"late_fee_method"?: Database["public"]['Enums']["late_fee_method"],"late_fee_rate"?: number,"location"?: string | null,"logo_path"?: string | null,"marla_per_kanal"?: number,"name"?: string,"sort_order"?: number,"sqft_per_marla"?: number,"status"?: Database["public"]['Enums']["project_status"],"type"?: Database["public"]['Enums']["project_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "projects_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"sale_buyers": {
                  Row: {
                    "client_id": string,"created_at": string,"is_primary": boolean,"sale_id": string,"share_pct": number
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"is_primary"?: boolean,"sale_id": string,"share_pct": number
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"is_primary"?: boolean,"sale_id"?: string,"share_pct"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "sale_buyers_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sale_buyers_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "v_receivables"
      referencedColumns: ["client_id"]
    },{
      foreignKeyName: "sale_buyers_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "v_sale_summary"
      referencedColumns: ["primary_client_id"]
    },{
      foreignKeyName: "sale_buyers_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sale_buyers_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "v_sale_ledger"
      referencedColumns: ["sale_id"]
    },{
      foreignKeyName: "sale_buyers_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "v_sale_summary"
      referencedColumns: ["sale_id"]
    }
                  ]
                },"sales": {
                  Row: {
                    "agent_id": string | null,"booking_amount": number | null,"booking_date": string,"booking_form_no": string,"cancellation_due": boolean,"commission_pct": number,"created_at": string,"created_by": string | null,"dealer_id": string | null,"deleted_at": string | null,"discount": number,"down_payment_pct": number | null,"final_price": number | null,"first_installment_date": string | null,"frequency": Database["public"]['Enums']["plan_frequency"] | null,"id": string,"installment_pct": number | null,"is_custom_schedule": boolean,"list_price": number,"notes": string | null,"payment_plan_id": string | null,"plan_kind": Database["public"]['Enums']["plan_kind"],"possession_pct": number | null,"project_id": string,"status": Database["public"]['Enums']["sale_status"],"tenure_months": number | null,"unit_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "agent_id"?: string | null,"booking_amount"?: number | null,"booking_date": string,"booking_form_no": string,"cancellation_due"?: boolean,"commission_pct"?: number,"created_at"?: string,"created_by"?: string | null,"dealer_id"?: string | null,"deleted_at"?: string | null,"discount"?: number,"down_payment_pct"?: number | null,"final_price"?: never,"first_installment_date"?: string | null,"frequency"?: Database["public"]['Enums']["plan_frequency"] | null,"id"?: string,"installment_pct"?: number | null,"is_custom_schedule"?: boolean,"list_price": number,"notes"?: string | null,"payment_plan_id"?: string | null,"plan_kind": Database["public"]['Enums']["plan_kind"],"possession_pct"?: number | null,"project_id": string,"status"?: Database["public"]['Enums']["sale_status"],"tenure_months"?: number | null,"unit_id": string,"updated_at"?: string
                  }
                  Update: {
                    "agent_id"?: string | null,"booking_amount"?: number | null,"booking_date"?: string,"booking_form_no"?: string,"cancellation_due"?: boolean,"commission_pct"?: number,"created_at"?: string,"created_by"?: string | null,"dealer_id"?: string | null,"deleted_at"?: string | null,"discount"?: number,"down_payment_pct"?: number | null,"final_price"?: never,"first_installment_date"?: string | null,"frequency"?: Database["public"]['Enums']["plan_frequency"] | null,"id"?: string,"installment_pct"?: number | null,"is_custom_schedule"?: boolean,"list_price"?: number,"notes"?: string | null,"payment_plan_id"?: string | null,"plan_kind"?: Database["public"]['Enums']["plan_kind"],"possession_pct"?: number | null,"project_id"?: string,"status"?: Database["public"]['Enums']["sale_status"],"tenure_months"?: number | null,"unit_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sales_agent_id_fkey"
      columns: ["agent_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_dealer_id_fkey"
      columns: ["dealer_id"]
isOneToOne: false
      referencedRelation: "dealers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_payment_plan_id_fkey"
      columns: ["payment_plan_id"]
isOneToOne: false
      referencedRelation: "payment_plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "v_project_inventory"
      referencedColumns: ["project_id"]
    },{
      foreignKeyName: "sales_unit_id_fkey"
      columns: ["unit_id"]
isOneToOne: false
      referencedRelation: "units"
      referencedColumns: ["id"]
    }
                  ]
                },"unit_ownerships": {
                  Row: {
                    "acquired_via": Database["public"]['Enums']["ownership_via"],"client_id": string,"created_at": string,"created_by": string | null,"id": string,"sale_id": string,"share_pct": number,"transfer_id": string | null,"unit_id": string,"valid_from": string,"valid_to": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "acquired_via": Database["public"]['Enums']["ownership_via"],"client_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"sale_id": string,"share_pct": number,"transfer_id"?: string | null,"unit_id": string,"valid_from": string,"valid_to"?: string | null
                  }
                  Update: {
                    "acquired_via"?: Database["public"]['Enums']["ownership_via"],"client_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"sale_id"?: string,"share_pct"?: number,"transfer_id"?: string | null,"unit_id"?: string,"valid_from"?: string,"valid_to"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "unit_ownerships_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "unit_ownerships_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "v_receivables"
      referencedColumns: ["client_id"]
    },{
      foreignKeyName: "unit_ownerships_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "v_sale_summary"
      referencedColumns: ["primary_client_id"]
    },{
      foreignKeyName: "unit_ownerships_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "unit_ownerships_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "unit_ownerships_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "v_sale_ledger"
      referencedColumns: ["sale_id"]
    },{
      foreignKeyName: "unit_ownerships_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "v_sale_summary"
      referencedColumns: ["sale_id"]
    },{
      foreignKeyName: "unit_ownerships_unit_id_fkey"
      columns: ["unit_id"]
isOneToOne: false
      referencedRelation: "units"
      referencedColumns: ["id"]
    }
                  ]
                },"units": {
                  Row: {
                    "area_sqft": number,"base_price": number,"cash_price": number | null,"bathrooms": number | null,"bedrooms": number | null,"block_id": string | null,"category": Database["public"]['Enums']["unit_category"],"created_at": string,"created_by": string | null,"deleted_at": string | null,"depth_ft": number | null,"floor_id": string | null,"id": string,"is_corner": boolean,"is_main_boulevard": boolean,"is_park_facing": boolean,"notes": string | null,"price_per_sqft": number | null,"project_id": string,"size_unit": Database["public"]['Enums']["size_unit"],"size_value": number,"status": Database["public"]['Enums']["unit_status"],"street": string | null,"unit_no": string,"updated_at": string,"use": Database["public"]['Enums']["unit_use"],"width_ft": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "area_sqft"?: number,"base_price": number,"cash_price"?: number | null,"bathrooms"?: number | null,"bedrooms"?: number | null,"block_id"?: string | null,"category": Database["public"]['Enums']["unit_category"],"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"depth_ft"?: number | null,"floor_id"?: string | null,"id"?: string,"is_corner"?: boolean,"is_main_boulevard"?: boolean,"is_park_facing"?: boolean,"notes"?: string | null,"price_per_sqft"?: number | null,"project_id": string,"size_unit": Database["public"]['Enums']["size_unit"],"size_value": number,"status"?: Database["public"]['Enums']["unit_status"],"street"?: string | null,"unit_no": string,"updated_at"?: string,"use": Database["public"]['Enums']["unit_use"],"width_ft"?: number | null
                  }
                  Update: {
                    "area_sqft"?: number,"base_price"?: number,"cash_price"?: number | null,"bathrooms"?: number | null,"bedrooms"?: number | null,"block_id"?: string | null,"category"?: Database["public"]['Enums']["unit_category"],"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"depth_ft"?: number | null,"floor_id"?: string | null,"id"?: string,"is_corner"?: boolean,"is_main_boulevard"?: boolean,"is_park_facing"?: boolean,"notes"?: string | null,"price_per_sqft"?: number | null,"project_id"?: string,"size_unit"?: Database["public"]['Enums']["size_unit"],"size_value"?: number,"status"?: Database["public"]['Enums']["unit_status"],"street"?: string | null,"unit_no"?: string,"updated_at"?: string,"use"?: Database["public"]['Enums']["unit_use"],"width_ft"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "units_block_id_fkey"
      columns: ["block_id"]
isOneToOne: false
      referencedRelation: "blocks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "units_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "units_floor_id_fkey"
      columns: ["floor_id"]
isOneToOne: false
      referencedRelation: "floors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "units_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "units_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "v_project_inventory"
      referencedColumns: ["project_id"]
    }
                  ]
                },"user_project_access": {
                  Row: {
                    "created_at": string,"project_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"project_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"project_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_project_access_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_project_access_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "v_project_inventory"
      referencedColumns: ["project_id"]
    },{
      foreignKeyName: "user_project_access_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "v_project_inventory": {
                  Row: {
                    "available": number | null,"blocked": number | null,"booked": number | null,"code": string | null,"name": string | null,"on_hold": number | null,"project_id": string | null,"project_status": Database["public"]['Enums']["project_status"] | null,"rented": number | null,"sold": number | null,"sort_order": number | null,"total_area_sqft": number | null,"total_list_value": number | null,"total_units": number | null,"type": Database["public"]['Enums']["project_type"] | null,"unsold_inventory_value": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_receivables": {
                  Row: {
                    "aging_bucket": string | null,"amount_pending": number | null,"client_id": string | null,"client_name": string | null,"client_phone": string | null,"client_whatsapp": string | null,"days_overdue": number | null,"due_date": string | null,"installment_id": string | null,"label": string | null,"late_fee_outstanding": number | null,"outstanding": number | null,"principal_outstanding": number | null,"project_code": string | null,"project_id": string | null,"project_name": string | null,"sale_id": string | null,"seq": number | null,"status": Database["public"]['Enums']["installment_status"] | null,"type": Database["public"]['Enums']["installment_type"] | null,"unit_id": string | null,"unit_no": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "installments_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "installments_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "v_sale_ledger"
      referencedColumns: ["sale_id"]
    },{
      foreignKeyName: "installments_sale_id_fkey"
      columns: ["sale_id"]
isOneToOne: false
      referencedRelation: "v_sale_summary"
      referencedColumns: ["sale_id"]
    },{
      foreignKeyName: "sales_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "v_project_inventory"
      referencedColumns: ["project_id"]
    },{
      foreignKeyName: "sales_unit_id_fkey"
      columns: ["unit_id"]
isOneToOne: false
      referencedRelation: "units"
      referencedColumns: ["id"]
    }
                  ]
                },"v_sale_ledger": {
                  Row: {
                    "balance": number | null,"final_price": number | null,"max_days_overdue": number | null,"next_due_date": string | null,"overdue_amount": number | null,"pct_paid": number | null,"project_id": string | null,"sale_id": string | null,"total_late_fee": number | null,"total_late_fee_paid": number | null,"total_paid": number | null,"total_pending": number | null,"total_waived": number | null,"unit_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "sales_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "v_project_inventory"
      referencedColumns: ["project_id"]
    },{
      foreignKeyName: "sales_unit_id_fkey"
      columns: ["unit_id"]
isOneToOne: false
      referencedRelation: "units"
      referencedColumns: ["id"]
    }
                  ]
                },"v_sale_summary": {
                  Row: {
                    "agent_id": string | null,"agent_name": string | null,"balance": number | null,"block_name": string | null,"booking_date": string | null,"booking_form_no": string | null,"buyer_count": number | null,"cancellation_due": boolean | null,"category": Database["public"]['Enums']["unit_category"] | null,"discount": number | null,"final_price": number | null,"floor_label": string | null,"next_due_date": string | null,"overdue_amount": number | null,"pct_paid": number | null,"plan_kind": Database["public"]['Enums']["plan_kind"] | null,"primary_client_cnic": string | null,"primary_client_id": string | null,"primary_client_name": string | null,"primary_client_phone": string | null,"project_code": string | null,"project_id": string | null,"project_name": string | null,"sale_id": string | null,"status": Database["public"]['Enums']["sale_status"] | null,"street": string | null,"total_late_fee": number | null,"total_paid": number | null,"unit_id": string | null,"unit_no": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "sales_agent_id_fkey"
      columns: ["agent_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sales_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "v_project_inventory"
      referencedColumns: ["project_id"]
    },{
      foreignKeyName: "sales_unit_id_fkey"
      columns: ["unit_id"]
isOneToOne: false
      referencedRelation: "units"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "allocate_payment":
{ Args: { "p_payment": string }; Returns: undefined
                           },
"bounce_instrument":
{ Args: { "p_payment": string,"p_reason": string }; Returns: undefined
                           },
"clear_instrument":
{ Args: { "p_cleared_on"?: string,"p_payment": string }; Returns: undefined
                           },
"client_exists":
{ Args: { "p_cnic"?: string,"p_passport"?: string }; Returns: boolean
                           },
"create_sale":
{ Args: { "p": Json }; Returns: {
              "agent_id": string | null,
"booking_amount": number | null,
"booking_date": string,
"booking_form_no": string,
"cancellation_due": boolean,
"commission_pct": number,
"created_at": string,
"created_by": string | null,
"dealer_id": string | null,
"deleted_at": string | null,
"discount": number,
"down_payment_pct": number | null,
"final_price": number | null,
"first_installment_date": string | null,
"frequency": Database["public"]['Enums']["plan_frequency"] | null,
"id": string,
"installment_pct": number | null,
"is_custom_schedule": boolean,
"list_price": number,
"notes": string | null,
"payment_plan_id": string | null,
"plan_kind": Database["public"]['Enums']["plan_kind"],
"possession_pct": number | null,
"project_id": string,
"status": Database["public"]['Enums']["sale_status"],
"tenure_months": number | null,
"unit_id": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "sales"
        isOneToOne: true
        isSetofReturn: false
      } },
"generate_installment_schedule":
{ Args: { "p_reason"?: string,"p_sale": string }; Returns: {
              "amount_due": number,
"amount_paid": number,
"amount_pending": number,
"created_at": string,
"created_by": string | null,
"days_overdue": number,
"deleted_at": string | null,
"due_date": string | null,
"id": string,
"label": string,
"late_fee": number,
"late_fee_paid": number,
"sale_id": string,
"seq": number,
"status": Database["public"]['Enums']["installment_status"],
"type": Database["public"]['Enums']["installment_type"],
"updated_at": string,
"waived_amount": number
            }[]
                          SetofOptions: {
        from: "*"
        to: "installments"
        isOneToOne: false
        isSetofReturn: true
      } },
"global_search":
{ Args: { "p_limit"?: number,"p_q": string }; Returns: {
              "id": string,"kind": string,"project_id": string,"subtitle": string,"title": string
            }[]
                           },
"install_document_templates":
{ Args: { "p_project_id": string,"p_set": string }; Returns: number
                           },
"mark_overdue":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"next_doc_no":
{ Args: { "p_doc_type": string,"p_project": string }; Returns: string
                           },
"record_payment":
{ Args: { "p": Json }; Returns: {
              "amount": number,
"bank_name": string | null,
"bounced_reason": string | null,
"cleared_on": string | null,
"created_at": string,
"created_by": string | null,
"id": string,
"instrument_date": string | null,
"instrument_no": string | null,
"instrument_status": Database["public"]['Enums']["instrument_status"],
"mode": Database["public"]['Enums']["payment_mode"],
"notes": string | null,
"payer_client_id": string | null,
"project_id": string,
"receipt_no": string,
"received_by": string | null,
"received_on": string,
"reversal_reason": string | null,
"reversed_at": string | null,
"reversed_by": string | null,
"sale_id": string,
"status": Database["public"]['Enums']["record_status"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "payments"
        isOneToOne: true
        isSetofReturn: false
      } },
"reverse_payment":
{ Args: { "p_payment": string,"p_reason": string }; Returns: undefined
                           },
"save_document_template":
{ Args: { "p_doc_type": Database["public"]['Enums']["document_type"],"p_project_id": string,"p_reason": string,"p_ref_prefix": string,"p_sections": Json,"p_title": string }; Returns: {
              "created_at": string,
"created_by": string | null,
"doc_type": Database["public"]['Enums']["document_type"],
"id": string,
"is_active": boolean,
"project_id": string | null,
"ref_prefix": string,
"sections": NonNullable<Json>,
"title": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "document_templates"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_payment_allocations":
{ Args: { "p_alloc": Json,"p_payment": string,"p_reason": string }; Returns: undefined
                           },
"soft_delete":
{ Args: { "p_id": string,"p_reason": string,"p_table": string }; Returns: undefined
                           },
"update_unit":
{ Args: { "p_id": string,"p_patch": Json,"p_reason"?: string }; Returns: {
              "area_sqft": number,
"base_price": number,
"bathrooms": number | null,
"bedrooms": number | null,
"block_id": string | null,
"category": Database["public"]['Enums']["unit_category"],
"created_at": string,
"created_by": string | null,
"deleted_at": string | null,
"depth_ft": number | null,
"floor_id": string | null,
"id": string,
"is_corner": boolean,
"is_main_boulevard": boolean,
"is_park_facing": boolean,
"notes": string | null,
"price_per_sqft": number | null,
"project_id": string,
"size_unit": Database["public"]['Enums']["size_unit"],
"size_value": number,
"status": Database["public"]['Enums']["unit_status"],
"street": string | null,
"unit_no": string,
"updated_at": string,
"use": Database["public"]['Enums']["unit_use"],
"width_ft": number | null
            }
                          SetofOptions: {
        from: "*"
        to: "units"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "app_role": "super_admin"|"manager"|"sales_agent"|"accounts"|"viewer"|"client","audit_action": "insert"|"update"|"delete","block_kind": "block"|"tower"|"phase"|"sector","commission_status": "pending"|"partially_received"|"received"|"cancelled","document_type": "booking_form"|"allotment_letter"|"sale_agreement"|"installment_schedule"|"possession_letter"|"ndc_letter"|"payment_receipt"|"transfer_letter"|"statement_of_account","installment_status": "pending"|"partially_paid"|"paid"|"overdue"|"waived","installment_type": "down_payment"|"installment"|"possession"|"balloon"|"other","instrument_status": "not_applicable"|"pending"|"cleared"|"bounced","late_fee_method": "none"|"flat_per_installment"|"pct_of_overdue_per_month"|"pct_per_day","ownership_via": "booking"|"transfer"|"correction","payment_mode": "cash"|"cheque"|"pay_order"|"bank_transfer"|"online","plan_frequency": "monthly"|"quarterly"|"bi_annual"|"annual","plan_kind": "full_cash"|"installment","project_status": "off_plan"|"under_construction"|"completed","project_type": "plot_society"|"high_rise","record_status": "valid"|"reversed","sale_status": "booked"|"active"|"completed"|"cancelled"|"transferred","size_unit": "marla"|"kanal"|"sqft","unit_category": "plot"|"apartment"|"shop"|"office"|"penthouse"|"other","unit_status": "available"|"on_hold"|"booked"|"sold"|"rented"|"blocked","unit_use": "residential"|"commercial"
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
            "app_role": ["super_admin", "manager", "sales_agent", "accounts", "viewer", "client"],"audit_action": ["insert", "update", "delete"],"block_kind": ["block", "tower", "phase", "sector"],"commission_status": ["pending", "partially_received", "received", "cancelled"],"document_type": ["booking_form", "allotment_letter", "sale_agreement", "installment_schedule", "possession_letter", "ndc_letter", "payment_receipt", "transfer_letter", "statement_of_account"],"installment_status": ["pending", "partially_paid", "paid", "overdue", "waived"],"installment_type": ["down_payment", "installment", "possession", "balloon", "other"],"instrument_status": ["not_applicable", "pending", "cleared", "bounced"],"late_fee_method": ["none", "flat_per_installment", "pct_of_overdue_per_month", "pct_per_day"],"ownership_via": ["booking", "transfer", "correction"],"payment_mode": ["cash", "cheque", "pay_order", "bank_transfer", "online"],"plan_frequency": ["monthly", "quarterly", "bi_annual", "annual"],"plan_kind": ["full_cash", "installment"],"project_status": ["off_plan", "under_construction", "completed"],"project_type": ["plot_society", "high_rise"],"record_status": ["valid", "reversed"],"sale_status": ["booked", "active", "completed", "cancelled", "transferred"],"size_unit": ["marla", "kanal", "sqft"],"unit_category": ["plot", "apartment", "shop", "office", "penthouse", "other"],"unit_status": ["available", "on_hold", "booked", "sold", "rented", "blocked"],"unit_use": ["residential", "commercial"]
          }
        }
} as const
