import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Navigation2, X, Clock, MapPin, Truck, AlertTriangle, ScanLine, Camera, CheckCircle2, ExternalLink, Upload } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { useStore, haversine, type Donation, type DonationStatus } from '../lib/store'
import { supabase } from '../lib/supabase'
import { db, deliveriesDb, donationsDb, notifsDb, storage } from '../lib/db'
import { GlassCard, glass, statusTint } from './ui'
import { MapWithDonations } from './MapViews'
import { DonationList } from './DonorViews'
import { ChatPanel } from './CommunityPanels'

export function PickupAlertModal({ dark, donation, onClaim, onDismiss }: { dark: boolean; donation: Donation; onClaim: () => void; onDismiss: () => void }) {
  const { users } = useStore()
  const ngo = users.find(u => u.id === donation.accepted_by)
  const ngoName = ngo?.organization_name || ngo?.full_name || 'NGO'
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${donation.lat},${donation.lng}&destination=${ngo?.lat || 12.9716},${ngo?.lng || 77.5946}`

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[6px]" onClick={onDismiss} />
      <motion.div
        initial={{ y: 20, scale: 0.96, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 12, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className={`relative w-full max-w-[560px] rounded-[28px] overflow-hidden ${glass(dark)} glass-noise`}
      >
        <div className="h-2 bg-gradient-to-r from-emerald-500 via-emerald-400 to-orange-400" />

        <div className="p-[24px]">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-[52px] h-[52px] rounded-[18px] bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg">
                <Navigation2 className="w-[26px] h-[26px] text-white" />
              </div>
              <div>
                <div className="text-[20px] font-[750] display leading-tight">Pickup Available!</div>
                <div className={`text-[12.5px] ${dark ? 'text-emerald-300' : 'text-emerald-700'} font-[650]`}>A new order needs a rider</div>
              </div>
            </div>
            <button onClick={onDismiss} className={`w-9 h-9 rounded-[12px] flex items-center justify-center ${dark ? 'bg-white/[0.07]' : 'bg-black/[0.05]'} hover:bg-red-500/15`}>
              <X className="w-[16px] h-[16px]" />
            </button>
          </div>

          <div className={`rounded-[20px] p-[18px] ${dark ? 'bg-white/[0.05]' : 'bg-emerald-50/70'} border ${dark ? 'border-white/[0.08]' : 'border-emerald-100'}`}>
            <div className="flex gap-4">
              <img
                src={donation.images?.[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop'}
                className="w-[110px] h-[110px] rounded-[16px] object-cover shadow-sm"
                alt={donation.food_name}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[19px] font-[720] tracking-tight">{donation.food_name}</div>
                <div className={`text-[13.5px] mt-1 flex items-center gap-2 ${dark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  <span className="font-[650]">{donation.servings} meals</span>
                  <span className="w-1 h-1 rounded-full bg-current opacity-40" />
                  <span>{donation.quantity_kg} kg</span>
                  <span className="w-1 h-1 rounded-full bg-current opacity-40" />
                  <span className="capitalize">{donation.veg_type}</span>
                </div>
                <div className={`mt-2 flex items-center gap-1.5 text-[12.5px] ${dark ? 'text-amber-300' : 'text-amber-700'}`}>
                  <Clock className="w-4 h-4" />
                  Expires {new Date(donation.expiry_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
            <div className={`rounded-[16px] p-[14px] ${dark ? 'bg-white/[0.04]' : 'bg-black/[0.03]'}`}>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider opacity-60 font-[700] mb-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                PICKUP FROM
              </div>
              <div className="text-[14px] font-[650] leading-tight">{donation.pickup_address}</div>
              <div className="text-[12px] opacity-70 mt-1">Donor: {donation.donor_name}</div>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-[38px] h-[38px] rounded-full bg-emerald-600 flex items-center justify-center shadow-md shadow-emerald-600/30">
                <Truck className="w-[18px] h-[18px] text-white" />
              </div>
              <div className={`w-[2px] h-[24px] ${dark ? 'bg-white/15' : 'bg-black/10'}`} />
              <div className={`text-[10px] font-[700] ${dark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                {donation.accepted_by ? haversine(
                  donation.lat, donation.lng,
                  ngo?.lat || 12.9716,
                  ngo?.lng || 77.5946
                ).toFixed(1) : '?'} km
              </div>
            </div>

            <div className={`rounded-[16px] p-[14px] ${dark ? 'bg-white/[0.04]' : 'bg-black/[0.03]'}`}>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider opacity-60 font-[700] mb-1">
                <MapPin className="w-3.5 h-3.5 text-orange-500" />
                DELIVER TO
              </div>
              <div className="text-[14px] font-[650] leading-tight">{ngoName}</div>
              <div className="text-[12px] opacity-70 mt-1">NGO accepting the food</div>
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <div className={`flex-1 rounded-[14px] px-[14px] py-[10px] text-[12.5px] ${dark ? 'bg-amber-400/10 text-amber-300' : 'bg-amber-50 text-amber-800'}`}>
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              Priority pickup – food expires soon
            </div>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className={`rounded-[14px] px-3 py-[10px] text-[12px] font-[640] flex items-center gap-1 ${glass(dark)}`}
            >
              <ExternalLink className="w-3.5 h-3.5" /> Route
            </a>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              onClick={onClaim}
              className="flex-1 h-[52px] rounded-[16px] bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-[720] text-[15px] shadow-lg shadow-emerald-600/25 hover:brightness-105 transition"
            >
              🚀 Claim This Assignment
            </button>
            <button
              onClick={onDismiss}
              className={`px-[20px] h-[52px] rounded-[16px] text-[14px] font-[620] ${glass(dark)}`}
            >
              Later
            </button>
          </div>

          <div className={`mt-3 text-[11.5px] text-center ${dark ? 'text-zinc-400' : 'text-zinc-500'}`}>
            Claiming will assign this pickup to you. You'll see QR code & routing details.
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

export function VolunteerViews({ active, dark, tr: _tr }: { active: string; dark: boolean; tr: any }) {
  const { donations, currentUser, updateDonation, users, pickupAlerts, addPickupAlert, removePickupAlert } = useStore()
  const [activePickupAlert, setActivePickupAlert] = useState<Donation | null>(null)
  const [proofTarget, setProofTarget] = useState<Donation | null>(null)
  const [proofImage, setProofImage] = useState<string | null>(null)
  const [uploadingProof, setUploadingProof] = useState(false)

  const availablePickups = donations.filter(d =>
    currentUser?.role?.toLowerCase() === 'volunteer' &&
    d.status === 'accepted' &&
    !d.volunteer_id
  )
  const claimedPickups = donations.filter(d =>
    d.volunteer_id === currentUser?.id &&
    ['volunteer_assigned', 'picked_up', 'delivered'].includes(d.status)
  )

  useEffect(() => {
    if (pickupAlerts.length > 0 && currentUser?.role === 'volunteer') {
      const latestAlertId = pickupAlerts[pickupAlerts.length - 1]
      const donation = donations.find(d => d.id === latestAlertId)
      if (donation && donation.status === 'accepted' && !donation.volunteer_id) {
        setActivePickupAlert(donation)
      }
    }
  }, [pickupAlerts, donations, currentUser])

  const alertedIdsRef = useRef(new Set<string>())
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'volunteer') return

    const channel = supabase
      .channel('volunteer-pickup-alerts')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'donations', filter: `status=eq.accepted` },
        (payload) => {
          const updated = payload.new as Donation
          if (!updated.volunteer_id && !alertedIdsRef.current.has(updated.id)) {
            alertedIdsRef.current.add(updated.id)
            addPickupAlert(updated.id)
            toast.success(`🚀 New pickup: ${updated.food_name}`, {
              description: `From ${updated.pickup_address}`
            })
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [currentUser, addPickupAlert])

  const handleClaimAssignment = async (id: string) => {
    if (!currentUser) return
    try {
      const ok = await donationsDb.update(id, {
        status: 'volunteer_assigned',
        volunteer_id: currentUser.id
      })
      if (!ok) throw new Error('Assignment claim failed')
      updateDonation(id, { status: 'volunteer_assigned', volunteer_id: currentUser.id })
      removePickupAlert(id)
      setActivePickupAlert(null)
      toast.success('✅ Assignment claimed! You can now view QR code & route.')
    } catch (err: any) {
      console.error('Claim assignment failed:', err)
      toast.error(err.message || 'Unable to claim assignment')
    }
  }

  const handleUpdateStatus = async (id: string, status: DonationStatus, points = 0) => {
    try {
      const ok = await donationsDb.update(id, { status })
      if (!ok) throw new Error('Update failed')
      updateDonation(id, { status })

      if (points > 0 && currentUser) {
        await db.incrementPoints(currentUser.id, points)
        useStore.getState().awardPoints(currentUser.id, points)
        await notifsDb.send({
          user_id: currentUser.id,
          title: 'Delivery completed',
          body: `+${points} points awarded for this delivery`,
          type: 'reward'
        })
      }

      toast.success(`Status updated to ${status.replace('_', ' ')}`)
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const submitDeliveryProof = async () => {
    if (!proofTarget || !currentUser) return
    setUploadingProof(true)
    try {
      let proofUrl: string | undefined
      if (proofImage) {
        proofUrl = (await storage.uploadDeliveryProof(currentUser.id, proofImage)) || undefined
      }
      const ngo = users.find(u => u.id === proofTarget.accepted_by)
      const dist = ngo ? Number(haversine(proofTarget.lat, proofTarget.lng, ngo.lat || 12.9716, ngo.lng || 77.5946).toFixed(2)) : undefined
      await deliveriesDb.record({
        donation_id: proofTarget.id,
        volunteer_id: currentUser.id,
        delivery_proof_url: proofUrl,
        delivered_at: new Date().toISOString(),
        distance_km: dist
      })
      await handleUpdateStatus(proofTarget.id, 'delivered')
      setProofTarget(null)
      setProofImage(null)
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload proof')
    } finally {
      setUploadingProof(false)
    }
  }

  if (active === 'map') {
    return (
      <GlassCard dark={dark} className="p-3 h-[560px]">
        <MapWithDonations dark={dark} donations={[...availablePickups, ...claimedPickups]} showRoute />
      </GlassCard>
    )
  }
  if (active === 'completed') return <DonationList dark={dark} list={donations.filter(d => d.status === 'completed' && d.volunteer_id === currentUser?.id)} />
  if (active === 'chat') return <ChatPanel dark={dark} />

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {activePickupAlert && (
          <PickupAlertModal
            dark={dark}
            donation={activePickupAlert}
            onClaim={() => handleClaimAssignment(activePickupAlert.id)}
            onDismiss={() => {
              removePickupAlert(activePickupAlert.id)
              setActivePickupAlert(null)
            }}
          />
        )}
      </AnimatePresence>

      {/* Delivery Proof Upload Modal */}
      <AnimatePresence>
        {proofTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/55 backdrop-blur-[5px]" onClick={() => setProofTarget(null)} />
            <motion.div initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }} className={`relative w-full max-w-[440px] p-6 rounded-[28px] ${glass(dark)}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="display text-[20px] font-[700]">Upload Delivery Proof</div>
                <button onClick={() => setProofTarget(null)} className="w-8 h-8 rounded-[10px] flex items-center justify-center bg-black/10 dark:bg-white/10">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="text-[13px] opacity-80 mb-4">{proofTarget.food_name} · {proofTarget.servings} meals</div>
              <label className={`block w-full h-[170px] rounded-[18px] border-2 border-dashed ${dark ? 'border-white/20 hover:border-emerald-400' : 'border-black/15 hover:border-emerald-500'} flex flex-col items-center justify-center cursor-pointer overflow-hidden mb-4`}>
                {proofImage ? (
                  <img src={proofImage} alt="Delivery proof" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center px-4 opacity-75">
                    <Upload className="w-7 h-7 mx-auto mb-2" />
                    <div className="text-[13px] font-[620]">Click to attach handoff photo</div>
                    <div className="text-[11px] opacity-70 mt-1">Optional if NGO confirmed directly</div>
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = ev => setProofImage(String(ev.target?.result))
                  reader.readAsDataURL(file)
                }} />
              </label>
              <div className="flex gap-2">
                <button
                  disabled={uploadingProof}
                  onClick={submitDeliveryProof}
                  className="flex-1 h-[46px] rounded-[14px] bg-emerald-600 text-white font-[680] text-[13.5px] disabled:opacity-60"
                >
                  {uploadingProof ? 'Uploading…' : 'Confirm Delivery'}
                </button>
                <button onClick={() => { setProofTarget(null); setProofImage(null) }} className={`px-4 h-[46px] rounded-[14px] text-[13px] ${glass(dark)}`}>
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {availablePickups.length > 0 && (
        <GlassCard dark={dark} className={`p-[16px] border-l-4 border-l-emerald-500 ${dark ? 'bg-emerald-500/8' : 'bg-emerald-50/80'}`}>
          <div className="flex items-center gap-3">
            <Navigation2 className="w-6 h-6 text-emerald-500 animate-pulse" />
            <div>
              <div className="font-[700] text-[15px]">{availablePickups.length} New Available Pickup{availablePickups.length > 1 ? 's' : ''}</div>
              <div className={`text-[12.5px] ${dark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                These donations have been accepted by NGOs and need a volunteer to deliver
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {availablePickups.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[14px] font-[700]">Available Pickups</span>
            <span className={`text-[12px] px-2.5 py-[3px] rounded-full ${dark ? 'bg-emerald-400/10 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
              {availablePickups.length} open
            </span>
          </div>

          {availablePickups.map(d => {
            const ngo = users.find(u => u.id === d.accepted_by)
            const ngoName = ngo?.organization_name || ngo?.full_name || 'NGO'
            const dist = d.accepted_by && ngo
              ? haversine(d.lat, d.lng, ngo.lat || 12.9716, ngo.lng || 77.5946).toFixed(1)
              : '?'

            return (
              <GlassCard key={d.id} dark={dark} className="p-[18px] overflow-hidden">
                <div className="flex flex-col md:flex-row gap-4">
                  <img src={d.images?.[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=600&auto=format&fit=crop'} className="w-full md:w-[140px] h-[120px] object-cover rounded-[14px]" alt="" />
                  <div className="flex-1">
                    <div className="text-[17px] font-[720] flex items-center gap-2">
                      {d.food_name}
                      <span className="text-[10px] px-2 py-[2px] rounded-full bg-orange-500/12 text-orange-600 dark:text-orange-300 font-[650]">
                        {d.veg_type}
                      </span>
                    </div>

                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-start gap-2 text-[13px]">
                        <div className="w-6 h-6 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                        </div>
                        <div>
                          <span className="font-[650] text-[11px] uppercase tracking-wider opacity-60">PICKUP FROM</span>
                          <div className="text-[13px]">{d.pickup_address}</div>
                          <div className="text-[11.5px] opacity-70">Donor: {d.donor_name}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 text-[13px]">
                        <div className="w-6 h-6 rounded-full bg-orange-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-orange-500" />
                        </div>
                        <div>
                          <span className="font-[650] text-[11px] uppercase tracking-wider opacity-60">DELIVER TO</span>
                          <div className="text-[13px]">{ngoName}</div>
                          <div className="text-[11.5px] opacity-70">{dist} km away</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
                      <span className={`px-2 py-[3px] rounded-full ${dark ? 'bg-amber-400/10 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>
                        <Clock className="w-3 h-3 inline mr-1" />
                        Expires {new Date(d.expiry_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="opacity-60">{d.servings} servings</span>
                      <span className="opacity-60">{d.quantity_kg} kg</span>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        onClick={() => handleClaimAssignment(d.id)}
                        className="px-5 py-[10px] rounded-[14px] bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-[13px] font-[660] shadow-md shadow-emerald-600/20 hover:brightness-105 transition flex items-center gap-1.5"
                      >
                        <Navigation2 className="w-4 h-4" />
                        Claim Pickup
                      </button>
                      <button
                        onClick={() => setActivePickupAlert(d)}
                        className={`px-4 py-[10px] rounded-[14px] text-[13px] font-[620] ${glass(dark)}`}
                      >
                        View Details
                      </button>
                    </div>
                  </div>

                  <div className="w-full md:w-[130px] flex flex-col items-center">
                    <div className={`p-[6px] rounded-[12px] ${dark ? 'bg-white/[0.08]' : 'bg-white'} shadow-sm`}>
                      <QRCodeCanvas value={`foodlink://pickup/${d.id}`} size={110} />
                    </div>
                    <div className="text-[10px] opacity-70 mt-2 text-center">Claim to activate QR</div>
                  </div>
                </div>
              </GlassCard>
            )
          })}
        </>
      )}

      {claimedPickups.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-6">
            <Truck className="w-4 h-4 text-emerald-500" />
            <span className="text-[14px] font-[700]">My Active Assignments</span>
            <span className={`text-[12px] px-2.5 py-[3px] rounded-full ${dark ? 'bg-blue-400/10 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
              {claimedPickups.length} active
            </span>
          </div>

          {claimedPickups.map(d => {
            const ngo = users.find(u => u.id === d.accepted_by)
            const ngoName = ngo?.organization_name || ngo?.full_name || 'NGO'
            const routeUrl = `https://www.google.com/maps/dir/?api=1&origin=${d.lat},${d.lng}&destination=${ngo?.lat || 12.9716},${ngo?.lng || 77.5946}`

            return (
              <GlassCard key={d.id} dark={dark} className="p-[18px]">
                <div className="flex flex-col md:flex-row gap-4">
                  <img src={d.images?.[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=600&auto=format&fit=crop'} className="w-full md:w-[180px] h-[128px] object-cover rounded-[16px]" alt="" />
                  <div className="flex-1">
                    <div className="text-[17px] font-[720]">{d.food_name}</div>

                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2 text-[12.5px]">
                        <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center">
                          <MapPin className="w-3 h-3 text-emerald-500" />
                        </div>
                        <span className="opacity-80">From: {d.pickup_address}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[12.5px]">
                        <div className="w-5 h-5 rounded-full bg-orange-500/15 flex items-center justify-center">
                          <MapPin className="w-3 h-3 text-orange-500" />
                        </div>
                        <span className="opacity-80">To: {ngoName}</span>
                      </div>
                    </div>

                    <div className={`mt-2 inline-flex items-center gap-1.5 ${statusTint(d.status, dark)} text-[11px] px-2.5 py-[4px] rounded-full`}>
                      {d.status === 'volunteer_assigned' && <ScanLine className="w-3.5 h-3.5" />}
                      {d.status === 'picked_up' && <Truck className="w-3.5 h-3.5" />}
                      {d.status === 'delivered' && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {d.status.replace('_', ' ')}
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3">
                      {d.status === 'volunteer_assigned' && (
                        <button onClick={() => handleUpdateStatus(d.id, 'picked_up')} className="px-3 py-[9px] rounded-[12px] bg-emerald-600 text-white text-[13px] font-[640] flex items-center gap-1.5"><ScanLine className="w-4 h-4" /> QR Pickup</button>
                      )}
                      {d.status === 'picked_up' && (
                        <button onClick={() => setProofTarget(d)} className={`px-3 py-[9px] rounded-[12px] text-[13px] ${glass(dark)} flex items-center gap-1.5`}><Camera className="w-4 h-4" /> Upload Proof</button>
                      )}
                      {d.status === 'delivered' && (
                        <button onClick={() => handleUpdateStatus(d.id, 'completed', 18)} className="px-3 py-[9px] rounded-[12px] text-[13px] bg-emerald-600 text-white font-[640]">Mark Completed (+18 pts)</button>
                      )}
                      <a href={routeUrl} target="_blank" rel="noreferrer" className={`px-3 py-[9px] rounded-[12px] text-[13px] ${glass(dark)} flex items-center gap-1.5`}>
                        <ExternalLink className="w-3.5 h-3.5" /> Navigate
                      </a>
                    </div>
                  </div>
                  <div className="w-full md:w-[170px] flex flex-col items-center">
                    <div className="p-[10px] rounded-[16px] bg-white shadow-sm">
                      <QRCodeCanvas value={`foodlink://pickup/${d.id}`} size={124} />
                    </div>
                    <div className="text-[11px] opacity-70 mt-2">Scan to verify pickup</div>
                  </div>
                </div>
              </GlassCard>
            )
          })}
        </>
      )}

      {availablePickups.length === 0 && claimedPickups.length === 0 && (
        <GlassCard dark={dark} className="p-16 text-center">
          <Truck className="w-14 h-14 mx-auto mb-4 opacity-30" />
          <div className="text-[18px] font-[700]">No assignments yet</div>
          <div className={`text-[14px] mt-2 ${dark ? 'text-zinc-400' : 'text-zinc-500'}`}>
            When an NGO accepts a donation, you'll see it here with full pickup & delivery details.
          </div>
        </GlassCard>
      )}
    </div>
  )
}

