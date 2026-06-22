export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      academies: {
        Row: {
          id: string
          name: string
          slug: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['academies']['Insert']>
      }
      users: {
        Row: {
          id: string
          academy_id: string | null
          auth_id: string | null
          name: string
          email: string
          kakao_access_token: string | null
          kakao_refresh_token: string | null
          kakao_token_expires_at: string | null
          monthly_quota_minutes: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          academy_id?: string | null
          auth_id?: string | null
          name: string
          email: string
          kakao_access_token?: string | null
          kakao_refresh_token?: string | null
          kakao_token_expires_at?: string | null
          monthly_quota_minutes?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      rooms: {
        Row: {
          id: string
          teacher_id: string
          invite_token: string
          scheduled_at: string | null
          duration_limit: number
          status: 'pending' | 'active' | 'completed' | 'cancelled'
          started_at: string | null
          ended_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          teacher_id: string
          invite_token?: string
          scheduled_at?: string | null
          duration_limit?: number
          status?: 'pending' | 'active' | 'completed' | 'cancelled'
          started_at?: string | null
          ended_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['rooms']['Insert']>
      }
      consultations: {
        Row: {
          id: string
          room_id: string
          teacher_id: string
          transcript: TranscriptEntry[] | null
          ai_summary: string | null
          repeat_count: number
          kakao_sent: boolean
          kakao_sent_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          room_id: string
          teacher_id: string
          transcript?: TranscriptEntry[] | null
          ai_summary?: string | null
          repeat_count?: number
          kakao_sent?: boolean
          kakao_sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['consultations']['Insert']>
      }
      signaling_messages: {
        Row: {
          id: string
          room_id: string
          sender_role: 'teacher' | 'parent'
          type: 'offer' | 'answer' | 'ice-candidate'
          payload: Json
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          sender_role: 'teacher' | 'parent'
          type: 'offer' | 'answer' | 'ice-candidate'
          payload: Json
          created_at?: string
        }
        Update: never
      }
    }
  }
}

export interface TranscriptEntry {
  speaker: 'teacher' | 'parent'
  text: string
  timestamp: number // ms since call start
}
