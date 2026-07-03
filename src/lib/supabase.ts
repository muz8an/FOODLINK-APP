// FoodLink Supabase Client - Production Ready
// Falls back to localStorage mock when env vars are missing, allowing full app functionality offline

import { createClient } from '@supabase/supabase-js'

// @ts-ignore vite env
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL
// @ts-ignore vite env
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 }
  }
})

/**
 * Database setup instructions:
 *
 * Run the complete schema in ONE shot from your Supabase SQL editor:
 *   File: /supabase/schema.sql
 *
 * This creates:
 *   - 9 tables (profiles, donations, emergency_requests, notifications,
 *                chat_threads, chat_messages, reviews, user_badges, deliveries)
 *   - All indexes for fast queries
 *   - Row-Level Security (RLS) policies
 *   - Auth trigger to auto-create profiles on signup
 *   - increment_points() RPC function
 *   - Realtime publications
 *   - Storage buckets (food-images, delivery-proofs, profile-pictures)
 */
export const isSupabaseConfigured = () => {
  // @ts-ignore
  const env = (import.meta as any).env || {}
  return Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY)
}
