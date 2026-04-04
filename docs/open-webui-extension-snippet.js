async function fetchLapTimeTelemetry({
  apiBase,
  hardwareName,
  modelName,
  runtime,
  observedDecodeTps,
  observedTtftMs,
}) {
  const url = new URL('/api/runtime-telemetry', apiBase)
  url.searchParams.set('hardwareName', hardwareName)
  url.searchParams.set('modelName', modelName)

  if (runtime) url.searchParams.set('runtime', runtime)
  if (Number.isFinite(observedDecodeTps)) {
    url.searchParams.set('observedDecodeTps', String(observedDecodeTps))
  }
  if (Number.isFinite(observedTtftMs)) {
    url.searchParams.set('observedTtftMs', String(observedTtftMs))
  }

  const response = await fetch(url.toString())
  return response.json()
}

function toneClass(tone) {
  if (tone === 'better') return 'lt-pill-better'
  if (tone === 'worse') return 'lt-pill-worse'
  if (tone === 'notable') return 'lt-pill-notable'
  return 'lt-pill-close'
}

function formatDelta(metricLabel, delta, unitSuffix = '') {
  if (!delta) return ''
  const sign = delta.percent > 0 ? '+' : ''
  return `${metricLabel} ${sign}${delta.percent.toFixed(0)}%${unitSuffix}`
}

export async function renderLapTimeBadge({
  target,
  apiBase,
  hardwareName,
  modelName,
  runtime,
  observedDecodeTps,
  observedTtftMs,
}) {
  const payload = await fetchLapTimeTelemetry({
    apiBase,
    hardwareName,
    modelName,
    runtime,
    observedDecodeTps,
    observedTtftMs,
  })

  if (!payload.ok) {
    const suggestions = payload.suggestions?.models ?? []
    target.innerHTML = `
      <div class="lt-card">
        <div class="lt-title">LapTime</div>
        <div class="lt-copy">${payload.error}</div>
        ${
          suggestions.length
            ? `<div class="lt-copy">Closest catalog matches: ${suggestions.map((item) => item.name).join(', ')}</div>`
            : ''
        }
      </div>
    `
    return
  }

  const decodeDelta = payload.comparison?.decode
  const ttftDelta = payload.comparison?.ttft

  target.innerHTML = `
    <div class="lt-card">
      <div class="lt-row">
        <strong class="lt-title">LapTime</strong>
        <span class="lt-fit lt-fit-${payload.laptime.fit.status}">${payload.laptime.fit.status}</span>
      </div>
      <div class="lt-copy">${payload.resolution.hardware.name} · ${payload.resolution.model.name}</div>
      <div class="lt-row">
        <span>Est. ${payload.laptime.estimated.decodeTps.toFixed(1)} tok/s</span>
        <span>TTFT ${Math.round(payload.laptime.estimated.ttftMs)} ms</span>
      </div>
      ${
        Number.isFinite(payload.observed.decodeTps)
          ? `<div class="lt-row">
              <span>Live ${payload.observed.decodeTps.toFixed(1)} tok/s</span>
              <span class="lt-pill ${toneClass(decodeDelta?.tone)}">${formatDelta('Decode', decodeDelta)}</span>
            </div>`
          : ''
      }
      ${
        Number.isFinite(payload.observed.ttftMs)
          ? `<div class="lt-row">
              <span>Live ${Math.round(payload.observed.ttftMs)} ms</span>
              <span class="lt-pill ${toneClass(ttftDelta?.tone)}">${formatDelta('TTFT', ttftDelta)}</span>
            </div>`
          : ''
      }
    </div>
  `
}

export const lapTimeBadgeStyles = `
  .lt-card {
    display: grid;
    gap: 0.4rem;
    padding: 0.75rem 0.9rem;
    border-radius: 0.9rem;
    background: rgba(7, 17, 28, 0.78);
    border: 1px solid rgba(104, 214, 255, 0.16);
    color: #eaf6ff;
    font: 500 12px/1.4 "IBM Plex Mono", monospace;
  }

  .lt-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .lt-title {
    font-size: 0.82rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .lt-copy {
    color: rgba(223, 240, 255, 0.78);
  }

  .lt-fit {
    padding: 0.12rem 0.45rem;
    border-radius: 999px;
    text-transform: uppercase;
    font-size: 0.7rem;
  }

  .lt-fit-fit { background: rgba(62, 180, 137, 0.18); color: #8ff0c5; }
  .lt-fit-tight { background: rgba(255, 194, 77, 0.18); color: #ffd98f; }
  .lt-fit-unfit { background: rgba(255, 97, 97, 0.18); color: #ffadad; }
  .lt-fit-unknown { background: rgba(145, 178, 214, 0.18); color: #cfe4ff; }

  .lt-pill {
    padding: 0.12rem 0.45rem;
    border-radius: 999px;
  }

  .lt-pill-better { background: rgba(62, 180, 137, 0.18); color: #8ff0c5; }
  .lt-pill-worse { background: rgba(255, 97, 97, 0.18); color: #ffadad; }
  .lt-pill-notable { background: rgba(255, 194, 77, 0.18); color: #ffd98f; }
  .lt-pill-close { background: rgba(145, 178, 214, 0.18); color: #cfe4ff; }
`
