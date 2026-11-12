import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Users2, HeartHandshake, Sprout, Truck, ShieldCheck, Search, Trophy, Star, BadgeCheck, X } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import { useStore, type Role, type UserProfile } from '../lib/store'
import { getAvatarStyle } from '../utils/avatar'
import { GlassCard, glass, rankColor } from './ui'
import { MapWithDonations } from './MapViews'
import { EmergencyConsole } from './NGOViews'

const PIE_COLORS = ['#10b981', '#f97316', '#0ea5e9', '#8b5cf6', '#eab308', '#ef4444']

export function AdminViews({ active, dark }: { active: string; dark: boolean }) {
  const { users, donations, emergencies, currentUser } = useStore()
  const allUsers = users.length > 0 ? users : currentUser ? [currentUser] : []
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)

  const filteredUsers = allUsers.filter(u => {
    const matchesRole = roleFilter === 'all' || u.role === roleFilter
    const term = searchTerm.toLowerCase()
    const matchesSearch = !term
      || (u.full_name || '').toLowerCase().includes(term)
      || (u.email || '').toLowerCase().includes(term)
      || (u.organization_name || '').toLowerCase().includes(term)
    return matchesRole && matchesSearch
  })

  const roleColors: Record<string, { bg: string; text: string; label: string }> = {
    donor: { bg: 'bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300', label: 'Donor' },
    ngo: { bg: 'bg-blue-500/15', text: 'text-blue-700 dark:text-blue-300', label: 'NGO' },
    volunteer: { bg: 'bg-purple-500/15', text: 'text-purple-700 dark:text-purple-300', label: 'Volunteer' },
    admin: { bg: 'bg-amber-500/15', text: 'text-amber-700 dark:text-amber-300', label: 'Admin' },
  }

  const counts = {
    total: allUsers.length,
    donor: allUsers.filter(u => u.role === 'donor').length,
    ngo: allUsers.filter(u => u.role === 'ngo').length,
    volunteer: allUsers.filter(u => u.role === 'volunteer').length,
    admin: allUsers.filter(u => u.role === 'admin').length,
  }

  const statusChartData = useMemo(() => {
    const statuses = ['pending', 'accepted', 'volunteer_assigned', 'picked_up', 'delivered', 'completed']
    return statuses.map(st => ({
      name: st.replace('_', ' '),
      meals: donations.filter(d => d.status === st).reduce((acc, d) => acc + (d.servings || 0), 0),
      count: donations.filter(d => d.status === st).length
    }))
  }, [donations])

  const vegChartData = useMemo(() => {
    const types = ['veg', 'non-veg', 'vegan'] as const
    return types
      .map(vt => ({
        name: vt,
        value: donations.filter(d => d.veg_type === vt).length
      }))
      .filter(x => x.value > 0)
  }, [donations])

  if (active === 'users') {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { key: 'total', label: 'Total Users', count: counts.total, icon: Users2, color: 'from-emerald-500 to-emerald-600' },
            { key: 'donor', label: 'Donors', count: counts.donor, icon: HeartHandshake, color: 'from-emerald-400 to-emerald-500' },
            { key: 'ngo', label: 'NGOs', count: counts.ngo, icon: Sprout, color: 'from-blue-400 to-blue-500' },
            { key: 'volunteer', label: 'Volunteers', count: counts.volunteer, icon: Truck, color: 'from-purple-400 to-purple-500' },
            { key: 'admin', label: 'Admins', count: counts.admin, icon: ShieldCheck, color: 'from-amber-400 to-amber-500' },
          ].map(c => (
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

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'donor', 'ngo', 'volunteer', 'admin'] as const).map(r => (
              <button key={r} onClick={() => setRoleFilter(r)}
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
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, org..."
              className="bg-transparent outline-none w-full text-[13px]"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-[11px] opacity-60 hover:opacity-100">✕</button>
            )}
          </div>
        </div>

        <GlassCard dark={dark} className="p-[16px] overflow-auto">
          {filteredUsers.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-[32px] opacity-40 mb-2"><Users2 className="w-10 h-10 mx-auto" /></div>
              <div className="text-[14px] opacity-70">
                {searchTerm
                  ? `No users matching "${searchTerm}"`
                  : 'No users available. Check Supabase profiles or permissions.'}
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
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-[44px] h-[44px] rounded-[14px] flex items-center justify-center text-white text-[16px] font-[700] bg-gradient-to-br ${av.gradient} shadow-md flex-shrink-0`}>
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
                      <div className="text-[12.3px] mb-2 flex items-center gap-1.5 opacity-80">
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

                    {u.points > 0 && (
                      <div className={`mt-2 h-[6px] rounded-full ${dark ? 'bg-white/[0.07]' : 'bg-black/[0.06]'} overflow-hidden`}>
                        <div className={`h-full rounded-full bg-gradient-to-r ${rankColor[u.rank] || 'from-amber-600 to-orange-500'}`}
                          style={{ width: `${Math.min(100, ((u.points || 0) % 300) / 3)}%` }} />
                      </div>
                    )}

                    <div className="flex gap-2 mt-3 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
                      <button onClick={() => setSelectedUser(u)}
                        className="flex-1 text-[11.5px] py-[7px] rounded-[11px] bg-emerald-600 text-white font-[600]">
                        View Profile
                      </button>
                      <button onClick={() => { navigator.clipboard?.writeText(u.email); toast.success(`Copied ${u.email}`) }}
                        className={`flex-1 text-[11.5px] py-[7px] rounded-[11px] ${glass(dark)} font-[600]`}>
                        Copy Email
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </GlassCard>

        <AnimatePresence>
          {selectedUser && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/50 backdrop-blur-[5px]" onClick={() => setSelectedUser(null)} />
              <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }} className={`relative w-full max-w-[440px] p-6 rounded-[28px] ${glass(dark)}`}>
                <button onClick={() => setSelectedUser(null)} className="absolute top-4 right-4 w-8 h-8 rounded-[10px] flex items-center justify-center bg-black/10 dark:bg-white/10">
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-14 h-14 rounded-[18px] flex items-center justify-center text-white text-[18px] font-[700] bg-gradient-to-br ${getAvatarStyle(selectedUser.email, selectedUser.full_name).gradient}`}>
                    {getAvatarStyle(selectedUser.email, selectedUser.full_name).initials}
                  </div>
                  <div>
                    <div className="display text-[20px] font-[700]">{selectedUser.full_name}</div>
                    <div className="text-[12.5px] opacity-75">{selectedUser.email}</div>
                  </div>
                </div>
                <div className="space-y-2 text-[13.5px]">
                  <div><b>Role:</b> <span className="capitalize">{selectedUser.role}</span></div>
                  {selectedUser.organization_name && <div><b>Organization:</b> {selectedUser.organization_name}</div>}
                  <div><b>Points & Rank:</b> {selectedUser.points} pts · {selectedUser.rank}</div>
                  <div><b>Streak:</b> {selectedUser.streak} days</div>
                  <div><b>Verified:</b> {selectedUser.verified ? 'Yes (KYC active)' : 'Pending'}</div>
                  <div><b>Coordinates:</b> {selectedUser.lat.toFixed(4)}, {selectedUser.lng.toFixed(4)}</div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  if (active === 'heatmap') return <GlassCard dark={dark} className="p-3 h-[560px]"><MapWithDonations dark={dark} donations={donations} heat /></GlassCard>
  if (active === 'alerts') return <EmergencyConsole dark={dark} tr={(k: string) => k} />

  const completedMeals = donations.filter(d => d.status === 'completed').reduce((acc, cur) => acc + cur.servings, 0)

  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-4 gap-4">
        {[
          ['Total Donations', donations.length],
          ['Meals Saved', completedMeals],
          ['Active NGOs', users.filter(u => u.role === 'ngo').length],
          ['Pending', donations.filter(d => d.status === 'pending').length],
        ].map(([l, v]) => (
          <GlassCard key={l as string} dark={dark} className="p-[18px]">
            <div className="text-[11.8px] uppercase tracking-wider opacity-70 font-[650]">{l}</div>
            <div className="display text-[30px] font-[700] mt-1">{v}</div>
          </GlassCard>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <GlassCard dark={dark} className="p-[20px]">
          <div className="text-[15px] font-[720] mb-3">Live meals by rescue stage</div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#223' : '#e7ece8'} />
                <XAxis dataKey="name" stroke={dark ? '#9aa' : '#556'} fontSize={11} />
                <YAxis stroke={dark ? '#9aa' : '#556'} fontSize={12} />
                <Tooltip contentStyle={{ background: dark ? '#10161a' : '#fff', border: 'none', borderRadius: 14 }} />
                <Bar dataKey="meals" fill="#16a34a" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
        <GlassCard dark={dark} className="p-[20px]">
          <div className="text-[15px] font-[720] mb-3">Donation dietary breakdown</div>
          <div className="h-[260px] flex items-center justify-center">
            {vegChartData.length === 0 ? (
              <div className="text-[13px] opacity-65">No donations recorded yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={vegChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={4} label>
                    {vegChartData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: dark ? '#10161a' : '#fff', border: 'none', borderRadius: 14 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </GlassCard>
      </div>
      <GlassCard dark={dark} className="p-[20px]">
        <div className="text-[15px] font-[720] mb-2">Emergency requests · {emergencies.length} active</div>
        <div className="text-[13px] opacity-80">Pinned on NGO + donor dashboards · realtime Supabase sync active</div>
      </GlassCard>
    </div>
  )
}

