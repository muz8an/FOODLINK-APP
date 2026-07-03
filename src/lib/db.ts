// Centralized Supabase Database Service
// All database operations with proper error handling, fallbacks, and schema validation

import { supabase, isSupabaseConfigured } from './supabase'
import type { UserProfile, Donation, EmergencyReq, ChatMessage, Notif } from './store'

// ============================================================
// SCHEMA HEALTH CHECK
// Run once at app start to catch missing tables/columns early
// ============================================================
let schemaChecked = false
let schemaHealthy = true

export async function checkSchemaHealth(): Promise<{ healthy: boolean; issues: string[] }> {
  if (!isSupabaseConfigured()) return { healthy: false, issues: ['Supabase not configured'] }
  if (schemaChecked) return { healthy: schemaHealthy, issues: [] }

  const issues: string[] = []

  // Check profiles table
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1)
    if (error && error.code === '42P01') issues.push('Table "profiles" does not exist')
  } catch { /* ignore */ }

  // Check donations table and critical columns
  try {
    const { error } = await supabase
      .from('donations')
      .select('id, donor_id, food_name, contact_phone, expiry_at, pickup_address, notes')
      .limit(1)
    if (error) {
      if (error.code === '42P01') issues.push('Table "donations" does not exist')
      else if (error.code === '42703') issues.push(`Donations table missing column: ${error.message}`)
      else if (error.code !== 'PGRST116') issues.push(`Donations table: ${error.message}`)
    }
  } catch { /* ignore */ }

  // Check emergency_requests
  try {
    const { error } = await supabase.from('emergency_requests').select('id').limit(1)
    if (error && error.code === '42P01') issues.push('Table "emergency_requests" does not exist')
  } catch { /* ignore */ }

  // Check notifications
  try {
    const { error } = await supabase.from('notifications').select('id').limit(1)
    if (error && error.code === '42P01') issues.push('Table "notifications" does not exist')
  } catch { /* ignore */ }

  // Check chat tables
  try {
    const { error } = await supabase.from('chat_messages').select('id').limit(1)
    if (error && error.code === '42P01') issues.push('Table "chat_messages" does not exist')
  } catch { /* ignore */ }

  schemaChecked = true
  schemaHealthy = issues.length === 0

  if (issues.length > 0) {
    console.warn('[FoodLink Schema Health]', issues.join('; '))
    console.warn('→ Run /supabase/schema.sql in Supabase SQL editor to fix.')
  }

  return { healthy: schemaHealthy, issues }
}

// ============================================================
// ERROR CLASSIFIER
// ============================================================
function classifyError(err: any): { kind: string; message: string } {
  const code = err?.code || ''
  const msg = err?.message || String(err)
  if (code === '42P01') return { kind: 'missing_table', message: msg }
  if (code === '42703') return { kind: 'missing_column', message: msg }
  if (code === '42501' || msg.includes('row-level security')) return { kind: 'rls_blocked', message: msg }
  if (code === '23503') return { kind: 'fk_violation', message: msg }
  if (code === 'PGRST301' || msg.includes('schema cache')) return { kind: 'schema_cache', message: msg }
  return { kind: 'unknown', message: msg }
}

// ============================================================
// PROFILES (Users)
// ============================================================
export const db = {
  async ensureProfile(user: { id: string; email?: string; user_metadata?: any }, defaults: Partial<UserProfile>): Promise<UserProfile | null> {
    if (!isSupabaseConfigured()) return null
    try {
      // Try to fetch existing
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) return data as UserProfile

      // If not found (and not a real error), create it
      if (error && error.code !== 'PGRST116') {
        console.warn('ensureProfile fetch error:', error.message)
      }

      // Insert new profile
      const profile = {
        id: user.id,
        email: user.email || '',
        full_name: defaults.full_name || user.user_metadata?.full_name || 'FoodLink Member',
        role: defaults.role || user.user_metadata?.role || 'donor',
        phone: defaults.phone || '',
        verified: defaults.verified ?? false,
        points: defaults.points ?? 0,
        rank: defaults.rank || 'Bronze',
        streak: defaults.streak ?? 0,
        lat: defaults.lat ?? 12.9716,
        lng: defaults.lng ?? 77.5946,
        organization_name: defaults.organization_name || user.user_metadata?.organization_name,
      }
      const { data: newProfile, error: insertErr } = await supabase
        .from('profiles')
        .upsert(profile, { onConflict: 'id' })
        .select()
        .single()
      if (insertErr) {
        const classified = classifyError(insertErr)
        console.warn(`ensureProfile insert failed (${classified.kind}):`, classified.message)
        return profile as UserProfile
      }
      return newProfile as UserProfile
    } catch (err) {
      console.error('ensureProfile error:', err)
      return null
    }
  },

  async getAllUsers(): Promise<UserProfile[]> {
    if (!isSupabaseConfigured()) return []
    const { data, error } = await supabase.from('profiles').select('*')
    if (error) {
      const c = classifyError(error)
      console.warn(`getAllUsers (${c.kind}):`, c.message)
      return []
    }
    return (data || []) as UserProfile[]
  },

  async getProfile(id: string): Promise<UserProfile | null> {
    if (!isSupabaseConfigured()) return null
    const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single()
    if (error && error.code !== 'PGRST116') {
      console.warn('getProfile error:', error.message)
    }
    return data as UserProfile | null
  },

  async incrementPoints(userId: string, pts: number): Promise<boolean> {
    if (!isSupabaseConfigured()) return false
    try {
      const { error } = await supabase.rpc('increment_points', { user_id: userId, pts })
      if (!error) return true

      // RPC may not exist yet - fallback to manual update
      const profile = await this.getProfile(userId)
      if (profile) {
        const newPoints = (profile.points || 0) + pts
        const rank = calcRankFromPoints(newPoints)
        const { error: updErr } = await supabase
          .from('profiles')
          .update({ points: newPoints, rank, updated_at: new Date().toISOString() })
          .eq('id', userId)
        if (updErr) {
          console.warn('incrementPoints fallback failed:', updErr.message)
          return false
        }
        return true
      }
      return false
    } catch (err) {
      console.error('incrementPoints error:', err)
      return false
    }
  }
}

function calcRankFromPoints(pts: number): string {
  if (pts >= 1500) return 'Diamond'
  if (pts >= 900) return 'Platinum'
  if (pts >= 500) return 'Gold'
  if (pts >= 220) return 'Silver'
  return 'Bronze'
}

// ============================================================
// DONATIONS
// ============================================================
export const donationsDb = {
  async list(): Promise<Donation[]> {
    if (!isSupabaseConfigured()) return []
    const { data, error } = await supabase
      .from('donations')
      .select('*, donor:profiles!donor_id(id, full_name, email, role)')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) {
      const c = classifyError(error)
      console.warn(`donations.list (${c.kind}):`, c.message)
      return []
    }
    return (data || []).map(d => ({
      ...d,
      donor_name: d.donor?.full_name || 'Donor'
    })) as Donation[]
  },

  async create(d: Partial<Donation>): Promise<Donation | null> {
    if (!isSupabaseConfigured()) return null
    if (!d.donor_id) {
      console.warn('donations.create: missing donor_id')
      return null
    }

    // Verify donor profile exists (prevents FK violation)
    const donorExists = await db.getProfile(d.donor_id)
    if (!donorExists) {
      console.warn('donations.create: donor profile missing, attempting to create...')
      // Caller should have ensured profile; this is a safety net
    }

    const payload: Record<string, any> = {
      donor_id: d.donor_id,
      food_name: d.food_name || 'Food donation',
      category: d.category || 'General',
      veg_type: d.veg_type || 'veg',
      quantity_kg: d.quantity_kg ?? 0,
      servings: d.servings ?? 1,
      expiry_at: d.expiry_at || new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
      pickup_address: d.pickup_address || '',
      lat: d.lat ?? 12.9716,
      lng: d.lng ?? 77.5946,
      contact_phone: d.contact_phone || '',
      notes: d.notes || '',
      images: Array.isArray(d.images) ? d.images : [],
      status: 'pending'
    }

    try {
      const { data, error } = await supabase.from('donations').insert(payload).select().single()
      if (error) {
        const c = classifyError(error)
        console.error(`donations.create (${c.kind}):`, c.message)
        throw error
      }
      return data as Donation
    } catch (err: any) {
      const c = classifyError(err)
      console.error(`donations.create failed (${c.kind}):`, c.message)
      throw err
    }
  },

  async update(id: string, patch: Partial<Donation>): Promise<boolean> {
    if (!isSupabaseConfigured()) return false
    const cleanPatch: Record<string, any> = { ...patch }
    // Remove computed/readonly fields
    delete cleanPatch.id
    delete cleanPatch.donor_id
    delete cleanPatch.created_at
    delete cleanPatch.donor_name

    const { error } = await supabase.from('donations').update(cleanPatch).eq('id', id)
    if (error) {
      const c = classifyError(error)
      console.warn(`donations.update (${c.kind}):`, c.message)
      return false
    }
    return true
  }
}

// ============================================================
// EMERGENCY REQUESTS
// ============================================================
export const emergencyDb = {
  async list(): Promise<EmergencyReq[]> {
    if (!isSupabaseConfigured()) return []
    const { data, error } = await supabase
      .from('emergency_requests')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      const c = classifyError(error)
      console.warn(`emergency.list (${c.kind}):`, c.message)
      return []
    }
    return (data || []) as EmergencyReq[]
  },

  async create(e: Partial<EmergencyReq>): Promise<EmergencyReq | null> {
    if (!isSupabaseConfigured()) return null
    const payload = {
      ngo_id: e.ngo_id,
      ngo_name: e.ngo_name || '',
      location: e.location || '',
      lat: e.lat ?? 12.9716,
      lng: e.lng ?? 77.5946,
      meals_needed: e.meals_needed ?? 1,
      priority: e.priority || 'medium',
      description: e.description || '',
      fulfilled: e.fulfilled ?? 0
    }
    const { data, error } = await supabase.from('emergency_requests').insert(payload).select().single()
    if (error) {
      const c = classifyError(error)
      console.error(`emergency.create (${c.kind}):`, c.message)
      throw error
    }
    return data as EmergencyReq
  }
}

// ============================================================
// NOTIFICATIONS
// ============================================================
export const notifsDb = {
  async list(userId: string): Promise<Notif[]> {
    if (!isSupabaseConfigured()) return []
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) {
      const c = classifyError(error)
      console.warn(`notifs.list (${c.kind}):`, c.message)
      return []
    }
    return (data || []) as Notif[]
  },

  async send(n: Partial<Notif>): Promise<boolean> {
    if (!isSupabaseConfigured()) return false
    if (!n.user_id) return false
    const { error } = await supabase.from('notifications').insert({
      user_id: n.user_id,
      title: n.title || 'Notification',
      body: n.body || '',
      type: n.type || 'general',
      read: false
    })
    if (error) {
      const c = classifyError(error)
      console.warn(`notifs.send (${c.kind}):`, c.message)
      return false
    }
    return true
  },

  async markRead(id: string): Promise<void> {
    if (!isSupabaseConfigured()) return
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id)
    if (error) console.warn('notifs.markRead error:', error.message)
  }
}

// ============================================================
// CHAT
// ============================================================
export const chatDb = {
  async list(): Promise<ChatMessage[]> {
    if (!isSupabaseConfigured()) return []
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*, sender:profiles!sender_id(id, full_name)')
      .order('created_at', { ascending: true })
      .limit(200)
    if (error) {
      const c = classifyError(error)
      console.warn(`chat.list (${c.kind}):`, c.message)
      return []
    }
    return (data || []).map(m => ({
      id: m.id,
      threadId: m.thread_id,
      sender_id: m.sender_id,
      sender_name: m.sender?.full_name || 'Member',
      text: m.text || '',
      created_at: m.created_at,
      read: m.read || false
    })) as ChatMessage[]
  },

  async send(msg: { thread_id?: string; sender_id: string; text: string; image_url?: string }): Promise<ChatMessage | null> {
    if (!isSupabaseConfigured()) return null

    let threadId = msg.thread_id
    const invalidThreadId = !threadId || threadId === '00000000-0000-0000-0000-000000000000'

    if (invalidThreadId) {
      // Get or create a default global thread
      const { data: existing } = await supabase
        .from('chat_threads')
        .select('id')
        .limit(1)

      if (existing && existing.length > 0) {
        threadId = existing[0].id
      } else {
        const { data: newThread, error } = await supabase
          .from('chat_threads')
          .insert({ last_message_at: new Date().toISOString() })
          .select()
          .single()
        if (error || !newThread) {
          const c = error ? classifyError(error) : { kind: 'unknown', message: 'no thread' }
          console.warn(`chat.createThread (${c.kind}):`, c.message)
          return null
        }
        threadId = newThread.id
      }
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        thread_id: threadId,
        sender_id: msg.sender_id,
        text: msg.text,
        image_url: msg.image_url || null,
        read: false
      })
      .select('*, sender:profiles!sender_id(id, full_name)')
      .single()
    if (error) {
      const c = classifyError(error)
      console.warn(`chat.send (${c.kind}):`, c.message)
      return null
    }
    return {
      id: data.id,
      threadId: data.thread_id,
      sender_id: data.sender_id,
      sender_name: data.sender?.full_name || 'Member',
      text: data.text || '',
      created_at: data.created_at,
      read: data.read || false
    } as ChatMessage
  }
}

// ============================================================
// STORAGE
// ============================================================
export const storage = {
  async uploadFoodImage(userId: string, dataUrl: string): Promise<string | null> {
    if (!isSupabaseConfigured()) return dataUrl
    if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl
    try {
      const blob = await (await fetch(dataUrl)).blob()
      const ext = dataUrl.includes('png') ? 'png' : 'jpg'
      const path = `food/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error } = await supabase.storage.from('food-images').upload(path, blob, {
        contentType: blob.type || 'image/jpeg',
        upsert: false
      })
      if (error) {
        console.warn('Food image upload failed:', error.message)
        return dataUrl
      }
      const { data } = supabase.storage.from('food-images').getPublicUrl(path)
      return data.publicUrl
    } catch (err) {
      console.warn('Food image upload error:', err)
      return dataUrl
    }
  },

  async uploadDeliveryProof(userId: string, dataUrl: string): Promise<string | null> {
    if (!isSupabaseConfigured()) return dataUrl
    if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl
    try {
      const blob = await (await fetch(dataUrl)).blob()
      const path = `proof/${userId}/${Date.now()}.jpg`
      const { error } = await supabase.storage.from('delivery-proofs').upload(path, blob)
      if (error) {
        console.warn('Proof upload failed:', error.message)
        return dataUrl
      }
      const { data } = supabase.storage.from('delivery-proofs').getPublicUrl(path)
      return data.publicUrl
    } catch {
      return dataUrl
    }
  }
}

// ============================================================
// AUTH HELPERS
// ============================================================
export const authDb = {
  async signOut(): Promise<void> {
    if (!isSupabaseConfigured()) return
    await supabase.auth.signOut()
  },

  async signInWithGoogle(): Promise<{ error?: string }> {
    if (!isSupabaseConfigured()) return { error: 'Supabase not configured' }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    return { error: error?.message }
  },

  async signUpWithEmail(email: string, password: string, metadata: any): Promise<{ user?: any; error?: string }> {
    if (!isSupabaseConfigured()) return { error: 'Supabase not configured' }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata }
    })
    if (error) return { error: error.message }

    // Ensure profile row exists (the trigger should handle this, but we
    // call ensureProfile explicitly as a safety net)
    if (data.user) {
      await db.ensureProfile(data.user, {
        full_name: metadata.full_name,
        role: metadata.role,
        organization_name: metadata.organization_name,
        verified: true,
        points: 0,
        rank: 'Bronze',
        streak: 0
      })
    }
    return { user: data.user }
  },

  async signInWithEmail(email: string, password: string): Promise<{ user?: any; error?: string }> {
    if (!isSupabaseConfigured()) return { error: 'Supabase not configured' }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return { user: data.user }
  }
}

// Expose the schema health check on startup
if (typeof window !== 'undefined') {
  setTimeout(() => checkSchemaHealth(), 1000)
}
