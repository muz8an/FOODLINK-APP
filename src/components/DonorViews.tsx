import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Star, UtensilsCrossed, Trophy, Leaf, MapPin, Share2, QrCode, X, Download, Clock } from 'lucide-react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { QRCodeCanvas } from 'qrcode.react'
import { useStore, calcPoints, badges as badgeDefs, haversine, type Donation } from '../lib/store'
import { db, donationsDb, notifsDb, storage } from '../lib/db'
import { GlassCard, glass, inputCls, Field, statusTint, StatusTimeline } from './ui'
import { MapClickHandler } from './MapViews'
import { EmergencyMini } from './NGOViews'
import { ChatPanel, Leaderboard } from './CommunityPanels'

function toLocalDatetimeInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function DonorViews({ active, dark, tr, onNavigateTab }: { active: string; dark: boolean; tr: any; onNavigateTab: (tab: string) => void }) {
  const { currentUser, donations, users } = useStore()
  const myDonations = donations.filter(d => d.donor_id === currentUser?.id)
  const completedMeals = myDonations.reduce((a, d) => a + (d.status === 'completed' ? d.servings : 0), 0)
  const co2SavedKg = (completedMeals * 0.62).toFixed(1)

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('fl_fav_ngos') || '[]')
    } catch {
      return []
    }
  })

  const toggleFav = (ngoId: string, name: string) => {
    const exists = favorites.includes(ngoId)
    const next = exists ? favorites.filter(id => id !== ngoId) : [...favorites, ngoId]
    setFavorites(next)
    localStorage.setItem('fl_fav_ngos', JSON.stringify(next))
    toast.success(exists ? `Removed ${name} from favorites` : `Saved ${name} to favorites`)
  }

  if (active === 'share') return <DonorShareForm dark={dark} tr={tr} onSuccess={() => onNavigateTab('donations')} />
  if (active === 'donations') return <DonationList dark={dark} list={myDonations} canCancel onOpenChat={() => onNavigateTab('chat')} />
  if (active === 'impact') return <ImpactPanel dark={dark} user={currentUser!} myDonations={myDonations} />
  if (active === 'chat') return <ChatPanel dark={dark} />
  if (active === 'leaderboard') return <Leaderboard dark={dark} />

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: tr('points'), value: currentUser?.points ?? 0, icon: Star, sub: `${myDonations.length} total listings` },
          { label: 'Meals Rescued', value: completedMeals, icon: UtensilsCrossed, sub: 'verified completed' },
          { label: tr('rank'), value: currentUser?.rank || 'Bronze', icon: Trophy, sub: 'Streak ' + (currentUser?.streak ?? 0) + ' days' },
          { label: 'CO₂ Saved', value: `${co2SavedKg} kg`, icon: Leaf, sub: 'computed from meals' },
        ].map(c => (
          <GlassCard key={c.label} dark={dark} className="p-[18px]">
            <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center ${dark ? 'bg-emerald-400/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'} mb-3`}>
              <c.icon className="w-[18px] h-[18px]" />
            </div>
            <div className="text-[11.5px] uppercase tracking-wider opacity-70 font-[650]">{c.label}</div>
            <div className="display text-[30px] font-[700] tracking-[-0.015em]">{c.value}</div>
            <div className={`text-[12.3px] ${dark ? 'text-emerald-300' : 'text-emerald-700'}`}>{c.sub}</div>
          </GlassCard>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1.35fr_0.65fr] gap-5">
        <GlassCard dark={dark} className="p-[20px]">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[16px] font-[720]">Active donations</div>
            <button onClick={() => onNavigateTab('share')} className="text-[12px] px-3 py-[5px] rounded-full bg-emerald-600 text-white font-[650] hover:brightness-105 transition">
              + Share Food
            </button>
          </div>
          <div className="space-y-3">
            {myDonations.slice(0, 3).map(d => (
              <div key={d.id} className={`flex gap-[14px] p-[14px] rounded-[18px] ${dark ? 'bg-white/[0.03]' : 'bg-black/[0.028]'}`}>
                <img src={d.images?.[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop'} className="w-20 h-20 rounded-[14px] object-cover" alt="" />
                <div className="flex-1 min-w-0">
                  <div className="font-[680]">{d.food_name}</div>
                  <div className="text-[12.7px] opacity-80">{d.servings} meals · {d.quantity_kg}kg · {d.veg_type}</div>
                  <div className={`mt-1 text-[11.5px] inline-flex px-2.5 py-[4px] rounded-full ${statusTint(d.status, dark)}`}>{d.status.replace('_', ' ')}</div>
                </div>
                <div className="text-right text-[12px] opacity-80">
                  expires<br /><b>{new Date(d.expiry_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b>
                </div>
              </div>
            ))}
            {myDonations.length === 0 && <div className="opacity-70 text-[14px]">No active donations yet.</div>}
          </div>
        </GlassCard>

        <GlassCard dark={dark} className="p-[20px]">
          <div className="text-[16px] font-[720] mb-3">Emergency hunger board</div>
          <EmergencyMini dark={dark} />
        </GlassCard>
      </div>

      <GlassCard dark={dark} className="p-[20px]">
        <div className="text-[15.5px] font-[720] mb-3">Nearby verified NGOs</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {users.filter(u => u.role === 'ngo').map(n => {
            const isFav = favorites.includes(n.id)
            const dist = currentUser ? haversine(currentUser.lat, currentUser.lng, n.lat || 12.9716, n.lng || 77.5946).toFixed(1) : '2.1'
            const ngoName = n.organization_name || n.full_name
            return (
              <div key={n.id} className={`p-[14px] rounded-[18px] ${dark ? 'bg-white/[0.035]' : 'bg-black/[0.033]'}`}>
                <div className="font-[680] text-[14.5px]">{ngoName}</div>
                <div className="text-[12.5px] opacity-80">{n.verified ? 'Verified' : 'Pending KYC'} • {dist} km</div>
                <button className="mt-2 text-[12.5px] text-emerald-600 dark:text-emerald-400 font-[650]" onClick={() => toggleFav(n.id, ngoName)}>
                  {isFav ? '♥ Favorited NGO' : '♡ Favorite NGO'}
                </button>
              </div>
            )
          })}
          {users.filter(u => u.role === 'ngo').length === 0 && (
            <div className={`p-[14px] rounded-[18px] border border-dashed ${dark ? 'border-white/15' : 'border-black/15'} flex items-center justify-center text-[13px] opacity-70`}>
              No NGOs registered yet
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  )
}

export function DonorShareForm({ dark, tr, onSuccess }: { dark: boolean; tr: any; onSuccess?: () => void }) {
  const { currentUser } = useStore()
  const [submitting, setSubmitting] = useState(false)
  const [servings, setServings] = useState(32)
  const [expiryValue, setExpiryValue] = useState(() => toLocalDatetimeInput(new Date(Date.now() + 4 * 3600 * 1000)))
  const [loc, setLoc] = useState({
    lat: currentUser?.lat || 12.9716,
    lng: currentUser?.lng || 77.5946,
    addr: 'Indiranagar 12th Main, Bengaluru'
  })
  const [images, setImages] = useState<string[]>(['https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1200&auto=format&fit=crop'])

  const setQuickExpiry = (hours: number) => {
    setExpiryValue(toLocalDatetimeInput(new Date(Date.now() + hours * 3600 * 1000)))
  }

  const pickLocation = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not available'); return }
    navigator.geolocation.getCurrentPosition(pos => {
      setLoc(l => ({ ...l, lat: pos.coords.latitude, lng: pos.coords.longitude, addr: `Live GPS ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}` }))
      toast.success('Live location attached')
    }, () => toast.error('Location denied'))
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setSubmitting(true)

    try {
      const uploadedImages: string[] = []
      for (const imgData of images) {
        if (imgData.startsWith('data:')) {
          const publicUrl = await storage.uploadFoodImage(currentUser!.id, imgData)
          if (publicUrl) uploadedImages.push(publicUrl)
        } else {
          uploadedImages.push(imgData)
        }
      }

      const donationData: Partial<Donation> = {
        donor_id: currentUser!.id,
        donor_name: currentUser!.full_name,
        food_name: String(fd.get('food_name') || 'Fresh meal'),
        category: String(fd.get('category') || 'Cooked Meal'),
        veg_type: (fd.get('veg_type') as any) || 'veg',
        quantity_kg: Number(fd.get('quantity_kg') || 1),
        servings: Number(fd.get('servings') || servings || 10),
        expiry_at: new Date(expiryValue || Date.now() + 4 * 3600 * 1000).toISOString(),
        pickup_address: loc.addr,
        lat: loc.lat,
        lng: loc.lng,
        contact_phone: String(fd.get('contact_phone') || currentUser?.phone || ''),
        notes: String(fd.get('notes') || ''),
        images: uploadedImages.length > 0 ? uploadedImages : images
      }

      const newDonation = await donationsDb.create(donationData)
      if (!newDonation) {
        const localDonation: Donation = {
          id: 'local_' + Math.random().toString(36).slice(2),
          ...donationData,
          status: 'pending',
          points_awarded: 0,
          created_at: new Date().toISOString()
        } as Donation
        useStore.getState().addDonation(localDonation)
        toast.success('Food listed locally! (offline mode)')
        ;(e.target as HTMLFormElement).reset()
        setImages([])
        setSubmitting(false)
        onSuccess?.()
        return
      }

      useStore.getState().addDonation({ ...newDonation, donor_name: currentUser!.full_name })
      const pts = calcPoints(newDonation, false)
      await db.incrementPoints(currentUser!.id, pts)
      useStore.getState().awardPoints(currentUser!.id, pts)
      await notifsDb.send({
        user_id: currentUser!.id,
        title: 'Donation live',
        body: `${donationData.food_name} listed. +${pts} pts`,
        type: 'donation'
      })

      toast.success(`Food listed! +${pts} pts · NGOs notified nearby.`)
      ;(e.target as HTMLFormElement).reset()
      setImages([])
      onSuccess?.()
    } catch (err: any) {
      toast.error(err.message || 'Failed to list food')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <GlassCard dark={dark} className="p-[22px] md:p-[28px]">
      <div className="flex items-center justify-between mb-4">
        <div className="display text-[26px] font-[700]">Share surplus food</div>
        <div className="text-[12px] px-2.5 py-[5px] rounded-full bg-emerald-500/14 text-emerald-700 dark:text-emerald-300 font-[650]">FSSAI checked</div>
      </div>

      <form onSubmit={onSubmit} className="grid md:grid-cols-2 gap-[18px]">
        <Field label={tr('food_name')} dark={dark}><input name="food_name" required placeholder="e.g. Veg Biryani + Raita" className={inputCls(dark)} /></Field>
        <Field label={tr('category')} dark={dark}>
          <select name="category" className={inputCls(dark)} defaultValue="Cooked Meal">
            <option>Cooked Meal</option><option>Bakery</option><option>Raw produce</option><option>Thali</option><option>Packets</option>
          </select>
        </Field>
        <Field label="Veg / Non-Veg" dark={dark}>
          <select name="veg_type" className={inputCls(dark)} defaultValue="veg">
            <option value="veg">{tr('veg')}</option>
            <option value="non-veg">{tr('non-veg')}</option>
            <option value="vegan">{tr('vegan')}</option>
          </select>
        </Field>
        <Field label={tr('quantity')} dark={dark}><input name="quantity_kg" type="number" step="0.1" min="0.5" required defaultValue={8} className={inputCls(dark)} /></Field>
        <Field label={tr('servings')} dark={dark}>
          <input name="servings" type="number" min="1" required value={servings} onChange={e => setServings(Number(e.target.value) || 0)} className={inputCls(dark)} />
        </Field>
        <Field label={tr('expiry')} dark={dark}>
          <input name="expiry_at" type="datetime-local" value={expiryValue} onChange={e => setExpiryValue(e.target.value)} className={inputCls(dark)} required />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {[2, 4, 6, 12].map(h => (
              <button key={h} type="button" onClick={() => setQuickExpiry(h)} className={`text-[11px] px-2.5 py-1 rounded-full ${dark ? 'bg-white/[0.06] hover:bg-white/[0.12]' : 'bg-black/[0.05] hover:bg-black/[0.09]'}`}>
                <Clock className="w-3 h-3 inline mr-1" />+{h}h
              </button>
            ))}
          </div>
        </Field>
        <Field label={tr('contact')} dark={dark}><input name="contact_phone" defaultValue={currentUser?.phone || ''} placeholder="+91 98..." className={inputCls(dark)} required /></Field>
        <Field label="Pickup address" dark={dark} full>
          <div className="flex gap-2">
            <input value={loc.addr} onChange={e => setLoc({ ...loc, addr: e.target.value })} className={inputCls(dark) + ' flex-1'} />
            <button type="button" onClick={pickLocation} className={`px-3 rounded-[14px] text-[12.5px] font-[640] ${glass(dark)}`}>Use GPS</button>
          </div>
          <div className={`mt-4 rounded-[20px] overflow-hidden border ${dark ? 'border-white/12' : 'border-black/[0.08]'}`}>
            <MapContainer center={[loc.lat, loc.lng]} zoom={14} style={{ height: '240px', width: '100%' }} scrollWheelZoom={false} attributionControl={false}>
              <TileLayer
                url={dark
                  ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                  : 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png'}
              />
              <Marker
                position={[loc.lat, loc.lng]}
                draggable
                eventHandlers={{
                  dragend: (e: any) => {
                    const latlng = e.target.getLatLng()
                    setLoc(prev => ({
                      ...prev,
                      lat: latlng.lat,
                      lng: latlng.lng,
                      addr: `GPS ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`
                    }))
                  }
                }}
              >
                <Popup>Pickup location</Popup>
              </Marker>
              <MapClickHandler setLoc={setLoc} />
            </MapContainer>
            <div className="p-3 text-[12px] opacity-75">Click the map or drag the marker to update pickup location.</div>
          </div>
        </Field>
        <Field label={tr('notes')} dark={dark} full><textarea name="notes" rows={3} placeholder="Allergens, spice level, packaging…" className={inputCls(dark) + ' h-auto py-3'} /></Field>

        <div className="md:col-span-2">
          <div className="text-[12.5px] font-[650] mb-2 opacity-80">Food photos</div>
          <div className="flex flex-wrap gap-3">
            {images.map((src, i) => (
              <div key={i} className="relative">
                <img src={src} className="w-[140px] h-[106px] object-cover rounded-[16px]" alt="" />
                <button type="button" onClick={() => setImages(im => im.filter((_, j) => j !== i))} className="absolute top-1 right-1 bg-black/60 text-white text-[11px] px-[7px] py-[3px] rounded-[9px]">✕</button>
              </div>
            ))}
            <label className={`w-[140px] h-[106px] rounded-[16px] border-2 border-dashed ${dark ? 'border-white/18' : 'border-black/15'} flex items-center justify-center text-[12.5px] cursor-pointer`}>
              <input type="file" className="hidden" accept="image/*" multiple onChange={e => {
                const files = Array.from(e.target.files || [])
                files.slice(0, 3).forEach(f => {
                  const reader = new FileReader()
                  reader.onload = ev => setImages(im => [...im, String(ev.target?.result)])
                  reader.readAsDataURL(f)
                })
              }} />
              + Upload
            </label>
          </div>
        </div>

        <div className="md:col-span-2 flex flex-wrap items-center gap-3 pt-2">
          <button disabled={submitting} className="px-[20px] h-[52px] rounded-[16px] text-white font-[720] bg-gradient-to-r from-emerald-600 to-emerald-500 shadow shadow-emerald-600/25 disabled:opacity-60">
            {submitting ? 'Publishing…' : tr('submit')}
          </button>
          <div className={`text-[12.6px] ${dark ? 'text-zinc-300' : 'text-zinc-600'}`}>
            Earn <b>+{calcPoints({ servings }, false)} points</b> for {servings} servings · instant NGO push
          </div>
        </div>
      </form>
    </GlassCard>
  )
}

export function DonationList({
  dark,
  list,
  canCancel = false,
  onOpenChat
}: {
  dark: boolean
  list: Donation[]
  canCancel?: boolean
  onOpenChat?: () => void
}) {
  const { updateDonation } = useStore()
  const [qrDonation, setQrDonation] = useState<Donation | null>(null)

  const handleCancel = async (d: Donation) => {
    const ok = await donationsDb.update(d.id, { status: 'cancelled' })
    updateDonation(d.id, { status: 'cancelled' })
    toast(ok ? 'Donation cancelled' : 'Donation cancelled locally')
  }

  const handleShare = async (d: Donation) => {
    const text = `FoodLink Rescue: ${d.food_name} (${d.servings} meals) at ${d.pickup_address}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'FoodLink Donation', text })
        return
      } catch { /* user cancelled or unsupported */ }
    }
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Donation summary copied to clipboard')
    } catch {
      toast.info(text)
    }
  }

  return (
    <div className="space-y-4">
      {list.map(d => (
        <GlassCard key={d.id} dark={dark} className="p-[18px] md:p-[20px]">
          <div className="flex flex-col md:flex-row gap-4">
            <img src={d.images?.[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=800&auto=format&fit=crop'} className="w-full md:w-[200px] h-[140px] object-cover rounded-[16px]" alt="" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-[18px] font-[720]">{d.food_name}</div>
                <span className={`text-[11px] px-2 py-[4px] rounded-full ${statusTint(d.status, dark)}`}>{d.status.replace('_', ' ')}</span>
                <span className="text-[11px] px-2 py-[4px] rounded-full bg-orange-500/12 text-orange-700 dark:text-orange-300">{d.veg_type}</span>
              </div>
              <div className={`text-[13.8px] mt-1 ${dark ? 'text-zinc-300' : 'text-zinc-700'}`}>{d.servings} meals · {d.quantity_kg}kg · {d.category}</div>
              <div className="text-[13px] opacity-80 mt-1 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{d.pickup_address}</div>
              <div className="text-[12.5px] opacity-75 mt-1">Expires {new Date(d.expiry_at).toLocaleString()} · Contact {d.contact_phone}</div>

              <StatusTimeline status={d.status} dark={dark} />

              <div className="flex gap-2 mt-3 flex-wrap">
                {d.status === 'pending' && canCancel && (
                  <button onClick={() => handleCancel(d)} className={`text-[12.5px] px-3 py-[7px] rounded-[12px] ${glass(dark)} hover:bg-red-500/15`}>Cancel</button>
                )}
                <button onClick={() => setQrDonation(d)} className={`text-[12.5px] px-3 py-[7px] rounded-[12px] ${glass(dark)} flex items-center gap-1.5`}>
                  <QrCode className="w-3.5 h-3.5" /> Handoff QR
                </button>
                {onOpenChat && (
                  <button onClick={onOpenChat} className="text-[12.5px] px-3 py-[7px] rounded-[12px] bg-emerald-600 text-white">Open Chat</button>
                )}
                <button onClick={() => handleShare(d)} className={`text-[12.5px] px-3 py-[7px] rounded-[12px] ${glass(dark)} flex items-center gap-1`}><Share2 className="w-3.5 h-3.5" /> Share</button>
              </div>
            </div>
            <div className="md:text-right">
              <div className="text-[12px] opacity-70">Impact</div>
              <div className="display text-[22px] font-[700]">+{calcPoints(d)} pts</div>
              <div className="text-[11.5px] opacity-70">QR ready</div>
            </div>
          </div>
        </GlassCard>
      ))}
      {list.length === 0 && <GlassCard dark={dark} className="p-8 text-center opacity-80">No donations yet. Share your first meal!</GlassCard>}

      <AnimatePresence>
        {qrDonation && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/55 backdrop-blur-[5px]" onClick={() => setQrDonation(null)} />
            <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }} className={`relative w-full max-w-[380px] p-6 rounded-[28px] text-center ${glass(dark)}`}>
              <button onClick={() => setQrDonation(null)} className="absolute top-4 right-4 w-8 h-8 rounded-[10px] flex items-center justify-center bg-black/10 dark:bg-white/10">
                <X className="w-4 h-4" />
              </button>
              <div className="display text-[20px] font-[700] mb-1">Cold-Chain Handoff QR</div>
              <div className="text-[12.5px] opacity-75 mb-4">{qrDonation.food_name} · {qrDonation.servings} meals</div>
              <div className="inline-block p-4 bg-white rounded-[20px] shadow-md">
                <QRCodeCanvas value={`foodlink://pickup/${qrDonation.id}`} size={180} />
              </div>
              <div className="text-[12px] opacity-70 mt-4">Show this QR code to the assigned volunteer at pickup to verify handoff.</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function ImpactPanel({ dark, user, myDonations }: { dark: boolean; user: any; myDonations: Donation[] }) {
  const totalMeals = myDonations.reduce((a, d) => a + d.servings, 0)
  const completedCount = myDonations.filter(d => d.status === 'completed').length
  const co2Kg = (totalMeals * 0.62).toFixed(1)

  const earnedMap: Record<string, boolean> = {
    first_donation: myDonations.length >= 1,
    food_saver: completedCount >= 10,
    hunger_hero: totalMeals >= 500,
    emergency_hero: myDonations.some(d => (d.points_awarded || 0) >= 20),
    top_donor: (user.points || 0) >= 500,
    diamond: (user.points || 0) >= 1500,
  }

  const downloadCertificate = () => {
    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>FoodLink Impact Certificate</title>
<style>
  body { font-family: Georgia, serif; background: #f3f7f4; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
  .cert { background:#fff; border:8px double #16a34a; border-radius:24px; padding:48px 56px; max-width:720px; text-align:center; box-shadow:0 20px 60px rgba(0,0,0,0.08); }
  h1 { color:#0f1d16; font-size:38px; margin:8px 0; }
  .sub { color:#15803d; letter-spacing:2px; font-size:12px; font-family:sans-serif; font-weight:700; text-transform:uppercase; }
  .name { font-size:28px; font-weight:700; margin:20px 0 10px; color:#0f1d16; }
  .stats { display:flex; justify-content:center; gap:32px; margin:28px 0; font-family:sans-serif; }
  .stat b { display:block; font-size:26px; color:#16a34a; }
  .meta { font-family:sans-serif; font-size:13px; color:#52525b; margin-top:24px; }
</style></head>
<body><div class="cert">
  <div class="sub">FoodLink Zero-Hunger Network · Verified Impact</div>
  <h1>Certificate of Food Rescue</h1>
  <p>Proudly presented to</p>
  <div class="name">${user.full_name}</div>
  <p>for outstanding contribution toward eliminating food waste and feeding communities.</p>
  <div class="stats">
    <div class="stat"><b>${totalMeals}</b>Meals Rescued</div>
    <div class="stat"><b>${co2Kg} kg</b>CO₂ Avoided</div>
    <div class="stat"><b>${user.points}</b>Impact Points</div>
  </div>
  <div class="meta">Rank: ${user.rank} · Issued ${new Date().toLocaleDateString()}</div>
</div></body></html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `foodlink-impact-certificate-${(user.full_name || 'member').toLowerCase().replace(/\s+/g, '-')}.html`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Impact certificate downloaded!')
  }

  return (
    <div className="grid md:grid-cols-2 gap-5">
      <GlassCard dark={dark} className="p-[22px]">
        <div className="text-[15px] font-[720] mb-3">Achievement Badges</div>
        <div className="grid grid-cols-2 gap-3">
          {badgeDefs.map(b => {
            const unlocked = earnedMap[b.key]
            return (
              <div key={b.key} className={`p-[14px] rounded-[18px] transition ${unlocked ? (dark ? 'bg-emerald-500/12 border border-emerald-400/25' : 'bg-emerald-50 border border-emerald-200') : (dark ? 'bg-white/[0.03] opacity-55' : 'bg-black/[0.025] opacity-60')}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[26px]">{b.icon}</span>
                  <span className={`text-[10px] font-[700] px-2 py-0.5 rounded-full ${unlocked ? 'bg-emerald-600 text-white' : 'bg-black/10 dark:bg-white/10'}`}>
                    {unlocked ? 'Earned' : 'Locked'}
                  </span>
                </div>
                <div className="font-[680] text-[14px] mt-1">{b.name}</div>
                <div className="text-[12px] opacity-75">{b.desc}</div>
              </div>
            )
          })}
        </div>
      </GlassCard>
      <GlassCard dark={dark} className="p-[22px]">
        <div className="text-[15px] font-[720] mb-3">Impact Certificate</div>
        <div className={`rounded-[18px] p-[18px] ${dark ? 'bg-emerald-400/8' : 'bg-emerald-50'} border ${dark ? 'border-emerald-400/15' : 'border-emerald-200'}`}>
          <div className="display text-[22px] font-[700]">FoodLink Impact</div>
          <div className="mt-2 text-[14px]">{user.full_name} has rescued <b>{totalMeals} meals</b>, saving ~{co2Kg} kg CO₂.</div>
          <div className="text-[12.5px] mt-3 opacity-80">Rank: {user.rank} • Points: {user.points}</div>
          <button onClick={downloadCertificate} className="mt-4 text-[12.5px] font-[650] px-3.5 py-[9px] rounded-[12px] bg-emerald-600 text-white inline-flex items-center gap-1.5 hover:brightness-105 transition">
            <Download className="w-3.5 h-3.5" /> Download Certificate
          </button>
        </div>
      </GlassCard>
    </div>
  )
}

