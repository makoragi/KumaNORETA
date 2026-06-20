import {
  getTransitDatasetOperators,
  normalizeTransitDatasetId,
  type TransitDatasetId,
  type TransitOperator,
  type TransitOperatorId,
} from '../config/transit'
import { mockTripUpdates, mockVehicles } from '../mocks/mockData'
import type { TripUpdate, VehiclePosition } from '../types'

export type GtfsRtCollectionFetchStatus = 'ok' | 'failed' | 'mock'

export type TripUpdatesFetchResult = {
  status: GtfsRtCollectionFetchStatus
  tripUpdates: TripUpdate[]
}

type GtfsRtConfig = {
  apiKey?: string
  apiKeyHeader: string
  authToken?: string
  datasetId: TransitDatasetId
  useMock: boolean
}

type ParsedVehiclePosition = {
  bearing?: number
  latitude?: number
  longitude?: number
  timestamp?: number
  tripId?: string
  vehicleId?: string
}

type ParsedStopTimeDelay = {
  stopId?: string
  stopSequence?: number
  arrivalDelaySeconds?: number
  departureDelaySeconds?: number
}

type ParsedTripUpdate = {
  tripId?: string
  vehicleId?: string
  delaySeconds?: number
  stopTimeDelays: ParsedStopTimeDelay[]
  timestamp?: number
}

type RawVehiclePosition = Omit<VehiclePosition, 'agencyId' | 'agencyName'>
type RawTripUpdate = Omit<TripUpdate, 'agencyId' | 'agencyName'>

class ProtoReader {
  private offset = 0

  constructor(private readonly bytes: Uint8Array) {}

  get eof() {
    return this.offset >= this.bytes.length
  }

  readFloat32() {
    const view = new DataView(this.bytes.buffer, this.bytes.byteOffset + this.offset, 4)
    const value = view.getFloat32(0, true)
    this.offset += 4
    return value
  }

  readLengthDelimited() {
    const length = this.readVarint()
    const start = this.offset
    const end = start + length
    if (end > this.bytes.length) {
      throw new Error('Unexpected end of protobuf field')
    }

    this.offset = end
    return this.bytes.subarray(start, end)
  }

  readString() {
    return new TextDecoder().decode(this.readLengthDelimited())
  }

  readTag() {
    const tag = this.readVarint()
    return {
      fieldNumber: tag >>> 3,
      wireType: tag & 0b111,
    }
  }

  private readVarintBigInt() {
    let result = 0n
    let shift = 0n

    while (true) {
      if (this.offset >= this.bytes.length) {
        throw new Error('Unexpected end of protobuf varint')
      }

      const byte = this.bytes[this.offset++]
      result |= BigInt(byte & 0x7f) << shift

      if ((byte & 0x80) === 0) {
        return result
      }

      shift += 7n
    }
  }

  readVarint() {
    const raw = this.readVarintBigInt()
    const numeric = Number(raw)
    if (!Number.isSafeInteger(numeric)) {
      throw new Error('Protobuf varint exceeds safe integer range')
    }

    return numeric
  }

  readInt32() {
    return Number(BigInt.asIntN(32, this.readVarintBigInt()))
  }

  skip(wireType: number) {
    switch (wireType) {
      case 0:
        this.readVarintBigInt()
        return
      case 1:
        this.offset += 8
        return
      case 2: {
        const length = this.readVarint()
        this.offset += length
        return
      }
      case 5:
        this.offset += 4
        return
      default:
        throw new Error(`Unsupported protobuf wire type: ${wireType}`)
    }
  }
}

function parsePosition(reader: ProtoReader) {
  const position: Pick<ParsedVehiclePosition, 'bearing' | 'latitude' | 'longitude'> = {}

  while (!reader.eof) {
    const { fieldNumber, wireType } = reader.readTag()
    if (wireType !== 5) {
      reader.skip(wireType)
      continue
    }

    switch (fieldNumber) {
      case 1:
        position.latitude = reader.readFloat32()
        break
      case 2:
        position.longitude = reader.readFloat32()
        break
      case 3:
        position.bearing = reader.readFloat32()
        break
      default:
        reader.skip(wireType)
    }
  }

  return position
}

function parseTripDescriptor(reader: ProtoReader) {
  let tripId: string | undefined

  while (!reader.eof) {
    const { fieldNumber, wireType } = reader.readTag()
    if (fieldNumber === 1 && wireType === 2) {
      tripId = reader.readString()
      continue
    }

    reader.skip(wireType)
  }

  return tripId
}

function parseVehicleDescriptor(reader: ProtoReader) {
  let vehicleId: string | undefined

  while (!reader.eof) {
    const { fieldNumber, wireType } = reader.readTag()
    if (fieldNumber === 1 && wireType === 2) {
      vehicleId = reader.readString()
      continue
    }

    reader.skip(wireType)
  }

  return vehicleId
}

function parseVehiclePositionMessage(reader: ProtoReader) {
  const parsed: ParsedVehiclePosition = {}

  while (!reader.eof) {
    const { fieldNumber, wireType } = reader.readTag()

    switch (fieldNumber) {
      case 1:
        if (wireType === 2) {
          parsed.tripId = parseTripDescriptor(new ProtoReader(reader.readLengthDelimited()))
          break
        }
        reader.skip(wireType)
        break
      case 2:
        if (wireType === 2) {
          Object.assign(parsed, parsePosition(new ProtoReader(reader.readLengthDelimited())))
          break
        }
        reader.skip(wireType)
        break
      case 5:
        if (wireType === 0) {
          parsed.timestamp = reader.readVarint()
          break
        }
        reader.skip(wireType)
        break
      case 8:
        if (wireType === 2) {
          parsed.vehicleId = parseVehicleDescriptor(new ProtoReader(reader.readLengthDelimited()))
          break
        }
        reader.skip(wireType)
        break
      default:
        reader.skip(wireType)
    }
  }

  return parsed
}

function parseStopTimeEvent(reader: ProtoReader) {
  let delaySeconds: number | undefined

  while (!reader.eof) {
    const { fieldNumber, wireType } = reader.readTag()

    if (fieldNumber === 1 && wireType === 0) {
      delaySeconds = reader.readInt32()
      continue
    }

    reader.skip(wireType)
  }

  return delaySeconds
}

function parseStopTimeUpdate(reader: ProtoReader) {
  const parsed: ParsedStopTimeDelay = {}

  while (!reader.eof) {
    const { fieldNumber, wireType } = reader.readTag()

    switch (fieldNumber) {
      case 1:
        if (wireType === 0) {
          parsed.stopSequence = reader.readVarint()
          break
        }
        reader.skip(wireType)
        break
      case 2:
        if (wireType === 2) {
          parsed.arrivalDelaySeconds = parseStopTimeEvent(new ProtoReader(reader.readLengthDelimited()))
          break
        }
        reader.skip(wireType)
        break
      case 3:
        if (wireType === 2) {
          parsed.departureDelaySeconds = parseStopTimeEvent(new ProtoReader(reader.readLengthDelimited()))
          break
        }
        reader.skip(wireType)
        break
      case 4:
        if (wireType === 2) {
          parsed.stopId = reader.readString()
          break
        }
        reader.skip(wireType)
        break
      default:
        reader.skip(wireType)
    }
  }

  return parsed
}

function parseTripUpdateMessage(reader: ProtoReader) {
  const parsed: ParsedTripUpdate = { stopTimeDelays: [] }

  while (!reader.eof) {
    const { fieldNumber, wireType } = reader.readTag()

    switch (fieldNumber) {
      case 1:
        if (wireType === 2) {
          parsed.tripId = parseTripDescriptor(new ProtoReader(reader.readLengthDelimited()))
          break
        }
        reader.skip(wireType)
        break
      case 2:
        if (wireType === 2) {
          parsed.stopTimeDelays.push(parseStopTimeUpdate(new ProtoReader(reader.readLengthDelimited())))
          break
        }
        reader.skip(wireType)
        break
      case 3:
        if (wireType === 2) {
          parsed.vehicleId = parseVehicleDescriptor(new ProtoReader(reader.readLengthDelimited()))
          break
        }
        reader.skip(wireType)
        break
      case 4:
        if (wireType === 0) {
          parsed.timestamp = reader.readVarint()
          break
        }
        reader.skip(wireType)
        break
      case 5:
        if (wireType === 0) {
          parsed.delaySeconds = reader.readInt32()
          break
        }
        reader.skip(wireType)
        break
      default:
        reader.skip(wireType)
    }
  }

  return parsed
}

function parseFeedEntity<T>(
  reader: ProtoReader,
  fieldNumber: number,
  parser: (nestedReader: ProtoReader) => T,
) {
  let parsed: T | undefined

  while (!reader.eof) {
    const tag = reader.readTag()
    if (tag.fieldNumber === fieldNumber && tag.wireType === 2) {
      parsed = parser(new ProtoReader(reader.readLengthDelimited()))
      continue
    }

    reader.skip(tag.wireType)
  }

  return parsed
}

function decodeVehiclePositions(buffer: ArrayBuffer): RawVehiclePosition[] {
  const reader = new ProtoReader(new Uint8Array(buffer))
  const vehicles: RawVehiclePosition[] = []

  while (!reader.eof) {
    const { fieldNumber, wireType } = reader.readTag()
    if (fieldNumber !== 2 || wireType !== 2) {
      reader.skip(wireType)
      continue
    }

    const entity = parseFeedEntity(new ProtoReader(reader.readLengthDelimited()), 4, parseVehiclePositionMessage)
    if (
      !entity?.vehicleId ||
      !entity.tripId ||
      entity.latitude === undefined ||
      entity.longitude === undefined
    ) {
      continue
    }

    vehicles.push({
      vehicleId: entity.vehicleId,
      tripId: entity.tripId,
      latitude: entity.latitude,
      longitude: entity.longitude,
      bearing: entity.bearing,
      timestamp: new Date((entity.timestamp ?? Math.trunc(Date.now() / 1000)) * 1000),
    })
  }

  return vehicles
}

function resolveTripDelay(entity: ParsedTripUpdate) {
  if (entity.delaySeconds !== undefined) {
    return entity.delaySeconds
  }

  for (const stopTimeDelay of entity.stopTimeDelays) {
    if (stopTimeDelay.departureDelaySeconds !== undefined) {
      return stopTimeDelay.departureDelaySeconds
    }

    if (stopTimeDelay.arrivalDelaySeconds !== undefined) {
      return stopTimeDelay.arrivalDelaySeconds
    }
  }

  return undefined
}

function decodeTripUpdates(buffer: ArrayBuffer): RawTripUpdate[] {
  const reader = new ProtoReader(new Uint8Array(buffer))
  const tripUpdates: RawTripUpdate[] = []

  while (!reader.eof) {
    const { fieldNumber, wireType } = reader.readTag()
    if (fieldNumber !== 2 || wireType !== 2) {
      reader.skip(wireType)
      continue
    }

    const entity = parseFeedEntity(new ProtoReader(reader.readLengthDelimited()), 3, parseTripUpdateMessage)
    if (!entity?.tripId) {
      continue
    }

    tripUpdates.push({
      tripId: entity.tripId,
      vehicleId: entity.vehicleId,
      delaySeconds: resolveTripDelay(entity),
      stopTimeDelays: entity.stopTimeDelays,
      timestamp: new Date((entity.timestamp ?? Math.trunc(Date.now() / 1000)) * 1000),
    })
  }

  return tripUpdates
}

function buildHeaders(config: GtfsRtConfig) {
  const headers = new Headers({
    Accept: 'application/x-protobuf',
  })

  if (config.apiKey) {
    headers.set(config.apiKeyHeader, config.apiKey)
  }

  if (config.authToken) {
    headers.set('Authorization', `Bearer ${config.authToken}`)
  }

  return headers
}

function getProxyEndpoints(
  path: 'vehicle-positions' | 'trip-updates',
  datasetId: TransitDatasetId,
  operatorId: TransitOperatorId,
) {
  const proxyUrl = import.meta.env.VITE_GTFS_RT_PROXY_URL?.replace(/\/$/, '')

  if (!proxyUrl) return []

  const operatorSpecificUrl = `${proxyUrl}/${path}/${operatorId}`
  if (datasetId === 'all' || operatorId !== 'toshibus') {
    return [operatorSpecificUrl]
  }

  const legacyUrl = proxyUrl.endsWith(`/${path}`) ? proxyUrl : `${proxyUrl}/${path}`
  return [...new Set([legacyUrl, operatorSpecificUrl])]
}

function getGtfsRtConfig(): GtfsRtConfig {
  const datasetId = normalizeTransitDatasetId(import.meta.env.VITE_TRANSIT_DATASET)

  return {
    datasetId,
    apiKey: import.meta.env.VITE_GTFS_RT_API_KEY,
    apiKeyHeader: import.meta.env.VITE_GTFS_RT_API_KEY_HEADER ?? 'x-api-key',
    authToken: import.meta.env.VITE_GTFS_RT_AUTH_TOKEN,
    useMock: import.meta.env.VITE_GTFS_RT_USE_MOCK !== 'false',
  }
}

function normalizeEntityId(datasetId: TransitDatasetId, operatorId: TransitOperatorId, value: string) {
  return datasetId === 'all' ? `${operatorId}:${value}` : value
}

function getGtfsRtUrls(
  operator: TransitOperator,
  config: GtfsRtConfig,
  path: 'vehicle-positions' | 'trip-updates',
) {
  const isDefined = (value: string | undefined): value is string => Boolean(value)
  const proxyUrls = getProxyEndpoints(path, config.datasetId, operator.id)

  if (config.datasetId !== 'all' && operator.id === 'toshibus') {
    const directUrl =
      path === 'trip-updates'
        ? import.meta.env.VITE_GTFS_RT_TRIP_UPDATES_URL || operator.tripUpdatesUrl
        : import.meta.env.VITE_GTFS_RT_VEHICLE_POSITIONS_URL || operator.vehiclePositionsUrl

    return [...new Set([...proxyUrls, directUrl].filter(isDefined))]
  }

  const directUrl = path === 'trip-updates' ? operator.tripUpdatesUrl : operator.vehiclePositionsUrl
  return [...new Set([...proxyUrls, directUrl].filter(isDefined))]
}

async function fetchGtfsRtBinary(url: string, config: GtfsRtConfig, label: string) {
  const response = await fetch(url, { headers: buildHeaders(config) })
  if (!response.ok) {
    throw new Error(`GTFS-RT ${label} request failed with ${response.status}`)
  }

  return response.arrayBuffer()
}

async function fetchFirstSuccessfulGtfsRtBinary(urls: string[], config: GtfsRtConfig, label: string) {
  let lastError: unknown

  for (const url of urls) {
    try {
      return await fetchGtfsRtBinary(url, config, label)
    } catch (error) {
      lastError = error
      console.warn(`Failed to fetch ${label} from ${url}`, error)
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch GTFS-RT ${label}`)
}

function normalizeVehiclePositions(
  vehicles: RawVehiclePosition[],
  operator: TransitOperator,
  datasetId: TransitDatasetId,
): VehiclePosition[] {
  return vehicles.map((vehicle) => ({
    ...vehicle,
    agencyId: operator.id,
    agencyName: operator.agencyName,
    vehicleId: normalizeEntityId(datasetId, operator.id, vehicle.vehicleId),
    tripId: normalizeEntityId(datasetId, operator.id, vehicle.tripId),
  }))
}

function normalizeTripUpdates(
  tripUpdates: RawTripUpdate[],
  operator: TransitOperator,
  datasetId: TransitDatasetId,
): TripUpdate[] {
  return tripUpdates.map((tripUpdate) => ({
    ...tripUpdate,
    agencyId: operator.id,
    agencyName: operator.agencyName,
    tripId: normalizeEntityId(datasetId, operator.id, tripUpdate.tripId),
    vehicleId: tripUpdate.vehicleId
      ? normalizeEntityId(datasetId, operator.id, tripUpdate.vehicleId)
      : undefined,
    stopTimeDelays: tripUpdate.stopTimeDelays.map((stopTimeDelay) => ({
      ...stopTimeDelay,
      stopId: stopTimeDelay.stopId
        ? normalizeEntityId(datasetId, operator.id, stopTimeDelay.stopId)
        : undefined,
    })),
  }))
}

export async function fetchVehiclePositions(datasetIdOverride?: TransitDatasetId): Promise<VehiclePosition[]> {
  const config = getGtfsRtConfig()
  if (datasetIdOverride) {
    config.datasetId = datasetIdOverride
  }
  if (config.useMock) {
    return mockVehicles
  }

  const operators = getTransitDatasetOperators(config.datasetId)
  const collections = await Promise.all(
    operators.map(async (operator) => {
      try {
        const buffer = await fetchFirstSuccessfulGtfsRtBinary(
          getGtfsRtUrls(operator, config, 'vehicle-positions'),
          config,
          `VehiclePositions (${operator.id})`,
        )
        return normalizeVehiclePositions(decodeVehiclePositions(buffer), operator, config.datasetId)
      } catch (error) {
        console.error(`Failed to fetch GTFS-RT VehiclePositions for ${operator.id}`, error)
        return []
      }
    }),
  )

  return collections.flat()
}

export async function fetchTripUpdates(datasetIdOverride?: TransitDatasetId): Promise<TripUpdate[]> {
  const result = await fetchTripUpdatesWithStatus(datasetIdOverride)
  return result.tripUpdates
}

export async function fetchTripUpdatesWithStatus(
  datasetIdOverride?: TransitDatasetId,
): Promise<TripUpdatesFetchResult> {
  const config = getGtfsRtConfig()
  if (datasetIdOverride) {
    config.datasetId = datasetIdOverride
  }
  if (config.useMock) {
    return {
      status: 'mock',
      tripUpdates: mockTripUpdates,
    }
  }

  const operators = getTransitDatasetOperators(config.datasetId)
  const results = await Promise.all(
    operators.map(async (operator) => {
      try {
        const buffer = await fetchFirstSuccessfulGtfsRtBinary(
          getGtfsRtUrls(operator, config, 'trip-updates'),
          config,
          `TripUpdates (${operator.id})`,
        )
        return {
          ok: true,
          tripUpdates: normalizeTripUpdates(decodeTripUpdates(buffer), operator, config.datasetId),
        }
      } catch (error) {
        console.error(`Failed to fetch GTFS-RT TripUpdates for ${operator.id}`, error)
        return {
          ok: false,
          tripUpdates: [] as TripUpdate[],
        }
      }
    }),
  )

  const tripUpdates = results.flatMap((result) => result.tripUpdates)
  const hasSuccess = results.some((result) => result.ok)

  return {
    status: hasSuccess ? 'ok' : 'failed',
    tripUpdates,
  }
}
