import { useState } from 'react'
import SectionHeading from './SectionHeading'

const sampleLlamaLog = `llama.cpp bench
build: 6123 (9f1f9c0)
backend: CUDA
gpu: NVIDIA GeForce RTX 4090
model: Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf
prompt eval time =  182.44 ms /   512 tokens ( 2806.6 tok/s)
eval time        =  2134.20 ms /   256 runs   ( 119.9 tok/s)
time to first token = 146.0 ms`

const sampleMlxLog = `MLX LM benchmark
device: Apple M4 Max 128GB
model: Qwen3.5-14B-Instruct-4bit
prompt processing: 7421.4 tokens/s
generation: 58.2 tokens/s
ttft: 0.31 s`

function normalizeModelName(value) {
  return value.replace(/\.gguf$/i, '').replace(/[-_]/g, ' ').trim()
}

function parseNumericMetric(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      return Number(match[1])
    }
  }
  return null
}

function parseTextValue(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      return match[1].trim()
    }
  }
  return ''
}

function parseBenchmarkLog(text) {
  const normalized = text.trim()
  if (!normalized) {
    return {
      status: 'idle',
      issues: [],
      parsed: null,
    }
  }

  const model = normalizeModelName(
    parseTextValue(normalized, [
      /^model:\s*(.+)$/im,
      /^model name:\s*(.+)$/im,
      /load(?:ed)? model[:=]\s*(.+)$/im,
    ]),
  )
  const hardware = parseTextValue(normalized, [
    /^gpu:\s*(.+)$/im,
    /^device:\s*(.+)$/im,
    /^hardware:\s*(.+)$/im,
    /^accelerator:\s*(.+)$/im,
  ])
  const backend = parseTextValue(normalized, [
    /^backend:\s*(.+)$/im,
    /^engine:\s*(.+)$/im,
    /^runtime:\s*(.+)$/im,
  ])

  const prefillTps = parseNumericMetric(normalized, [
    /prompt(?:\s+eval|\s+processing)?(?:\s+time)?\s*=\s*[\d.]+\s*(?:ms|s)\s*\/\s*[\d.]+\s*tokens?\s*\(\s*([\d.]+)\s*(?:tok\/s|tokens\/s)\s*\)/i,
    /prompt(?:\s+processing)?[:=]\s*([\d.]+)\s*(?:tok\/s|tokens\/s)/i,
    /prefill[:=]\s*([\d.]+)\s*(?:tok\/s|tokens\/s)/i,
  ])
  const decodeTps = parseNumericMetric(normalized, [
    /^\s*eval(?:\s+time)?\s*=\s*[\d.]+\s*(?:ms|s)\s*\/\s*[\d.]+\s*(?:runs|tokens?)\s*\(\s*([\d.]+)\s*(?:tok\/s|tokens\/s)\s*\)/im,
    /generation[:=]\s*([\d.]+)\s*(?:tok\/s|tokens\/s)/i,
    /decode[:=]\s*([\d.]+)\s*(?:tok\/s|tokens\/s)/i,
  ])
  const ttftMsSeconds = parseNumericMetric(normalized, [
    /ttft[:=]\s*([\d.]+)\s*s\b/i,
  ])
  const ttftMsDirect = parseNumericMetric(normalized, [
    /time to first token\s*[:=]\s*([\d.]+)\s*ms/i,
    /ttft[:=]\s*([\d.]+)\s*ms\b/i,
    /first token(?: delay)?[:=]\s*([\d.]+)\s*ms/i,
  ])
  const ttftMs = ttftMsDirect ?? (ttftMsSeconds != null ? ttftMsSeconds * 1000 : null)

  const issues = []
  if (!model) issues.push('Model name not found yet')
  if (!hardware) issues.push('Hardware or device name not found yet')
  if (prefillTps == null) issues.push('Prompt ingest / prefill throughput not found yet')
  if (decodeTps == null) issues.push('Decode throughput not found yet')
  if (ttftMs == null) issues.push('Time to first token not found yet')

  const parsed = {
    model,
    hardware,
    backend,
    prefillTps,
    decodeTps,
    ttftMs,
  }

  return {
    status: issues.length === 0 ? 'ready' : 'partial',
    issues,
    parsed,
  }
}

function buildIssueUrl(parsed, rawLog) {
  const title = `Run what ya brung: ${parsed.hardware || 'Unknown hardware'} / ${parsed.model || 'Unknown model'}`
  const body = [
    '## Parsed benchmark submission',
    '',
    `- Hardware: ${parsed.hardware || 'Unknown'}`,
    `- Model: ${parsed.model || 'Unknown'}`,
    `- Backend: ${parsed.backend || 'Unknown'}`,
    `- Prefill TPS: ${parsed.prefillTps != null ? parsed.prefillTps : 'Missing'}`,
    `- Decode TPS: ${parsed.decodeTps != null ? parsed.decodeTps : 'Missing'}`,
    `- TTFT ms: ${parsed.ttftMs != null ? Math.round(parsed.ttftMs) : 'Missing'}`,
    '',
    '## Raw benchmark log',
    '',
    '```text',
    rawLog.trim(),
    '```',
  ].join('\n')

  const params = new URLSearchParams({
    title,
    body,
  })

  return `https://github.com/mcglothi/laptime/issues/new?${params.toString()}`
}

function SubmissionSection() {
  const [draftLog, setDraftLog] = useState(sampleLlamaLog)
  const parsed = parseBenchmarkLog(draftLog)
  const issueUrl = parsed.parsed ? buildIssueUrl(parsed.parsed, draftLog) : null

  return (
    <section className="submission-section" id="submissions">
      <SectionHeading
        eyebrow="Run What Ya Brung"
        title="Bring your own laps without flooding the grid."
        description="LapTime can accept real benchmark artifacts without collapsing everything into one noisy community bucket. Parsed logs come first. Verified in-browser laps are the next trust lane."
      />

      <div className="submission-grid">
        <article className="submission-card">
          <div className="submission-card-header">
            <div>
              <div className="metrics-heading">Paste a benchmark log</div>
              <p className="submission-copy">
                Drop in `llama.cpp`, `MLX`, or similarly structured output and LapTime will pull out the useful lap data before you file it.
              </p>
            </div>
            <div className="submission-actions">
              <button className="ghost-button" type="button" onClick={() => setDraftLog(sampleLlamaLog)}>
                Load llama.cpp
              </button>
              <button className="ghost-button" type="button" onClick={() => setDraftLog(sampleMlxLog)}>
                Load MLX
              </button>
            </div>
          </div>

          <label className="control-group dense">
            <span>Benchmark log</span>
            <textarea
              className="submission-textarea"
              name="submissionLog"
              value={draftLog}
              onChange={(event) => setDraftLog(event.target.value)}
              placeholder="Paste benchmark output here"
            />
          </label>

          <div className="submission-result-grid">
            <div className={`submission-result-card submission-result-${parsed.status}`}>
              <div className="metrics-heading">
                {parsed.status === 'ready' ? 'Parsed lap data' : 'Parser status'}
              </div>
              {parsed.parsed ? (
                <div className="metric-list submission-metric-list">
                  <div>
                    <span>Hardware</span>
                    <strong>{parsed.parsed.hardware || 'Missing'}</strong>
                  </div>
                  <div>
                    <span>Model</span>
                    <strong>{parsed.parsed.model || 'Missing'}</strong>
                  </div>
                  <div>
                    <span>Backend</span>
                    <strong>{parsed.parsed.backend || 'Unknown'}</strong>
                  </div>
                  <div>
                    <span>Prefill</span>
                    <strong>
                      {parsed.parsed.prefillTps != null
                        ? `${parsed.parsed.prefillTps.toFixed(1)} tok/s`
                        : 'Missing'}
                    </strong>
                  </div>
                  <div>
                    <span>Decode</span>
                    <strong>
                      {parsed.parsed.decodeTps != null
                        ? `${parsed.parsed.decodeTps.toFixed(1)} tok/s`
                        : 'Missing'}
                    </strong>
                  </div>
                  <div>
                    <span>TTFT</span>
                    <strong>
                      {parsed.parsed.ttftMs != null
                        ? `${Math.round(parsed.parsed.ttftMs)} ms`
                        : 'Missing'}
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="empty-state">Paste a log to see what LapTime can extract.</div>
              )}
              {parsed.issues.length ? (
                <div className="submission-issues">
                  {parsed.issues.map((issue) => (
                    <p key={issue}>{issue}</p>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="submission-result-card">
              <div className="metrics-heading">Trust lane</div>
              <p className="submission-copy">
                Parsed logs should land as `Parsed community benchmark` rows, not as benchmark-backed laps. The raw artifact stays attached so people can audit what was actually measured.
              </p>
              {issueUrl ? (
                <a className="source-link" href={issueUrl} target="_blank" rel="noreferrer">
                  Open prefilled GitHub issue
                </a>
              ) : null}
            </div>
          </div>
        </article>

        <article className="submission-card submission-card-featured">
          <div className="metrics-heading">Verified by WebLLM</div>
          <p className="submission-copy">
            The next lane is a browser-run lap: WebGPU-backed, reproducible, and clearly separated from native backend results.
          </p>
          <div className="submission-feature-list">
            <div>
              <span>Badge</span>
              <strong>Verified in-browser</strong>
            </div>
            <div>
              <span>Captures</span>
              <strong>Hardware name, prefill, decode, TTFT</strong>
            </div>
            <div>
              <span>Rule</span>
              <strong>Separate trust tier from llama.cpp / MLX native laps</strong>
            </div>
          </div>
          <p className="submission-note">
            This lane is intentionally not wired yet. The goal is to add signal, not another pile of unverified numbers.
          </p>
        </article>
      </div>
    </section>
  )
}

export default SubmissionSection
