import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { buildTelemetrySnapshot } from './src/lib/runtimeTelemetry.js'

function json(res, statusCode, body) {
  res.statusCode = statusCode
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function normalizeRepo(repo) {
  if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(repo)) {
    return null
  }
  return repo
}

function parseOptionalNumber(value) {
  if (value == null || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function compactSearchResult(payload) {
  return {
    id: payload.id ?? payload.modelId,
    pipelineTag: payload.pipeline_tag ?? null,
    familyLabel: payload.config?.model_type ?? payload.library_name ?? 'Model',
    likes: typeof payload.likes === 'number' ? payload.likes : null,
    downloads: typeof payload.downloads === 'number' ? payload.downloads : null,
  }
}

function getSearchRank(payload, query) {
  const normalizedQuery = query.toLowerCase()
  const id = String(payload.id ?? payload.modelId ?? '').toLowerCase()
  let score = 0

  if (id.startsWith(`${normalizedQuery}/`)) score += 80
  if (id.includes(`/${normalizedQuery}`)) score += 25
  if (id.includes(normalizedQuery)) score += 10
  if (/\bgguf\b/i.test(id)) score -= 20
  if (typeof payload.downloads === 'number') score += Math.min(payload.downloads / 50000, 20)
  if (typeof payload.likes === 'number') score += Math.min(payload.likes / 200, 10)

  return score
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'laptime-huggingface-dev-proxy',
      configureServer(server) {
        server.middlewares.use('/api/huggingface-model', async (req, res) => {
          const requestUrl = new URL(req.url ?? '/', 'http://localhost')
          const repo = normalizeRepo(requestUrl.searchParams.get('repo')?.trim() ?? '')

          if (!repo) {
            json(res, 400, { error: 'Expected repo=<owner>/<model>.' })
            return
          }

          const [owner, model] = repo.split('/')
          const upstreamUrl = `https://huggingface.co/api/models/${encodeURIComponent(owner)}/${encodeURIComponent(model)}`

          try {
            const upstream = await fetch(upstreamUrl, {
              headers: {
                accept: 'application/json',
                'user-agent': 'LapTime Vite HF Proxy',
              },
            })
            const payload = await upstream.json()

            if (!upstream.ok) {
              json(res, upstream.status, { error: payload.error ?? `Hugging Face returned ${upstream.status}.` })
              return
            }

            json(res, upstream.status, {
              id: payload.id ?? payload.modelId,
              modelId: payload.modelId ?? payload.id,
              pipeline_tag: payload.pipeline_tag ?? null,
              private: Boolean(payload.private),
              gated: Boolean(payload.gated),
              disabled: Boolean(payload.disabled),
              tags: Array.isArray(payload.tags) ? payload.tags : [],
              config: payload.config ?? {},
              cardData: payload.cardData ?? {},
              safetensors: payload.safetensors ?? null,
            })
          } catch {
            json(res, 502, { error: 'Unable to reach Hugging Face right now.' })
          }
        })

        server.middlewares.use('/api/huggingface-search', async (req, res) => {
          const requestUrl = new URL(req.url ?? '/', 'http://localhost')
          const query = requestUrl.searchParams.get('q')?.trim() ?? ''

          if (!query) {
            json(res, 400, { error: 'Expected q=<search terms>.' })
            return
          }

          const upstreamUrl = new URL('https://huggingface.co/api/models')
          upstreamUrl.searchParams.set('search', query)
          upstreamUrl.searchParams.set('pipeline_tag', 'text-generation')
          upstreamUrl.searchParams.set('limit', '6')
          upstreamUrl.searchParams.set('full', 'true')
          upstreamUrl.searchParams.set('config', 'true')

          try {
            const upstream = await fetch(upstreamUrl, {
              headers: {
                accept: 'application/json',
                'user-agent': 'LapTime Vite HF Search Proxy',
              },
            })
            const payload = await upstream.json()

            if (!upstream.ok) {
              json(res, upstream.status, { error: payload.error ?? `Hugging Face returned ${upstream.status}.` })
              return
            }

            const results = Array.isArray(payload)
              ? payload
                  .filter((entry) => entry?.id && !entry.private && !entry.gated && !entry.disabled)
                  .sort((left, right) => getSearchRank(right, query) - getSearchRank(left, query))
                  .map(compactSearchResult)
              : []

            json(res, upstream.status, { query, results })
          } catch {
            json(res, 502, { error: 'Unable to search Hugging Face right now.' })
          }
        })

        server.middlewares.use('/api/runtime-telemetry', async (req, res) => {
          const requestUrl = new URL(req.url ?? '/', 'http://localhost')
          const payload = buildTelemetrySnapshot({
            hardwareId: requestUrl.searchParams.get('hardwareId') ?? undefined,
            hardwareName: requestUrl.searchParams.get('hardwareName') ?? undefined,
            modelId: requestUrl.searchParams.get('modelId') ?? undefined,
            modelName: requestUrl.searchParams.get('modelName') ?? undefined,
            runtime: requestUrl.searchParams.get('runtime') ?? undefined,
            promptTokens: parseOptionalNumber(requestUrl.searchParams.get('promptTokens')) ?? 1200,
            responseTokens: parseOptionalNumber(requestUrl.searchParams.get('responseTokens')) ?? 220,
            observedPrefillTps: parseOptionalNumber(requestUrl.searchParams.get('observedPrefillTps')),
            observedDecodeTps: parseOptionalNumber(requestUrl.searchParams.get('observedDecodeTps')),
            observedTtftMs: parseOptionalNumber(requestUrl.searchParams.get('observedTtftMs')),
          })

          json(res, payload.ok ? 200 : 404, payload)
        })
      },
    },
  ],
})
