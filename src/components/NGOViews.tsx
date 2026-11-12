import React, { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Siren, HeartHandshake } from 'lucide-react'
import { useStore, calcPoints, haversine, type Donation, type EmergencyReq } from '../lib/store'
import { db, donationsDb, emergencyDb, notifsDb } from '../lib/db'
import { GlassCard, glass, inputCls, statusTint } from './ui'
import { MapWithDonations } from './MapViews'
import { DonationList } from './DonorViews'
import { ChatPanel, Leaderboard } from './CommunityPanels'

type FilterKey = 'all' | 'dist_3km' | 'veg' | 'non_veg' | 'expiring_2h' | 'meals_50'

export function NGOViews({ active, dark, tr, onNavigateTab }: { active: string; dark: boolean; tr: any; onNavigateTab: (tab: string) => void }) {
  const { donations, currentUser, users, updateDonation } = useStore()
  const [filter, setFilter] = useState<FilterKey>('all')

  const allPending = donations.filter(d => d.status === 'pending')
  const accepted = donations.filter(d => d.accepted_by === currentUser?.id)

  const nearby = useMemo(() => {
    const now = Date.now()
    return allPending
      .filter(d => {
        if (filter === 'dist_3km' && currentUser) {
          return haversine(currentUser.lat, currentUser.lng, d.lat, d.lng) <= 3
        }
        if (filter === 'veg') return d.veg_type === 'veg' || d.veg_type === 'vegan'
        if (filter === 'non_veg') return d.veg_type === 'non-veg'
        if (filter === 'expiring_2h') return new Date(d.expiry_at).getTime() - now <= 2 * 3600 * 1000
        if (filter === 'meals_50') return d.servings >= 50
        return true
      })
      .sort((a, b) => {
        if (!currentUser) return 0
        return haversine(currentUser.lat, currentUser.lng, a.lat, a.lng) - haversine(currentUser.lat, currentUser.lng, b.lat, b.lng)
      })
  }, [allPending, filter, currentUser])

  const handleAccept = async (d: Donation) => {
    try {
      const pts = calcPoints(d)
      const volunteers = users.filter(u => u.role?.toLowerCase() === 'volunteer')
      const patch: Partial<Donation> = {
        accepted_by: currentUser!.id,
        points_awarded: pts,
        status: 'accepted',
        volunteer_id: null
      }

      const ok = await donationsDb.update(d.id, patch)
      if (!ok) throw new Error('Update failed')

      updateDonation(d.id, patch)
      await db.incrementPoints(d.donor_id, pts)
      useStore.getState().awardPoints(d.donor_id, pts)

      await notifsDb.send({
        user_id: d.donor_id,
        title: 'Donation accepted',
        body: `${currentUser?.organization_name || currentUser?.full_name} accepted ${d.food_name}`,
        type: 'donation'
      })

      if (volunteers.length > 0) {
        await Promise.all(volunteers.map(v => notifsDb.send({
          user_id: v.id,
          title: '🚀 Pickup Available – Claim Now!',
          body: `📍 FROM: ${d.pickup_address}\n📍 TO: ${currentUser?.organization_name || currentUser?.full_name}\n🍽️ ${d.food_name} (${d.servings} servings)\n⏰ Expires: ${new Date(d.expiry_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          type: 'pickup_available'
        })))
        toast.success('Donation accepted • ALL volunteers notified of available pickup')
      } else {
        toast.success('Donation accepted • QR generated')
      }
    } catch (err: any) {
      console.error('Accept donation failed:', err)
      toast.error(err.message || 'Unable to accept donation')
    }
  }

  const handleAssign = async (d: Donation) => {
    const vol = users.find(u => u.role?.toLowerCase() === 'volunteer')
    if (!vol) {
      toast.error('No volunteers available right now')
      return
    }
    try {
      const ok = await donationsDb.update(d.id, {
        accepted_by: d.accepted_by || currentUser!.id,
        status: 'volunteer_assigned',
        volunteer_id: vol.id
      })
      if (!ok) throw new Error('Update failed')

      updateDonation(d.id, { accepted_by: d.accepted_by || currentUser!.id, status: 'volunteer_assigned', volunteer_id: vol.id })
      await notifsDb.send({
        user_id: vol.id,
        title: 'New pickup assigned',
        body: `Pickup for ${d.food_name} at ${d.pickup_address}`,
        type: 'assignment'
      })
      toast.success('Volunteer assigned!')
    } catch (err: any) {
      console.error('Assign volunteer failed:', err)
      toast.error(err.message || 'Unable to assign volunteer')
    }
  }

  if (active === 'accepted') return <DonationList dark={dark} list={accepted} onOpenChat={() => onNavigateTab('chat')} />
  if (active === 'emergency') return <EmergencyConsole dark={dark} tr={tr} />
  if (active === 'chat') return <ChatPanel dark={dark} />
  if (active === 'leaderboard') return <Leaderboard dark={dark} />

  const filterChips: { key: FilterKey; label: string }[] = [
    { key: 'all', label: `All (${allPending.length})` },
    { key: 'dist_3km', label: 'Distance <3km' },
    { key: 'veg', label: 'Veg / Vegan' },
    { key: 'non_veg', label: 'Non-Veg' },
    { key: 'expiring_2h', label: 'Expiring <2h' },
    { key: 'meals_50', label: '50+ meals' },
  ]

  return (
    <div className="space-y-5">
      <div className={`flex flex-wrap gap-2 ${glass(dark)} rounded-[18px] p-[10px]`}>
        {filterChips.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-[12.5px] px-3 py-[8px] rounded-[12px] font-[620] transition ${filter === f.key
              ? 'bg-emerald-600 text-white shadow-sm'
              : dark ? 'bg-white/[0.05] hover:bg-white/[0.1]' : 'bg-white hover:bg-emerald-50'}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="grid lg:grid-cols-[1.2fr_.8fr] gap-5">
        <div className="space-y-4">
          {nearby.map(d => (
            <GlassCard key={d.id} dark={dark} className="p-[16px]">
              <div className="flex gap-3">
                <img src={d.images?.[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop'} className="w-[110px] h-[86px] rounded-[14px] object-cover" alt="" />
                <div className="flex-1 min-w-0">
                  <div className="font-[700] truncate">{d.food_name}</div>
                  <div className="text-[12.6px] opacity-80">{d.servings} meals · {haversine(currentUser!.lat, currentUser!.lng, d.lat, d.lng).toFixed(1)} km · {d.veg_type}</div>
                  <div className="text-[12px] opacity-75 truncate">{d.pickup_address}</div>
                </div>
                <div className="text-right">
                  <div className={`text-[11px] px-2 py-[4px] rounded-full mb-2 ${statusTint(d.status, dark)}`}>{d.status}</div>
                  {d.status === 'pending' ? (
                    <button onClick={() => handleAccept(d)} className="px-3 py-[8px] rounded-[12px] bg-emerald-600 text-white text-[12.5px] font-[650]">{tr('accept')}</button>
                  ) : (
                    <button onClick={() => handleAssign(d)} className={`px-3 py-[8px] rounded-[12px] text-[12.5px] ${glass(dark)} font-[620]`}>{tr('assign_volunteer')}</button>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
          {nearby.length === 0 && <div className="text-center py-10 opacity-60">No donations match this filter right now.</div>}
        </div>
        <GlassCard dark={dark} className="p-3 h-[520px]">
          <MapWithDonations dark={dark} donations={nearby} />
        </GlassCard>
      </div>
    </div>
  )
}

export function EmergencyConsole({ dark, tr }: { dark: boolean; tr: any }) {
  const { emergencies, currentUser, users, updateEmergency } = useStore()
  const [priority, setPriority] = useState<EmergencyReq['priority']>('high')

  const handlePledge = async (er: EmergencyReq, delta = 25) => {
    const nextFulfilled = Math.min(er.meals_needed, (er.fulfilled || 0) + delta)
    const nextStatus = nextFulfilled >= er.meals_needed ? 'fulfilled' : 'active'
    updateEmergency(er.id, { fulfilled: nextFulfilled })
    await emergencyDb.updateFulfilled(er.id, nextFulfilled, nextStatus)
    if (er.ngo_id && er.ngo_id !== currentUser?.id) {
      await notifsDb.send({
        user_id: er.ngo_id,
        title: 'Emergency meals pledged!',
        body: `${currentUser?.full_name} pledged ${delta} meals for ${er.location}`,
        type: 'emergency'
      })
    }
    toast.success(`Pledged ${delta} meals toward ${er.location}!`)
  }

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)

    try {
      const erPayload: Partial<EmergencyReq> = {
        ngo_id: currentUser!.id,
        ngo_name: currentUser!.organization_name || currentUser!.full_name,
        location: String(fd.get('location') || ''),
        lat: currentUser!.lat + (Math.random() - 0.5) * 0.02,
        lng: currentUser!.lng + (Math.random() - 0.5) * 0.02,
        meals_needed: Number(fd.get('meals') || 50),
        priority,
        description: String(fd.get('description') || ''),
        fulfilled: 0
      }

      const created = await emergencyDb.create(erPayload)

      const donors = users.filter(u => u.role === 'donor')
      await Promise.all(donors.map(u => notifsDb.send({
        user_id: u.id,
        title: '🚨 Emergency Hunger Alert',
        body: `${erPayload.meals_needed} meals needed @ ${erPayload.location}`,
        type: 'emergency'
      })))

      if (created) {
        useStore.getState().addEmergency(created)
      } else {
        const localEr: EmergencyReq = {
          id: 'local_' + Math.random().toString(36).slice(2),
          ...erPayload,
          created_at: new Date().toISOString()
        } as EmergencyReq
        useStore.getState().addEmergency(localEr)
      }

      toast('Emergency alert broadcast • donors notified', { description: 'Push + In-app notification' })
      ;(e.target as HTMLFormElement).reset()
    } catch (err: any) {
      toast.error(err.message || 'Failed to create emergency')
    }
  }
  return (
    <div className="grid lg:grid-cols-[0.95fr_1.05fr] gap-5">
      <GlassCard dark={dark} className="p-[20px]">
        <div className="text-[16.5px] font-[720] mb-3 flex items-center gap-2"><Siren className="w-[18px] h-[18px] text-orange-500" /> {tr('create_alert')}</div>
        <form onSubmit={submit} className="space-y-3.5">
          <input name="location" placeholder="Location / camp name" required className={inputCls(dark).replace('h-[50px]', 'h-[48px]')} />
          <div className="grid grid-cols-2 gap-3">
            <input name="meals" type="number" min="1" placeholder="Meals needed" required className={inputCls(dark).replace('h-[50px]', 'h-[48px]')} />
            <select value={priority} onChange={e => setPriority(e.target.value as any)} className={inputCls(dark).replace('h-[50px]', 'h-[48px]')}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
            </select>
          </div>
          <textarea name="description" rows={4} placeholder="Situation, time window, contact…" className={inputCls(dark).replace('h-[50px]', 'h-auto py-3')} />
          <button className="w-full h-[50px] rounded-[15px] bg-orange-600 text-white font-[700]">Broadcast Emergency Alert</button>
          <div className="text-[12px] opacity-80">Nearby donors receive instant realtime alert.</div>
        </form>
      </GlassCard>
      <GlassCard dark={dark} className="p-[20px]">
        <div className="text-[15px] font-[700] mb-3">Active emergency requests</div>
        <div className="space-y-3 max-h-[460px] overflow-auto pr-1">
          {emergencies.map(er => (
            <div key={er.id} className={`p-[14px] rounded-[16px] ${dark ? 'bg-white/[0.045]' : 'bg-amber-50/80'} border ${er.priority === 'critical' ? 'border-orange-500/45' : dark ? 'border-white/10' : 'border-amber-200'}`}>
              <div className="flex items-center justify-between">
                <div className="font-[700]">{er.location}</div>
                <span className={`text-[10.5px] px-[9px] py-[4px] rounded-full font-[720] ${er.priority === 'critical' ? 'bg-red-600 text-white' : 'bg-orange-500 text-white'}`}>{er.priority.toUpperCase()}</span>
              </div>
              <div className="text-[12.7px] mt-1 opacity-90">{er.description}</div>
              <div className="flex items-center justify-between mt-2">
                <div className="text-[12px]">{er.fulfilled}/{er.meals_needed} meals fulfilled · {er.ngo_name}</div>
                {er.fulfilled < er.meals_needed && (
                  <button
                    type="button"
                    onClick={() => handlePledge(er, 25)}
                    className="text-[11px] px-2.5 py-1 rounded-[10px] bg-emerald-600 text-white font-[650] flex items-center gap-1"
                  >
                    <HeartHandshake className="w-3 h-3" /> +25 Meals
                  </button>
                )}
              </div>
              <div className={`mt-2 h-[7px] rounded-full ${dark ? 'bg-white/[0.09]' : 'bg-black/[0.08]'} overflow-hidden`}>
                <div className="h-full bg-orange-500 transition-all" style={{ width: `${Math.min(100, er.meals_needed > 0 ? er.fulfilled / er.meals_needed * 100 : 0)}%` }} />
              </div>
            </div>
          ))}
          {emergencies.length === 0 && <div className="text-[13px] opacity-65 py-6 text-center">No active emergency requests.</div>}
        </div>
      </GlassCard>
    </div>
  )
}

export function EmergencyMini({ dark }: { dark: boolean }) {
  const { emergencies, currentUser, updateEmergency } = useStore()

  const pledgeQuick = async (er: EmergencyReq) => {
    const next = Math.min(er.meals_needed, (er.fulfilled || 0) + 20)
    updateEmergency(er.id, { fulfilled: next })
    await emergencyDb.updateFulfilled(er.id, next, next >= er.meals_needed ? 'fulfilled' : 'active')
    if (er.ngo_id && er.ngo_id !== currentUser?.id) {
      await notifsDb.send({
        user_id: er.ngo_id,
        title: 'Emergency response received',
        body: `${currentUser?.full_name || 'A donor'} pledged 20 meals for ${er.location}`,
        type: 'emergency'
      })
    }
    toast.success(`Pledged 20 meals for ${er.location}`)
  }

  return (
    <div className="space-y-3">
      {emergencies.slice(0, 2).map(er => (
        <div key={er.id} className={`p-[13px] rounded-[16px] ${dark ? 'bg-orange-400/7' : 'bg-orange-50'} border ${dark ? 'border-orange-400/18' : 'border-orange-200'}`}>
          <div className="flex justify-between items-center">
            <div className="font-[680] text-[13.7px]">{er.location}</div>
            <span className="text-[10px] px-[8px] py-[3px] rounded-full bg-orange-600 text-white font-[700]">{er.priority}</span>
          </div>
          <div className="text-[12px] mt-1 opacity-85">{er.description.slice(0, 95)}{er.description.length > 95 ? '…' : ''}</div>
          <div className="flex items-center justify-between mt-2">
            <div className="text-[11.5px]">{er.fulfilled}/{er.meals_needed} meals</div>
            {er.fulfilled < er.meals_needed && (
              <button onClick={() => pledgeQuick(er)} className="text-[11px] font-[680] text-orange-700 dark:text-orange-300 hover:underline">
                Pledge +20
              </button>
            )}
          </div>
        </div>
      ))}
      {emergencies.length === 0 && <div className="text-[13px] opacity-65">No active emergencies right now.</div>}
    </div>
  )
}

