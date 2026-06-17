export type Coordinates = {
  latitude: number
  longitude: number
  accuracyMeters: number
  capturedAt: Date
}

export type Stop = {
  id: string
  name: string
  latitude: number
  longitude: number
}

export type Route = {
  id: string
  shortName: string
  longName: string
  color: string
}

export type Trip = {
  id: string
  routeId: string
  headsign: string
  stopIds: string[]
}

export type VehiclePosition = {
  vehicleId: string
  tripId: string
  latitude: number
  longitude: number
  bearing?: number
  timestamp: Date
}

export type BusCandidate = {
  trip: Trip
  route: Route
  vehicle: VehiclePosition
  confidence: number
  reason: string
}

export type EtaResult = {
  stop: Stop
  estimatedArrival: Date
  minutesUntilArrival: number
  source: 'mock' | 'gtfs-rt'
}
