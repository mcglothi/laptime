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
    `- Memory GB: ${parsed.memoryGb != null ? parsed.memoryGb : 'Not provided'}`,
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

function SubmissionSection({ onLoadParsedSubmission, onRaceParsedSubmission }) {
  const [draftLog, setDraftLog] = useState(sampleLlamaLog)
  const [memoryGbInput, setMemoryGbInput] = useState('24')
  const parsed = parseBenchmarkLog(draftLog)
  const parsedSubmission =
    parsed.parsed == null
      ? null
      : {
          ...parsed.parsed,
          memoryGb: memoryGbInput.trim() ? Number(memoryGbInput) : null,
        }
  const issueUrl = parsedSubmission ? buildIssueUrl(parsedSubmission, draftLog) : null

  return (
    <section className="submission-section" id="submissions">
      <SectionHeading
        eyebrow="Run What Ya Brung"
        title="Bring your own laps without flooding the grid."
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

          <label className="control-group dense submission-memory-field">
            <span>Available memory (GB)</span>
            <input
              id="submission-memory-gb"
              name="submissionMemoryGb"
              min="1"
              step="1"
              type="number"
              value={memoryGbInput}
              onChange={(event) => setMemoryGbInput(event.target.value)}
              placeholder="24"
            />
            <small>
              Enter VRAM or unified memory so LapTime can give an honest fit comparison.
            </small>
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
                    <span>Memory</span>
                    <strong>
                      {parsedSubmission?.memoryGb != null && Number.isFinite(parsedSubmission.memoryGb)
                        ? `${parsedSubmission.memoryGb} GB`
                        : 'Add memory'}
                    </strong>
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

            <div className="submission-result-card submission-result-submit">
              <div className="metrics-heading">Run or submit this lap</div>
              <p className="submission-copy">
                Use these actions to test your setup locally, race it against a house rig, or propose adding it to
                LapTime for everyone to explore. GitHub issues are the intake lane for public benchmark proposals so
                the raw artifact stays attached and reviewable.
              </p>
              {issueUrl ? (
                <>
                  {parsed.status === 'ready' && parsed.parsed ? (
                    <div className="submission-action-group">
                      <div className="submission-action-label">Try it live on this page</div>
                      <button
                        className="submission-button submission-button-secondary"
                        type="button"
                        onClick={() => onLoadParsedSubmission?.(parsedSubmission)}
                      >
                        Run in simulator
                      </button>
                      <button
                        className="submission-button submission-button-race"
                        type="button"
                        onClick={() => onRaceParsedSubmission?.(parsedSubmission)}
                      >
                        Race my setup
                      </button>
                    </div>
                  ) : null}
                  <div className="submission-divider" aria-hidden="true" />
                  <div className="submission-action-label">Send it in for review</div>
                  <a
                    className="submission-button"
                    href={issueUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Submit Entry
                  </a>
                  <p className="submission-helper">
                    This opens a prefilled GitHub issue proposing your parsed benchmark as a public LapTime entry.
                    The hardware, model, memory, and lap metrics stay attached so the submission can be reviewed
                    before it shows up for everyone.
                  </p>
                </>
              ) : null}
            </div>
          </div>
        </article>
      </div>
    </section>
  )
}

export default SubmissionSection
