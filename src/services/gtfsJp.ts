import {
  getStaticGtfsFile,
  getTransitOperator,
  normalizeTransitDatasetId,
} from '../config/transit'
import { mockRoutes, mockStops, mockTrips } from '../mocks/mockData'
import type { GtfsFeedMetadata, Route, Stop, Trip } from '../types'

export type StaticGtfsData = {
  metadata: GtfsFeedMetadata
  routes: Route[]
  stops: Stop[]
  trips: Trip[]
}

type StaticGtfsDataLike = {
  metadata: GtfsFeedMetadata
  routes: Array<Partial<Route> & Pick<Route, 'id' | 'shortName' | 'longName' | 'color'>>
  stops: Array<Partial<Stop> & Pick<Stop, 'id' | 'name' | 'latitude' | 'longitude'>>
  trips: Array<Partial<Trip> & Pick<Trip, 'id' | 'routeId' | 'headsign' | 'stopIds'>>
}

function normalizeStaticGtfsData(datasetId: string, data: StaticGtfsDataLike): StaticGtfsData {
  const fallbackOperator = datasetId !== 'all' ? getTransitOperator(datasetId) : undefined
  const fallbackAgencyId = fallbackOperator?.id ?? data.metadata.agencyIds?.[0] ?? datasetId
  const fallbackAgencyName = fallbackOperator?.agencyName ?? data.metadata.publisherName

  return {
    metadata: {
      ...data.metadata,
      datasetId: data.metadata.datasetId ?? datasetId,
      agencyIds: data.metadata.agencyIds ?? [fallbackAgencyId],
    },
    routes: data.routes.map((route) => ({
      ...route,
      agencyId: route.agencyId ?? fallbackAgencyId,
      agencyName: route.agencyName ?? fallbackAgencyName,
    })) as Route[],
    stops: data.stops.map((stop) => ({
      ...stop,
      agencyId: stop.agencyId ?? fallbackAgencyId,
      agencyName: stop.agencyName ?? fallbackAgencyName,
    })) as Stop[],
    trips: data.trips.map((trip) => ({
      ...trip,
      agencyId: trip.agencyId ?? fallbackAgencyId,
    })) as Trip[],
  }
}

export async function loadStaticGtfsData(): Promise<StaticGtfsData> {
  const datasetId = normalizeTransitDatasetId(import.meta.env.VITE_TRANSIT_DATASET)
  const staticGtfsUrl = `${import.meta.env.BASE_URL}gtfs/${getStaticGtfsFile(datasetId)}`

  try {
    const response = await fetch(staticGtfsUrl)
    if (!response.ok) {
      throw new Error(`Static GTFS request failed with ${response.status}`)
    }

    return normalizeStaticGtfsData(datasetId, (await response.json()) as StaticGtfsDataLike)
  } catch (error) {
    console.error('Failed to load static GTFS-JP data, falling back to mocks.', error)

    return {
      metadata: {
        publisherName: 'mock',
        version: 'mock',
        datasetId,
        agencyIds: ['mock'],
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
