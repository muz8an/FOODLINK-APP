import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, BellOff, CheckCheck } from 'lucide-react'
import type { DonationStatus, Notif } from '../lib/store'

export const glass = (dark: boolean) =>
  dark
    ? 'backdrop-blur-2xl bg-[#131920]/70 border border-white/[0.11] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_20px_50px_rgba(0,0,0,0.45)]'
    : 'backdrop-blur-2xl bg-white/78 border border-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_20px_50px_rgba(20,65,35,0.08)]'

export function GlassCard({
  children,
  className = '',
  dark = false,
  hover = false
}: {
  children: React.ReactNode
  className?: string
  dark?: boolean
  hover?: boolean
}) {
  return (
    <div
      className={`${glass(dark)} rounded-[26px] transition-all duration-300 ${
        hover ? (dark ? 'hover:border-emerald-400/25 hover:-translate-y-0.5' : 'hover:border-emerald-500/25 hover:-translate-y-0.5 hover:shadow-[0_24px_56px_rgba(20,65,35,0.12)]') : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}

export const rankColor: Record<string, string> = {
  Bronze: 'from-amber-600 to-orange-500',
  Silver: 'from-slate-400 to-slate-600',
  Gold: 'from-amber-400 to-yellow-500',
  Platinum: 'from-sky-400 to-indigo-500',
  Diamond: 'from-teal-300 to-cyan-500'
}

export const inputCls = (dark: boolean) =>
  `w-full h-[50px] px-4 rounded-[16px] outline-none text-[14.5px] border transition-all focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
    dark
      ? 'bg-white/[0.05] border-white/[0.12] text-white placeholder:text-zinc-400'
      : 'bg-white/90 border-black/[0.09] text-zinc-900 placeholder:text-zinc-400'
  }`

export function Field({ label, children, dark, full }: { label: string; children: React.ReactNode; dark: boolean; full?: boolean }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <div className={`text-[12.5px] font-[640] mb-[7px] ${dark ? 'text-zinc-300' : 'text-zinc-700'}`}>{label}</div>
      {children}
    </div>
  )
}

export function statusTint(status: string, dark: boolean) {
  const map: Record<string, string> = {
    pending: dark ? 'bg-amber-400/12 text-amber-300 border border-amber-400/20' : 'bg-amber-50 text-amber-800 border border-amber-200/80',
    accepted: dark ? 'bg-emerald-400/12 text-emerald-300 border border-emerald-400/20' : 'bg-emerald-50 text-emerald-800 border border-emerald-200/80',
    volunteer_assigned: dark ? 'bg-sky-400/12 text-sky-300 border border-sky-400/20' : 'bg-sky-50 text-sky-800 border border-sky-200/80',
    picked_up: dark ? 'bg-indigo-400/12 text-indigo-300 border border-indigo-400/20' : 'bg-indigo-50 text-indigo-800 border border-indigo-200/80',
    delivered: dark ? 'bg-teal-400/12 text-teal-300 border border-teal-400/20' : 'bg-teal-50 text-teal-900 border border-teal-200/80',
    completed: dark ? 'bg-emerald-400/18 text-emerald-200 border border-emerald-400/30' : 'bg-emerald-100/80 text-emerald-900 border border-emerald-300/80',
    cancelled: dark ? 'bg-zinc-600/20 text-zinc-300 border border-zinc-500/20' : 'bg-zinc-100 text-zinc-700 border border-zinc-200',
  }
  return map[status] || map.pending
}

const STEPS: { key: DonationStatus; label: string }[] = [
  { key: 'pending', label: 'Listed' },
  { key: 'accepted', label: 'NGO Accepted' },
  { key: 'volunteer_assigned', label: 'Rider Claimed' },
  { key: 'picked_up', label: 'Picked Up' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'completed', label: 'Completed' },
]

/** Visual lifecycle progress bar for active donations */
export function StatusTimeline({ status, dark }: { status: DonationStatus; dark: boolean }) {
  if (status === 'cancelled') {
    return (
      <div className={`mt-3 text-[11.5px] px-3 py-1.5 rounded-[10px] inline-block ${dark ? 'bg-zinc-700/40 text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`}>
        Donation cancelled
      </div>
    )
  }
  const activeIdx = Math.max(0, STEPS.findIndex(s => s.key === status))
  return (
    <div className="mt-3.5 pt-3 border-t border-black/[0.05] dark:border-white/[0.06]">
      <div className="flex items-center gap-1.5">
        {STEPS.map((step, i) => {
          const done = i <= activeIdx
          const current = i === activeIdx
          return (
            <div key={step.key} className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    current
                      ? 'bg-emerald-500 ring-4 ring-emerald-500/20 animate-pulse'
                      : done
                      ? 'bg-emerald-500'
                      : dark
                      ? 'bg-white/15'
                      : 'bg-black/15'
                  }`}
                />
                <div
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    done
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                      : dark
                      ? 'bg-white/10'
                      : 'bg-black/10'
                  }`}
                />
              </div>
              <div className={`text-[10px] mt-1.5 truncate ${current ? 'font-[700] text-emerald-600 dark:text-emerald-300' : done ? 'opacity-80' : 'opacity-45'}`}>
                {step.label}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function BellTray({
  dark,
  notifications,
  onRead,
  onMarkAllRead
}: {
  dark: boolean
  notifications: Notif[]
  onRead: (id: string) => void
  onMarkAllRead?: () => void
}) {
  const [open, setOpen] = useState(false)
  const unread = notifications.filter(n => !n.read).length
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-10 h-10 rounded-[15px] flex items-center justify-center ${glass(dark)} relative transition hover:scale-[1.03]`}
        aria-label="notifications"
      >
        <Bell className="w-[18px] h-[18px]" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-[5px] rounded-full bg-gradient-to-r from-orange-500 to-rose-500 text-white text-[10px] font-[700] flex items-center justify-center shadow-md">
            {unread}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: .97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6 }}
            className={`absolute right-0 mt-3 w-[360px] max-w-[92vw] z-50 ${glass(dark)} rounded-[24px] p-3`}
          >
            <div className="flex items-center justify-between px-2 pb-2.5 border-b border-black/[0.06] dark:border-white/[0.07]">
              <div className="text-[11.5px] font-[750] tracking-wider opacity-70">REALTIME NOTIFICATIONS</div>
              {unread > 0 && onMarkAllRead && (
                <button onClick={onMarkAllRead} className="text-[11px] font-[650] text-emerald-600 dark:text-emerald-300 flex items-center gap-1 hover:underline">
                  <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-[400px] overflow-auto space-y-2 pr-1 pt-2">
              {notifications.length === 0 && (
                <div className="px-2 py-8 text-center text-sm opacity-65">
                  <BellOff className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  You’re all caught up.
                </div>
              )}
              {notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => onRead(n.id)}
                  className={`px-3.5 py-3 rounded-[16px] cursor-pointer transition border ${
                    n.read
                      ? dark
                        ? 'bg-white/[0.025] border-transparent hover:bg-white/[0.05]'
                        : 'bg-black/[0.015] border-transparent hover:bg-black/[0.03]'
                      : dark
                      ? 'bg-emerald-500/12 border-emerald-400/20'
                      : 'bg-emerald-50/90 border-emerald-200/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[13.5px] font-[680]">{n.title}</div>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />}
                  </div>
                  <div className={`text-[12.5px] mt-0.5 whitespace-pre-line ${dark ? 'text-zinc-300' : 'text-zinc-700'}`}>{n.body}</div>
                  <div className="text-[11px] opacity-55 mt-1.5">{new Date(n.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
