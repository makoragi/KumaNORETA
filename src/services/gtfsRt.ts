import { mockVehicles } from '../mocks/mockData'
import type { VehiclePosition } from '../types'

type GtfsRtConfig = {
  apiKey?: string
  apiKeyHeader: string
  authToken?: string
  alertsUrl: string
  tripUpdatesUrl: string
  url: string
  useMock: boolean
}

const DEFAULT_GTFS_RT_URLS = {
  alerts: 'https://km.bus-vision.jp/realtime/toshibus_alrt_update.bin',
  tripUpdates: 'https://km.bus-vision.jp/realtime/toshibus_trip_update.bin',
  vehiclePositions: 'https://km.bus-vision.jp/realtime/toshibus_vpos_update.bin',
} as const

type ParsedVehiclePosition = {
  bearing?: number
  latitude?: number
  longitude?: number
  timestamp?: number
  tripId?: string
  vehicleId?: string
}

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

  readVarint() {
    let result = 0n
    let shift = 0n

    while (true) {
      if (this.offset >= this.bytes.length) {
        throw new Error('Unexpected end of protobuf varint')
      }

      const byte = this.bytes[this.offset++]
      result |= BigInt(byte & 0x7f) << shift

      if ((byte & 0x80) === 0) {
        const numeric = Number(result)
        if (!Number.isSafeInteger(numeric)) {
          throw new Error('Protobuf varint exceeds safe integer range')
        }
        return numeric
      }

      shift += 7n
    }
  }

  skip(wireType: number) {
    switch (wireType) {
      case 0:
        this.readVarint()
        return
      case 1:
        this.offset += 8
        return
      case 2:
        this.offset += this.readVarint()
        return
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

function parseFeedEntity(reader: ProtoReader) {
  let vehiclePosition: ParsedVehiclePosition | undefined

  while (!reader.eof) {
    const { fieldNumber, wireType } = reader.readTag()
    if (fieldNumber === 4 && wireType === 2) {
      vehiclePosition = parseVehiclePositionMessage(new ProtoReader(reader.readLengthDelimited()))
      continue
    }

    reader.skip(wireType)
  }

  return vehiclePosition
}

function decodeVehiclePositions(buffer: ArrayBuffer): VehiclePosition[] {
  const reader = new ProtoReader(new Uint8Array(buffer))
  const vehicles: VehiclePosition[] = []

  while (!reader.eof) {
    const { fieldNumber, wireType } = reader.readTag()
    if (fieldNumber !== 2 || wireType !== 2) {
      reader.skip(wireType)
      continue
    }

    const entity = parseFeedEntity(new ProtoReader(reader.readLengthDelimited()))
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

function getGtfsRtConfig(): GtfsRtConfig {
  return {
    apiKey: import.meta.env.VITE_GTFS_RT_API_KEY,
    apiKeyHeader: import.meta.env.VITE_GTFS_RT_API_KEY_HEADER ?? 'x-api-key',
    authToken: import.meta.env.VITE_GTFS_RT_AUTH_TOKEN,
    alertsUrl: import.meta.env.VITE_GTFS_RT_ALERTS_URL ?? DEFAULT_GTFS_RT_URLS.alerts,
    tripUpdatesUrl: import.meta.env.VITE_GTFS_RT_TRIP_UPDATES_URL ?? DEFAULT_GTFS_RT_URLS.tripUpdates,
    url: import.meta.env.VITE_GTFS_RT_VEHICLE_POSITIONS_URL ?? DEFAULT_GTFS_RT_URLS.vehiclePositions,
    useMock: import.meta.env.VITE_GTFS_RT_USE_MOCK !== 'false',
  }
}

export async function fetchVehiclePositions(): Promise<VehiclePosition[]> {
  const config = getGtfsRtConfig()
  if (config.useMock) {
    return mockVehicles
  }

  const headers = new Headers({
    Accept: 'application/x-protobuf',
  })

  if (config.apiKey) {
    headers.set(config.apiKeyHeader, config.apiKey)
  }

  if (config.authToken) {
    headers.set('Authorization', `Bearer ${config.authToken}`)
  }

  try {
    const response = await fetch(config.url, { headers })
    if (!response.ok) {
      throw new Error(`GTFS-RT VehiclePositions request failed with ${response.status}`)
    }

    return decodeVehiclePositions(await response.arrayBuffer())
  } catch (error) {
    console.error('Failed to fetch GTFS-RT VehiclePositions', error)
    return []
  }
}
