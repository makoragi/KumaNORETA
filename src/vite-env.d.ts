declare module '*.css'

interface ImportMetaEnv {
  readonly VITE_GTFS_RT_API_KEY?: string
  readonly VITE_GTFS_RT_API_KEY_HEADER?: string
  readonly VITE_GTFS_RT_AUTH_TOKEN?: string
  readonly VITE_GTFS_RT_ALERTS_URL?: string
  readonly VITE_GTFS_RT_TRIP_UPDATES_URL?: string
  readonly VITE_GTFS_RT_USE_MOCK?: string
  readonly VITE_GTFS_RT_VEHICLE_POSITIONS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
