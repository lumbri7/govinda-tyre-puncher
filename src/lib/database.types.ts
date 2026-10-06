export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type AppRole = 'owner' | 'employee'
export type VehicleType = 'bike' | 'car' | 'small_truck' | 'large_truck' | 'tractor' | 'other'
export type BillItemType = 'service' | 'part' | 'custom'
export type SalaryPaymentStatus = 'pending' | 'confirmed' | 'cancelled'

export type Database = {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string
          name: string
          bill_prefix: string
          timezone: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          bill_prefix?: string
          timezone?: string
          created_at?: string
          updated_at?: string
        }
        Update: { name?: string; bill_prefix?: string; timezone?: string; updated_at?: string }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          business_id: string
          role: AppRole
          full_name: string
          phone: string | null
          email: string | null
          is_active: boolean
          /** Set when a password changes: sessions issued earlier are refused. */
          session_invalid_before: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          business_id: string
          role: AppRole
          full_name: string
          phone?: string | null
          email?: string | null
          is_active?: boolean
          session_invalid_before?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          full_name?: string
          phone?: string | null
          email?: string | null
          is_active?: boolean
          session_invalid_before?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          id: string
          business_id: string
          user_id: string
          monthly_salary: number
          is_active: boolean
          joined_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          user_id: string
          monthly_salary?: number
          is_active?: boolean
          joined_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: { monthly_salary?: number; is_active?: boolean; joined_at?: string; updated_at?: string }
        Relationships: []
      }
      bills: {
        Row: {
          id: string
          business_id: string
          bill_number: string
          created_by: string
          customer_name: string
          vehicle_type: VehicleType
          vehicle_number: string
          vehicle_description: string | null
          customer_phone: string | null
          service_total: number
          parts_total: number
          custom_items_total: number
          grand_total: number
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          bill_number: string
          created_by: string
          customer_name: string
          vehicle_type: VehicleType
          vehicle_number: string
          vehicle_description?: string | null
          customer_phone?: string | null
          service_total?: number
          parts_total?: number
          custom_items_total?: number
          grand_total?: number
          created_at?: string
        }
        Update: never
        Relationships: []
      }
      bill_items: {
        Row: {
          id: string
          bill_id: string
          business_id: string
          item_type: BillItemType
          name: string
          quantity: number
          unit_price: number
          line_total: number
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          bill_id: string
          business_id: string
          item_type: BillItemType
          name: string
          quantity: number
          unit_price: number
          line_total: number
          sort_order?: number
          created_at?: string
        }
        Update: never
        Relationships: []
      }
      salary_payments: {
        Row: {
          id: string
          business_id: string
          employee_id: string
          amount: number
          payment_date: string
          status: SalaryPaymentStatus
          acknowledged_at: string | null
          note: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          employee_id: string
          amount: number
          payment_date: string
          status?: SalaryPaymentStatus
          acknowledged_at?: string | null
          note?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: { status?: SalaryPaymentStatus; acknowledged_at?: string | null; note?: string | null }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          business_id: string
          user_id: string
          type: 'salary_payment_recorded' | 'salary_payment_accepted' | 'salary_payment_cancelled' | 'employee_joined'
          title: string
          message: string
          related_id: string | null
          is_read: boolean
          created_at: string
        }
        Insert: never
        Update: { is_read?: boolean }
        Relationships: []
      }
      bill_number_counters: {
        Row: { business_id: string; day: string; last_value: number }
        Insert: never
        Update: never
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      bootstrap_owner: {
        Args: { p_user_id: string; p_full_name: string; p_email: string; p_business_name: string }
        Returns: string
      }
      employee_auth_user_id: {
        Args: { p_phone: string }
        Returns: string | null
      }
      create_employee_record: {
        Args: {
          p_user_id: string
          p_full_name: string
          p_phone: string | null
          p_monthly_salary: number
          p_joined_at?: string | null
        }
        Returns: string
      }
      update_employee_record: {
        Args: {
          p_employee_id: string
          p_full_name?: string | null
          p_phone?: string | null
          p_monthly_salary?: number | null
          p_joined_at?: string | null
        }
        Returns: undefined
      }
      set_employee_active: { Args: { p_employee_id: string; p_is_active: boolean }; Returns: undefined }
      update_business: { Args: { p_name: string }; Returns: undefined }
      create_bill: {
        Args: {
          p_customer_name: string
          p_vehicle_type: string
          p_vehicle_number: string
          p_items: Json
          p_customer_phone?: string | null
          p_vehicle_description?: string | null
        }
        Returns: Database['public']['Tables']['bills']['Row']
      }
      record_salary_payment: {
        Args: {
          p_employee_id: string
          p_amount: number
          p_payment_date?: string | null
          p_note?: string | null
        }
        Returns: Database['public']['Tables']['salary_payments']['Row']
      }
      accept_salary_payment: {
        Args: { p_payment_id: string }
        Returns: Database['public']['Tables']['salary_payments']['Row']
      }
      cancel_salary_payment: {
        Args: { p_payment_id: string; p_note?: string | null }
        Returns: Database['public']['Tables']['salary_payments']['Row']
      }
      sales_summary: {
        Args: { p_from: string; p_to: string; p_created_by?: string | null }
        Returns: {
          total_sales: number
          bill_count: number
          service_revenue: number
          parts_revenue: number
          custom_revenue: number
          average_bill: number
        }[]
      }
      sales_by_day: {
        Args: { p_from: string; p_to: string; p_created_by?: string | null }
        Returns: { day: string; total_sales: number; bill_count: number }[]
      }
      salary_overview: {
        Args: { p_month: string }
        Returns: {
          employee_id: string
          full_name: string
          phone: string | null
          is_active: boolean
          monthly_salary: number
          paid: number
          remaining: number
          pending_acknowledgements: number
        }[]
      }
      my_salary_summary: {
        Args: { p_month?: string | null }
        Returns: { monthly_salary: number; paid: number; remaining: number; pending_count: number }[]
      }
    }
    Enums: {
      app_role: AppRole
      vehicle_type: VehicleType
      bill_item_type: BillItemType
      salary_payment_status: SalaryPaymentStatus
    }
    CompositeTypes: Record<string, never>
  }
}

type PublicSchema = Database[Extract<keyof Database, 'public'>]

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update']
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T]