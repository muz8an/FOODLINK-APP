import { motion } from 'framer-motion'
import { Sprout, MapPin, ShieldCheck, ArrowRight, Sparkles, Clock, CheckCircle2, HeartHandshake } from 'lucide-react'
import { useStore } from '../lib/store'
import { getAvatarStyle } from '../utils/avatar'
import { GlassCard, glass } from './ui'
import { MapLite } from './MapViews'

export function Landing({ dark, onGetStarted }: { dark: boolean; tr?: any; onGetStarted: () => void }) {
  const { users, donations, emergencies } = useStore()
  const completedMealsCount = donations.filter(d => d.status === 'completed').reduce((acc, cur) => acc + cur.servings, 0)
  const activePickupsCount = donations.filter(d => ['accepted', 'volunteer_assigned', 'picked_up', 'delivered'].includes(d.status)).length
  const emergencyCount = emergencies.length
  const nNGOs = users.filter(u => u.role === 'ngo').length
  const nVolunteers = users.filter(u => u.role === 'volunteer').length

  const scrollToLiveMap = () => {
    const el = document.getElementById('live-map-card')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div>
      {/* HERO */}
      <section className="max-w-[1220px] mx-auto px-6 sm:px-7 pt-12 sm:pt-20 pb-12 grid lg:grid-cols-[1.08fr_0.92fr] gap-12 items-center">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className={`inline-flex items-center gap-2.5 px-3.5 py-[7px] rounded-full text-[12.5px] font-[620] ${glass(dark)}`}>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span>Live rescue network · <b>{users.length}</b> active members</span>
          </div>

          <h1 className="display mt-6 text-[44px] sm:text-[64px] leading-[0.96] tracking-[-0.025em] font-[700]">
            Food rescue,<br />
            <span className="text-gradient">at production</span><br />
            speed.
          </h1>

          <p className={`mt-5 text-[17.5px] leading-relaxed max-w-[540px] ${dark ? 'text-zinc-300' : 'text-zinc-600'}`}>
            FoodLink connects verified donors, NGOs, and volunteer riders on a realtime map with QR cold-chain verification, Supabase RLS, and instant impact scoring.
          </p>

          <div className="flex flex-wrap gap-3.5 mt-8">
            <button
              onClick={onGetStarted}
              className="group px-6 h-[54px] rounded-[18px] text-[15px] font-[700] text-white bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 shadow-xl shadow-emerald-600/25 hover:shadow-emerald-600/40 hover:brightness-105 transition-all flex items-center gap-2"
            >
              Start rescuing
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={scrollToLiveMap}
              className={`px-6 h-[54px] rounded-[18px] text-[15px] font-[640] ${glass(dark)} hover:scale-[1.02] transition-all flex items-center gap-2`}
            >
              <MapPin className="w-4 h-4 text-emerald-500" />
              View live map
            </button>
          </div>

          <div className={`grid grid-cols-3 gap-4 max-w-[460px] mt-9 pt-7 border-t ${dark ? 'border-white/10' : 'border-emerald-950/10'}`}>
            <div>
              <div className="display text-[26px] font-[700]">4.8★</div>
              <div className="text-[12.5px] opacity-70">Trust score</div>
            </div>
            <div>
              <div className="display text-[26px] font-[700]">11 min</div>
              <div className="text-[12.5px] opacity-70">Avg pickup</div>
            </div>
            <div>
              <div className="display text-[26px] font-[700]">98.4%</div>
              <div className="text-[12.5px] opacity-70">Safe delivery</div>
            </div>
          </div>
        </motion.div>

        {/* HERO GLASS CARD */}
        <motion.div
          id="live-map-card"
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, delay: 0.1 }}
        >
          <GlassCard dark={dark} className="relative p-4 sm:p-6 glass-noise overflow-hidden max-w-[460px] mx-auto w-full">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
                <span className="text-[11.5px] font-[700] tracking-wider opacity-65 ml-1.5">LIVE DISPATCH GRID</span>
              </div>
              <div className="text-[11px] px-2.5 py-[4px] rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-[680] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Real-time
              </div>
            </div>

            <div className={`relative h-[370px] rounded-[22px] overflow-hidden ring-1 ${dark ? 'ring-white/12' : 'ring-black/6'}`}>
              <MapLite dark={dark} />
              <div className={`pointer-events-none absolute bottom-3 left-3 right-3 px-3.5 py-2.5 rounded-[16px] ${glass(dark)} flex items-center justify-between text-[12px] z-[400]`}>
                <span className="font-[650] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  {donations.length} tracked listings
                </span>
                <span className="opacity-75 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Live sync
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 mt-4 text-center">
              {[
                { k: completedMealsCount, l: 'meals rescued', tint: 'text-emerald-600 dark:text-emerald-300' },
                { k: activePickupsCount, l: 'active pickups', tint: 'text-sky-600 dark:text-sky-300' },
                { k: emergencyCount, l: 'emergency open', tint: 'text-orange-600 dark:text-orange-300' },
              ].map(i => (
                <div key={i.l} className={`rounded-[16px] py-3 px-2 ${dark ? 'bg-white/[0.035]' : 'bg-black/[0.025]'}`}>
                  <div className={`display text-[20px] font-[700] ${i.tint}`}>{i.k}</div>
                  <div className="text-[10.5px] leading-tight opacity-70 mt-0.5">{i.l}</div>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      </section>

      {/* Features grid */}
      <section id="features" className="max-w-[1220px] mx-auto px-6 sm:px-7 py-10">
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { icon: <Sprout className="w-[20px] h-[20px]" />, title: 'Verified cold chain', body: 'QR pickups, food safety checklist, and photo proof captured at every hand-off.', accent: 'from-emerald-500 to-teal-500' },
            { icon: <MapPin className="w-[20px] h-[20px]" />, title: 'Live maps + routes', body: 'Interactive Leaflet & OpenStreetMap routing with live volunteer pickup tracking.', accent: 'from-sky-500 to-indigo-500' },
            { icon: <ShieldCheck className="w-[20px] h-[20px]" />, title: 'RLS secured', body: 'Postgres Row-Level Security, KYC-verified NGOs, and immutable delivery audit trails.', accent: 'from-orange-500 to-amber-500' },
          ].map(f => (
            <GlassCard key={f.title} dark={dark} hover className="p-[24px]">
              <div className={`w-12 h-12 rounded-[16px] bg-gradient-to-br ${f.accent} text-white shadow-lg flex items-center justify-center`}>
                {f.icon}
              </div>
              <div className="mt-4 text-[17.5px] font-[720]">{f.title}</div>
              <div className={`text-[14px] mt-1.5 leading-relaxed ${dark ? 'text-zinc-300' : 'text-zinc-600'}`}>{f.body}</div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-[1220px] mx-auto px-6 sm:px-7 py-14">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8">
          <div>
            <div className="text-[12px] font-[750] uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Workflow</div>
            <div className="display text-[34px] sm:text-[42px] font-[700] tracking-[-0.018em]">How FoodLink flows</div>
          </div>
          <div className={`text-[13.5px] ${dark ? 'text-zinc-400' : 'text-zinc-600'}`}>Four verified steps from surplus kitchen to shelter table</div>
        </div>
        <div className="grid md:grid-cols-4 gap-5">
          {[
            { n: '01', t: 'Donor lists food', d: 'Photo, servings, expiry preset, and interactive GPS pin.' },
            { n: '02', t: 'NGO accepts', d: 'Nearby verified NGOs claim in seconds and alert riders.' },
            { n: '03', t: 'Rider QR pickup', d: 'Volunteer claims route, scans QR, and starts cold-chain.' },
            { n: '04', t: 'Delivered & scored', d: 'Photo proof upload, impact points, and rank certificate.' },
          ].map(s => (
            <GlassCard key={s.n} dark={dark} hover className="p-[22px] relative overflow-hidden">
              <div className="text-[13px] font-[800] text-gradient">{s.n}</div>
              <div className="text-[17.5px] font-[720] mt-2">{s.t}</div>
              <div className={`text-[13.8px] mt-2 leading-relaxed ${dark ? 'text-zinc-300' : 'text-zinc-600'}`}>{s.d}</div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section id="impact" className="max-w-[1220px] mx-auto px-6 sm:px-7 py-10">
        <GlassCard dark={dark} className="p-8 md:p-11 relative overflow-hidden glass-noise">
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { v: completedMealsCount, l: 'Meals rescued', icon: HeartHandshake },
              { v: nNGOs, l: 'Verified NGOs', icon: CheckCircle2 },
              { v: nVolunteers, l: 'Active volunteers', icon: MapPin },
              { v: (completedMealsCount * 0.62).toFixed(1) + ' kg', l: 'CO₂ avoided', icon: Sprout },
            ].map(x => (
              <div key={x.l} className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center mb-2.5 ${dark ? 'bg-emerald-400/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
                  <x.icon className="w-5 h-5" />
                </div>
                <div className="display text-[38px] font-[700] tracking-[-0.02em] text-gradient">{x.v}</div>
                <div className={`${dark ? 'text-zinc-300' : 'text-zinc-600'} text-[13.5px] font-[550]`}>{x.l}</div>
              </div>
            ))}
          </div>
        </GlassCard>
      </section>

      {/* Testimonials */}
      <section className="max-w-[1220px] mx-auto px-6 sm:px-7 py-10">
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { name: 'Ananya – Taj Vivanta', role: 'Hospitality Donor', quote: 'From surplus to shelter in 17 minutes. The QR proof keeps our FSSAI team happy.' },
            { name: 'Feeding India Hub BLR', role: 'Verified NGO', quote: 'Emergency alerts filled 220 plates in 50 min. Realtime rider ping is gold.' },
            { name: 'Priya · Volunteer', role: 'Diamond Rider', quote: 'I love the streak + rank system. Donors trust me – 184 safe deliveries.' },
          ].map(ti => (
            <GlassCard key={ti.name} dark={dark} hover className="p-[24px] flex flex-col justify-between">
              <div>
                <div className="flex text-amber-400 text-[14px] tracking-wider">★★★★★</div>
                <div className={`mt-3 text-[15px] leading-relaxed ${dark ? 'text-zinc-200' : 'text-zinc-700'}`}>“{ti.quote}”</div>
              </div>
              <div className="mt-5 pt-3 border-t border-black/[0.06] dark:border-white/[0.07] flex items-center justify-between text-[12.5px]">
                <span className="font-[680]">{ti.name}</span>
                <span className="opacity-65">{ti.role}</span>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* leaderboard preview */}
      <section className="max-w-[1220px] mx-auto px-6 sm:px-7 py-12">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="display text-[30px] font-[700]">Top impact this month</div>
          <button onClick={onGetStarted} className={`text-[13px] font-[640] ${glass(dark)} px-4 py-[9px] rounded-[14px] hover:scale-[1.02] transition`}>View full leaderboard</button>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
          {users.slice(0, 4).map((u, i) => (
            <GlassCard key={u.id} dark={dark} hover className="p-4 flex items-center gap-3">
              <div className={`text-[12px] font-[800] w-6 text-center ${i === 0 ? 'text-amber-500' : 'opacity-60'}`}>#{i + 1}</div>
              {(() => {
                const av = getAvatarStyle(u.email, u.full_name)
                return (
                  <div className={`w-12 h-12 rounded-[16px] flex items-center justify-center text-white text-[14px] font-[700] bg-gradient-to-br ${av.gradient} shadow-md flex-shrink-0`}>
                    {av.initials}
                  </div>
                )
              })()}
              <div className="min-w-0">
                <div className="text-[14.5px] font-[700] truncate">{u.full_name}</div>
                <div className={`text-[12px] ${dark ? 'text-emerald-300' : 'text-emerald-700'}`}>{u.points} pts · {u.rank}</div>
              </div>
            </GlassCard>
          ))}
          {users.length === 0 && (
            <div className="col-span-4 text-center py-6 opacity-75 text-[14px]">
              No members registered yet. Be the first to join this real-time network!
            </div>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-[970px] mx-auto px-6 sm:px-7 py-10">
        <div className="display text-[32px] font-[700] mb-7 text-center">Frequently Asked Questions</div>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            ['Is this NGO verified?', 'Every NGO submits 12A, FSSAI & address proof. Admin KYC before going live.'],
            ['How fast is pickup?', 'Median 11 minutes in BLR. Emergency alerts push to nearby riders instantly.'],
            ['Is food safe?', 'Donors complete temperature + expiry checklist. Photo proof at pickup & delivery.'],
            ['Points & ranks?', 'Normal 10 pts, emergency 20 pts, 50+ servings +15. Ranks auto-upgrade live.'],
          ].map(([q, a]) => (
            <GlassCard key={q} dark={dark} hover className="p-[20px]">
              <div className="font-[720] text-[15.5px]">{q}</div>
              <div className={`text-[13.8px] mt-2 leading-relaxed ${dark ? 'text-zinc-300' : 'text-zinc-600'}`}>{a}</div>
            </GlassCard>
          ))}
        </div>
      </section>
    </div>
  )
}
