import { useEffect, useState } from 'react'
import {
  benchmarkMatrix,
  communityBenchmarks,
  dataSources,
  hardwareOptions,
  modelOptions,
  workloadOptions,
} from './data/benchmarkData'
import './App.css'

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function formatSeconds(value) {
  return `${value.toFixed(value >= 10 ? 1 : 2)}s`
}

function getExperience(totalSeconds) {
  if (totalSeconds < 4.5) return 'Feels instant'
  if (totalSeconds < 9) return 'Feels smooth'
  if (totalSeconds < 18) return 'Feels like waiting'
  return 'Feels batch-first'
}

function calculateMetrics(hardware, model, workload, customMetrics) {
  let prefillTps
  let decodeTps
  let ttftMs
  let source

  if (hardware.id === 'custom') {
    prefillTps = customMetrics.prefillTps
    decodeTps = customMetrics.decodeTps
    ttftMs = customMetrics.ttftMs
    source = 'Manual'
  } else if (benchmarkMatrix[hardware.id]?.[model.id]) {
    const benchmark = benchmarkMatrix[hardware.id][model.id]
    prefillTps = benchmark.prefillTps
    decodeTps = benchmark.decodeTps
    ttftMs = benchmark.ttftMs
    source = benchmark.source
  } else {
    prefillTps = hardware.prefillBase / model.prefillFactor
    decodeTps = hardware.decodeBase / model.decodeFactor
    ttftMs = hardware.ttftBase * model.ttftFactor
    source = 'Estimated from LocalScore baseline'
  }

  ttftMs += workload.promptTokens * 0.16
  const prefillSeconds = workload.promptTokens / prefillTps
  const streamingSeconds = workload.responseTokens / decodeTps
  const totalSeconds = prefillSeconds + ttftMs / 1000 + streamingSeconds

  return {
    prefillTps,
    decodeTps,
    ttftMs,
    prefillSeconds,
    streamingSeconds,
    totalSeconds,
    experience: getExperience(totalSeconds),
    source,
  }
}

function resolveWorkload(selectedWorkload, customPreset) {
  return selectedWorkload.id === 'custom'
    ? {
        ...selectedWorkload,
        promptTokens: customPreset.promptTokens,
        responseTokens: customPreset.responseTokens,
      }
    : selectedWorkload
}

function App() {
  const [hardwareId, setHardwareId] = useState(hardwareOptions[1].id)
  const [modelId, setModelId] = useState(modelOptions[1].id)
  const [workloadId, setWorkloadId] = useState(workloadOptions[2].id)
  const [compareHardwareId, setCompareHardwareId] = useState(hardwareOptions[3].id)
  const [compareModelId, setCompareModelId] = useState(modelOptions[2].id)
  const [sourceQuery, setSourceQuery] = useState('')
  const [communityFilter, setCommunityFilter] = useState('all')
  const [theme, setTheme] = useState('dark')
  const [isPlaying, setIsPlaying] = useState(true)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [customMetrics, setCustomMetrics] = useState({
    prefillTps: 3000,
    decodeTps: 60,
    ttftMs: 350,
  })
  const [customPreset, setCustomPreset] = useState({
    promptTokens: 1200,
    responseTokens: 220,
  })

  const hardware = hardwareOptions.find((item) => item.id === hardwareId) ?? hardwareOptions[1]
  const model = modelOptions.find((item) => item.id === modelId) ?? modelOptions[0]
  const selectedWorkload = workloadOptions.find((item) => item.id === workloadId) ?? workloadOptions[0]
  const workload = resolveWorkload(selectedWorkload, customPreset)
  const metrics = calculateMetrics(hardware, model, workload, customMetrics)
  const compareHardware =
    hardwareOptions.find((item) => item.id === compareHardwareId) ?? hardwareOptions[2]
  const compareModel = modelOptions.find((item) => item.id === compareModelId) ?? modelOptions[1]
  const compareMetrics = calculateMetrics(compareHardware, compareModel, workload, customMetrics)

  function restartSimulation() {
    setElapsedMs(0)
    setIsPlaying(true)
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!isPlaying) {
      return undefined
    }

    const startedAt = performance.now()
    const durationMs = metrics.totalSeconds * 1000

    const intervalId = window.setInterval(() => {
      const nextElapsed = performance.now() - startedAt

      if (nextElapsed >= durationMs) {
        setElapsedMs(durationMs)
        setIsPlaying(false)
        window.clearInterval(intervalId)
        return
      }

      setElapsedMs(nextElapsed)
    }, 48)

    return () => window.clearInterval(intervalId)
  }, [isPlaying, metrics.totalSeconds])

  const prefillMs = metrics.prefillSeconds * 1000
  const streamStartMs = prefillMs + metrics.ttftMs
  const streamDurationMs = metrics.streamingSeconds * 1000
  const progress = clamp(elapsedMs / (metrics.totalSeconds * 1000), 0, 1)
  const streamProgress = clamp((elapsedMs - streamStartMs) / streamDurationMs, 0, 1)
  const visibleChars = Math.floor(workload.response.length * streamProgress)
  const streamedText = workload.response.slice(0, visibleChars)
  const currentPhase =
    elapsedMs < prefillMs
      ? 'Ingesting prompt'
      : elapsedMs < streamStartMs
        ? 'Preparing first token'
        : isPlaying
        ? 'Streaming response'
          : 'Playback complete'
  const normalizedQuery = sourceQuery.trim().toLowerCase()
  const filteredStructuredSources = dataSources.filter((source) => {
    if (!normalizedQuery) return true
    return [source.name, source.type, source.notes]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery)
  })
  const filteredCommunityBenchmarks = communityBenchmarks.filter((entry) => {
    const matchesFilter = communityFilter === 'all' || entry.quality === communityFilter
    const matchesQuery =
      !normalizedQuery ||
      [entry.hardware, entry.model, entry.source]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    return matchesFilter && matchesQuery
  })

  return (
    <div className="app-shell">
      <section className="masthead">
        <div className="brand-lockup">
          <div className="eyebrow">LapTime</div>
          <h1>Local LLM lap simulator</h1>
        </div>
        <button
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="theme-toggle icon-toggle"
          type="button"
          onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
        >
          <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
        </button>
      </section>

      <section className="simulator-section">
        <div className="section-heading compact">
          <div>
            <div className="eyebrow">Simulator</div>
            <h2>Run a playback.</h2>
          </div>
          <p>Fast to try, easy to compare, and built for real buying decisions.</p>
        </div>

        <div className="simulator-layout">
          <aside className="control-panel">
            <label className="control-group">
              <span>Hardware</span>
              <select
                value={hardwareId}
                onChange={(event) => {
                  setHardwareId(event.target.value)
                  restartSimulation()
                }}
              >
                {hardwareOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
              <small>
                {hardware.spec} · {hardware.price}
              </small>
              <p>{hardware.buyer}</p>
            </label>

            {hardware.id === 'custom' ? (
              <div className="custom-grid">
                <label className="control-group">
                  <span>Prefill tok/s</span>
                  <input
                    min="1"
                    step="1"
                    type="number"
                    value={customMetrics.prefillTps}
                    onChange={(event) => {
                      setCustomMetrics((current) => ({
                        ...current,
                        prefillTps: Number(event.target.value) || 1,
                      }))
                      restartSimulation()
                    }}
                  />
                </label>
                <label className="control-group">
                  <span>Decode tok/s</span>
                  <input
                    min="0.1"
                    step="0.1"
                    type="number"
                    value={customMetrics.decodeTps}
                    onChange={(event) => {
                      setCustomMetrics((current) => ({
                        ...current,
                        decodeTps: Number(event.target.value) || 0.1,
                      }))
                      restartSimulation()
                    }}
                  />
                </label>
                <label className="control-group">
                  <span>TTFT ms</span>
                  <input
                    min="1"
                    step="1"
                    type="number"
                    value={customMetrics.ttftMs}
                    onChange={(event) => {
                      setCustomMetrics((current) => ({
                        ...current,
                        ttftMs: Number(event.target.value) || 1,
                      }))
                      restartSimulation()
                    }}
                  />
                </label>
              </div>
            ) : null}

            <label className="control-group">
              <span>Model</span>
              <select
                value={modelId}
                onChange={(event) => {
                  setModelId(event.target.value)
                  restartSimulation()
                }}
              >
                {modelOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} · {option.quant}
                  </option>
                ))}
              </select>
              <small>{model.quant}</small>
              <p>{model.fit}</p>
            </label>

            <label className="control-group">
              <span>Workload</span>
              <select
                value={workloadId}
                onChange={(event) => {
                  setWorkloadId(event.target.value)
                  restartSimulation()
                }}
              >
                {workloadOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
              <small>{workload.category}</small>
              <p>{workload.accent}</p>
            </label>

            {workload.id === 'custom' ? (
              <div className="custom-grid two-up">
                <label className="control-group">
                  <span>Prompt tokens</span>
                  <input
                    min="1"
                    step="1"
                    type="number"
                    value={customPreset.promptTokens}
                    onChange={(event) => {
                      setCustomPreset((current) => ({
                        ...current,
                        promptTokens: Number(event.target.value) || 1,
                      }))
                      restartSimulation()
                    }}
                  />
                </label>
                <label className="control-group">
                  <span>Response tokens</span>
                  <input
                    min="1"
                    step="1"
                    type="number"
                    value={customPreset.responseTokens}
                    onChange={(event) => {
                      setCustomPreset((current) => ({
                        ...current,
                        responseTokens: Number(event.target.value) || 1,
                      }))
                      restartSimulation()
                    }}
                  />
                </label>
              </div>
            ) : null}

            <div className="metrics-heading">Values used for this run</div>
            <div className="metric-grid">
              <div>
                <span>Prefill</span>
                <strong>{metrics.prefillTps.toFixed(0)} tok/s</strong>
              </div>
              <div>
                <span>Decode</span>
                <strong>{metrics.decodeTps.toFixed(1)} tok/s</strong>
              </div>
              <div>
                <span>TTFT</span>
                <strong>{Math.round(metrics.ttftMs)} ms</strong>
              </div>
              <div>
                <span>Total</span>
                <strong>{formatSeconds(metrics.totalSeconds)}</strong>
              </div>
              <div>
                <span>Prompt tokens</span>
                <strong>{workload.promptTokens.toLocaleString()}</strong>
              </div>
              <div>
                <span>Response tokens</span>
                <strong>{workload.responseTokens.toLocaleString()}</strong>
              </div>
            </div>

            <div className="source-note">
              Source: {metrics.source}
              {metrics.source === 'LocalScore' ? ` · ${model.name}` : ''}
            </div>
            <div className="source-note">
              Coverage: {Object.keys(benchmarkMatrix).length} exact hardware tiers ·{' '}
              {communityBenchmarks.length} community references · {dataSources.length} source groups
            </div>
          </aside>

          <div className="playback-panel">
            <div className="terminal-card">
              <div className="terminal-topbar">
                <div className="playback-heading">
                  <span>{workload.name} playback</span>
                  <small>{currentPhase}</small>
                </div>
                <button className="ghost-button" type="button" onClick={restartSimulation}>
                  Restart
                </button>
              </div>

              <div className="prompt-block">
                <div className="block-label">Prompt</div>
                <p>{workload.prompt}</p>
              </div>

              <div className="response-block">
                <div className="block-label">Response Stream</div>
                <p>{streamedText || ' '}</p>
                {isPlaying && elapsedMs >= streamStartMs ? (
                  <span className="cursor" aria-hidden="true" />
                ) : null}
              </div>
            </div>

            <div className="timeline-card">
              <div className="timeline-row">
                <span>Prompt ingest</span>
                <strong>{formatSeconds(metrics.prefillSeconds)}</strong>
              </div>
              <div className="timeline-row">
                <span>First token delay</span>
                <strong>{Math.round(metrics.ttftMs)} ms</strong>
              </div>
              <div className="timeline-row">
                <span>Response stream</span>
                <strong>{formatSeconds(metrics.streamingSeconds)}</strong>
              </div>
              <div className="timeline-progress">
                <div style={{ width: `${progress * 100}%` }} />
              </div>
              <div className="timeline-caption">
                <span>{currentPhase}</span>
                <span>{metrics.experience}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="compare-section">
        <div className="section-heading compact">
          <div>
            <div className="eyebrow">Comparison</div>
            <h2>Compare two setups.</h2>
          </div>
          <p>Use the same workload to see what actually changes between rigs and models.</p>
        </div>

        <div className="compare-grid">
          <article className="compare-card">
            <div className="compare-header">
              <span>Lane A</span>
              <strong>Current run</strong>
            </div>
            <div className="compare-title">{hardware.name}</div>
            <div className="compare-subtitle">{model.name}</div>
            <div className="metric-list">
              <div><span>Prefill</span><strong>{metrics.prefillTps.toFixed(0)} tok/s</strong></div>
              <div><span>Decode</span><strong>{metrics.decodeTps.toFixed(1)} tok/s</strong></div>
              <div><span>TTFT</span><strong>{Math.round(metrics.ttftMs)} ms</strong></div>
              <div><span>Total</span><strong>{formatSeconds(metrics.totalSeconds)}</strong></div>
            </div>
            <div className="compare-experience">{metrics.experience}</div>
          </article>

          <article className="compare-card">
            <div className="compare-header">
              <span>Lane B</span>
              <strong>Comparison run</strong>
            </div>
            <div className="compare-controls">
              <label className="control-group dense">
                <span>Hardware</span>
                <select
                  value={compareHardwareId}
                  onChange={(event) => setCompareHardwareId(event.target.value)}
                >
                  {hardwareOptions
                    .filter((option) => option.id !== 'custom')
                    .map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="control-group dense">
                <span>Model</span>
                <select
                  value={compareModelId}
                  onChange={(event) => setCompareModelId(event.target.value)}
                >
                  {modelOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="compare-title">{compareHardware.name}</div>
            <div className="compare-subtitle">{compareModel.name}</div>
            <div className="metric-list">
              <div><span>Prefill</span><strong>{compareMetrics.prefillTps.toFixed(0)} tok/s</strong></div>
              <div><span>Decode</span><strong>{compareMetrics.decodeTps.toFixed(1)} tok/s</strong></div>
              <div><span>TTFT</span><strong>{Math.round(compareMetrics.ttftMs)} ms</strong></div>
              <div><span>Total</span><strong>{formatSeconds(compareMetrics.totalSeconds)}</strong></div>
            </div>
            <div className="compare-experience">{compareMetrics.experience}</div>
          </article>
        </div>

        <div className="delta-grid">
          <div>
            <span>Decode delta</span>
            <strong>{(compareMetrics.decodeTps - metrics.decodeTps).toFixed(1)} tok/s</strong>
          </div>
          <div>
            <span>TTFT delta</span>
            <strong>{Math.round(compareMetrics.ttftMs - metrics.ttftMs)} ms</strong>
          </div>
          <div>
            <span>Total time delta</span>
            <strong>{formatSeconds(compareMetrics.totalSeconds - metrics.totalSeconds)}</strong>
          </div>
        </div>
      </section>

      <section className="source-section">
        <div className="section-heading compact">
          <div>
            <div className="eyebrow">Sources</div>
            <h2>Source explorer.</h2>
          </div>
          <p>Exact simulator math uses structured benchmark entries first, with community data kept separate.</p>
        </div>

        <div className="explorer-controls">
          <label className="control-group dense">
            <span>Search</span>
            <input
              type="text"
              value={sourceQuery}
              placeholder="Search hardware, model, or source"
              onChange={(event) => setSourceQuery(event.target.value)}
            />
          </label>
          <label className="control-group dense">
            <span>Community filter</span>
            <select
              value={communityFilter}
              onChange={(event) => setCommunityFilter(event.target.value)}
            >
              <option value="all">All qualities</option>
              <option value="forum">Forum</option>
              <option value="approximate">Approximate</option>
            </select>
          </label>
        </div>

        <div className="source-grid">
          <div className="source-card">
            <div className="metrics-heading">
              Structured sources · {filteredStructuredSources.length}
            </div>
            <div className="source-list">
              {filteredStructuredSources.map((source) => (
                <article key={source.name}>
                  <div className="source-name-row">
                    <strong>{source.name}</strong>
                    <span>{source.type}</span>
                  </div>
                  <p>{source.notes}</p>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.url}
                  </a>
                </article>
              ))}
              {filteredStructuredSources.length === 0 ? (
                <div className="empty-state">No structured sources match that search yet.</div>
              ) : null}
            </div>
          </div>

          <div className="source-card">
            <div className="metrics-heading">
              Community references · {filteredCommunityBenchmarks.length}
            </div>
            <div className="community-table">
              {filteredCommunityBenchmarks.map((entry) => (
                <article key={`${entry.hardware}-${entry.model}-${entry.metric}`}>
                  <div className="source-name-row">
                    <strong>{entry.hardware}</strong>
                    <span>{entry.quality}</span>
                  </div>
                  <p>{entry.model}</p>
                  <p className="community-value">
                    {entry.metric === 'decode_tps_range'
                      ? `${entry.value[0]}-${entry.value[1]} tok/s decode`
                      : `${entry.value} tok/s decode`}
                  </p>
                </article>
              ))}
              {filteredCommunityBenchmarks.length === 0 ? (
                <div className="empty-state">No community references match that filter.</div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="quick-notes">
        <article>
          <span className="proof-kicker">Why this matters</span>
          <p>Prefill, TTFT, and decode are separated so buyers can understand where the wait comes from.</p>
        </article>
        <article>
          <span className="proof-kicker">What comes next</span>
          <p>Deeper ingestion, richer comparison lanes, and buyer guides that can carry affiliate revenue.</p>
        </article>
        <article>
          <span className="proof-kicker">Product wedge</span>
          <p>Numbers tell you what is faster. LapTime shows what it feels like.</p>
        </article>
      </section>
    </div>
  )
}

export default App
