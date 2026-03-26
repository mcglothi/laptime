import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'laptime-huggingface-dev-proxy',
      configureServer(server) {
        server.middlewares.use('/api/huggingface-model', async (req, res) => {
          const requestUrl = new URL(req.url ?? '/', 'http://localhost')
          const repo = requestUrl.searchParams.get('repo')?.trim() ?? ''

          if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(repo)) {
            res.statusCode = 400
            res.setHeader('content-type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: 'Expected repo=<owner>/<model>.' }))
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

            res.statusCode = upstream.status
            res.setHeader('content-type', 'application/json; charset=utf-8')

            if (!upstream.ok) {
              res.end(JSON.stringify({ error: payload.error ?? `Hugging Face returned ${upstream.status}.` }))
              return
            }

            res.end(
              JSON.stringify({
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
              }),
            )
          } catch {
            res.statusCode = 502
            res.setHeader('content-type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: 'Unable to reach Hugging Face right now.' }))
          }
        })
      },
    },
  ],
})
