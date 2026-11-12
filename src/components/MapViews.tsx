import React, { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap, useMapEvents } from 'react-leaflet'
import { useStore, type Donation } from '../lib/store'

export function MapLite({ dark }: { dark: boolean }) {
  const { donations } = useStore()
  return (
    <MapContainer center={[12.9716, 77.5946]} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false} attributionControl={false}>
      <TileLayer
        url={dark
          ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
      />
      {donations.map(d => (
        <Marker key={d.id} position={[d.lat, d.lng]}>
          <Popup>{d.food_name} · {d.servings} servings · {d.status.replace('_', ' ')}</Popup>
        </Marker>
      ))}
      <Recenter />
    </MapContainer>
  )
}

export function MapClickHandler({ setLoc }: { setLoc: React.Dispatch<React.SetStateAction<{ lat: number; lng: number; addr: string }>> }) {
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

export function MapWithDonations({
  dark,
  donations,
  showRoute = false,
  heat = false
}: {
  dark: boolean
  donations: Donation[]
  showRoute?: boolean
  heat?: boolean
}) {
  const { users } = useStore()
  const center: [number, number] = donations.length > 0
    ? [donations[0].lat, donations[0].lng]
    : [12.9716, 77.5946]

  return (
    <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        url={dark
          ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          : 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png'}
        attribution="© OpenStreetMap"
      />
      {donations.map(d => {
        const ngo = d.accepted_by ? users.find(u => u.id === d.accepted_by) : undefined
        const routePositions: [number, number][] | null =
          showRoute && ngo ? [[d.lat, d.lng], [ngo.lat || 12.9716, ngo.lng || 77.5946]] : null

        return (
          <React.Fragment key={d.id}>
            {heat ? (
              <CircleMarker
                center={[d.lat, d.lng]}
                radius={Math.min(34, Math.max(10, Math.sqrt(d.servings || 10) * 3))}
                pathOptions={{
                  color: d.status === 'completed' ? '#10b981' : '#f97316',
                  fillColor: d.status === 'completed' ? '#10b981' : '#f97316',
                  fillOpacity: 0.38,
                  weight: 2
                }}
              >
                <Popup>
                  <b>{d.food_name}</b><br />
                  {d.servings} meals · {d.quantity_kg} kg<br />
                  Status: {d.status.replace('_', ' ')}
                </Popup>
              </CircleMarker>
            ) : (
              <Marker position={[d.lat, d.lng]}>
                <Popup>
                  <b>{d.food_name}</b><br />
                  {d.servings} meals · {d.pickup_address}<br />
                  Status: {d.status.replace('_', ' ')}
                </Popup>
              </Marker>
            )}
            {routePositions && (
              <>
                <Polyline positions={routePositions} pathOptions={{ color: '#10b981', weight: 4, dashArray: '8 6' }} />
                <CircleMarker center={routePositions[1]} radius={8} pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 0.85 }}>
                  <Popup>Deliver to: {ngo?.organization_name || ngo?.full_name}</Popup>
                </CircleMarker>
              </>
            )}
          </React.Fragment>
        )
      })}
      <Recenter />
    </MapContainer>
  )
}

export function Recenter() {
  const map = useMap()
  useEffect(() => {
    const id = setTimeout(() => map.invalidateSize(), 220)
    return () => clearTimeout(id)
  }, [map])
  return null
}

