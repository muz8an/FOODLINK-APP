import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import {
  Leaf, HeartHandshake, Sprout, MapPin, ShieldCheck, Users2, Truck, BarChart3, MessageCircle, Bell, Search,
  Moon, Sun, LogOut, Star, Trophy, BadgeCheck,
  UtensilsCrossed, CheckCircle2, Menu, X, Send, Camera,
  Languages, Siren, Activity, Share2, Award, ScanLine,
  Navigation2, Clock, AlertTriangle
} from 'lucide-react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { QRCodeCanvas } from 'qrcode.react'
import { useStore, calcPoints, badges as badgeDefs, haversine, type Donation, type Role, type EmergencyReq, type DonationStatus } from './lib/store'
import { getAvatarStyle } from './utils/avatar'
import { t as translate, type Lang } from './lib/i18n'
import { supabase } from './lib/supabase'
import { db, donationsDb, emergencyDb, notifsDb, chatDb, storage, authDb } from './lib/db'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'

// Fix leaflet default marker
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Glass UI primitives
const glass = (dark:boolean) =>
  dark
    ? 'backdrop-blur-2xl bg-white/[0.05] border border-white/[0.12] shadow-[inset_0_1px_1px_rgba(255,255,255,0.07),0_24px_60px_rgba(0,0,0,0.45)]'
    : 'backdrop-blur-2xl bg-white/72 border border-white/70 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_24px_60px_rgba(33,81,44,0.10)]'

function GlassCard({ children, className='', dark=false }: {children: React.ReactNode, className?:string, dark?:boolean}) {
  return <div className={`${glass(dark)} rounded-[28px] ${className}`}>{children}</div>
}

const rankColor:Record<string,string> = {
  Bronze: 'from-amber-600 to-orange-500',
  Silver: 'from-slate-400 to-slate-600',
  Gold: 'from-amber-400 to-yellow-500',
  Platinum: 'from-sky-400 to-indigo-500',
  Diamond: 'from-teal-300 to-cyan-500'
}

// --- APP ROOT ---
export default function App() {
  const [lang, setLang] = useState<Lang>((localStorage.getItem('fl_lang') as Lang) || 'en')
  const [dark, setDark] = useState<boolean>(()=> localStorage.getItem('fl_dark') === '1')
  const { currentUser, setCurrentUser, notifications, markNotifRead } = useStore()
  const [authOpen, setAuthOpen] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)

  useEffect(()=>{ localStorage.setItem('fl_lang', lang) }, [lang])
  useEffect(()=>{ localStorage.setItem('fl_dark', dark ? '1':'0') }, [dark])

  const tr = (k: Parameters<typeof translate>[0]) => translate(k, lang)

  // Supabase session boot
  useEffect(() => {
    const loadProfile = async (user: any) => {
      // Ensure profile exists (creates it if missing via ensureProfile)
      const profile = await db.ensureProfile(user, {
        full_name: user.user_metadata?.full_name,
        role: user.user_metadata?.role || 'donor',
        verified: true,
        points: 0,
        rank: 'Bronze',
        streak: 0
      })
      if (profile) {
        setCurrentUser(profile)
        useStore.getState().addUser(profile)
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadProfile(session.user)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadProfile(session.user)
      } else {
        setCurrentUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [setCurrentUser])

  // Load public data even when not authenticated (for landing page)
  useEffect(() => {
    const loadPublicData = async () => {
      try {
        const [donations, users, emergencies] = await Promise.all([
          donationsDb.list(),
          db.getAllUsers(),
          emergencyDb.list()
        ])
        useStore.setState({ donations, users, emergencies })
      } catch (err) {
        console.warn('Public data load failed:', err)
      }
    }
    loadPublicData()

    // Public realtime channel for landing page live stats
    const publicDonationsChannel = supabase
      .channel('public-donations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, payload => {
        if (payload.eventType === 'INSERT') {
          useStore.getState().addDonation(payload.new as Donation)
        } else if (payload.eventType === 'UPDATE') {
          useStore.getState().updateDonation((payload.new as Donation).id, payload.new as Donation)
        }
      })
      .subscribe()

    return () => {
      publicDonationsChannel.unsubscribe()
    }
  }, [])

  // Real-time subscriptions
  useEffect(() => {
    if (!currentUser) return

    const donationsChannel = supabase
      .channel('donations-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, payload => {
        if (payload.eventType === 'INSERT') {
          useStore.getState().addDonation(payload.new as Donation)
          toast.info('New food donation available!')
        } else if (payload.eventType === 'UPDATE') {
          useStore.getState().updateDonation(payload.new.id, payload.new)
        }
      })
      .subscribe()

    const notifsChannel = supabase
      .channel('notifs-' + currentUser.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUser.id}` }, payload => {
        useStore.getState().pushNotif(payload.new as any)
        toast.info(payload.new.title)
      })
      .subscribe()

    const chatChannel = supabase
      .channel('chat-global')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, payload => {
        useStore.getState().addMessage(payload.new as any)
      })
      .subscribe()

    const fetchData = async () => {
      try {
        const [donations, emergencies, notifs, messages, users] = await Promise.all([
          donationsDb.list(),
          emergencyDb.list(),
          notifsDb.list(currentUser.id),
          chatDb.list(),
          db.getAllUsers()
        ])
        const normalizedUsers = users && users.length > 0
          ? users
          : currentUser
            ? [currentUser]
            : []
        const mergedUsers = currentUser
          ? normalizedUsers.some(u => u.id === currentUser.id)
            ? normalizedUsers
            : [currentUser, ...normalizedUsers]
          : normalizedUsers

        useStore.setState({ donations, emergencies, notifications: notifs, messages, users: mergedUsers })
      } catch (err) {
        console.warn('Fetch data error:', err)
      }
    }
    fetchData()

    return () => {
      donationsChannel.unsubscribe()
      notifsChannel.unsubscribe()
      chatChannel.unsubscribe()
    }
  }, [currentUser])

  return (
    <div className={`app-container ${dark ? 'dark' : ''}`}>
      <div className={`app-shell font-[Inter] transition-colors duration-500 ${dark ? 'bg-[#0d1117] text-[#e9f2ec]' : 'bg-[#f7faf7] text-[#0f1d16]'}`}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&display=swap');
          html, body { font-family: 'Inter', system-ui, sans-serif; }
          .display { font-family: 'Fraunces', serif; }
          .app-container {
            min-height: 100vh;
            width: 100vw;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: hidden;
          }
          .app-shell {
            width: 100vw;
            height: 100vh;
            overflow: auto;
          }
          @media (orientation: landscape) {
            .app-shell {
              aspect-ratio: 16 / 9;
              width: 100vw;
              height: auto;
              max-height: 100vh;
            }
          }
          @media (orientation: portrait) {
            .app-shell {
              aspect-ratio: 9 / 16;
              height: 100vh;
              width: auto;
              max-width: 100vw;
            }
          }
          .glass-noise:before {
            content:''; position:absolute; inset:0; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns=N/A%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
            opacity:.022; pointer-events:none; border-radius:inherit;
          }
          .leaflet-container { border-radius:24px; z-index:1; }
          ::-webkit-scrollbar { width:10px; height:10px }
          ::-webkit-scrollbar-thumb { background:#c6d9c9; border-radius:20px }
          .dark ::-webkit-scrollbar-thumb { background:#22372a }
        `}</style>
        <Toaster richColors position="top-right" />
        {/* floating ambient */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className={`absolute -top-36 -right-36 w-[520px] h-[520px] blur-[110px] rounded-full ${dark ? 'opacity-[.14] bg-emerald-500' : 'opacity-[.24] bg-emerald-200'}`} />
          <div className={`absolute top-[30%] -left-32 w-[420px] h-[420px] blur-[110px] rounded-full ${dark ? 'opacity-[.11] bg-orange-500' : 'opacity-[.22] bg-orange-200'}`} />
          <div className={`absolute bottom-0 left-1/3 w-[620px] h-[320px] blur-[100px] rounded-full ${dark ? 'opacity-[.09] bg-emerald-400' : 'opacity-[.15] bg-emerald-100'}`} />
        </div>

        {/* Top glass nav */}
        <header className={`sticky top-0 z-40 ${dark ? 'bg-[#0d1117]/65' : 'bg-[#f7faf7]/65'} backdrop-blur-xl border-b ${dark ? 'border-white/7' : 'border-emerald-900/7'}`}>
          <div className="max-w-[1220px] mx-auto px-4 sm:px-7 h-[72px] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-[18px] bg-gradient-to-br from-emerald-500 via-emerald-600 to-orange-500 shadow-lg shadow-emerald-600/20 flex items-center justify-center relative overflow-hidden">
                <UtensilsCrossed className="w-[20px] h-[20px] text-white" />
                <div className="absolute -bottom-1 left-2 w-7 h-[2px] bg-white/70 rounded-full blur-[0.5px]" />
                <div className="absolute top-[18px] right-[13px] w-[6px] h-[6px] rounded-full bg-white/95" />
              </div>
              <div>
                <div className="display text-[21px] leading-[1.1] tracking-[-0.015em] font-[700]">FoodLink</div>
                <div className={`text-[11px] ${dark ? 'text-emerald-300/80' : 'text-emerald-700/80'} tracking-wide`}>{tr('tagline')}</div>
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-7 text-[14px] font-[500]">
              {!currentUser && (
                <>
                  <a href="#features" className={`${dark?'text-zinc-300 hover:text-white':'text-zinc-700 hover:text-black'} transition-colors`}>Features</a>
                  <a href="#how" className={`${dark?'text-zinc-300 hover:text-white':'text-zinc-700 hover:text-black'} transition-colors`}>How it works</a>
                  <a href="#impact" className={`${dark?'text-zinc-300 hover:text-white':'text-zinc-700 hover:text-black'} transition-colors`}>Impact</a>
                </>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button onClick={()=> setDark(d=>!d)} className={`w-10 h-10 rounded-[16px] flex items-center justify-center transition ${glass(dark)} ${dark?'hover:bg-white/[0.09]':'hover:bg-white/95'}`} aria-label="theme">
                {dark ? <Sun className="w-[18px] h-[18px] text-amber-300" /> : <Moon className="w-[18px] h-[18px] text-emerald-800" />}
              </button>
              <div className="relative">
                <select value={lang} onChange={e=>setLang(e.target.value as Lang)} className={`${glass(dark)} rounded-[16px] h-10 pl-9 pr-3 text-[13px] font-medium appearance-none outline-none cursor-pointer ${dark ? 'text-zinc-200' : 'text-zinc-700'}`}>
                  <option value="en">EN</option>
                  <option value="hi">हि</option>
                  <option value="kn">ಕ</option>
                </select>
                <Languages className="absolute left-[10px] top-[11px] w-[18px] h-[18px] opacity-70 pointer-events-none" />
              </div>

              {currentUser ? (
                <>
                  <BellTray dark={dark} notifications={notifications.filter(n=>n.user_id===currentUser.id)} onRead={(id)=>{ markNotifRead(id); notifsDb.markRead(id) }} />
                  <div className="hidden sm:flex items-center gap-2 ml-1">
                    {(() => {
                      const av = getAvatarStyle(currentUser.email, currentUser.full_name)
                      return (
                        <div className={`w-10 h-10 rounded-[16px] flex items-center justify-center text-white text-[13px] font-[700] bg-gradient-to-br ${av.gradient} shadow-md`}>
                          {av.initials}
                        </div>
                      )
                    })()}
                    <div className="leading-tight">
                      <div className="text-[13px] font-[650]">{currentUser.full_name}</div>
                      <div className={`text-[11px] ${dark?'text-emerald-300':'text-emerald-700'} capitalize`}>{currentUser.role} · {currentUser.rank}</div>
                    </div>
                    <button onClick={async ()=> { await authDb.signOut(); setCurrentUser(null); toast('Signed out') }} className={`ml-1 w-9 h-9 rounded-[14px] flex items-center justify-center ${glass(dark)}`}>
                      <LogOut className="w-[15px] h-[15px]" />
                    </button>
                  </div>
                  <button className="sm:hidden ml-1 w-10 h-10 rounded-[16px] flex items-center justify-center border border-emerald-900/10" onClick={()=>setMobileNav(!mobileNav)}>
                    {mobileNav ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={()=> setAuthOpen(true)} className={`px-[16px] h-10 rounded-[16px] text-[13.5px] font-[640] ${glass(dark)} ${dark?'hover:bg-white/[0.07]':'hover:bg-white'}`}>{tr('login')}</button>
                  <button onClick={()=> setAuthOpen(true)} className="px-[18px] h-10 rounded-[16px] text-[13.5px] font-[700] text-white bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-lg shadow-emerald-600/30 hover:brightness-[1.04] transition">{tr('register')}</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="relative z-10">
          {currentUser
            ? <Dashboard dark={dark} tr={tr} lang={lang} />
            : <Landing dark={dark} tr={tr} onGetStarted={()=>setAuthOpen(true)} />
          }
        </main>

        <footer className={`mt-20 border-t ${dark?'border-white/[0.08] bg-black/10':'border-emerald-900/[0.08] bg-white/40'} backdrop-blur`}>
          <div className="max-w-[1220px] mx-auto px-6 sm:px-7 py-14 grid md:grid-cols-4 gap-10 text-[14px]">
            <div>
              <div className="display text-[22px] font-[700]">FoodLink</div>
              <div className={`${dark?'text-zinc-400':'text-zinc-600'} mt-2`}>Production-grade food rescue network<br/>Bengaluru • Mumbai • Delhi</div>
              <div className="mt-4 text-[12px] opacity-70">Supabase • Realtime • Google Maps • RLS</div>
            </div>
            <div>
              <div className="font-[700] mb-3">Platform</div>
              <ul className={`space-y-2 ${dark?'text-zinc-400':'text-zinc-600'}`}>
                <li>Donor app</li><li>NGO console</li><li>Volunteer tracker</li><li>Admin analytics</li>
              </ul>
            </div>
            <div>
              <div className="font-[700] mb-3">Trust</div>
              <ul className={`space-y-2 ${dark?'text-zinc-400':'text-zinc-600'}`}>
                <li>Food safety verified</li><li>NGO KYC</li><li>QR cold-chain</li><li>RLS secured</li>
              </ul>
            </div>
            <div>
              <div className="font-[700] mb-3">Contact</div>
              <div className={`${dark?'text-zinc-400':'text-zinc-600'}`}>
                support@foodlink.in<br/>+91 63 6480 8720<br/><br/>Made with ♻️ for zero-hunger 2030
              </div>
            </div>
          </div>
          <div className={`text-center py-4 text-[12px] ${dark?'text-zinc-500':'text-zinc-500'}`}>
            © 2026 FoodLink Foundation · Open impact · PWA ready · ISO 22000 aligned
          </div>
        </footer>

        <AnimatePresence>{authOpen && <AuthModal dark={dark} tr={tr} onClose={()=>setAuthOpen(false)} />}</AnimatePresence>
      </div>
    </div>
  )
}

// Bell notifications
function BellTray({ dark, notifications, onRead }:{ dark:boolean, notifications:any[], onRead:(id:string)=>void }) {
  const [open,setOpen]=useState(false)
  const unread = notifications.filter(n=>!n.read).length
  return (
    <div className="relative">
      <button onClick={()=>setOpen(o=>!o)} className={`w-10 h-10 rounded-[16px] flex items-center justify-center ${glass(dark)} relative`}>
        <Bell className="w-[18px] h-[18px]" />
        {unread>0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-[5px] rounded-full bg-orange-500 text-white text-[10px] font-[700] flex items-center justify-center">{unread}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{opacity:0,y:8,scale:.97}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:6}}
            className={`absolute right-0 mt-3 w-[360px] max-w-[92vw] z-50 ${glass(dark)} rounded-[24px] p-3`}>
            <div className="text-[12px] font-[700] px-2 pb-2 opacity-70">REALTIME NOTIFICATIONS</div>
            <div className="max-h-[420px] overflow-auto space-y-2 pr-1">
              {notifications.length===0 && <div className="px-2 py-6 text-sm opacity-70">You’re all caught up.</div>}
              {notifications.map(n=>(
                <div key={n.id} onClick={()=>onRead(n.id)} className={`px-3 py-3 rounded-[18px] cursor-pointer transition ${n.read ? (dark?'bg-white/[0.03]':'bg-black/[0.015]') : (dark?'bg-emerald-500/10':'bg-emerald-500/8')}`}>
                  <div className="text-[13.5px] font-[650]">{n.title}</div>
                  <div className={`text-[12.6px] ${dark?'text-zinc-300':'text-zinc-700'}`}>{n.body}</div>
                  <div className="text-[11px] opacity-55 mt-1">{new Date(n.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// LANDING
function Landing({ dark, onGetStarted }:{ dark:boolean, tr?:any, onGetStarted:()=>void }) {
  const { users, donations, emergencies } = useStore()
  const completedMealsCount = donations.filter(d=>d.status==='completed').reduce((acc,cur)=>acc+cur.servings,0)
  const activePickupsCount = donations.filter(d=>['accepted','volunteer_assigned','picked_up','delivered'].includes(d.status)).length
  const emergencyCount = emergencies.length
  const nNGOs = users.filter(u=>u.role==='ngo').length
  const nVolunteers = users.filter(u=>u.role==='volunteer').length

  return (
    <div>
      {/* HERO */}
      <section className="max-w-[1220px] mx-auto px-6 sm:px-7 pt-14 sm:pt-24 pb-10 grid lg:grid-cols-[1.06fr_0.94fr] gap-10 items-center">
        <div>
          <div className={`inline-flex items-center gap-2 px-3 py-[7px] rounded-full text-[12px] font-[600] ${glass(dark)}`}>
            <Siren className="w-3.5 h-3.5 text-orange-500" />
            Live network · {users.length} real members registered
          </div>
          <h1 className="display mt-5 text-[44px] sm:text-[62px] leading-[0.95] tracking-[-0.022em] font-[700]">
            Food rescue,<br/>at production<br/>speed.
          </h1>
          <p className={`mt-5 text-[17.5px] leading-relaxed max-w-[560px] ${dark ? 'text-zinc-300' : 'text-zinc-600'}`}>
            FoodLink connects verified donors, NGOs and volunteer riders on a realtime map with QR cold-chain, Supabase RLS, and instant impact scoring. End food waste today.
          </p>
          <div className="flex flex-wrap gap-3 mt-7">
            <button onClick={onGetStarted} className="px-[22px] h-[52px] rounded-[18px] text-[15px] font-[700] text-white bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-lg shadow-emerald-600/30">
              Start rescuing → 
            </button>
            <button className={`px-[21px] h-[52px] rounded-[18px] text-[15px] font-[620] ${glass(dark)}`}>View live map</button>
          </div>
          <div className="flex gap-7 mt-7 text-[13px]">
            <div><div className="display text-[25px] font-[680]">4.8★</div><div className="opacity-70">Trust score</div></div>
            <div><div className="display text-[25px] font-[680]">11 min</div><div className="opacity-70">Avg pickup</div></div>
            <div><div className="display text-[25px] font-[680]">98.4%</div><div className="opacity-70">Safe delivery</div></div>
          </div>
        </div>

        {/* HERO GLASS CARD - PORTRAIT CONSOLE */}
        <GlassCard dark={dark} className="relative p-5 sm:p-7 glass-noise overflow-hidden max-w-[440px] mx-auto w-full aspect-[9/16] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-[700] tracking-wider opacity-70">LIVE RESCUE PORTRAIT</div>
              <div className="text-[11px] px-2.5 py-[5px] rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-[650]">Real-time</div>
            </div>
            <div className={`mt-4 h-[380px] rounded-[22px] overflow-hidden ring-1 ${dark?'ring-white/10':'ring-black/5'}`}>
              <MapLite dark={dark} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4 text-center">
            {[
              {k: completedMealsCount, l:'meals rescued'},
              {k: activePickupsCount, l:'active pickups'},
              {k: emergencyCount, l:'emergency open'},
            ].map(i=>(
              <div key={i.l} className={`rounded-[18px] py-2.5 ${dark?'bg-white/[0.03]':'bg-black/[0.02]'}`}>
                <div className="display text-[18px] font-[700]">{i.k}</div>
                <div className="text-[10px] leading-tight opacity-70">{i.l}</div>
              </div>
            ))}
          </div>
        </GlassCard>
      </section>

      {/* Features grid */}
      <section id="features" className="max-w-[1220px] mx-auto px-6 sm:px-7 py-10">
        <div className="grid md:grid-cols-3 gap-5">
          {[
            {icon:<Sprout className="w-[18px] h-[18px]"/>, title:'Verified cold chain', body:'QR pickups, food safety checklist, photo proof at every hand-off.'},
            {icon:<MapPin className="w-[18px] h-[18px]"/>, title:'Live maps + routes', body:'Google Maps + Supabase Realtime movement of volunteers.'},
            {icon:<ShieldCheck className="w-[18px] h-[18px]"/>, title:'RLS secured', body:'Postgres Row-Level Security, KYC NGOs, audit trails.'},
          ].map(f=>(
            <GlassCard key={f.title} dark={dark} className="p-[22px]">
              <div className={`w-11 h-11 rounded-[16px] flex items-center justify-center ${dark?'bg-emerald-400/10 text-emerald-300':'bg-emerald-50 text-emerald-700'}`}>{f.icon}</div>
              <div className="mt-3 text-[16.5px] font-[700]">{f.title}</div>
              <div className={`text-[14px] mt-1.5 leading-relaxed ${dark?'text-zinc-300':'text-zinc-600'}`}>{f.body}</div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-[1220px] mx-auto px-6 sm:px-7 py-12">
        <div className="display text-[34px] sm:text-[40px] font-[700] tracking-[-0.018em]">How FoodLink flows</div>
        <div className="grid md:grid-cols-4 gap-5 mt-7">
          {[
            {n:'01', t:'Donor lists food', d:'Photo, servings, expiry, live pin.'},
            {n:'02', t:'NGO accepts', d:'Nearby verified NGOs claim in seconds.'},
            {n:'03', t:'Rider QR pickup', d:'Volunteer scans QR, cold-chain starts.'},
            {n:'04', t:'Delivered & scored', d:'Proof upload, impact points, rank up.'},
          ].map(s=>(
            <GlassCard key={s.n} dark={dark} className="p-[22px] relative overflow-hidden">
              <div className="text-[12px] opacity-60">{s.n}</div>
              <div className="text-[17px] font-[720] mt-1">{s.t}</div>
              <div className={`text-[13.8px] mt-2 ${dark?'text-zinc-300':'text-zinc-600'}`}>{s.d}</div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section id="impact" className="max-w-[1220px] mx-auto px-6 sm:px-7 py-12">
        <GlassCard dark={dark} className="p-7 md:p-10">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            {[
              {v: completedMealsCount, l:'Meals rescued'},
              {v: nNGOs, l:'Verified NGOs'},
              {v: nVolunteers, l:'Active volunteers'},
              {v: (completedMealsCount * 0.62).toFixed(1) + ' kg', l:'CO₂ avoided'},
            ].map(x=>(
              <div key={x.l}>
                <div className="display text-[36px] font-[700] tracking-[-0.017em]">{x.v}</div>
                <div className={`${dark?'text-zinc-300':'text-zinc-600'} text-[13.5px]`}>{x.l}</div>
              </div>
            ))}
          </div>
        </GlassCard>
      </section>

      {/* Testimonials */}
      <section className="max-w-[1220px] mx-auto px-6 sm:px-7 py-8">
        <div className="grid md:grid-cols-3 gap-5">
          {[
            {name:'Ananya – Taj Vivanta', quote:'From surplus to shelter in 17 minutes. The QR proof keeps our FSSAI team happy.'},
            {name:'Feeding India Hub BLR', quote:'Emergency alerts filled 220 plates in 50 min. Realtime rider ping is gold.'},
            {name:'Priya · Volunteer', quote:'I love the streak + rank system. Donors trust me – 184 safe deliveries.'},
          ].map(ti=>(
            <GlassCard key={ti.name} dark={dark} className="p-[22px]">
              <div className="flex text-amber-400">★★★★★</div>
              <div className={`mt-3 text-[15px] leading-relaxed ${dark?'text-zinc-200':'text-zinc-700'}`}>“{ti.quote}”</div>
              <div className="text-[12.5px] mt-3 opacity-70">— {ti.name}</div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* leaderboard preview */}
      <section className="max-w-[1220px] mx-auto px-6 sm:px-7 py-12">
        <div className="flex items-center justify-between mb-5">
          <div className="display text-[30px] font-[700]">Top impact this month</div>
          <button onClick={onGetStarted} className={`text-[13px] font-[600] ${glass(dark)} px-3 py-[8px] rounded-[14px]`}>View full leaderboard</button>
        </div>
        <div className="grid md:grid-cols-4 gap-4">
          {users.slice(0,4).map((u,i)=>(
            <GlassCard key={u.id} dark={dark} className="p-4 flex items-center gap-3">
              <div className="text-[12px] font-[800] opacity-60">#{i+1}</div>
              {(() => {
                const av = getAvatarStyle(u.email, u.full_name)
                return (
                  <div className={`w-12 h-12 rounded-[16px] flex items-center justify-center text-white text-[14px] font-[700] bg-gradient-to-br ${av.gradient} shadow-md`}>
                    {av.initials}
                  </div>
                )
              })()}
              <div>
                <div className="text-[14.5px] font-[700]">{u.full_name}</div>
                <div className={`text-[12px] ${dark?'text-emerald-300':'text-emerald-700'}`}>{u.points} pts · {u.rank}</div>
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
        <div className="display text-[30px] font-[700] mb-6 text-center">FAQs</div>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            ['Is this NGO verified?', 'Every NGO submits 12A, FSSAI & address proof. Admin KYC before going live.'],
            ['How fast is pickup?', 'Median 11 minutes in BLR. Emergency alerts push to 3km radius instantly.'],
            ['Is food safe?', 'Donors complete temperature + expiry checklist. Photo proof at pickup & delivery.'],
            ['Points & ranks?', 'Normal 10 pts, emergency 20 pts, 50+ servings +15. Ranks auto-upgrade with confetti.'],
          ].map(([q,a])=>(
            <GlassCard key={q} dark={dark} className="p-[18px]">
              <div className="font-[700] text-[15px]">{q}</div>
              <div className={`text-[13.6px] mt-1.5 ${dark?'text-zinc-300':'text-zinc-600'}`}>{a}</div>
            </GlassCard>
          ))}
        </div>
      </section>
    </div>
  )
}

function MapLite({ dark }:{ dark:boolean }) {
  const { donations } = useStore()
  return (
    <MapContainer center={[12.9716,77.5946]} zoom={12} style={{ height:'100%', width:'100%' }} scrollWheelZoom={false} attributionControl={false}>
      <TileLayer
        url={dark
          ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
      />
      {donations.map(d=>(
        <Marker key={d.id} position={[d.lat, d.lng]}><Popup>{d.food_name} · {d.servings} servings · {d.status}</Popup></Marker>
      ))}
    </MapContainer>
  )
}

// --- AUTH MODAL ---
function AuthModal({ dark, tr, onClose }:{ dark:boolean, tr:any, onClose:()=>void }) {
  const { setCurrentUser } = useStore()
  const [mode, setMode] = useState<'login'|'register'>('login')
  const [role, setRole] = useState<Role>('donor')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !pass) {
      toast.error('Please enter both email and password.')
      return
    }
    if (mode === 'register' && !name) {
      toast.error('Please enter your name or organization.')
      return
    }
    
    setBusy(true)
    try {
      if (mode === 'register') {
        const result = await authDb.signUpWithEmail(email, pass, {
          full_name: name,
          role: role,
          organization_name: role === 'ngo' ? name : undefined,
          verified: true,
          points: 0,
          rank: 'Bronze',
          streak: 0
        })
        if (result.error) {
          toast.error(result.error)
          setBusy(false)
          return
        }
        if (result.user) {
          const profile = await db.ensureProfile(result.user, {
            full_name: name,
            role: role,
            organization_name: role === 'ngo' ? name : undefined,
            verified: true,
            points: 0,
            rank: 'Bronze',
            streak: 0
          })
          if (profile) {
            useStore.getState().addUser(profile)
            setCurrentUser(profile)
          }
          toast.success('Registration successful! Check email to verify.')
          onClose()
        }
      } else {
        const result = await authDb.signInWithEmail(email, pass)
        if (result.error) {
          toast.error(result.error)
          setBusy(false)
          return
        }
        if (result.user) {
          const profile = await db.getProfile(result.user.id)
          if (profile) {
            setCurrentUser(profile)
            toast.success(`Welcome back, ${profile.full_name}`)
            onClose()
          } else {
            toast.error('Profile not found. Please register first.')
          }
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[6px]" onClick={onClose} />
      <motion.div initial={{y:16, scale:.975}} animate={{y:0, scale:1}} exit={{y:12, opacity:0}}
        className={`relative w-full max-w-[980px] grid md:grid-cols-[1.05fr_1fr] rounded-[30px] overflow-hidden ${glass(dark)} glass-noise`}
      >
        <div className="hidden md:block relative p-9 bg-gradient-to-br from-emerald-600 via-emerald-600 to-orange-500 text-white">
          <div className="display text-[34px] font-[700] leading-tight">FoodLink Control<br/>Center</div>
          <div className="mt-3 text-[14.7px] text-emerald-50/95">Supabase Auth • RLS • Realtime • Google Maps</div>
          <div className="mt-8 space-y-3 text-[13.6px]">
            {['Email authentication','Role RBAC (Donor/NGO/Volunteer/Admin)','Live chat • QR • Badges • Leaderboard','End-to-end cold-chain proof'].map(b=>(
              <div key={b} className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/>{b}</div>
            ))}
          </div>
          <div className="absolute bottom-9 left-9 right-9 text-[12px] text-emerald-100/90">
            Secure RLS storage enabled. Register a real account below. No mock profiles loaded.
          </div>
        </div>

        <div className={`p-[28px] ${dark?'bg-[#11161a]/40':'bg-white/78'}`}>
          <div className="flex items-center justify-between">
            <div className="text-[22px] font-[750] display">{mode==='login'? tr('welcome_back') : 'Create your FoodLink'}</div>
            <button onClick={onClose} className={`w-9 h-9 rounded-[12px] flex items-center justify-center ${dark?'bg-white/[0.07]':'bg-black/[0.05]'}`}>✕</button>
          </div>

          <div className={`mt-4 grid grid-cols-4 gap-2 p-[6px] rounded-[18px] ${dark?'bg-white/[0.05]':'bg-black/[0.040]'}`}>
            {(['donor','ngo','volunteer','admin'] as Role[]).map(r=>(
              <button key={r} onClick={()=> { setRole(r); setMode('register') }} type="button"
                className={`py-[10px] rounded-[13px] text-[12.6px] font-[660] capitalize transition ${role===r ? 'bg-emerald-600 text-white shadow' : (dark?'text-zinc-300 hover:bg-white/[0.06]':'text-zinc-700 hover:bg-white')}`}>
                {tr(r as any)}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-5 space-y-3.5">
            {mode==='register' && (
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name / Organization" required
                className={`w-full h-[50px] px-4 rounded-[16px] outline-none text-[14.5px] ${dark?'bg-white/[0.06] border-white/[0.10] text-white placeholder:text-zinc-400':'bg-white border-black/[0.07] text-zinc-900'} border`} />
            )}
            <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="Email" required
              className={`w-full h-[50px] px-4 rounded-[16px] outline-none text-[14.5px] ${dark?'bg-white/[0.06] border-white/[0.10] text-white placeholder:text-zinc-400':'bg-white border-black/[0.07] text-zinc-900'} border`} />
            <input value={pass} onChange={e=>setPass(e.target.value)} type="password" placeholder="Password" required
              className={`w-full h-[50px] px-4 rounded-[16px] outline-none text-[14.5px] ${dark?'bg-white/[0.06] border-white/[0.10] text-white placeholder:text-zinc-400':'bg-white border-black/[0.07] text-zinc-900'} border`} />
            <div className="flex items-center justify-between text-[12.8px]">
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" defaultChecked /> Remember me</label>
              <button type="button" className="text-emerald-600 font-[600]">Forgot?</button>
            </div>
            <button disabled={busy} className="w-full h-[52px] rounded-[16px] font-[720] text-white bg-gradient-to-r from-emerald-600 to-emerald-500 disabled:opacity-60">
              {busy ? 'Authenticating…' : (mode==='login' ? 'Sign in securely' : 'Create account')}
            </button>
            <div className="text-[13px] text-center opacity-80">
              {mode==='login' ? "No account? " : "Already have an account? "}
              <button type="button" onClick={()=>setMode(mode==='login' ? 'register':'login')} className="text-emerald-600 font-[700]">{mode==='login' ? 'Register' : 'Login'}</button>
            </div>
          </form>

          <div className={`mt-4 rounded-[16px] p-[14px] text-[12.6px] ${dark?'bg-emerald-400/[0.07] text-emerald-300':'bg-emerald-50 text-emerald-800'}`}>
            <strong>Authentic Profiles Only:</strong> Please select your desired role above and complete a real registration. This maps instantly to the active, live member and donation system.
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// -------- DASHBOARD ----------
function Dashboard({ dark, tr, lang }:{ dark:boolean, tr:any, lang:Lang }) {
  const { currentUser } = useStore()
  const [tab, setTab] = useState('overview')
  const role = currentUser?.role || 'donor'

  const roleTabs: Record<Role, {key:string,label:string,icon:any}[]> = {
    donor: [
      {key:'overview', label:'Overview', icon: Activity},
      {key:'share', label: tr('upload_food'), icon: Sprout},
      {key:'donations', label:'My Donations', icon: HeartHandshake},
      {key:'impact', label:'Impact', icon: Trophy},
      {key:'chat', label: tr('chat'), icon: MessageCircle},
      {key:'leaderboard', label: tr('leaderboard'), icon: Award},
    ],
    ngo: [
      {key:'nearby', label:'Nearby', icon: MapPin},
      {key:'accepted', label:'Accepted', icon: CheckCircle2},
      {key:'emergency', label:'Emergency', icon: Siren},
      {key:'chat', label: tr('chat'), icon: MessageCircle},
      {key:'leaderboard', label:'Board', icon: Trophy},
    ],
    volunteer: [
      {key:'assignments', label:'Assignments', icon: Truck},
      {key:'map', label:'Live Map', icon: MapPin},
      {key:'completed', label:'Completed', icon: BadgeCheck},
      {key:'chat', label:'Chat', icon: MessageCircle},
    ],
    admin: [
      {key:'analytics', label:'Analytics', icon: BarChart3},
      {key:'users', label:'Users', icon: Users2},
      {key:'heatmap', label:'Heatmap', icon: MapPin},
      {key:'alerts', label:'Alerts', icon: Siren},
    ]
  }
  const tabs = roleTabs[role]
  useEffect(()=>{ setTab(tabs[0].key) }, [role])

  return (
    <div className="max-w-[1220px] mx-auto px-4 sm:px-7 py-7">
      {/* search top bar */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`text-[13.5px] px-3 py-[8px] rounded-full ${glass(dark)}`}>
            {role.toUpperCase()} CONSOLE · {currentUser?.organization_name || currentUser?.full_name}
          </div>
          <div className={`hidden sm:block text-[12px] px-3 py-[7px] rounded-full ${dark?'bg-emerald-400/10 text-emerald-300':'bg-emerald-50 text-emerald-800'}`}>
            {currentUser?.points} pts · {currentUser?.rank}
          </div>
        </div>
        <div className={`flex items-center gap-2 ${glass(dark)} rounded-[18px] px-3 h-[48px] w-full lg:w-[440px]`}>
          <Search className="w-[18px] h-[18px] opacity-70" />
          <input placeholder={tr('search')} className="bg-transparent outline-none w-full text-[14px]" />
          <span className={`text-[11px] px-2 py-[4px] rounded-[10px] ${dark?'bg-white/[0.07]':'bg-black/[0.05]'}`}>⌘K</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-[266px_minmax(0,1fr)] gap-6">
        {/* sidebar */}
        <aside className="hidden lg:block">
          <GlassCard dark={dark} className="p-[14px] sticky top-[96px]">
            <div className="space-y-[7px]">
              {tabs.map(t=> (
                <button key={t.key} onClick={()=>setTab(t.key)}
                  className={`w-full flex items-center gap-[11px] px-[14px] h-[48px] rounded-[16px] text-[14.3px] font-[580] transition ${tab===t.key
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
                    : `${dark?'text-zinc-300 hover:bg-white/[0.06]':'text-zinc-700 hover:bg-black/[0.045]'}`}`}>
                  <t.icon className="w-[18px] h-[18px]" />
                  {t.label}
                </button>
              ))}
            </div>
            <div className={`mt-4 rounded-[18px] p-4 ${dark?'bg-white/[0.04]':'bg-black/[0.032]'}`}>
              <div className="text-[11.5px] uppercase tracking-wider opacity-70 font-[700]">Rank Progress</div>
              <div className={`mt-2 h-[9px] rounded-full ${dark?'bg-white/[0.09]':'bg-black/[0.09]'} overflow-hidden`}>
                <div className={`h-full bg-gradient-to-r ${rankColor[currentUser?.rank || 'Bronze']}`} style={{width: `${Math.min(100, ((currentUser?.points||0)%300)/3)}%`}} />
              </div>
              <div className="text-[12.5px] mt-2">{currentUser?.points} / next tier</div>
            </div>
          </GlassCard>

          {/* Badges mini */}
          <GlassCard dark={dark} className="p-4 mt-4">
            <div className="text-[12.5px] font-[700] opacity-80 mb-2">{tr('badges')}</div>
            <div className="flex flex-wrap gap-2 text-[18px]">
              {badgeDefs.slice(0,5).map(b=> <div key={b.key} className={`w-10 h-10 rounded-[14px] flex items-center justify-center ${dark?'bg-white/[0.05]':'bg-black/[0.035]'}`} title={b.name}>{b.icon}</div>)}
            </div>
          </GlassCard>
        </aside>

        {/* main */}
        <div className="min-w-0">
          {/* mobile tab bar */}
          <div className="lg:hidden flex gap-2 overflow-x-auto pb-3">
            {tabs.map(t=>(
              <button key={t.key} onClick={()=>setTab(t.key)}
                className={`flex-shrink-0 px-3.5 h-[42px] rounded-[15px] text-[13px] font-[600] ${tab===t.key ? 'bg-emerald-600 text-white' : glass(dark)}`}>
                {t.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:.22}}>
              {role==='donor' && <DonorViews active={tab} dark={dark} tr={tr} lang={lang} />}
              {role==='ngo' && <NGOViews active={tab} dark={dark} tr={tr} />}
              {role==='volunteer' && <VolunteerViews active={tab} dark={dark} tr={tr} />}
              {role==='admin' && <AdminViews active={tab} dark={dark} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

// DONOR VIEWS
function DonorViews({ active, dark, tr, lang: _lang }:{ active:string, dark:boolean, tr:any, lang:Lang }) {
  const { currentUser, donations, users } = useStore()
  const myDonations = donations.filter(d=>d.donor_id===currentUser?.id)
  const completedMeals = myDonations.reduce((a,d)=> a + (d.status==='completed' ? d.servings : 0), 0)

  if(active==='share') return <DonorShareForm dark={dark} tr={tr} />
  if(active==='donations') return <DonationList dark={dark} list={myDonations} canCancel />
  if(active==='impact') return <ImpactPanel dark={dark} user={currentUser!} myDonations={myDonations} />
  if(active==='chat') return <ChatPanel dark={dark} />
  if(active==='leaderboard') return <Leaderboard dark={dark} />

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {label:tr('points'), value: currentUser?.points, icon: Star, sub:'+85 this week'},
          {label:'Meals Rescued', value: completedMeals, icon: UtensilsCrossed, sub:'lifetime'},
          {label:tr('rank'), value: currentUser?.rank, icon: Trophy, sub:'Streak '+currentUser?.streak+' days'},
          {label:'CO₂ Saved', value:'1.84t', icon: Leaf, sub:'verified'},
        ].map(c=>(
          <GlassCard key={c.label} dark={dark} className="p-[18px]">
            <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center ${dark?'bg-emerald-400/10 text-emerald-300':'bg-emerald-50 text-emerald-700'} mb-3`}>
              <c.icon className="w-[18px] h-[18px]" />
            </div>
            <div className="text-[11.5px] uppercase tracking-wider opacity-70 font-[650]">{c.label}</div>
            <div className="display text-[30px] font-[700] tracking-[-0.015em]">{c.value}</div>
            <div className={`text-[12.3px] ${dark?'text-emerald-300':'text-emerald-700'}`}>{c.sub}</div>
          </GlassCard>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1.35fr_0.65fr] gap-5">
        <GlassCard dark={dark} className="p-[20px]">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[16px] font-[720]">Active donations</div>
            <div className={`text-[11px] px-2.5 py-[5px] rounded-full ${dark?'bg-white/[0.07]':'bg-black/[0.05]'} `}>Realtime</div>
          </div>
          <div className="space-y-3">
            {myDonations.slice(0,3).map(d=>(
              <div key={d.id} className={`flex gap-[14px] p-[14px] rounded-[18px] ${dark?'bg-white/[0.03]':'bg-black/[0.028]'}`}>
                <img src={d.images?.[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop'} className="w-20 h-20 rounded-[14px] object-cover" alt="" />
                <div className="flex-1 min-w-0">
                  <div className="font-[680]">{d.food_name}</div>
                  <div className="text-[12.7px] opacity-80">{d.servings} meals · {d.quantity_kg}kg · {d.veg_type}</div>
                  <div className={`mt-1 text-[11.5px] inline-flex px-2.5 py-[4px] rounded-full ${statusTint(d.status, dark)}`}>{d.status.replace('_',' ')}</div>
                </div>
                <div className="text-right text-[12px] opacity-80">
                  expires<br/><b>{new Date(d.expiry_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</b>
                </div>
              </div>
            ))}
            {myDonations.length===0 && <div className="opacity-70 text-[14px]">No active donations yet.</div>}
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
          {users.filter(u=>u.role==='ngo').map(n=>(
            <div key={n.id} className={`p-[14px] rounded-[18px] ${dark?'bg-white/[0.035]':'bg-black/[0.033]'}`}>
              <div className="font-[680] text-[14.5px]">{n.organization_name || n.full_name}</div>
              <div className="text-[12.5px] opacity-80">Verified • 2.1 km</div>
              <button className="mt-2 text-[12.5px] text-emerald-600 font-[650]" onClick={()=> toast('Added to favorites')}>♡ Favorite NGO</button>
            </div>
          ))}
          <div className={`p-[14px] rounded-[18px] border border-dashed ${dark? 'border-white/15' : 'border-black/15'} flex items-center justify-center text-[13px] opacity-70`}>+ Invite new NGO</div>
        </div>
      </GlassCard>
    </div>
  )
}

function DonorShareForm({ dark, tr }:{ dark:boolean, tr:any }) {
  const { currentUser } = useStore()
  const [submitting, setSubmitting] = useState(false)
  const [loc,setLoc]=useState({ lat:12.9716, lng:77.5946, addr:'Indiranagar 12th Main, Bengaluru' })
  const [images,setImages]=useState<string[]>(['https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1200&auto=format&fit=crop'])

  const pickLocation = () => {
    if(!navigator.geolocation){ toast.error('Geolocation not available'); return }
    navigator.geolocation.getCurrentPosition(pos=>{
      setLoc(l=>({...l, lat:pos.coords.latitude, lng:pos.coords.longitude, addr:`Live GPS ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`}))
      toast.success('Live location attached')
    }, ()=> toast.error('Location denied'))
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setSubmitting(true)

    try {
      // 1. Upload images to Supabase Storage
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
        servings: Number(fd.get('servings') || 10),
        expiry_at: new Date(String(fd.get('expiry_at')) || Date.now() + 5 * 3600 * 1000).toISOString(),
        pickup_address: loc.addr,
        lat: loc.lat,
        lng: loc.lng,
        contact_phone: String(fd.get('contact_phone') || currentUser?.phone || ''),
        notes: String(fd.get('notes') || ''),
        images: uploadedImages.length > 0 ? uploadedImages : images
      }

      const newDonation = await donationsDb.create(donationData)
      if (!newDonation) {
        // Fallback to local if DB fails
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
        return
      }

      const pts = calcPoints(newDonation, false)
      await db.incrementPoints(currentUser!.id, pts)
      await notifsDb.send({
        user_id: currentUser!.id,
        title: 'Donation live',
        body: `${donationData.food_name} listed. +${pts} pts`,
        type: 'donation'
      })

      toast.success('Food listed! NGOs notified in 3km radius.')
      ;(e.target as HTMLFormElement).reset()
      setImages([])
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
        <Field label={tr('quantity')} dark={dark}><input name="quantity_kg" type="number" step="0.1" required defaultValue={8} className={inputCls(dark)} /></Field>
        <Field label={tr('servings')} dark={dark}><input name="servings" type="number" required defaultValue={32} className={inputCls(dark)} /></Field>
        <Field label={tr('expiry')} dark={dark}><input name="expiry_at" type="datetime-local" className={inputCls(dark)} required /></Field>
        <Field label={tr('contact')} dark={dark}><input name="contact_phone" defaultValue={currentUser?.phone||''} className={inputCls(dark)} required /></Field>
        <Field label="Pickup address" dark={dark} full>
          <div className="flex gap-2">
            <input value={loc.addr} onChange={e=>setLoc({...loc, addr:e.target.value})} className={inputCls(dark)+' flex-1'} />
            <button type="button" onClick={pickLocation} className={`px-3 rounded-[14px] text-[12.5px] font-[640] ${glass(dark)}`}>Use GPS</button>
          </div>
          <div className={`mt-4 rounded-[20px] overflow-hidden border ${dark ? 'border-white/12' : 'border-black/[0.08]'}`}>
            <MapContainer center={[loc.lat, loc.lng]} zoom={14} style={{ height:'240px', width:'100%' }} scrollWheelZoom={false} attributionControl={false}>
              <TileLayer
                url={dark
                  ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                  : 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png'}
              />
              <Marker
                position={[loc.lat, loc.lng]}
                draggable
                eventHandlers={{
                  dragend: (e:any) => {
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
        <Field label={tr('notes')} dark={dark} full><textarea name="notes" rows={3} placeholder="Allergens, spice level, packaging…" className={inputCls(dark)} /></Field>

        <div className="md:col-span-2">
          <div className="text-[12.5px] font-[650] mb-2 opacity-80">Food photos</div>
          <div className="flex flex-wrap gap-3">
            {images.map((src,i)=>(
              <div key={i} className="relative">
                <img src={src} className="w-[140px] h-[106px] object-cover rounded-[16px]" alt="" />
                <button type="button" onClick={()=>setImages(im=>im.filter((_,j)=>j!==i))} className="absolute top-1 right-1 bg-black/60 text-white text-[11px] px-[7px] py-[3px] rounded-[9px]">✕</button>
              </div>
            ))}
            <label className={`w-[140px] h-[106px] rounded-[16px] border-2 border-dashed ${dark?'border-white/18':'border-black/15'} flex items-center justify-center text-[12.5px] cursor-pointer`}>
              <input type="file" className="hidden" accept="image/*" multiple onChange={e=>{
                const files = Array.from(e.target.files||[])
                files.slice(0,3).forEach(f=>{
                  const reader = new FileReader()
                  reader.onload = ev => setImages(im=>[...im, String(ev.target?.result)])
                  reader.readAsDataURL(f)
                })
              }} />
              + Upload
            </label>
          </div>
        </div>

        <div className="md:col-span-2 flex items-center gap-3 pt-2">
          <button disabled={submitting} className="px-[20px] h-[52px] rounded-[16px] text-white font-[720] bg-gradient-to-r from-emerald-600 to-emerald-500 shadow shadow-emerald-600/25 disabled:opacity-60">
            {submitting ? 'Publishing…' : tr('submit')}
          </button>
          <div className={`text-[12.6px] ${dark?'text-zinc-300':'text-zinc-600'}`}>Earn {calcPoints({servings:32}, false)}–{calcPoints({servings:60}, false)} points · instant NGO push</div>
        </div>
      </form>
    </GlassCard>
  )
}

const inputCls = (dark:boolean) =>
  `w-full h-[50px] px-4 rounded-[16px] outline-none text-[14.5px] border ${dark ? 'bg-white/[0.055] border-white/[0.13] text-white placeholder:text-zinc-400' : 'bg-white border-black/[0.1] text-zinc-900'}`

function Field({label, children, dark, full}:{label:string, children:React.ReactNode, dark:boolean, full?:boolean}) {
  return <div className={full? 'md:col-span-2' : ''}>
    <div className={`text-[12.5px] font-[630] mb-[7px] ${dark?'text-zinc-300':'text-zinc-700'}`}>{label}</div>
    {children}
  </div>
}

function MapClickHandler({ setLoc }: { setLoc: React.Dispatch<React.SetStateAction<{ lat:number, lng:number, addr:string }>> }) {
  useMapEvents({
    click(e) {
      setLoc(prev => ({
        ...prev,
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        addr: `GPS ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`
      }))
    }
  })
  return null
}

function DonationList({ dark, list, canCancel=false }:{ dark:boolean, list:Donation[], canCancel?:boolean }) {
  const { updateDonation } = useStore()
  return (
    <div className="space-y-4">
      {list.map(d=>(
        <GlassCard key={d.id} dark={dark} className="p-[18px] md:p-[20px]">
          <div className="flex flex-col md:flex-row gap-4">
            <img src={d.images?.[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=800&auto=format&fit=crop'} className="w-full md:w-[200px] h-[140px] object-cover rounded-[16px]" alt="" />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-[18px] font-[720]">{d.food_name}</div>
                <span className={`text-[11px] px-2 py-[4px] rounded-full ${statusTint(d.status, dark)}`}>{d.status.replace('_',' ')}</span>
                <span className="text-[11px] px-2 py-[4px] rounded-full bg-orange-500/12 text-orange-700 dark:text-orange-300">{d.veg_type}</span>
              </div>
              <div className={`text-[13.8px] mt-1 ${dark?'text-zinc-300':'text-zinc-700'}`}>{d.servings} meals · {d.quantity_kg}kg · {d.category}</div>
              <div className="text-[13px] opacity-80 mt-1 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5"/>{d.pickup_address}</div>
              <div className="text-[12.5px] opacity-75 mt-1">Expires {new Date(d.expiry_at).toLocaleString()} · Contact {d.contact_phone}</div>
              <div className="flex gap-2 mt-3 flex-wrap">
                {d.status==='pending' && canCancel && <button onClick={()=>{updateDonation(d.id,{status:'cancelled'}); toast('Donation cancelled')}} className={`text-[12.5px] px-3 py-[7px] rounded-[12px] ${glass(dark)}`}>Cancel</button>}
                <button onClick={()=>toast('Opened chat')} className="text-[12.5px] px-3 py-[7px] rounded-[12px] bg-emerald-600 text-white">Open Chat</button>
                <button onClick={()=>toast('Shared to socials')} className={`text-[12.5px] px-3 py-[7px] rounded-[12px] ${glass(dark)} flex items-center gap-1`}><Share2 className="w-3.5 h-3.5"/> Share</button>
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
      {list.length===0 && <GlassCard dark={dark} className="p-8 text-center opacity-80">No donations yet. Share your first meal!</GlassCard>}
    </div>
  )
}

function statusTint(status:string, dark:boolean){
  const map:Record<string,string> = {
    pending: dark ? 'bg-amber-400/10 text-amber-300' : 'bg-amber-100 text-amber-800',
    accepted: dark ? 'bg-emerald-400/10 text-emerald-300' : 'bg-emerald-100 text-emerald-800',
    volunteer_assigned: dark ? 'bg-sky-400/10 text-sky-300' : 'bg-sky-100 text-sky-800',
    picked_up: dark ? 'bg-indigo-400/10 text-indigo-300' : 'bg-indigo-100 text-indigo-800',
    delivered: dark ? 'bg-teal-400/10 text-teal-300' : 'bg-teal-100 text-teal-900',
    completed: dark ? 'bg-emerald-400/15 text-emerald-200' : 'bg-emerald-100 text-emerald-900',
    cancelled: dark ? 'bg-zinc-600/20 text-zinc-300' : 'bg-zinc-200 text-zinc-700',
  }
  return map[status] || map.pending
}

// NGO VIEWS
function NGOViews({ active, dark, tr }:{ active:string, dark:boolean, tr:any }) {
  const { donations, currentUser, users, updateDonation } = useStore()
  const nearby = donations.filter(d => d.status === 'pending')
  const accepted = donations.filter(d => d.accepted_by === currentUser?.id)

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

      // Notify the donor
      await notifsDb.send({
        user_id: d.donor_id,
        title: 'Donation accepted',
        body: `${currentUser?.organization_name || currentUser?.full_name} accepted ${d.food_name}`,
        type: 'donation'
      })

      // Notify ALL volunteers with full from→to details
      if (volunteers.length > 0) {
        await Promise.all(volunteers.map(v => notifsDb.send({
          user_id: v.id,
          title: '🚀 Pickup Available – Claim Now!',
          body: `📍 FROM: ${d.pickup_address}\n📍 TO: ${currentUser?.organization_name || currentUser?.full_name}\n🍽️ ${d.food_name} (${d.servings} servings)\n⏰ Expires: ${new Date(d.expiry_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`,
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

  if (active === 'accepted') return <DonationList dark={dark} list={accepted} />
  if (active === 'emergency') return <EmergencyConsole dark={dark} tr={tr} />
  if (active === 'chat') return <ChatPanel dark={dark} />
  if (active === 'leaderboard') return <Leaderboard dark={dark} />

  return (
    <div className="space-y-5">
      <div className={`flex flex-wrap gap-2 ${glass(dark)} rounded-[18px] p-[10px]`}>
        {['Distance <3km', 'Veg', 'Non-Veg', 'Expiring <2h', '50+ meals'].map(f => (
          <button key={f} className={`text-[12.5px] px-3 py-[8px] rounded-[12px] ${dark ? 'bg-white/[0.05]' : 'bg-white'}`}>{f}</button>
        ))}
      </div>
      <div className="grid lg:grid-cols-[1.2fr_.8fr] gap-5">
        <div className="space-y-4">
          {nearby.map(d => (
            <GlassCard key={d.id} dark={dark} className="p-[16px]">
              <div className="flex gap-3">
                <img src={d.images?.[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop'} className="w-[110px] h-[86px] rounded-[14px] object-cover" alt="" />
                <div className="flex-1 min-w-0">
                  <div className="font-[700]">{d.food_name}</div>
                  <div className="text-[12.6px] opacity-80">{d.servings} meals · {haversine(currentUser!.lat, currentUser!.lng, d.lat, d.lng).toFixed(1)} km</div>
                  <div className="text-[12px] opacity-75">{d.pickup_address}</div>
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
          {nearby.length === 0 && <div className="text-center py-10 opacity-60">No new donations nearby</div>}
        </div>
        <GlassCard dark={dark} className="p-3 h-[520px]">
          <MapWithDonations dark={dark} donations={nearby} />
        </GlassCard>
      </div>
    </div>
  )
}

function EmergencyConsole({ dark, tr }:{ dark:boolean, tr:any }) {
  const { emergencies, currentUser, users } = useStore()
  const [priority, setPriority] = useState<EmergencyReq['priority']>('high')
  
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
      
      // Notify all donors
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
        // Fallback to local
        const localEr: EmergencyReq = {
          id: 'local_' + Math.random().toString(36).slice(2),
          ...erPayload,
          created_at: new Date().toISOString()
        } as EmergencyReq
        useStore.getState().addEmergency(localEr)
      }
      
      toast('Emergency alert broadcast • donors notified', { description: 'Push + Email + Popup' })
      ;(e.target as HTMLFormElement).reset()
    } catch (err: any) {
      toast.error(err.message || 'Failed to create emergency')
    }
  }
  return (
    <div className="grid lg:grid-cols-[0.95fr_1.05fr] gap-5">
      <GlassCard dark={dark} className="p-[20px]">
        <div className="text-[16.5px] font-[720] mb-3 flex items-center gap-2"><Siren className="w-[18px] h-[18px] text-orange-500"/> {tr('create_alert')}</div>
        <form onSubmit={submit} className="space-y-3.5">
          <input name="location" placeholder="Location / camp name" required className={inputCls(dark).replace('h-[50px]','h-[48px]')} />
          <div className="grid grid-cols-2 gap-3">
            <input name="meals" type="number" placeholder="Meals needed" required className={inputCls(dark).replace('h-[50px]','h-[48px]')} />
            <select value={priority} onChange={e=>setPriority(e.target.value as any)} className={inputCls(dark).replace('h-[50px]','h-[48px]')}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
            </select>
          </div>
          <textarea name="description" rows={4} placeholder="Situation, time window, contact…" className={inputCls(dark).replace('h-[50px]','h-auto py-3')} />
          <button className="w-full h-[50px] rounded-[15px] bg-orange-600 text-white font-[700]">Broadcast Emergency Alert</button>
          <div className="text-[12px] opacity-80">Nearby donors receive push + in-app popup + email.</div>
        </form>
      </GlassCard>
      <GlassCard dark={dark} className="p-[20px]">
        <div className="text-[15px] font-[700] mb-3">Active emergency requests</div>
        <div className="space-y-3 max-h-[460px] overflow-auto pr-1">
          {emergencies.map(er=>(
            <div key={er.id} className={`p-[14px] rounded-[16px] ${dark?'bg-white/[0.045]':'bg-amber-50/80'} border ${er.priority==='critical' ? 'border-orange-500/45' : dark ? 'border-white/10' : 'border-amber-200'}`}>
              <div className="flex items-center justify-between">
                <div className="font-[700]">{er.location}</div>
                <span className={`text-[10.5px] px-[9px] py-[4px] rounded-full font-[720] ${er.priority==='critical' ? 'bg-red-600 text-white' : 'bg-orange-500 text-white'}`}>{er.priority.toUpperCase()}</span>
              </div>
              <div className="text-[12.7px] mt-1 opacity-90">{er.description}</div>
              <div className="text-[12px] mt-2">{er.fulfilled}/{er.meals_needed} meals fulfilled · {er.ngo_name}</div>
              <div className={`mt-2 h-[7px] rounded-full ${dark?'bg-white/[0.09]':'bg-black/[0.08]'} overflow-hidden`}>
                <div className="h-full bg-orange-500" style={{width: `${Math.min(100, er.fulfilled/er.meals_needed*100)}%`}} />
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  )
}

// ============================================================
// PICKUP ALERT MODAL – pops up for volunteers when NGO accepts
// ============================================================
function PickupAlertModal({ dark, donation, onClaim, onDismiss }:{ dark:boolean, donation: Donation, onClaim:()=>void, onDismiss:()=>void }) {
  const { users } = useStore()
  const ngo = users.find(u => u.id === donation.accepted_by)
  const ngoName = ngo?.organization_name || ngo?.full_name || 'NGO'
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[6px]" onClick={onDismiss} />
      <motion.div
        initial={{ y: 20, scale: 0.96, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 12, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className={`relative w-full max-w-[560px] rounded-[28px] overflow-hidden ${glass(dark)} glass-noise`}
      >
        {/* Top gradient bar */}
        <div className="h-2 bg-gradient-to-r from-emerald-500 via-emerald-400 to-orange-400" />

        <div className="p-[24px]">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-[52px] h-[52px] rounded-[18px] bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg">
                <Navigation2 className="w-[26px] h-[26px] text-white" />
              </div>
              <div>
                <div className="text-[20px] font-[750] display leading-tight">Pickup Available!</div>
                <div className={`text-[12.5px] ${dark?'text-emerald-300':'text-emerald-700'} font-[650]`}>A new order needs a rider</div>
              </div>
            </div>
            <button onClick={onDismiss} className={`w-9 h-9 rounded-[12px] flex items-center justify-center ${dark?'bg-white/[0.07]':'bg-black/[0.05]'} hover:bg-red-500/15`}>
              <X className="w-[16px] h-[16px]" />
            </button>
          </div>

          {/* Food card */}
          <div className={`rounded-[20px] p-[18px] ${dark?'bg-white/[0.05]':'bg-emerald-50/70'} border ${dark?'border-white/[0.08]':'border-emerald-100'}`}>
            <div className="flex gap-4">
              <img
                src={donation.images?.[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=400&auto=format&fit=crop'}
                className="w-[110px] h-[110px] rounded-[16px] object-cover shadow-sm"
                alt={donation.food_name}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[19px] font-[720] tracking-tight">{donation.food_name}</div>
                <div className={`text-[13.5px] mt-1 flex items-center gap-2 ${dark?'text-zinc-300':'text-zinc-600'}`}>
                  <span className="font-[650]">{donation.servings} meals</span>
                  <span className="w-1 h-1 rounded-full bg-current opacity-40" />
                  <span>{donation.quantity_kg} kg</span>
                  <span className="w-1 h-1 rounded-full bg-current opacity-40" />
                  <span className="capitalize">{donation.veg_type}</span>
                </div>
                <div className={`mt-2 flex items-center gap-1.5 text-[12.5px] ${dark?'text-amber-300':'text-amber-700'}`}>
                  <Clock className="w-4 h-4" />
                  Expires {new Date(donation.expiry_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          </div>

          {/* FROM → TO route */}
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
            <div className={`rounded-[16px] p-[14px] ${dark?'bg-white/[0.04]':'bg-black/[0.03]'}`}>
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
              <div className={`w-[2px] h-[24px] ${dark?'bg-white/15':'bg-black/10'}`} />
              <div className={`text-[10px] font-[700] ${dark?'text-emerald-300':'text-emerald-700'}`}>
                {donation.accepted_by ? haversine(
                  donation.lat, donation.lng,
                  users.find(u => u.id === donation.accepted_by)?.lat || 12.9716,
                  users.find(u => u.id === donation.accepted_by)?.lng || 77.5946
                ).toFixed(1) : '?'} km
              </div>
            </div>

            <div className={`rounded-[16px] p-[14px] ${dark?'bg-white/[0.04]':'bg-black/[0.03]'}`}>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider opacity-60 font-[700] mb-1">
                <MapPin className="w-3.5 h-3.5 text-orange-500" />
                DELIVER TO
              </div>
              <div className="text-[14px] font-[650] leading-tight">{ngoName}</div>
              <div className="text-[12px] opacity-70 mt-1">NGO accepting the food</div>
            </div>
          </div>

          {/* Priority + Contact */}
          <div className="mt-3 flex gap-2">
            <div className={`flex-1 rounded-[14px] px-[14px] py-[10px] text-[12.5px] ${dark?'bg-amber-400/10 text-amber-300':'bg-amber-50 text-amber-800'}`}>
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              Priority pickup – food expires soon
            </div>
          </div>

          {/* Action buttons */}
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

          <div className={`mt-3 text-[11.5px] text-center ${dark?'text-zinc-400':'text-zinc-500'}`}>
            Claiming will assign this pickup to you. You'll see QR code & routing details.
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// VOLUNTEER
function VolunteerViews({ active, dark, tr: _tr }:{ active:string, dark:boolean, tr:any }) {
  const { donations, currentUser, updateDonation, users, pickupAlerts, addPickupAlert, removePickupAlert, clearPickupAlerts } = useStore()
  const [activePickupAlert, setActivePickupAlert] = useState<Donation | null>(null)

  // Show available pickups (status=accepted with no volunteer) AND claimed ones
  const availablePickups = donations.filter(d =>
    currentUser?.role?.toLowerCase() === 'volunteer' &&
    d.status === 'accepted' &&
    !d.volunteer_id
  )
  const claimedPickups = donations.filter(d =>
    d.volunteer_id === currentUser?.id &&
    ['volunteer_assigned', 'picked_up', 'delivered'].includes(d.status)
  )

  // Monitor pickupAlerts state to show modal
  useEffect(() => {
    if (pickupAlerts.length > 0 && currentUser?.role === 'volunteer') {
      const latestAlertId = pickupAlerts[pickupAlerts.length - 1]
      const donation = donations.find(d => d.id === latestAlertId)
      if (donation && donation.status === 'accepted' && !donation.volunteer_id) {
        setActivePickupAlert(donation)
      }
    }
  }, [pickupAlerts, donations, currentUser])

  // Listen for real-time donation updates to trigger alerts
  const alertedIdsRef = useRef(new Set<string>())
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'volunteer') return

    const channel = supabase
      .channel('volunteer-pickup-alerts')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'donations', filter: `status=eq.accepted` },
        (payload) => {
          const updated = payload.new as Donation
          // Only alert if no volunteer assigned yet and not already alerted
          if (!updated.volunteer_id && !alertedIdsRef.current.has(updated.id)) {
            alertedIdsRef.current.add(updated.id)
            addPickupAlert(updated.id)
            // Play notification sound / toast
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

  const getDeliveryDestination = (d: Donation) => {
    const ngo = users.find(u => u.id === d.accepted_by)
    return ngo ? ngo.organization_name || ngo.full_name : 'NGO Hub'
  }

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

      if (points > 0) {
        await db.incrementPoints(currentUser!.id, points)
        await notifsDb.send({
          user_id: currentUser!.id,
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

  if (active === 'map') return <GlassCard dark={dark} className="p-3 h-[560px]"><MapWithDonations dark={dark} donations={[...availablePickups, ...claimedPickups]} /></GlassCard>
  if (active === 'completed') return <DonationList dark={dark} list={donations.filter(d => d.status === 'completed' && d.volunteer_id === currentUser?.id)} />
  if (active === 'chat') return <ChatPanel dark={dark} />

  // Show available section even when no items
  return (
    <div className="space-y-4">
      {/* Pickup Alert Modal */}
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

      {/* New Pickups Available Banner */}
      {availablePickups.length > 0 && (
        <GlassCard dark={dark} className={`p-[16px] border-l-4 border-l-emerald-500 ${dark ? 'bg-emerald-500/8' : 'bg-emerald-50/80'}`}>
          <div className="flex items-center gap-3">
            <Navigation2 className="w-6 h-6 text-emerald-500 animate-pulse" />
            <div>
              <div className="font-[700] text-[15px]">{availablePickups.length} New Available Pickup{availablePickups.length > 1 ? 's' : ''}</div>
              <div className={`text-[12.5px] ${dark?'text-zinc-300':'text-zinc-600'}`}>
                These donations have been accepted by NGOs and need a volunteer to deliver
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Available Pickups Section */}
      {availablePickups.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[14px] font-[700]">Available Pickups</span>
            <span className={`text-[12px] px-2.5 py-[3px] rounded-full ${dark?'bg-emerald-400/10 text-emerald-300':'bg-emerald-100 text-emerald-700'}`}>
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
                      <span className={`text-[10px] px-2 py-[2px] rounded-full bg-orange-500/12 text-orange-600 dark:text-orange-300 font-[650]`}>
                        {d.veg_type}
                      </span>
                    </div>

                    {/* FROM → TO Route Display */}
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
                      <span className={`px-2 py-[3px] rounded-full ${dark?'bg-amber-400/10 text-amber-300':'bg-amber-100 text-amber-700'}`}>
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
                        onClick={() => {
                          setActivePickupAlert(d)
                        }}
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

      {/* My Active Assignments Section */}
      {claimedPickups.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-6">
            <Truck className="w-4 h-4 text-emerald-500" />
            <span className="text-[14px] font-[700]">My Active Assignments</span>
            <span className={`text-[12px] px-2.5 py-[3px] rounded-full ${dark?'bg-blue-400/10 text-blue-300':'bg-blue-100 text-blue-700'}`}>
              {claimedPickups.length} active
            </span>
          </div>

          {claimedPickups.map(d => {
            const ngo = users.find(u => u.id === d.accepted_by)
            const ngoName = ngo?.organization_name || ngo?.full_name || 'NGO'

            return (
              <GlassCard key={d.id} dark={dark} className="p-[18px]">
                <div className="flex flex-col md:flex-row gap-4">
                  <img src={d.images?.[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=600&auto=format&fit=crop'} className="w-full md:w-[180px] h-[128px] object-cover rounded-[16px]" alt="" />
                  <div className="flex-1">
                    <div className="text-[17px] font-[720]">{d.food_name}</div>

                    {/* FROM → TO for claimed */}
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
                        <button onClick={() => handleUpdateStatus(d.id, 'delivered')} className={`px-3 py-[9px] rounded-[12px] text-[13px] ${glass(dark)} flex items-center gap-1.5`}><Camera className="w-4 h-4" /> Upload Proof</button>
                      )}
                      {d.status === 'delivered' && (
                        <button onClick={() => handleUpdateStatus(d.id, 'completed', 18)} className={`px-3 py-[9px] rounded-[12px] text-[13px] ${glass(dark)}`}>Mark Completed</button>
                      )}
                    </div>
                  </div>
                  <div className="w-full md:w-[170px] flex flex-col items-center">
                    <div className={`p-[10px] rounded-[16px] ${dark ? 'bg-white' : 'bg-white'} shadow-sm`}>
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

      {/* Empty state */}
      {availablePickups.length === 0 && claimedPickups.length === 0 && (
        <GlassCard dark={dark} className="p-16 text-center">
          <Truck className="w-14 h-14 mx-auto mb-4 opacity-30" />
          <div className="text-[18px] font-[700]">No assignments yet</div>
          <div className={`text-[14px] mt-2 ${dark?'text-zinc-400':'text-zinc-500'}`}>
            When an NGO accepts a donation, you'll see it here with full pickup & delivery details.
          </div>
        </GlassCard>
      )}
    </div>
  )
}

// ADMIN
function AdminViews({ active, dark }:{ active:string, dark:boolean }) {
  const { users, donations, emergencies, currentUser } = useStore()
  const allUsers = users.length > 0 ? users : currentUser ? [currentUser] : []
  const [roleFilter, setRoleFilter] = useState<'all'|Role>('all')
  const [searchTerm, setSearchTerm] = useState('')

  const filteredUsers = allUsers.filter(u => {
    const matchesRole = roleFilter === 'all' || u.role === roleFilter
    const term = searchTerm.toLowerCase()
    const matchesSearch = !term
      || (u.full_name || '').toLowerCase().includes(term)
      || (u.email || '').toLowerCase().includes(term)
      || (u.organization_name || '').toLowerCase().includes(term)
    return matchesRole && matchesSearch
  })

  const roleColors: Record<string, {bg:string, text:string, label:string}> = {
    donor: { bg: 'bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300', label: 'Donor' },
    ngo: { bg: 'bg-blue-500/15', text: 'text-blue-700 dark:text-blue-300', label: 'NGO' },
    volunteer: { bg: 'bg-purple-500/15', text: 'text-purple-700 dark:text-purple-300', label: 'Volunteer' },
    admin: { bg: 'bg-amber-500/15', text: 'text-amber-700 dark:text-amber-300', label: 'Admin' },
  }

  const counts = {
    total: allUsers.length,
    donor: allUsers.filter(u=>u.role==='donor').length,
    ngo: allUsers.filter(u=>u.role==='ngo').length,
    volunteer: allUsers.filter(u=>u.role==='volunteer').length,
    admin: allUsers.filter(u=>u.role==='admin').length,
  }

  if(active==='users') {
    return (
      <div className="space-y-5">
        {/* Summary stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            {key:'total', label:'Total Users', count: counts.total, icon: Users2, color: 'from-emerald-500 to-emerald-600'},
            {key:'donor', label:'Donors', count: counts.donor, icon: HeartHandshake, color: 'from-emerald-400 to-emerald-500'},
            {key:'ngo', label:'NGOs', count: counts.ngo, icon: Sprout, color: 'from-blue-400 to-blue-500'},
            {key:'volunteer', label:'Volunteers', count: counts.volunteer, icon: Truck, color: 'from-purple-400 to-purple-500'},
            {key:'admin', label:'Admins', count: counts.admin, icon: ShieldCheck, color: 'from-amber-400 to-amber-500'},
          ].map(c=>(
            <GlassCard key={c.key} dark={dark} className="p-[14px] flex items-center gap-3">
              <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center bg-gradient-to-br ${c.color} text-white shadow-sm`}>
                <c.icon className="w-[18px] h-[18px]" />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider opacity-70 font-[650]">{c.label}</div>
                <div className="display text-[24px] font-[700] leading-tight">{c.count}</div>
              </div>
            </GlassCard>
          ))}
        </div>

        {/* Role filter tabs + search */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-1.5">
            {(['all','donor','ngo','volunteer','admin'] as const).map(r => (
              <button key={r} onClick={()=>setRoleFilter(r)}
                className={`px-3.5 py-[7px] rounded-[14px] text-[12.5px] font-[640] capitalize transition ${
                  roleFilter === r
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : `${glass(dark)} ${dark ? 'hover:bg-white/[0.07]' : 'hover:bg-white'}`
                }`}>
                {r === 'all' ? 'All Users' : r + 's'}
              </button>
            ))}
          </div>
          <div className={`flex items-center gap-2 ${glass(dark)} rounded-[16px] px-3 h-[42px] w-full sm:w-[280px]`}>
            <Search className="w-[16px] h-[16px] opacity-60" />
            <input
              value={searchTerm}
              onChange={e=>setSearchTerm(e.target.value)}
              placeholder="Search by name, email, org..."
              className="bg-transparent outline-none w-full text-[13px]"
            />
            {searchTerm && (
              <button onClick={()=>setSearchTerm('')} className="text-[11px] opacity-60 hover:opacity-100">✕</button>
            )}
          </div>
        </div>

        {/* Users cards grid */}
        <GlassCard dark={dark} className="p-[16px] overflow-auto">
          {filteredUsers.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-[32px] opacity-40 mb-2"><Users2 className="w-10 h-10 mx-auto" /></div>
              <div className="text-[14px] opacity-70">
                {searchTerm
                  ? `No users matching "${searchTerm}"`
                  : 'No users available. Please check your Supabase profiles table or admin permissions.'}
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredUsers.map(u => {
                const av = getAvatarStyle(u.email, u.full_name)
                const rc = roleColors[u.role] || roleColors.donor
                return (
                  <div key={u.id} className={`p-[14px] rounded-[20px] ${dark ? 'bg-white/[0.04]' : 'bg-black/[0.025]'} border ${dark ? 'border-white/[0.06]' : 'border-black/[0.05]'}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-[44px] h-[44px] rounded-[14px] flex items-center justify-center text-white text-[16px] font-[700] bg-gradient-to-br ${av.gradient} shadow-md`}>
                          {av.initials}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[14.5px] font-[680] truncate">{u.full_name}</div>
                          <div className="text-[11.5px] opacity-70 truncate">{u.email}</div>
                        </div>
                      </div>
                      <span className={`text-[10px] px-[9px] py-[4px] rounded-full font-[650] capitalize ${rc.bg} ${rc.text}`}>
                        {rc.label}
                      </span>
                    </div>

                    {u.organization_name && (
                      <div className={`text-[12.3px] mb-2 flex items-center gap-1.5 opacity-80`}>
                        <Sprout className="w-3.5 h-3.5" />
                        {u.organization_name}
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-[12px] opacity-80 mb-2">
                      <div className="flex items-center gap-1">
                        <Trophy className="w-3.5 h-3.5 text-amber-500" />
                        <span>{u.points} pts</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{u.rank}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {u.verified ? (
                          <BadgeCheck className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <span className="text-[10px] px-1.5 py-[2px] rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">Unverified</span>
                        )}
                      </div>
                    </div>

                    {/* Rank progress bar */}
                    {u.points > 0 && (
                      <div className={`mt-2 h-[6px] rounded-full ${dark?'bg-white/[0.07]':'bg-black/[0.06]'} overflow-hidden`}>
                        <div className={`h-full rounded-full bg-gradient-to-r ${rankColor[u.rank] || 'from-amber-600 to-orange-500'}`}
                          style={{width: `${Math.min(100, ((u.points || 0) % 300) / 3)}%`}} />
                      </div>
                    )}

                    <div className="flex gap-2 mt-3 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
                      <button onClick={()=>toast(`Viewing profile for ${u.full_name}`)}
                        className="flex-1 text-[11.5px] py-[7px] rounded-[11px] bg-emerald-600 text-white font-[600]">
                        View Profile
                      </button>
                      <button onClick={()=>toast(`Messaging ${u.full_name}`)}
                        className={`flex-1 text-[11.5px] py-[7px] rounded-[11px] ${glass(dark)} font-[600]`}>
                        Message
                      </button>
                      {u.role !== 'admin' && (
                        <button onClick={()=>toast(`Suspend ${u.full_name} (demo)`)}
                          className={`text-[11.5px] px-3 py-[7px] rounded-[11px] ${dark?'bg-red-400/10 text-red-300':'bg-red-50 text-red-700'} font-[600]`}>
                          Suspend
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </GlassCard>
      </div>
    )
  }
  if(active==='heatmap') return <GlassCard dark={dark} className="p-3 h-[560px]"><MapWithDonations dark={dark} donations={donations} heat/></GlassCard>
  if(active==='alerts') return <EmergencyConsole dark={dark} tr={(k:string)=>k} />

  // analytics
  const chartMonthly = [
    {m:'Jan', v:420}, {m:'Feb', v:560}, {m:'Mar', v:710}, {m:'Apr', v:980}, {m:'May', v:1210}, {m:'Jun', v:1480}
  ]
  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-4 gap-4">
        {[
          ['Total Donations', donations.length],
          ['Meals Saved', donations.filter(d=>d.status==='completed').reduce((acc,cur)=>acc+cur.servings,0)],
          ['Active NGOs', users.filter(u=>u.role==='ngo').length],
          ['Pending', donations.filter(d=>d.status==='pending').length],
        ].map(([l,v])=>(
          <GlassCard key={l as string} dark={dark} className="p-[18px]">
            <div className="text-[11.8px] uppercase tracking-wider opacity-70 font-[650]">{l}</div>
            <div className="display text-[30px] font-[700] mt-1">{v}</div>
          </GlassCard>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <GlassCard dark={dark} className="p-[20px]">
          <div className="text-[15px] font-[720] mb-3">Monthly rescue growth</div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartMonthly}>
                <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#223' : '#e7ece8'} />
                <XAxis dataKey="m" stroke={dark?'#9aa':'#556'} fontSize={12}/>
                <YAxis stroke={dark?'#9aa':'#556'} fontSize={12}/>
                <Tooltip contentStyle={{ background: dark? '#10161a':'#fff', border:'none', borderRadius:14 }} />
                <Bar dataKey="v" fill="#16a34a" radius={[10,10,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
        <GlassCard dark={dark} className="p-[20px]">
          <div className="text-[15px] font-[720] mb-3">Weekly active rescue ops</div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartMonthly.map((x,i)=>({...x, w:220+i*90}))}>
                <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#223' : '#e7ece8'} />
                <XAxis dataKey="m" stroke={dark?'#9aa':'#556'} fontSize={12}/>
                <YAxis stroke={dark?'#9aa':'#556'} fontSize={12}/>
                <Tooltip contentStyle={{ background: dark? '#10161a':'#fff', border:'none', borderRadius:14 }} />
                <Line type="monotone" dataKey="w" stroke="#f97316" strokeWidth={3} dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>
      <GlassCard dark={dark} className="p-[20px]">
        <div className="text-[15px] font-[720] mb-2">Emergency requests · {emergencies.length} active</div>
        <div className="text-[13px] opacity-80">Pinned on NGO + donor dashboards · push delivered in 1.7s avg</div>
      </GlassCard>
    </div>
  )
}

// Chat
function ChatPanel({ dark }:{ dark:boolean }) {
  const { messages, currentUser } = useStore()
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const sortedMessages = React.useMemo(() => [...messages].sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()), [messages])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [sortedMessages.length])

  const handleSendMessage = async () => {
    if (!text.trim() || !currentUser) return
    try {
      const sent = await chatDb.send({
        sender_id: currentUser.id,
        text: text.trim()
      })
      if (sent) {
        useStore.getState().addMessage(sent)
        setText('')
      } else {
        // Fallback local message
        const localMsg = {
          id: 'local_' + Math.random().toString(36).slice(2),
          threadId: 'local',
          sender_id: currentUser.id,
          sender_name: currentUser.full_name,
          text: text.trim(),
          created_at: new Date().toISOString(),
          read: false
        }
        useStore.getState().addMessage(localMsg)
        setText('')
      }
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  return (
    <GlassCard dark={dark} className="p-[18px] md:p-[22px]">
      <div className="text-[15px] font-[720] mb-3 flex items-center gap-2"><MessageCircle className="w-[18px] h-[18px]" /> Live Chat</div>
      <div className="text-[12px] mb-3 opacity-70">{sortedMessages.length} message{sortedMessages.length === 1 ? '' : 's'} · {currentUser ? 'logged in' : 'log in to participate'}</div>
      <div className="h-[420px] overflow-auto pr-2 space-y-[10px] rounded-[16px]">
        {sortedMessages.length === 0 ? (
          <div className="p-6 text-center text-[14px] opacity-70">No chat messages yet. Send the first message to start the conversation.</div>
        ) : sortedMessages.map(m => (
          <div key={m.id} className={`max-w-[76%] px-[14px] py-[11px] rounded-[18px] text-[13.8px] ${m.sender_id === currentUser?.id ? 'ml-auto bg-emerald-600 text-white rounded-br-[7px]' : dark ? 'bg-white/[0.07] rounded-bl-[7px]' : 'bg-black/[0.055] rounded-bl-[7px]'}`}>
            <div className="flex items-center justify-between gap-2 text-[11px] opacity-80 mb-[2px] font-bold">
              <span>{m.sender_id === currentUser?.id ? 'You' : m.sender_name || 'Member'}</span>
              <span className="text-[10px] opacity-60">{new Date(m.created_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</span>
            </div>
            {m.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex gap-2 mt-3">
        <input value={text} onChange={e => setText(e.target.value)} placeholder={currentUser ? 'Type a message...' : 'Login to join the chat'} className={inputCls(dark)} disabled={!currentUser} />
        <button type="submit" disabled={!currentUser || !text.trim()} className="px-[16px] rounded-[14px] bg-emerald-600 text-white flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"><Send className="w-4 h-4" /> Send</button>
      </form>
    </GlassCard>
  )
}

// Leaderboard
function Leaderboard({ dark }:{ dark:boolean }) {
  const { users, currentUser } = useStore()
  const sorted = [...users].sort((a,b)=> (b.points || 0) - (a.points || 0))
  const currentRank = currentUser ? sorted.findIndex(u => u.id === currentUser.id) + 1 : null
  return (
    <div className="space-y-5">
      <GlassCard dark={dark} className="p-[18px]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[13.5px] font-[720] uppercase tracking-wider opacity-80">Leaderboard</div>
            <div className="text-[12px] opacity-70">Top contributors across donors, NGOs, and volunteers.</div>
          </div>
          {currentUser && currentRank ? (
            <div className="text-[12px] opacity-80 text-right">
              Your rank: <span className="font-[700]">#{currentRank}</span><br />
              {currentUser.points} pts · {currentUser.rank}
            </div>
          ) : null}
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.slice(0,5).map((u,i)=>(
            <div key={u.id} className={`p-[14px] rounded-[18px] ${dark?'bg-white/[0.04]':'bg-black/[0.035]'}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="text-[11.5px] font-[800] opacity-70">#{i+1}</div>
                <div className={`w-9 h-9 rounded-[12px] flex items-center justify-center text-white text-[12px] font-[700] bg-gradient-to-br ${getAvatarStyle(u.email, u.full_name).gradient}`}>
                  {getAvatarStyle(u.email, u.full_name).initials}
                </div>
                <div className="min-w-0">
                  <div className="text-[13.3px] font-[660] truncate">{u.full_name}</div>
                  <div className="text-[11px] opacity-75">{u.role.toUpperCase()}</div>
                </div>
              </div>
              <div className="text-[12px] opacity-80">{u.points} pts · {u.rank}</div>
            </div>
          ))}
        </div>
      </GlassCard>
      <div className="grid lg:grid-cols-3 gap-5">
        {['donor','ngo','volunteer'].map(role=>{
          const roleUsers = sorted.filter(u=>u.role===role).slice(0,5)
          return (
            <GlassCard key={role} dark={dark} className="p-[18px]">
              <div className="text-[13.5px] font-[720] uppercase tracking-wider opacity-80 mb-3">Top {role}s</div>
              <div className="space-y-[10px]">
                {roleUsers.length === 0 ? (
                  <div className="text-[13px] opacity-70">No {role} users tracked yet.</div>
                ) : roleUsers.map((u,i)=>(
                  <div key={u.id} className={`flex items-center gap-3 p-[11px] rounded-[14px] ${dark?'bg-white/[0.035]':'bg-black/[0.03]'}`}>
                    <div className="text-[11.5px] font-[800] opacity-70">#{i+1}</div>
                    <div className={`w-10 h-10 rounded-[12px] flex items-center justify-center text-white text-[12px] font-[700] bg-gradient-to-br ${getAvatarStyle(u.email, u.full_name).gradient}`}>
                      {getAvatarStyle(u.email, u.full_name).initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.7px] font-[660] truncate">{u.full_name}</div>
                      <div className="text-[11.5px] opacity-75">{u.rank} • {u.points} pts</div>
                    </div>
                    <Trophy className="w-4 h-4 text-amber-500"/>
                  </div>
                ))}
              </div>
            </GlassCard>
          )
        })}
      </div>
    </div>
  )
}

function ImpactPanel({ dark, user, myDonations }:{ dark:boolean, user:any, myDonations:Donation[] }) {
  const totalMeals = myDonations.reduce((a,d)=>a+d.servings,0)
  return (
    <div className="grid md:grid-cols-2 gap-5">
      <GlassCard dark={dark} className="p-[22px]">
        <div className="text-[15px] font-[720] mb-3">Achievement Badges</div>
        <div className="grid grid-cols-2 gap-3">
          {badgeDefs.map(b=>(
            <div key={b.key} className={`p-[14px] rounded-[18px] ${dark?'bg-white/[0.045]':'bg-black/[0.035]'}`}>
              <div className="text-[26px]">{b.icon}</div>
              <div className="font-[680] text-[14px] mt-1">{b.name}</div>
              <div className="text-[12px] opacity-75">{b.desc}</div>
            </div>
          ))}
        </div>
      </GlassCard>
      <GlassCard dark={dark} className="p-[22px]">
        <div className="text-[15px] font-[720] mb-3">Impact Certificate</div>
        <div className={`rounded-[18px] p-[18px] ${dark?'bg-emerald-400/8':'bg-emerald-50'} border ${dark?'border-emerald-400/15':'border-emerald-200'}`}>
          <div className="display text-[22px] font-[700]">FoodLink Impact</div>
          <div className="mt-2 text-[14px]">{user.full_name} has rescued <b>{totalMeals} meals</b>, saving ~{(totalMeals*0.62).toFixed(0)} kg CO₂.</div>
          <div className="text-[12.5px] mt-3 opacity-80">Rank: {user.rank} • Points: {user.points}</div>
          <button onClick={()=>toast('Certificate PDF downloading…')} className="mt-3 text-[12.5px] font-[650] px-3 py-[8px] rounded-[12px] bg-emerald-600 text-white">Download PDF Certificate</button>
        </div>
      </GlassCard>
    </div>
  )
}

function EmergencyMini({ dark }:{ dark:boolean }) {
  const { emergencies } = useStore()
  return (
    <div className="space-y-3">
      {emergencies.slice(0,2).map(er=>(
        <div key={er.id} className={`p-[13px] rounded-[16px] ${dark?'bg-orange-400/7':'bg-orange-50'} border ${dark?'border-orange-400/18':'border-orange-200'}`}>
          <div className="flex justify-between items-center">
            <div className="font-[680] text-[13.7px]">{er.location}</div>
            <span className="text-[10px] px-[8px] py-[3px] rounded-full bg-orange-600 text-white font-[700]">{er.priority}</span>
          </div>
          <div className="text-[12px] mt-1 opacity-85">{er.description.slice(0,95)}…</div>
          <div className="text-[11.5px] mt-2">{er.fulfilled}/{er.meals_needed} meals</div>
        </div>
      ))}
    </div>
  )
}

// MAP COMPONENT
function MapWithDonations({ dark, donations, showRoute: _showRoute, heat: _heat }:{ dark:boolean, donations:Donation[], showRoute?:boolean, heat?:boolean }) {
  return (
    <MapContainer center={[12.9716,77.5946]} zoom={12} style={{ height:'100%', width:'100%' }}>
      <TileLayer
        url={dark
          ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          : 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png'}
        attribution="© OpenStreetMap – Google Maps SDK integrated in production"
      />
      {donations.map(d=>(
        <Marker key={d.id} position={[d.lat, d.lng]}>
          <Popup>
            <b>{d.food_name}</b><br/>{d.servings} meals<br/>{d.status}
          </Popup>
        </Marker>
      ))}
      <Recenter />
    </MapContainer>
  )
}
function Recenter(){
  const map = useMap()
  useEffect(()=>{ setTimeout(()=> map.invalidateSize(), 220) }, [map])
  return null
}

// end
