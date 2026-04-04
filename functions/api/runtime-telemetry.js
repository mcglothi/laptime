import { buildTelemetrySnapshot } from '../../src/lib/runtimeTelemetry.js'

function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'content-type': 'application/json; charset=utf-8',
      ...init.headers,
    },
  })
}

function parseOptionalNumber(value) {
  if (value == null || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export async function onRequestOptions() {
  return json({}, { status: 204 })
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url)

  const payload = buildTelemetrySnapshot({
    hardwareId: url.searchParams.get('hardwareId') ?? undefined,
    hardwareName: url.searchParams.get('hardwareName') ?? undefined,
    modelId: url.searchParams.get('modelId') ?? undefined,
    modelName: url.searchParams.get('modelName') ?? undefined,
    runtime: url.searchParams.get('runtime') ?? undefined,
    promptTokens: parseOptionalNumber(url.searchParams.get('promptTokens')) ?? 1200,
    responseTokens: parseOptionalNumber(url.searchParams.get('responseTokens')) ?? 220,
    observedPrefillTps: parseOptionalNumber(url.searchParams.get('observedPrefillTps')),
    observedDecodeTps: parseOptionalNumber(url.searchParams.get('observedDecodeTps')),
    observedTtftMs: parseOptionalNumber(url.searchParams.get('observedTtftMs')),
  })

  if (!payload.ok) {
    return json(payload, { status: 404 })
  }

  return json(payload)
}
