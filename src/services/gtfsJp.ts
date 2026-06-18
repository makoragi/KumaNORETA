import { mockRoutes, mockStops, mockTrips } from '../mocks/mockData'
import type { GtfsFeedMetadata, Route, Stop, Trip } from '../types'

export type StaticGtfsData = {
  metadata: GtfsFeedMetadata
  routes: Route[]
  stops: Stop[]
  trips: Trip[]
}

const STATIC_GTFS_URL = `${import.meta.env.BASE_URL}gtfs/toshibus-static.json`

export async function loadStaticGtfsData(): Promise<StaticGtfsData> {
  try {
    const response = await fetch(STATIC_GTFS_URL)
    if (!response.ok) {
      throw new Error(`Static GTFS request failed with ${response.status}`)
    }

    return (await response.json()) as StaticGtfsData
  } catch (error) {
    console.error('Failed to load static GTFS-JP data, falling back to mocks.', error)

    return {
      metadata: {
        publisherName: 'mock',
        version: 'mock',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date().toISOString().slice(0, 10),
        sourceUrl: 'mock',
        fetchedAt: new Date().toISOString(),
        routeCount: mockRoutes.length,
        stopCount: mockStops.length,
        tripCount: mockTrips.length,
      },
      routes: mockRoutes,
      stops: mockStops,
      trips: mockTrips,
    }
  }
}
