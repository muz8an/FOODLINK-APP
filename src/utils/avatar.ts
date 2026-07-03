// Pure CSS Avatar generator helper for premium colored initials

export function getAvatarStyle(email: string, name: string) {
  const seed = (email || name || 'A').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  
  const gradients = [
    'from-emerald-500 to-teal-600',
    'from-orange-400 to-amber-600',
    'from-cyan-500 to-blue-600',
    'from-fuchsia-500 to-purple-600',
    'from-rose-500 to-pink-600',
    'from-lime-500 to-emerald-600',
    'from-amber-500 to-orange-600',
    'from-indigo-500 to-violet-600'
  ]
  
  const gradient = gradients[seed % gradients.length]
  const initials = (name || 'U').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase()
  
  return {
    initials,
    gradient
  }
}
