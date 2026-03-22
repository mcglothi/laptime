import { useEffect, useState } from 'react'
import './App.css'

const hardwareOptions = [
  {
    id: 'm4-max',
    name: 'MacBook Pro M4 Max',
    spec: '128 GB unified memory',
    price: '$4,299',
    buyer: 'Quiet premium workstation for long-context local workflows.',
    prefillBase: 1090,
    decodeBase: 92,
    ttftBase: 260,
  },
  {
    id: 'rtx-5090',
    name: 'RTX 5090 Tower',
    spec: '32 GB VRAM, CUDA',
    price: '$3,899',
    buyer: 'Top-end decode speed for heavy open-weight models.',
    prefillBase: 1550,
    decodeBase: 144,
    ttftBase: 180,
  },
  {
    id: 'rtx-4070-ti-super',
    name: 'RTX 4070 Ti Super Build',
    spec: '16 GB VRAM, CUDA',
    price: '$1,899',
    buyer: 'Strong midrange buyer pick for 7B to 14B experimentation.',
    prefillBase: 820,
    decodeBase: 63,
    ttftBase: 360,
  },
  {
    id: 'mini-pc',
    name: 'Mini PC CPU-Only',
    spec: '96 GB RAM, no discrete GPU',
    price: '$899',
    buyer: 'Budget entry point that highlights where interactivity breaks down.',
    prefillBase: 120,
    decodeBase: 11,
    ttftBase: 1450,
  },
]

const modelOptions = [
  {
    id: 'llama-3.1-8b-q4',
    name: 'Llama 3.1 8B',
    quant: 'Q4_K_M',
    fit: 'Easy daily-driver chat model',
    prefillFactor: 1,
    decodeFactor: 1,
    ttftFactor: 1,
  },
  {
    id: 'qwen-2.5-14b-q6',
    name: 'Qwen 2.5 14B',
    quant: 'Q6_K',
    fit: 'Sharper coding model with heavier memory pressure',
    prefillFactor: 1.28,
    decodeFactor: 1.34,
    ttftFactor: 1.16,
  },
  {
    id: 'llama-3.3-70b-q4',
    name: 'Llama 3.3 70B',
    quant: 'Q4_K_M',
    fit: 'Dream setup model that separates premium rigs from everything else',
    prefillFactor: 2.7,
    decodeFactor: 3.05,
    ttftFactor: 1.55,
  },
]

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
      'The retrieval-heavy workload shifts the experience dramatically because the system spends most of its time ingesting context before it can say anything useful. Buyers often shop on decode tokens per second alone, but in this scenario prompt processing efficiency and time to first token matter more. A machine that feels almost identical on short chat can feel meaningfully worse once you hand it a dense research packet, long markdown notes, or a large tool trace. That is exactly the kind of gap PromptDrive should make visible.',
  },
]

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function formatSeconds(value) {
  return `${value.toFixed(value >= 10 ? 1 : 2)}s`
}

function calculateMetrics(hardware, model, workload) {
  const prefillTps = hardware.prefillBase / model.prefillFactor
  const decodeTps = hardware.decodeBase / model.decodeFactor
  const ttftMs = hardware.ttftBase * model.ttftFactor + workload.promptTokens * 0.16
  const prefillSeconds = workload.promptTokens / prefillTps
  const streamingSeconds = workload.responseTokens / decodeTps
  const totalSeconds = prefillSeconds + ttftMs / 1000 + streamingSeconds
  const experience =
    totalSeconds < 4.5
      ? 'Feels instant'
      : totalSeconds < 9
        ? 'Feels smooth'
        : totalSeconds < 18
          ? 'Feels like waiting'
          : 'Feels batch-first'

  return {
    prefillTps,
    decodeTps,
    ttftMs,
    prefillSeconds,
    streamingSeconds,
    totalSeconds,
    experience,
  }
}

function App() {
  const [hardwareId, setHardwareId] = useState(hardwareOptions[0].id)
  const [modelId, setModelId] = useState(modelOptions[1].id)
  const [workloadId, setWorkloadId] = useState(workloadOptions[2].id)
  const [isPlaying, setIsPlaying] = useState(true)
  const [elapsedMs, setElapsedMs] = useState(0)

  const hardware = hardwareOptions.find((item) => item.id === hardwareId) ?? hardwareOptions[0]
  const model = modelOptions.find((item) => item.id === modelId) ?? modelOptions[0]
  const workload = workloadOptions.find((item) => item.id === workloadId) ?? workloadOptions[0]
  const metrics = calculateMetrics(hardware, model, workload)

  function restartSimulation() {
    setElapsedMs(0)
    setIsPlaying(true)
  }

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
      <section className="hero-panel">
        <div className="hero-copy">
          <div className="eyebrow">PromptDrive</div>
          <h1>Test-drive local AI before you buy the hardware.</h1>
          <p className="hero-text">
            PromptDrive translates raw benchmark data into a buying experience. Pick
            a machine, model, and workload, then watch the response arrive with
            realistic prompt ingest, first-token delay, and streamed output speed.
          </p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={restartSimulation}>
              Replay simulation
            </button>
            <a className="secondary-link" href="#simulator">
              Explore the simulator
            </a>
          </div>
          <div className="hero-strip">
            <div>
              <span className="strip-label">Positioning</span>
              <strong>PCPartPicker meets a local-LLM test drive</strong>
            </div>
            <div>
              <span className="strip-label">Monetization</span>
              <strong>Affiliate builds, buyer guides, sponsored comparisons</strong>
            </div>
          </div>
        </div>

        <div className="hero-card">
          <div className="card-header">
            <span className="status-dot" />
            Live buyer preview
          </div>
          <div className="mini-stats">
            <div>
              <span>Scenario</span>
              <strong>{workload.name}</strong>
            </div>
            <div>
              <span>System</span>
              <strong>{hardware.name}</strong>
            </div>
            <div>
              <span>Experience</span>
              <strong>{metrics.experience}</strong>
            </div>
          </div>
          <div className="hero-timeline">
            <div className="hero-progress">
              <div style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="phase-label">{currentPhase}</div>
          </div>
        </div>
      </section>

      <section className="proof-grid">
        <article>
          <span className="proof-kicker">Why it matters</span>
          <h2>Benchmarks alone do not explain the buying experience.</h2>
          <p>
            PromptDrive makes prefill, time-to-first-token, and decode speed legible
            to real buyers instead of leaving them with a spreadsheet full of jargon.
          </p>
        </article>
        <article>
          <span className="proof-kicker">What changes</span>
          <h2>Show where short chat and long-context RAG behave differently.</h2>
          <p>
            Two rigs can look similar in a table and still feel radically different
            once prompt length, quantization, and model size change.
          </p>
        </article>
      </section>

      <section className="simulator-section" id="simulator">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Simulator</div>
            <h2>See the same benchmark numbers the way a buyer experiences them.</h2>
          </div>
          <p>
            This first build uses curated sample hardware, models, and workload
            presets so we can shape the product before wiring in a larger benchmark
            corpus.
          </p>
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
            </div>
          </aside>

          <div className="playback-panel">
            <div className="terminal-card">
              <div className="terminal-topbar">
                <span>{workload.name} playback</span>
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

      <section className="feature-band">
        <div className="feature-card">
          <div className="eyebrow">V1 roadmap</div>
          <h2>What we build next</h2>
          <ul>
            <li>Real benchmark ingestion and source attribution</li>
            <li>Side-by-side system comparison view</li>
            <li>Buyer guides and affiliate-ready hardware pages</li>
          </ul>
        </div>
        <div className="feature-card muted">
          <div className="eyebrow">Brand promise</div>
          <h2>Numbers tell you what is faster. PromptDrive shows what it feels like.</h2>
          <p>
            That is the wedge that can make the project useful, memorable, and
            commercially attractive.
          </p>
        </div>
      </section>
    </div>
  )
}

export default App
