declare module '*.css'

interface ImportMetaEnv {
  readonly BASE_URL: string
  readonly VITE_GPS_OVERRIDE_ACCURACY_METERS?: string
  readonly VITE_GPS_OVERRIDE_ENABLED?: string
  readonly VITE_GPS_OVERRIDE_LATITUDE?: string
  readonly VITE_GPS_OVERRIDE_LONGITUDE?: string
  readonly VITE_TRANSIT_DATASET?: string
  readonly VITE_GTFS_RT_API_KEY?: string
  readonly VITE_GTFS_RT_API_KEY_HEADER?: string
  readonly VITE_GTFS_RT_AUTH_TOKEN?: string
  readonly VITE_GTFS_RT_PROXY_URL?: string
  readonly VITE_GTFS_RT_ALERTS_URL?: string
  readonly VITE_GTFS_RT_TRIP_UPDATES_URL?: string
  readonly VITE_GTFS_RT_USE_MOCK?: string
  readonly VITE_GTFS_RT_VEHICLE_POSITIONS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

type LeafletMapInstance = {
  addLayer?: (layer: unknown) => void
  fitBounds: (bounds: unknown, options?: Record<string, unknown>) => void
  getCenter: () => { lat: number; lng: number }
  getZoom: () => number
  invalidateSize: () => void
  on: (event: string, handler: () => void) => void
  remove: () => void
  setMaxBounds: (bounds: unknown) => void
  setView: (center: [number, number], zoom: number) => void
}

type LeafletNamespace = {
  circle: (latlng: [number, number], options?: Record<string, unknown>) => { addTo: (map: LeafletMapInstance) => void }
  divIcon: (options?: Record<string, unknown>) => unknown
  latLngBounds: (latlngs: [number, number][]) => { pad: (ratio: number) => unknown }
  map: (element: HTMLElement, options?: Record<string, unknown>) => LeafletMapInstance
  marker: (
    latlng: [number, number],
    options?: Record<string, unknown>,
  ) => { addTo: (map: LeafletMapInstance) => { on: (event: string, handler: () => void) => void } }
  tileLayer: (
    urlTemplate: string,
    options?: Record<string, unknown>,
  ) => { addTo: (map: LeafletMapInstance) => void }
}

interface Window {
  L?: LeafletNamespace
}
