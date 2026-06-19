const CACHE_SECONDS = 10

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
    const allowedOrigin = env.ALLOWED_ORIGIN

    if (requestUrl.pathname !== '/vehicle-positions') {
      return new Response('Not found', { status: 404 })
    }

    if (origin && origin !== allowedOrigin) {
      return new Response('Origin not allowed', { status: 403 })
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(allowedOrigin) })
    }

    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 })
    }

    const upstream = await fetch(env.GTFS_RT_VEHICLE_POSITIONS_URL, {
      headers: { Accept: 'application/x-protobuf' },
      cf: { cacheEverything: true, cacheTtl: CACHE_SECONDS },
    })

    if (!upstream.ok) {
      return new Response('Upstream GTFS-RT request failed', {
        status: 502,
        headers: corsHeaders(allowedOrigin),
      })
    }

    const headers = new Headers(corsHeaders(allowedOrigin))
    headers.set('Cache-Control', `public, max-age=${CACHE_SECONDS}`)
    headers.set('Content-Type', 'application/x-protobuf')

    return new Response(upstream.body, { headers })
  },
}
