const CACHE_SECONDS = 10
const DEFAULT_ALLOWED_ORIGIN = '*'

const DEFAULT_FEED_PATHS = {
  '/trip-updates': 'GTFS_RT_TRIP_UPDATES_URL',
  '/vehicle-positions': 'GTFS_RT_VEHICLE_POSITIONS_URL',
}

const OPERATOR_ENV_KEYS = {
  dentetsu: {
    '/trip-updates': 'GTFS_RT_TRIP_UPDATES_URL_DENTETSU',
    '/vehicle-positions': 'GTFS_RT_VEHICLE_POSITIONS_URL_DENTETSU',
  },
  kumabus: {
    '/trip-updates': 'GTFS_RT_TRIP_UPDATES_URL_KUMABUS',
    '/vehicle-positions': 'GTFS_RT_VEHICLE_POSITIONS_URL_KUMABUS',
  },
  sankobus: {
    '/trip-updates': 'GTFS_RT_TRIP_UPDATES_URL_SANKOBUS',
    '/vehicle-positions': 'GTFS_RT_VEHICLE_POSITIONS_URL_SANKOBUS',
  },
  toshibus: {
    '/trip-updates': 'GTFS_RT_TRIP_UPDATES_URL_TOSHIBUS',
    '/vehicle-positions': 'GTFS_RT_VEHICLE_POSITIONS_URL_TOSHIBUS',
  },
}

function parseAllowedOrigins(value) {
  return (value || DEFAULT_ALLOWED_ORIGIN)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

function resolveAllowedCorsOrigin(requestOrigin, configuredAllowedOrigin) {
  const allowedOrigins = parseAllowedOrigins(configuredAllowedOrigin)

  if (allowedOrigins.includes(DEFAULT_ALLOWED_ORIGIN)) {
    return requestOrigin || DEFAULT_ALLOWED_ORIGIN
  }

  if (!requestOrigin) {
    return allowedOrigins[0]
  }

  return allowedOrigins.includes(requestOrigin) ? requestOrigin : undefined
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function resolveUpstreamEnvKey(pathname) {
  if (DEFAULT_FEED_PATHS[pathname]) {
    return DEFAULT_FEED_PATHS[pathname]
  }

  const match = pathname.match(/^\/(trip-updates|vehicle-positions)\/([a-z0-9-]+)$/)
  if (!match) {
    return undefined
  }

  const basePath = `/${match[1]}`
  const operatorId = match[2]
  return OPERATOR_ENV_KEYS[operatorId]?.[basePath]
}

export default {
  async fetch(request, env) {
    const requestUrl = new URL(request.url)
    const origin = request.headers.get('Origin')
    const allowedCorsOrigin = resolveAllowedCorsOrigin(origin, env.ALLOWED_ORIGIN)
    const upstreamEnvKey = resolveUpstreamEnvKey(requestUrl.pathname)

    if (!upstreamEnvKey) {
      return new Response('Not found', { status: 404 })
    }

    if (origin && !allowedCorsOrigin) {
      return new Response('Origin not allowed', { status: 403 })
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(allowedCorsOrigin || DEFAULT_ALLOWED_ORIGIN) })
    }

    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 })
    }

    const upstream = await fetch(env[upstreamEnvKey], {
      headers: { Accept: 'application/x-protobuf' },
      cf: { cacheEverything: true, cacheTtl: CACHE_SECONDS },
    })

    if (!upstream.ok) {
      return new Response('Upstream GTFS-RT request failed', {
        status: 502,
        headers: corsHeaders(allowedCorsOrigin || DEFAULT_ALLOWED_ORIGIN),
      })
    }

    const headers = new Headers(corsHeaders(allowedCorsOrigin || DEFAULT_ALLOWED_ORIGIN))
    headers.set('Cache-Control', `public, max-age=${CACHE_SECONDS}`)
    headers.set('Content-Type', 'application/x-protobuf')

    return new Response(upstream.body, { headers })
  },
}
