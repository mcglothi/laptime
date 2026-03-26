function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...init.headers,
    },
  })
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

export async function onRequestGet(context) {
  const url = new URL(context.request.url)
  const query = url.searchParams.get('q')?.trim() ?? ''

  if (!query) {
    return json({ error: 'Expected q=<search terms>.' }, { status: 400 })
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
        'user-agent': 'LapTime HF Search Proxy',
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

    const results = Array.isArray(payload)
      ? payload
          .filter((entry) => entry?.id && !entry.private && !entry.gated && !entry.disabled)
          .sort((left, right) => getSearchRank(right, query) - getSearchRank(left, query))
          .map(compactSearchResult)
      : []

    return json({
      query,
      results,
    })
  } catch {
    return json(
      {
        error: 'Unable to search Hugging Face right now.',
      },
      { status: 502 },
    )
  }
}
