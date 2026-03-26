function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...init.headers,
    },
  })
}

function normalizeRepo(value) {
  const normalized = String(value ?? '').trim()
  const match = normalized.match(/^([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)$/)
  if (!match) return null
  return `${match[1]}/${match[2]}`
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url)
  const repo = normalizeRepo(url.searchParams.get('repo'))

  if (!repo) {
    return json({ error: 'Expected repo=<owner>/<model>.' }, { status: 400 })
  }

  const [owner, model] = repo.split('/')
  const upstreamUrl = `https://huggingface.co/api/models/${encodeURIComponent(owner)}/${encodeURIComponent(model)}`

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        accept: 'application/json',
        'user-agent': 'LapTime HF Import Proxy',
      },
    })

    const payload = await upstream.json()

    if (!upstream.ok) {
      return json(
        {
          error: payload.error ?? `Hugging Face returned ${upstream.status}.`,
        },
        { status: upstream.status },
      )
    }

    return json({
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
    return json(
      {
        error: 'Unable to reach Hugging Face right now.',
      },
      { status: 502 },
    )
  }
}
