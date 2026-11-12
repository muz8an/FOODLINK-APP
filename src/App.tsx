import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import {
  HeartHandshake, Sprout, MapPin, Users2, Truck, BarChart3, MessageCircle, Search,
  Moon, Sun, LogOut, Trophy, BadgeCheck, UtensilsCrossed, CheckCircle2, Menu, X,
  Languages, Siren, Activity, Award
} from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useStore, badges as badgeDefs, type Donation, type EmergencyReq, type Role, type UserProfile } from './lib/store'
import { getAvatarStyle } from './utils/avatar'
import { t as translate, type Lang } from './lib/i18n'
import { supabase } from './lib/supabase'
import { db, donationsDb, emergencyDb, notifsDb, chatDb, authDb } from './lib/db'
import { glass, GlassCard, rankColor, BellTray } from './components/ui'
import { Landing } from './components/Landing'
import { AuthModal } from './components/AuthModal'
import { DonorViews } from './components/DonorViews'
import { NGOViews } from './components/NGOViews'
import { VolunteerViews } from './components/VolunteerViews'
import { AdminViews } from './components/AdminViews'
import { CommandPalette } from './components/CommandPalette'

// Fix leaflet default marker
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

export default function App() {
  const [lang, setLang] = useState<Lang>((localStorage.getItem('fl_lang') as Lang) || 'en')
  const [dark, setDark] = useState<boolean>(() => localStorage.getItem('fl_dark') === '1')
  const { currentUser, setCurrentUser, notifications, markNotifRead } = useStore()
  const [authOpen, setAuthOpen] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)

  useEffect(() => { localStorage.setItem('fl_lang', lang) }, [lang])
  useEffect(() => { localStorage.setItem('fl_dark', dark ? '1' : '0') }, [dark])

  const tr = (k: Parameters<typeof translate>[0]) => translate(k, lang)

  // Supabase session boot
  useEffect(() => {
    const loadProfile = async (user: any) => {
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

  // Real-time subscriptions for authenticated users
  useEffect(() => {
    if (!currentUser) return

    const donationsChannel = supabase
      .channel('donations-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, payload => {
        if (payload.eventType === 'INSERT') {
          useStore.getState().addDonation(payload.new as Donation)
          toast.info('New food donation available!')
        } else if (payload.eventType === 'UPDATE') {
          useStore.getState().updateDonation(payload.new.id, payload.new as Partial<Donation>)
        }
      })
      .subscribe()

    const notifsChannel = supabase
      .channel('notifs-' + currentUser.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUser.id}` }, payload => {
        useStore.getState().pushNotif(payload.new as any)
        toast.info((payload.new as any).title)
      })
      .subscribe()

    const chatChannel = supabase
      .channel('chat-global')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, payload => {
        useStore.getState().addMessage(payload.new as any)
      })
      .subscribe()

    const emergencyChannel = supabase
      .channel('emergencies-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_requests' }, payload => {
        if (payload.eventType === 'INSERT') {
          useStore.getState().addEmergency(payload.new as EmergencyReq)
        } else if (payload.eventType === 'UPDATE') {
          useStore.getState().updateEmergency((payload.new as EmergencyReq).id, payload.new as Partial<EmergencyReq>)
        }
      })
      .subscribe()

    const profilesChannel = supabase
      .channel('profiles-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, payload => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const p = payload.new as UserProfile
          useStore.getState().upsertUser({ ...p, role: p.role?.toString().toLowerCase() as Role })
        }
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
        const normalizedUsers = users && users.length > 0 ? users : [currentUser]
        const mergedUsers = normalizedUsers.some(u => u.id === currentUser.id)
          ? normalizedUsers
          : [currentUser, ...normalizedUsers]

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
      emergencyChannel.unsubscribe()
      profilesChannel.unsubscribe()
    }
  }, [currentUser?.id])

  const handleMarkAllRead = async () => {
    if (!currentUser) return
    const unreadIds = notifications.filter(n => n.user_id === currentUser.id && !n.read).map(n => n.id)
    unreadIds.forEach(id => markNotifRead(id))
    await notifsDb.markAllRead(currentUser.id)
  }

  return (
    <div className={`min-h-screen w-full ${dark ? 'dark' : ''}`}>
      <div className={`min-h-screen w-full font-[Inter] transition-colors duration-500 relative ${dark ? 'bg-[#0b1016] text-[#e9f2ec] bg-grid-dark' : 'bg-[#f6faf7] text-[#0f1d16] bg-grid-light'}`}>
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
                  <a href="#features" className={`${dark ? 'text-zinc-300 hover:text-white' : 'text-zinc-700 hover:text-black'} transition-colors`}>Features</a>
                  <a href="#how" className={`${dark ? 'text-zinc-300 hover:text-white' : 'text-zinc-700 hover:text-black'} transition-colors`}>How it works</a>
                  <a href="#impact" className={`${dark ? 'text-zinc-300 hover:text-white' : 'text-zinc-700 hover:text-black'} transition-colors`}>Impact</a>
                </>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button onClick={() => setDark(d => !d)} className={`w-10 h-10 rounded-[16px] flex items-center justify-center transition ${glass(dark)} ${dark ? 'hover:bg-white/[0.09]' : 'hover:bg-white/95'}`} aria-label="theme">
                {dark ? <Sun className="w-[18px] h-[18px] text-amber-300" /> : <Moon className="w-[18px] h-[18px] text-emerald-800" />}
              </button>
              <div className="relative">
                <select value={lang} onChange={e => setLang(e.target.value as Lang)} className={`${glass(dark)} rounded-[16px] h-10 pl-9 pr-3 text-[13px] font-medium appearance-none outline-none cursor-pointer ${dark ? 'text-zinc-200' : 'text-zinc-700'}`}>
                  <option value="en">EN</option>
                  <option value="hi">हि</option>
                  <option value="kn">ಕ</option>
                </select>
                <Languages className="absolute left-[10px] top-[11px] w-[18px] h-[18px] opacity-70 pointer-events-none" />
              </div>

              {currentUser ? (
                <>
                  <BellTray
                    dark={dark}
                    notifications={notifications.filter(n => n.user_id === currentUser.id)}
                    onRead={(id) => { markNotifRead(id); notifsDb.markRead(id) }}
                    onMarkAllRead={handleMarkAllRead}
                  />
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
                      <div className={`text-[11px] ${dark ? 'text-emerald-300' : 'text-emerald-700'} capitalize`}>{currentUser.role} · {currentUser.rank}</div>
                    </div>
                    <button onClick={async () => { await authDb.signOut(); setCurrentUser(null); toast('Signed out') }} className={`ml-1 w-9 h-9 rounded-[14px] flex items-center justify-center ${glass(dark)}`} aria-label="sign out">
                      <LogOut className="w-[15px] h-[15px]" />
                    </button>
                  </div>
                  <button className="sm:hidden ml-1 w-10 h-10 rounded-[16px] flex items-center justify-center border border-emerald-900/10 dark:border-white/10" onClick={() => setMobileNav(!mobileNav)} aria-label="menu">
                    {mobileNav ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={() => setAuthOpen(true)} className={`px-[16px] h-10 rounded-[16px] text-[13.5px] font-[640] ${glass(dark)} ${dark ? 'hover:bg-white/[0.07]' : 'hover:bg-white'}`}>{tr('login')}</button>
                  <button onClick={() => setAuthOpen(true)} className="px-[18px] h-10 rounded-[16px] text-[13.5px] font-[700] text-white bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-lg shadow-emerald-600/30 hover:brightness-[1.04] transition">{tr('register')}</button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Drawer */}
          <AnimatePresence>
            {mobileNav && currentUser && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className={`sm:hidden overflow-hidden border-t ${dark ? 'border-white/10 bg-[#0d1117]/95' : 'border-emerald-900/10 bg-white/95'} px-4 py-3`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[14px] font-[700]">{currentUser.full_name}</div>
                    <div className="text-[12px] opacity-75 capitalize">{currentUser.role} · {currentUser.points} pts · {currentUser.rank}</div>
                  </div>
                  <button
                    onClick={async () => { await authDb.signOut(); setCurrentUser(null); setMobileNav(false); toast('Signed out') }}
                    className="px-3 py-2 rounded-[12px] bg-red-500/15 text-red-600 dark:text-red-300 text-[12.5px] font-[650] flex items-center gap-1.5"
                  >
                    <LogOut className="w-4 h-4" /> Sign out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        <main className="relative z-10">
          {currentUser
            ? <Dashboard dark={dark} tr={tr} />
            : <Landing dark={dark} tr={tr} onGetStarted={() => setAuthOpen(true)} />
          }
        </main>

        <footer className={`mt-20 border-t ${dark ? 'border-white/[0.08] bg-black/10' : 'border-emerald-900/[0.08] bg-white/40'} backdrop-blur`}>
          <div className="max-w-[1220px] mx-auto px-6 sm:px-7 py-14 grid md:grid-cols-4 gap-10 text-[14px]">
            <div>
              <div className="display text-[22px] font-[700]">FoodLink</div>
              <div className={`${dark ? 'text-zinc-400' : 'text-zinc-600'} mt-2`}>Production-grade food rescue network<br />Bengaluru • Mumbai • Delhi</div>
              <div className="mt-4 text-[12px] opacity-70">Supabase • Realtime • Leaflet • RLS</div>
            </div>
            <div>
              <div className="font-[700] mb-3">Platform</div>
              <ul className={`space-y-2 ${dark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                <li>Donor app</li><li>NGO console</li><li>Volunteer tracker</li><li>Admin analytics</li>
              </ul>
            </div>
            <div>
              <div className="font-[700] mb-3">Trust</div>
              <ul className={`space-y-2 ${dark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                <li>Food safety verified</li><li>NGO KYC</li><li>QR cold-chain</li><li>RLS secured</li>
              </ul>
            </div>
            <div>
              <div className="font-[700] mb-3">Contact</div>
              <div className={`${dark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                support@foodlink.in<br />+91 63 6480 8720<br /><br />Made with ♻️ for zero-hunger 2030
              </div>
            </div>
          </div>
          <div className="text-center py-4 text-[12px] text-zinc-500">
            © 2026 FoodLink Foundation · Open impact · PWA ready · ISO 22000 aligned
          </div>
        </footer>

        <AnimatePresence>{authOpen && <AuthModal dark={dark} tr={tr} onClose={() => setAuthOpen(false)} />}</AnimatePresence>
      </div>
    </div>
  )
}

function Dashboard({ dark, tr }: { dark: boolean; tr: any }) {
  const { currentUser } = useStore()
  const [tab, setTab] = useState('overview')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const role = currentUser?.role || 'donor'

  const roleTabs: Record<Role, { key: string; label: string; icon: any }[]> = {
    donor: [
      { key: 'overview', label: 'Overview', icon: Activity },
      { key: 'share', label: tr('upload_food'), icon: Sprout },
      { key: 'donations', label: 'My Donations', icon: HeartHandshake },
      { key: 'impact', label: 'Impact', icon: Trophy },
      { key: 'chat', label: tr('chat'), icon: MessageCircle },
      { key: 'leaderboard', label: tr('leaderboard'), icon: Award },
    ],
    ngo: [
      { key: 'nearby', label: 'Nearby', icon: MapPin },
      { key: 'accepted', label: 'Accepted', icon: CheckCircle2 },
      { key: 'emergency', label: 'Emergency', icon: Siren },
      { key: 'chat', label: tr('chat'), icon: MessageCircle },
      { key: 'leaderboard', label: 'Board', icon: Trophy },
    ],
    volunteer: [
      { key: 'assignments', label: 'Assignments', icon: Truck },
      { key: 'map', label: 'Live Map', icon: MapPin },
      { key: 'completed', label: 'Completed', icon: BadgeCheck },
      { key: 'chat', label: 'Chat', icon: MessageCircle },
    ],
    admin: [
      { key: 'analytics', label: 'Analytics', icon: BarChart3 },
      { key: 'users', label: 'Users', icon: Users2 },
      { key: 'heatmap', label: 'Heatmap', icon: MapPin },
      { key: 'alerts', label: 'Alerts', icon: Siren },
    ]
  }
  const tabs = roleTabs[role]
  useEffect(() => { setTab(tabs[0].key) }, [role])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const pts = currentUser?.points || 0
  const nextTier = pts >= 1500 ? 1500 : pts >= 900 ? 1500 : pts >= 500 ? 900 : pts >= 220 ? 500 : 220
  const prevTier = pts >= 1500 ? 900 : pts >= 900 ? 500 : pts >= 500 ? 220 : 0
  const pct = pts >= 1500 ? 100 : Math.min(100, Math.round(((pts - prevTier) / Math.max(1, nextTier - prevTier)) * 100))

  return (
    <div className="max-w-[1220px] mx-auto px-4 sm:px-7 py-7">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`text-[13px] font-[650] px-3.5 py-[8px] rounded-full ${glass(dark)} flex items-center gap-2`}>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {role.toUpperCase()} CONSOLE · {currentUser?.organization_name || currentUser?.full_name}
          </div>
          <div className={`hidden sm:block text-[12px] font-[640] px-3 py-[7px] rounded-full ${dark ? 'bg-emerald-400/12 text-emerald-300 border border-emerald-400/20' : 'bg-emerald-50 text-emerald-800 border border-emerald-200/70'}`}>
            {currentUser?.points} pts · {currentUser?.rank}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className={`flex items-center gap-2.5 ${glass(dark)} rounded-[18px] px-3.5 h-[48px] w-full lg:w-[440px] text-left hover:border-emerald-500/35 transition`}
        >
          <Search className="w-[18px] h-[18px] opacity-65" />
          <span className="flex-1 text-[14px] opacity-60 truncate">{tr('search')}</span>
          <kbd className={`text-[11px] font-[650] px-2 py-[4px] rounded-[9px] border ${dark ? 'bg-white/[0.06] border-white/10' : 'bg-black/[0.04] border-black/10'}`}>⌘K</kbd>
        </button>
      </div>

      <div className="grid lg:grid-cols-[268px_minmax(0,1fr)] gap-6">
        <aside className="hidden lg:block">
          <GlassCard dark={dark} className="p-[14px] sticky top-[96px]">
            <div className="space-y-[6px]">
              {tabs.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`relative w-full flex items-center gap-[11px] px-[14px] h-[48px] rounded-[16px] text-[14.3px] font-[600] transition ${tab === t.key
                    ? 'text-white'
                    : `${dark ? 'text-zinc-300 hover:bg-white/[0.06]' : 'text-zinc-700 hover:bg-black/[0.04]'}`}`}>
                  {tab === t.key && (
                    <motion.div
                      layoutId="activeSidebarTab"
                      transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                      className="absolute inset-0 rounded-[16px] bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-lg shadow-emerald-600/25"
                    />
                  )}
                  <t.icon className="w-[18px] h-[18px] relative z-10" />
                  <span className="relative z-10">{t.label}</span>
                </button>
              ))}
            </div>
            <div className={`mt-4 rounded-[18px] p-4 ${dark ? 'bg-white/[0.04]' : 'bg-black/[0.03]'}`}>
              <div className="flex items-center justify-between text-[11.5px] uppercase tracking-wider opacity-70 font-[700]">
                <span>Rank Progress</span>
                <span>{pct}%</span>
              </div>
              <div className={`mt-2 h-[9px] rounded-full ${dark ? 'bg-white/[0.09]' : 'bg-black/[0.09]'} overflow-hidden`}>
                <div className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${rankColor[currentUser?.rank || 'Bronze']}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="text-[12.5px] mt-2 opacity-80">{pts} / {nextTier} pts</div>
            </div>
          </GlassCard>

          <GlassCard dark={dark} className="p-4 mt-4">
            <div className="text-[12.5px] font-[700] opacity-80 mb-2">{tr('badges')}</div>
            <div className="flex flex-wrap gap-2 text-[18px]">
              {badgeDefs.slice(0, 5).map(b => <div key={b.key} className={`w-10 h-10 rounded-[14px] flex items-center justify-center ${dark ? 'bg-white/[0.05]' : 'bg-black/[0.035]'} hover:scale-110 transition-transform`} title={b.name}>{b.icon}</div>)}
            </div>
          </GlassCard>
        </aside>

        <div className="min-w-0">
          <div className="lg:hidden flex gap-2 overflow-x-auto pb-3">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex-shrink-0 px-3.5 h-[42px] rounded-[15px] text-[13px] font-[600] ${tab === t.key ? 'bg-emerald-600 text-white' : glass(dark)}`}>
                {t.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .22 }}>
              {role === 'donor' && <DonorViews active={tab} dark={dark} tr={tr} onNavigateTab={setTab} />}
              {role === 'ngo' && <NGOViews active={tab} dark={dark} tr={tr} onNavigateTab={setTab} />}
              {role === 'volunteer' && <VolunteerViews active={tab} dark={dark} tr={tr} />}
              {role === 'admin' && <AdminViews active={tab} dark={dark} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        dark={dark}
        onClose={() => setPaletteOpen(false)}
        onNavigateTab={setTab}
        availableTabs={tabs.map(t => ({ key: t.key, label: t.label }))}
      />
    </div>
  )
}
