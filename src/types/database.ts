
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
    }
                  ]
                },"clients": {
                  Row: {
                    "address": string | null,"auth_user_id": string | null,"city": string | null,"cnic": string | null,"cnic_back_path": string | null,"cnic_front_path": string | null,"country": string,"created_at": string,"created_by": string | null,"deleted_at": string | null,"email": string | null,"full_name": string,"guardian_name": string | null,"id": string,"is_overseas": boolean,"nationality": string,"nok_cnic": string | null,"nok_name": string | null,"nok_phone": string | null,"nok_relation": string | null,"notes": string | null,"passport_no": string | null,"phone": string,"photo_path": string | null,"relation_type": string | null,"updated_at": string,"whatsapp": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"auth_user_id"?: string | null,"city"?: string | null,"cnic"?: string | null,"cnic_back_path"?: string | null,"cnic_front_path"?: string | null,"country"?: string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"email"?: string | null,"full_name": string,"guardian_name"?: string | null,"id"?: string,"is_overseas"?: boolean,"nationality"?: string,"nok_cnic"?: string | null,"nok_name"?: string | null,"nok_phone"?: string | null,"nok_relation"?: string | null,"notes"?: string | null,"passport_no"?: string | null,"phone": string,"photo_path"?: string | null,"relation_type"?: string | null,"updated_at"?: string,"whatsapp"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"auth_user_id"?: string | null,"city"?: string | null,"cnic"?: string | null,"cnic_back_path"?: string | null,"cnic_front_path"?: string | null,"country"?: string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"email"?: string | null,"full_name"?: string,"guardian_name"?: string | null,"id"?: string,"is_overseas"?: boolean,"nationality"?: string,"nok_cnic"?: string | null,"nok_name"?: string | null,"nok_phone"?: string | null,"nok_relation"?: string | null,"notes"?: string | null,"passport_no"?: string | null,"phone"?: string,"photo_path"?: string | null,"relation_type"?: string | null,"updated_at"?: string,"whatsapp"?: string | null
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
                },"projects": {
                  Row: {
                    "code": string,"cover_image_path": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"description": string | null,"id": string,"is_active": boolean,"late_fee_cap_pct": number | null,"late_fee_grace_days": number,"late_fee_method": Database["public"]['Enums']["late_fee_method"],"late_fee_rate": number,"location": string | null,"logo_path": string | null,"marla_per_kanal": number,"name": string,"sort_order": number,"sqft_per_marla": number,"status": Database["public"]['Enums']["project_status"],"type": Database["public"]['Enums']["project_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"cover_image_path"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"description"?: string | null,"id"?: string,"is_active"?: boolean,"late_fee_cap_pct"?: number | null,"late_fee_grace_days"?: number,"late_fee_method"?: Database["public"]['Enums']["late_fee_method"],"late_fee_rate"?: number,"location"?: string | null,"logo_path"?: string | null,"marla_per_kanal"?: number,"name": string,"sort_order"?: number,"sqft_per_marla"?: number,"status"?: Database["public"]['Enums']["project_status"],"type": Database["public"]['Enums']["project_type"],"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"cover_image_path"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"description"?: string | null,"id"?: string,"is_active"?: boolean,"late_fee_cap_pct"?: number | null,"late_fee_grace_days"?: number,"late_fee_method"?: Database["public"]['Enums']["late_fee_method"],"late_fee_rate"?: number,"location"?: string | null,"logo_path"?: string | null,"marla_per_kanal"?: number,"name"?: string,"sort_order"?: number,"sqft_per_marla"?: number,"status"?: Database["public"]['Enums']["project_status"],"type"?: Database["public"]['Enums']["project_type"],"updated_at"?: string
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
                },"units": {
                  Row: {
                    "area_sqft": number,"base_price": number,"bathrooms": number | null,"bedrooms": number | null,"block_id": string | null,"category": Database["public"]['Enums']["unit_category"],"created_at": string,"created_by": string | null,"deleted_at": string | null,"floor_id": string | null,"id": string,"is_corner": boolean,"is_main_boulevard": boolean,"is_park_facing": boolean,"notes": string | null,"price_per_sqft": number | null,"project_id": string,"size_unit": Database["public"]['Enums']["size_unit"],"size_value": number,"status": Database["public"]['Enums']["unit_status"],"street": string | null,"unit_no": string,"updated_at": string,"use": Database["public"]['Enums']["unit_use"]
                  }
                  ComputedFields: never
                  Insert: {
                    "area_sqft"?: number,"base_price": number,"bathrooms"?: number | null,"bedrooms"?: number | null,"block_id"?: string | null,"category": Database["public"]['Enums']["unit_category"],"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"floor_id"?: string | null,"id"?: string,"is_corner"?: boolean,"is_main_boulevard"?: boolean,"is_park_facing"?: boolean,"notes"?: string | null,"price_per_sqft"?: number | null,"project_id": string,"size_unit": Database["public"]['Enums']["size_unit"],"size_value": number,"status"?: Database["public"]['Enums']["unit_status"],"street"?: string | null,"unit_no": string,"updated_at"?: string,"use": Database["public"]['Enums']["unit_use"]
                  }
                  Update: {
                    "area_sqft"?: number,"base_price"?: number,"bathrooms"?: number | null,"bedrooms"?: number | null,"block_id"?: string | null,"category"?: Database["public"]['Enums']["unit_category"],"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"floor_id"?: string | null,"id"?: string,"is_corner"?: boolean,"is_main_boulevard"?: boolean,"is_park_facing"?: boolean,"notes"?: string | null,"price_per_sqft"?: number | null,"project_id"?: string,"size_unit"?: Database["public"]['Enums']["size_unit"],"size_value"?: number,"status"?: Database["public"]['Enums']["unit_status"],"street"?: string | null,"unit_no"?: string,"updated_at"?: string,"use"?: Database["public"]['Enums']["unit_use"]
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
            [_ in never]: never
          }
          Functions: {
            "client_exists":
{ Args: { "p_cnic"?: string,"p_passport"?: string }; Returns: boolean
                           }
          }
          Enums: {
            "app_role": "super_admin"|"manager"|"sales_agent"|"accounts"|"viewer"|"client","audit_action": "insert"|"update"|"delete","block_kind": "block"|"tower"|"phase"|"sector","late_fee_method": "none"|"flat_per_installment"|"pct_of_overdue_per_month"|"pct_per_day","project_status": "off_plan"|"under_construction"|"completed","project_type": "plot_society"|"high_rise","size_unit": "marla"|"kanal"|"sqft","unit_category": "plot"|"apartment"|"shop"|"office"|"penthouse"|"other","unit_status": "available"|"on_hold"|"booked"|"sold"|"rented"|"blocked","unit_use": "residential"|"commercial"
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
            "app_role": ["super_admin", "manager", "sales_agent", "accounts", "viewer", "client"],"audit_action": ["insert", "update", "delete"],"block_kind": ["block", "tower", "phase", "sector"],"late_fee_method": ["none", "flat_per_installment", "pct_of_overdue_per_month", "pct_per_day"],"project_status": ["off_plan", "under_construction", "completed"],"project_type": ["plot_society", "high_rise"],"size_unit": ["marla", "kanal", "sqft"],"unit_category": ["plot", "apartment", "shop", "office", "penthouse", "other"],"unit_status": ["available", "on_hold", "booked", "sold", "rented", "blocked"],"unit_use": ["residential", "commercial"]
          }
        }
} as const
