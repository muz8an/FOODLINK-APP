import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, UtensilsCrossed, Siren, Users2, ArrowRight } from 'lucide-react'
import { useStore } from '../lib/store'
import { glass, statusTint } from './ui'

interface CommandPaletteProps {
  open: boolean
  dark: boolean
  onClose: () => void
  onNavigateTab: (tabKey: string) => void
  availableTabs: { key: string; label: string }[]
}

export function CommandPalette({ open, dark, onClose, onNavigateTab, availableTabs }: CommandPaletteProps) {
  const { donations, users, emergencies } = useStore()
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (open) setQuery('')
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const q = query.trim().toLowerCase()

  const matchedDonations = useMemo(() => {
    if (!q) return donations.slice(0, 4)
    return donations.filter(d =>
      d.food_name.toLowerCase().includes(q) ||
      d.pickup_address.toLowerCase().includes(q) ||
      d.donor_name.toLowerCase().includes(q) ||
      d.status.toLowerCase().includes(q)
    ).slice(0, 5)
  }, [donations, q])

  const matchedNgos = useMemo(() => {
    const ngos = users.filter(u => u.role === 'ngo')
    if (!q) return ngos.slice(0, 3)
    return ngos.filter(u =>
      (u.organization_name || u.full_name).toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    ).slice(0, 4)
  }, [users, q])

  const matchedEmergencies = useMemo(() => {
    if (!q) return emergencies.slice(0, 2)
    return emergencies.filter(e =>
      e.location.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      e.ngo_name.toLowerCase().includes(q)
    ).slice(0, 3)
  }, [emergencies, q])

  const matchedTabs = useMemo(() => {
    if (!q) return availableTabs
    return availableTabs.filter(t => t.label.toLowerCase().includes(q) || t.key.toLowerCase().includes(q))
  }, [availableTabs, q])

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[95] flex items-start justify-center pt-16 sm:pt-24 px-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[5px]" onClick={onClose} />
          <motion.div
            initial={{ y: -12, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            className={`relative w-full max-w-[640px] rounded-[26px] overflow-hidden ${glass(dark)}`}
          >
            <div className={`flex items-center gap-3 px-4 h-[56px] border-b ${dark ? 'border-white/10' : 'border-black/10'}`}>
              <Search className="w-[18px] h-[18px] opacity-70" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search donations, NGOs, emergencies, or jump to tab..."
                className="bg-transparent outline-none flex-1 text-[14.5px]"
              />
              <button onClick={onClose} className={`w-8 h-8 rounded-[10px] flex items-center justify-center ${dark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[440px] overflow-auto p-3 space-y-4">
              {matchedTabs.length > 0 && (
                <div>
                  <div className="text-[11px] font-[700] uppercase tracking-wider opacity-60 px-2 mb-1.5">Quick Navigation</div>
                  <div className="flex flex-wrap gap-1.5 px-1">
                    {matchedTabs.map(t => (
                      <button
                        key={t.key}
                        onClick={() => { onNavigateTab(t.key); onClose() }}
                        className={`px-3 py-1.5 rounded-[12px] text-[12.5px] font-[620] flex items-center gap-1.5 ${dark ? 'bg-white/[0.06] hover:bg-emerald-500/20' : 'bg-black/[0.04] hover:bg-emerald-500/15'}`}
                      >
                        {t.label} <ArrowRight className="w-3 h-3 opacity-60" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="text-[11px] font-[700] uppercase tracking-wider opacity-60 px-2 mb-1.5">Donations ({matchedDonations.length})</div>
                {matchedDonations.length === 0 ? (
                  <div className="text-[12.5px] opacity-60 px-2 py-2">No matching donations</div>
                ) : (
                  <div className="space-y-1.5">
                    {matchedDonations.map(d => (
                      <div
                        key={d.id}
                        onClick={() => {
                          const targetTab = availableTabs.find(t => ['donations', 'nearby', 'assignments', 'heatmap'].includes(t.key))?.key || availableTabs[0]?.key
                          if (targetTab) onNavigateTab(targetTab)
                          onClose()
                        }}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-[14px] cursor-pointer ${dark ? 'hover:bg-white/[0.06]' : 'hover:bg-black/[0.04]'}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UtensilsCrossed className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="text-[13.5px] font-[650] truncate">{d.food_name}</div>
                            <div className="text-[11.5px] opacity-70 truncate">{d.servings} meals · {d.pickup_address}</div>
                          </div>
                        </div>
                        <span className={`text-[10.5px] px-2 py-[3px] rounded-full ml-2 flex-shrink-0 ${statusTint(d.status, dark)}`}>{d.status.replace('_', ' ')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {matchedEmergencies.length > 0 && (
                <div>
                  <div className="text-[11px] font-[700] uppercase tracking-wider opacity-60 px-2 mb-1.5">Emergency Alerts</div>
                  <div className="space-y-1.5">
                    {matchedEmergencies.map(er => (
                      <div
                        key={er.id}
                        onClick={() => {
                          const emTab = availableTabs.find(t => ['emergency', 'alerts'].includes(t.key))?.key
                          if (emTab) onNavigateTab(emTab)
                          onClose()
                        }}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-[14px] cursor-pointer ${dark ? 'hover:bg-white/[0.06]' : 'hover:bg-black/[0.04]'}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Siren className="w-4 h-4 text-orange-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="text-[13.5px] font-[650] truncate">{er.location}</div>
                            <div className="text-[11.5px] opacity-70 truncate">{er.fulfilled}/{er.meals_needed} meals · {er.ngo_name}</div>
                          </div>
                        </div>
                        <span className="text-[10.5px] px-2 py-[3px] rounded-full bg-orange-500 text-white font-[650] uppercase">{er.priority}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {matchedNgos.length > 0 && (
                <div>
                  <div className="text-[11px] font-[700] uppercase tracking-wider opacity-60 px-2 mb-1.5">Verified NGOs</div>
                  <div className="space-y-1.5">
                    {matchedNgos.map(n => (
                      <div key={n.id} className={`flex items-center justify-between px-3 py-2 rounded-[14px] ${dark ? 'bg-white/[0.025]' : 'bg-black/[0.02]'}`}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Users2 className="w-4 h-4 text-sky-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="text-[13.5px] font-[640] truncate">{n.organization_name || n.full_name}</div>
                            <div className="text-[11px] opacity-65 truncate">{n.points} pts · {n.rank}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

