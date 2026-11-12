import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { useStore, type Role } from '../lib/store'
import { authDb, db } from '../lib/db'
import { glass } from './ui'

export function AuthModal({ dark, tr, onClose }: { dark: boolean; tr: any; onClose: () => void }) {
  const { setCurrentUser } = useStore()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [role, setRole] = useState<Role>('donor')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [showPass, setShowPass] = useState(false)
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[6px]" onClick={onClose} />
      <motion.div initial={{ y: 16, scale: .975 }} animate={{ y: 0, scale: 1 }} exit={{ y: 12, opacity: 0 }}
        className={`relative w-full max-w-[980px] grid md:grid-cols-[1.05fr_1fr] rounded-[30px] overflow-hidden ${glass(dark)} glass-noise`}
      >
        <div className="hidden md:block relative p-9 bg-gradient-to-br from-emerald-600 via-emerald-600 to-orange-500 text-white">
          <div className="display text-[34px] font-[700] leading-tight">FoodLink Control<br />Center</div>
          <div className="mt-3 text-[14.7px] text-emerald-50/95">Supabase Auth • RLS • Realtime • Interactive Maps</div>
          <div className="mt-8 space-y-3 text-[13.6px]">
            {['Email authentication', 'Role RBAC (Donor/NGO/Volunteer/Admin)', 'Live chat • QR • Badges • Leaderboard', 'End-to-end cold-chain proof'].map(b => (
              <div key={b} className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{b}</div>
            ))}
          </div>
          <div className="absolute bottom-9 left-9 right-9 text-[12px] text-emerald-100/90">
            Secure RLS storage enabled. Register a real account below.
          </div>
        </div>

        <div className={`p-[28px] ${dark ? 'bg-[#11161a]/40' : 'bg-white/78'}`}>
          <div className="flex items-center justify-between">
            <div className="text-[22px] font-[750] display">{mode === 'login' ? tr('welcome_back') : 'Create your FoodLink'}</div>
            <button onClick={onClose} className={`w-9 h-9 rounded-[12px] flex items-center justify-center ${dark ? 'bg-white/[0.07]' : 'bg-black/[0.05]'}`}>✕</button>
          </div>

          <div className={`mt-4 grid grid-cols-4 gap-2 p-[6px] rounded-[18px] ${dark ? 'bg-white/[0.05]' : 'bg-black/[0.040]'}`}>
            {(['donor', 'ngo', 'volunteer', 'admin'] as Role[]).map(r => (
              <button key={r} onClick={() => { setRole(r); setMode('register') }} type="button"
                className={`py-[10px] rounded-[13px] text-[12.6px] font-[660] capitalize transition ${role === r ? 'bg-emerald-600 text-white shadow' : (dark ? 'text-zinc-300 hover:bg-white/[0.06]' : 'text-zinc-700 hover:bg-white')}`}>
                {tr(r as any)}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-5 space-y-3.5">
            {mode === 'register' && (
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name / Organization" required
                className={`w-full h-[50px] px-4 rounded-[16px] outline-none text-[14.5px] ${dark ? 'bg-white/[0.06] border-white/[0.10] text-white placeholder:text-zinc-400' : 'bg-white border-black/[0.07] text-zinc-900'} border`} />
            )}
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Email" required
              className={`w-full h-[50px] px-4 rounded-[16px] outline-none text-[14.5px] ${dark ? 'bg-white/[0.06] border-white/[0.10] text-white placeholder:text-zinc-400' : 'bg-white border-black/[0.07] text-zinc-900'} border`} />
            <div className="relative">
              <input value={pass} onChange={e => setPass(e.target.value)} type={showPass ? 'text' : 'password'} placeholder="Password" required
                className={`w-full h-[50px] pl-4 pr-11 rounded-[16px] outline-none text-[14.5px] ${dark ? 'bg-white/[0.06] border-white/[0.10] text-white placeholder:text-zinc-400' : 'bg-white border-black/[0.07] text-zinc-900'} border`} />
              <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-65 hover:opacity-100" aria-label="toggle password">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center justify-between text-[12.8px]">
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" defaultChecked /> Remember me</label>
              <button type="button" onClick={() => toast.info('Use your registered email to reset via Supabase Auth')} className="text-emerald-600 font-[600]">Forgot?</button>
            </div>
            <button disabled={busy} className="w-full h-[52px] rounded-[16px] font-[720] text-white bg-gradient-to-r from-emerald-600 to-emerald-500 disabled:opacity-60">
              {busy ? 'Authenticating…' : (mode === 'login' ? 'Sign in securely' : 'Create account')}
            </button>
            <div className="text-[13px] text-center opacity-80">
              {mode === 'login' ? "No account? " : "Already have an account? "}
              <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="text-emerald-600 font-[700]">{mode === 'login' ? 'Register' : 'Login'}</button>
            </div>
          </form>

          <div className={`mt-4 rounded-[16px] p-[14px] text-[12.6px] ${dark ? 'bg-emerald-400/[0.07] text-emerald-300' : 'bg-emerald-50 text-emerald-800'}`}>
            <strong>Authentic Profiles Only:</strong> Please select your desired role above and complete a real registration.
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

