const CACHE_SECONDS = 10
const DEFAULT_ALLOWED_ORIGIN = '*'

const FEED_PATHS = {
  '/trip-updates': 'GTFS_RT_TRIP_UPDATES_URL',
  '/vehicle-positions': 'GTFS_RT_VEHICLE_POSITIONS_URL',
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

export default {
  async fetch(request, env) {
    const requestUrl = new URL(request.url)
    const origin = request.headers.get('Origin')
    const allowedCorsOrigin = resolveAllowedCorsOrigin(origin, env.ALLOWED_ORIGIN)
    const upstreamEnvKey = FEED_PATHS[requestUrl.pathname]

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
