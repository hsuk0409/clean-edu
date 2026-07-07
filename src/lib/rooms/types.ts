import type { Database } from '@/types/database'

export type Room = Database['public']['Tables']['rooms']['Row']
export type RoomStatus = Room['status']
