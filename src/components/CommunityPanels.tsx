import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { MessageCircle, Send, Trophy, Crown } from 'lucide-react'
import { useStore } from '../lib/store'
import { chatDb } from '../lib/db'
import { getAvatarStyle } from '../utils/avatar'
import { GlassCard, inputCls } from './ui'

const QUICK_REPLIES = [
  'Food is packed and ready at pickup gate!',
  'Rider is on the way (ETA 10 mins)',
  'Reached pickup location',
  'Delivered safely to NGO hub!'
]

export function ChatPanel({ dark }: { dark: boolean }) {
  const { messages, currentUser, users } = useStore()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const sortedMessages = React.useMemo(
    () => [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [messages]
  )

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [sortedMessages.length])

  const handleSendMessage = async (customText?: string) => {
    const content = (customText ?? text).trim()
    if (!content || !currentUser || sending) return
    setSending(true)
    try {
      const sent = await chatDb.send({
        sender_id: currentUser.id,
        text: content
      })
      if (sent) {
        useStore.getState().addMessage(sent)
        if (!customText) setText('')
      } else {
        const localMsg = {
          id: 'local_' + Math.random().toString(36).slice(2),
          threadId: 'local',
          sender_id: currentUser.id,
          sender_name: currentUser.full_name,
          text: content,
          created_at: new Date().toISOString(),
          read: false
        }
        useStore.getState().addMessage(localMsg)
        if (!customText) setText('')
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <GlassCard dark={dark} className="p-[18px] md:p-[24px]">
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-[12px] flex items-center justify-center ${dark ? 'bg-emerald-400/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
            <MessageCircle className="w-[18px] h-[18px]" />
          </div>
          <div>
            <div className="text-[15.5px] font-[720]">Live Dispatch Chat</div>
            <div className="text-[11.5px] opacity-65">{sortedMessages.length} message{sortedMessages.length === 1 ? '' : 's'} · realtime channel</div>
          </div>
        </div>
        <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-[650] flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Online
        </span>
      </div>

      {currentUser && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {QUICK_REPLIES.map(qr => (
            <button
              key={qr}
              type="button"
              onClick={() => handleSendMessage(qr)}
              className={`text-[11.5px] px-3 py-1 rounded-full transition ${dark ? 'bg-white/[0.06] hover:bg-emerald-500/20 text-zinc-200' : 'bg-emerald-50/90 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/70'}`}
            >
              + {qr}
            </button>
          ))}
        </div>
      )}

      <div className={`h-[390px] overflow-auto p-3 space-y-3 rounded-[18px] ${dark ? 'bg-black/20' : 'bg-black/[0.02]'}`}>
        {sortedMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-[14px] opacity-65">
            <MessageCircle className="w-9 h-9 mb-2 opacity-40" />
            No chat messages yet. Send a quick update to start coordinating pickups.
          </div>
        ) : sortedMessages.map(m => {
          const isMe = m.sender_id === currentUser?.id
          const sender = users.find(u => u.id === m.sender_id)
          const av = getAvatarStyle(sender?.email || m.sender_id, m.sender_name || 'M')
          return (
            <div key={m.id} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
              {!isMe && (
                <div className={`w-7 h-7 rounded-[10px] flex items-center justify-center text-white text-[10px] font-[700] bg-gradient-to-br ${av.gradient} flex-shrink-0`}>
                  {av.initials}
                </div>
              )}
              <div className={`max-w-[75%] px-[14px] py-[10px] rounded-[18px] text-[13.8px] shadow-sm ${isMe ? 'bg-gradient-to-br from-emerald-600 to-emerald-500 text-white rounded-br-[6px]' : dark ? 'bg-white/[0.08] rounded-bl-[6px]' : 'bg-white rounded-bl-[6px] border border-black/[0.05]'}`}>
                <div className="flex items-center justify-between gap-3 text-[11px] opacity-80 mb-[2px] font-[680]">
                  <span>{isMe ? 'You' : m.sender_name || 'Member'}</span>
                  <span className="text-[10px] opacity-65 font-normal">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                {m.text}
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); handleSendMessage() }} className="flex gap-2 mt-3">
        <input value={text} onChange={e => setText(e.target.value)} placeholder={currentUser ? 'Type a message...' : 'Login to join the chat'} className={inputCls(dark)} disabled={!currentUser} />
        <button type="submit" disabled={!currentUser || !text.trim() || sending} className="px-[18px] rounded-[16px] bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-[640] flex items-center gap-1.5 shadow-md shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-105 transition">
          <Send className="w-4 h-4" /> Send
        </button>
      </form>
    </GlassCard>
  )
}

export function Leaderboard({ dark }: { dark: boolean }) {
  const { users, currentUser } = useStore()
  const sorted = [...users].sort((a, b) => (b.points || 0) - (a.points || 0))
  const currentRank = currentUser ? sorted.findIndex(u => u.id === currentUser.id) + 1 : null
  const medalBg = [
    'from-amber-400/20 to-yellow-500/10 border-amber-400/40',
    'from-slate-300/20 to-slate-400/10 border-slate-400/35',
    'from-orange-400/20 to-amber-600/10 border-orange-400/35',
  ]

  return (
    <div className="space-y-5">
      <GlassCard dark={dark} className="p-[20px]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-[13.5px] font-[750] uppercase tracking-wider opacity-80 flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-amber-500" /> Global Impact Leaderboard
            </div>
            <div className="text-[12.5px] opacity-70 mt-0.5">Top contributors across donors, NGOs, and volunteers.</div>
          </div>
          {currentUser && currentRank ? (
            <div className={`text-[12.5px] px-3.5 py-2 rounded-[14px] ${dark ? 'bg-emerald-500/12 text-emerald-300' : 'bg-emerald-50 text-emerald-800'} text-right`}>
              Your rank: <span className="font-[750]">#{currentRank}</span> · {currentUser.points} pts ({currentUser.rank})
            </div>
          ) : null}
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.slice(0, 6).map((u, i) => (
            <div
              key={u.id}
              className={`p-[16px] rounded-[20px] border transition ${
                i < 3
                  ? `bg-gradient-to-br ${medalBg[i]}`
                  : dark ? 'bg-white/[0.04] border-white/[0.07]' : 'bg-black/[0.025] border-black/[0.05]'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`text-[13px] font-[800] w-6 ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-500' : 'opacity-65'}`}>
                  #{i + 1}
                </div>
                <div className={`w-10 h-10 rounded-[13px] flex items-center justify-center text-white text-[12.5px] font-[700] bg-gradient-to-br ${getAvatarStyle(u.email, u.full_name).gradient} shadow-sm`}>
                  {getAvatarStyle(u.email, u.full_name).initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-[700] truncate">{u.full_name}</div>
                  <div className="text-[11px] opacity-70">{u.role.toUpperCase()}</div>
                </div>
              </div>
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="font-[680]">{u.points} pts</span>
                <span className="opacity-75">{u.rank}</span>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
      <div className="grid lg:grid-cols-3 gap-5">
        {['donor', 'ngo', 'volunteer'].map(role => {
          const roleUsers = sorted.filter(u => u.role === role).slice(0, 5)
          return (
            <GlassCard key={role} dark={dark} className="p-[18px]">
              <div className="text-[13.5px] font-[720] uppercase tracking-wider opacity-80 mb-3">Top {role}s</div>
              <div className="space-y-[10px]">
                {roleUsers.length === 0 ? (
                  <div className="text-[13px] opacity-70">No {role} users tracked yet.</div>
                ) : roleUsers.map((u, i) => (
                  <div key={u.id} className={`flex items-center gap-3 p-[11px] rounded-[14px] ${dark ? 'bg-white/[0.035]' : 'bg-black/[0.03]'}`}>
                    <div className="text-[11.5px] font-[800] opacity-70">#{i + 1}</div>
                    <div className={`w-10 h-10 rounded-[12px] flex items-center justify-center text-white text-[12px] font-[700] bg-gradient-to-br ${getAvatarStyle(u.email, u.full_name).gradient}`}>
                      {getAvatarStyle(u.email, u.full_name).initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.7px] font-[660] truncate">{u.full_name}</div>
                      <div className="text-[11.5px] opacity-75">{u.rank} • {u.points} pts</div>
                    </div>
                    <Trophy className={`w-4 h-4 ${i === 0 ? 'text-amber-500' : 'opacity-40'}`} />
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
