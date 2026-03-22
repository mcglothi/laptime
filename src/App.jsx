import { useEffect, useState } from 'react'
import './App.css'

const hardwareOptions = [
  {
    id: 'custom',
    name: 'Custom speeds',
    spec: 'Manual override',
    price: 'Custom',
    buyer: 'Set your own prefill, decode, and TTFT like TokenFlow.',
    prefillBase: 3000,
    decodeBase: 60,
    ttftBase: 350,
    source: 'Manual',
  },
  {
    id: 'rtx-5090',
    name: 'RTX 5090 Tower',
    spec: '31 GB VRAM, CUDA',
    price: '$3,899',
    buyer: 'Flagship consumer rig with strong prompt throughput.',
    prefillBase: 6477.08,
    decodeBase: 65.1,
    ttftBase: 216.85,
    source: 'LocalScore',
  },
  {
    id: 'rtx-4090',
    name: 'RTX 4090',
    spec: '24 GB VRAM, CUDA',
    price: '$2,699',
    buyer: 'Popular high-end local AI card with broad community data.',
    prefillBase: 6598.53,
    decodeBase: 89.26,
    ttftBase: 207.98,
    source: 'LocalScore',
  },
  {
    id: 'rtx-4080-super',
    name: 'RTX 4080 SUPER',
    spec: '16 GB VRAM class build',
    price: '$1,999',
    buyer: 'Strong premium tier when 4090 pricing is too steep.',
    prefillBase: 4978.68,
    decodeBase: 78.69,
    ttftBase: 267.04,
    source: 'LocalScore',
  },
  {
    id: 'rtx-3090-ti',
    name: 'RTX 3090 Ti',
    spec: '24 GB VRAM, CUDA',
    price: '$1,899',
    buyer: 'Used-market favorite for serious local models on a budget.',
    prefillBase: 4023.78,
    decodeBase: 109.78,
    ttftBase: 320.45,
    source: 'LocalScore',
  },
  {
    id: 'rtx-3080-ti',
    name: 'RTX 3080 Ti',
    spec: '12 GB VRAM, CUDA',
    price: '$1,199',
    buyer: 'Older enthusiast tier that still matters for value shoppers.',
    prefillBase: 3739.43,
    decodeBase: 103.81,
    ttftBase: 342.66,
    source: 'LocalScore',
  },
  {
    id: 'rtx-3070-ti',
    name: 'RTX 3070 Ti',
    spec: '8 GB VRAM, CUDA',
    price: '$699',
    buyer: 'Lower-cost entry that shows where VRAM limits start to bite.',
    prefillBase: 2509.44,
    decodeBase: 83.17,
    ttftBase: 519.63,
    source: 'LocalScore',
  },
]

const modelOptions = [
  {
    id: 'llama-3.2-1b',
    name: 'Llama 3.2 1B Instruct',
    quant: 'Q4_K - Medium',
    fit: 'Tiny benchmark model for lightweight local chat.',
    prefillFactor: 0.33,
    decodeFactor: 0.34,
    ttftFactor: 0.34,
  },
  {
    id: 'llama-3.1-8b',
    name: 'Meta Llama 3.1 8B Instruct',
    quant: 'Q4_K - Medium',
    fit: 'Most stable baseline for interactive local use.',
    prefillFactor: 1,
    decodeFactor: 1,
    ttftFactor: 1,
  },
  {
    id: 'qwen-2.5-14b',
    name: 'Qwen2.5 14B Instruct',
    quant: 'Q4_K - Medium',
    fit: 'Heavier benchmark model that starts exposing memory tradeoffs.',
    prefillFactor: 1.9,
    decodeFactor: 1.85,
    ttftFactor: 2.05,
  },
  {
    id: 'llama-3.3-70b',
    name: 'Llama 3.3 70B',
    quant: 'Q4 estimate',
    fit: 'Extrapolated heavyweight model for dream-rig comparisons.',
    prefillFactor: 6.4,
    decodeFactor: 4.2,
    ttftFactor: 3.6,
  },
]

const benchmarkMatrix = {
  'rtx-5090': {
    'llama-3.2-1b': { prefillTps: 20305.31, decodeTps: 170.33, ttftMs: 299.93, source: 'LocalScore' },
    'llama-3.1-8b': { prefillTps: 6477.08, decodeTps: 65.1, ttftMs: 216.85, source: 'LocalScore' },
    'qwen-2.5-14b': { prefillTps: 3678.27, decodeTps: 45.54, ttftMs: 535.86, source: 'LocalScore' },
  },
  'rtx-4090': {
    'llama-3.2-1b': { prefillTps: 18868.67, decodeTps: 193.6, ttftMs: 101.84, source: 'LocalScore' },
    'llama-3.1-8b': { prefillTps: 6598.53, decodeTps: 89.26, ttftMs: 207.98, source: 'LocalScore' },
    'qwen-2.5-14b': { prefillTps: 3370.69, decodeTps: 45.65, ttftMs: 413.23, source: 'LocalScore' },
  },
  'rtx-4080-super': {
    'llama-3.2-1b': { prefillTps: 17478.95, decodeTps: 247.22, ttftMs: 80.02, source: 'LocalScore' },
    'llama-3.1-8b': { prefillTps: 4978.68, decodeTps: 78.69, ttftMs: 267.04, source: 'LocalScore' },
    'qwen-2.5-14b': { prefillTps: 2802.55, decodeTps: 46.15, ttftMs: 468.4, source: 'LocalScore' },
  },
  'rtx-3090-ti': {
    'llama-3.2-1b': { prefillTps: 15119.73, decodeTps: 353.86, ttftMs: 89.64, source: 'LocalScore' },
    'llama-3.1-8b': { prefillTps: 4023.78, decodeTps: 109.78, ttftMs: 320.45, source: 'LocalScore' },
    'qwen-2.5-14b': { prefillTps: 2202.06, decodeTps: 64.18, ttftMs: 575.42, source: 'LocalScore' },
  },
  'rtx-3080-ti': {
    'llama-3.2-1b': { prefillTps: 14351.58, decodeTps: 326.48, ttftMs: 93.43, source: 'LocalScore' },
    'llama-3.1-8b': { prefillTps: 3739.43, decodeTps: 103.81, ttftMs: 342.66, source: 'LocalScore' },
    'qwen-2.5-14b': { prefillTps: 1704.09, decodeTps: 41.95, ttftMs: 784.72, source: 'LocalScore' },
  },
  'rtx-3070-ti': {
    'llama-3.2-1b': { prefillTps: 10074.28, decodeTps: 297.33, ttftMs: 137.21, source: 'LocalScore' },
    'llama-3.1-8b': { prefillTps: 2509.44, decodeTps: 83.17, ttftMs: 519.63, source: 'LocalScore' },
  },
}

const workloadOptions = [
  {
    id: 'chat',
    name: 'Quick Chat',
    category: 'Interactive reply',
    promptTokens: 180,
    responseTokens: 140,
    accent: 'Feels like a premium assistant when decode stays high.',
    prompt:
      'Summarize whether a 16 GB GPU is enough for local coding help and note the biggest tradeoff.',
    response:
      'A 16 GB GPU is a very workable sweet spot for local coding help, especially if you stay in the 7B to 14B range or use efficient quantizations. The main tradeoff is not just raw speed, but headroom: larger models, longer contexts, and simultaneous tools start squeezing memory quickly, so a setup that feels instant on short chats can feel tight once you lean into serious coding or retrieval-heavy workflows.',
  },
  {
    id: 'code',
    name: 'Coding Assist',
    category: 'Long answer',
    promptTokens: 820,
    responseTokens: 420,
    accent: 'This is where first-token delay starts shaping user trust.',
    prompt:
      'Review this React component for loading-state bugs, explain the issue, and propose a cleaner pattern with an example.',
    response:
      'The biggest issue is that the component can render stale data while a new request is in flight, which makes the UI look responsive but semantically wrong. A cleaner pattern is to separate request status from the displayed result, show a clear pending state, and delay swapping visible content until the newest response wins. In practice that means tracking an active request id, resetting optimistic assumptions when inputs change, and rendering loading, error, and settled states deliberately instead of letting them blur together. The result feels calmer, avoids race-condition flashes, and makes retry behavior easier to reason about.',
  },
  {
    id: 'rag',
    name: 'RAG Deep Dive',
    category: 'Large prompt',
    promptTokens: 6400,
    responseTokens: 320,
    accent: 'Prefill dominates here, so flashy decode numbers can be misleading.',
    prompt:
      'Answer a product strategy question using a long context bundle that includes pricing notes, benchmark charts, customer interviews, and prior roadmap decisions.',
    response:
      'The retrieval-heavy workload shifts the experience dramatically because the system spends most of its time ingesting context before it can say anything useful. Buyers often shop on decode tokens per second alone, but in this scenario prompt processing efficiency and time to first token matter more. A machine that feels almost identical on short chat can feel meaningfully worse once you hand it a dense research packet, long markdown notes, or a large tool trace. That is exactly the kind of gap LapTime should make visible.',
  },
  {
    id: 'custom',
    name: 'Custom Preset',
    category: 'Manual preset',
    promptTokens: 1200,
    responseTokens: 220,
    accent: 'Tune prompt and response sizes for your own what-if scenario.',
    prompt:
      'Use your own token counts to preview how a workload might feel before you buy hardware.',
    response:
      'This custom preset lets you model your own workload shape. Increase prompt tokens to simulate longer context ingestion, increase response tokens to simulate longer answers, or combine both to test more demanding sessions.',
  },
]

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

function App() {
  const [hardwareId, setHardwareId] = useState(hardwareOptions[1].id)
  const [modelId, setModelId] = useState(modelOptions[1].id)
  const [workloadId, setWorkloadId] = useState(workloadOptions[2].id)
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
  const workload =
    selectedWorkload.id === 'custom'
      ? {
          ...selectedWorkload,
          promptTokens: customPreset.promptTokens,
          responseTokens: customPreset.responseTokens,
        }
      : selectedWorkload
  const metrics = calculateMetrics(hardware, model, workload, customMetrics)

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

      <section className="quick-notes">
        <article>
          <span className="proof-kicker">Why this matters</span>
          <p>Prefill, TTFT, and decode are separated so buyers can understand where the wait comes from.</p>
        </article>
        <article>
          <span className="proof-kicker">What comes next</span>
          <p>Real benchmark ingestion, side-by-side comparison, and buyer guides that can carry affiliate revenue.</p>
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
