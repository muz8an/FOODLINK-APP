import { create } from 'zustand'

export type Role = 'donor'|'ngo'|'volunteer'|'admin'
export type DonationStatus = 'pending'|'accepted'|'volunteer_assigned'|'picked_up'|'delivered'|'completed'|'cancelled'

export interface UserProfile {
  id: string
  email: string
  full_name: string
  role: Role
  organization_name?: string
  phone?: string
  verified: boolean
  points: number
  rank: string
  streak: number
  lat: number
  lng: number
  avatar?: string
}

export interface Donation {
  id: string
  donor_id: string
  donor_name: string
  food_name: string
  category: string
  veg_type: 'veg'|'non-veg'|'vegan'
  quantity_kg: number
  servings: number
  expiry_at: string
  pickup_address: string
  lat: number
  lng: number
  contact_phone: string
  notes?: string
  images: string[]
  status: DonationStatus
  accepted_by?: string
  volunteer_id?: string
  points_awarded: number
  created_at: string
}

export interface EmergencyReq {
  id: string
  ngo_id: string
  ngo_name: string
  location: string
  lat: number
  lng: number
  meals_needed: number
  priority: 'low'|'medium'|'high'|'critical'
  description: string
  fulfilled: number
  created_at: string
}

export interface ChatMessage {
  id: string
  threadId: string
  sender_id: string
  sender_name: string
  text: string
  created_at: string
  read?: boolean
}

export interface Notif {
  id: string
  user_id: string
  title: string
  body: string
  type: string
  read: boolean
  created_at: string
}



interface State {
  users: UserProfile[]
  currentUser: UserProfile | null
  donations: Donation[]
  emergencies: EmergencyReq[]
  messages: ChatMessage[]
  notifications: Notif[]
  setCurrentUser: (u:UserProfile|null)=>void
  addUser: (u:UserProfile)=>void
  addDonation: (d:Donation)=>void
  updateDonation: (id:string, patch:Partial<Donation>)=>void
  addEmergency: (e:EmergencyReq)=>void
  addMessage: (m:ChatMessage)=>void
  pushNotif: (n:Notif)=>void
  markNotifRead: (id:string)=>void
  awardPoints: (userId:string, pts:number)=>void
}

export const useStore = create<State>((set, _get)=>({
  users: [],
  currentUser: null,
  donations: [],
  emergencies: [],
  messages: [],
  notifications: [],
  setCurrentUser: (u)=> set({currentUser: u}),
  addUser: (u)=> set(s=> ({users: [...s.users, u]})),
  addDonation: (d)=> set(s=> ({donations: [d, ...s.donations]})),
  updateDonation: (id,patch)=> set(s=> ({donations: s.donations.map(x=>x.id===id? {...x, ...patch}:x)})),
  addEmergency: (e)=> set(s=> ({emergencies: [e, ...s.emergencies]})),
  addMessage: (m)=> set(s=> ({ messages: [...s.messages, m] })),
  pushNotif: (n)=> set(s=> ({ notifications: [n, ...s.notifications] })),
  markNotifRead: (id)=> set(s=> ({notifications: s.notifications.map(n=>n.id===id? {...n, read:true}:n)})),
  awardPoints: (userId, pts)=> set(s=>{
    const users = s.users.map(u=> u.id===userId ? {...u, points:u.points+pts, rank: calcRank(u.points+pts)}:u)
    const currentUser = s.currentUser?.id===userId ? users.find(u=>u.id===userId)||s.currentUser : s.currentUser
    return { users, currentUser }
  })
}))

export function calcRank(points:number){
  if(points>=1500) return 'Diamond'
  if(points>=900) return 'Platinum'
  if(points>=500) return 'Gold'
  if(points>=220) return 'Silver'
  return 'Bronze'
}

export function calcPoints(d: Partial<Donation>, isEmergency=false){
  let p = 10
  if(isEmergency) p = 20
  if((d.servings||0) >= 50) p += 15
  return p
}

export const badges = [
  {key:'first_donation', name:'First Donation', desc:'You shared your first meal', icon:'🌱'},
  {key:'food_saver', name:'Food Saver', desc:'10+ donations completed', icon:'🥗'},
  {key:'hunger_hero', name:'Hunger Hero', desc:'500+ people fed', icon:'🦸'},
  {key:'emergency_hero', name:'Emergency Hero', desc:'Responded to critical alert', icon:'🚨'},
  {key:'top_donor', name:'Top Donor', desc:'Top 5 on leaderboard', icon:'🏆'},
  {key:'diamond', name:'Diamond Donor', desc:'1500+ impact points', icon:'💎'},
]

export function haversine(lat1:number,lon1:number,lat2:number,lon2:number){
  const R=6371; const dLat=(lat2-lat1)*Math.PI/180; const dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2
  return R*2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}
