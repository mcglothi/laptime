import { useEffect, useRef, useState } from 'react'
import SectionHeading from './SectionHeading'
import ShareSheet from './ShareSheet'

const SOURCE_EXPLORER_TARGETS = [
  {
    pattern: 'LocalScore',
    target: '#source-localscore',
  },
  {
    pattern: 'inferencerlabs Qwen3.5-0.8B-MLX-9bit',
    target: '#source-inferencerlabs-qwen3-5-0-8b-mlx-9bit',
  },
  {
    pattern: 'inferencerlabs Qwen3.5-2B-MLX-9bit',
    target: '#source-inferencerlabs-qwen3-5-2b-mlx-9bit',
  },
  {
    pattern: 'inferencerlabs Qwen3.5-4B-MLX-4.5bit',
    target: '#source-inferencerlabs-qwen3-5-4b-mlx-4-5bit',
  },
  {
    pattern: 'inferencerlabs Qwen3.5-9B-MLX-4.5bit',
    target: '#source-inferencerlabs-qwen3-5-9b-mlx-4-5bit',
  },
  {
    pattern: 'inferencerlabs Qwen3.5-9B-MLX-9bit',
    target: '#source-inferencerlabs-qwen3-5-9b-mlx-9bit',
  },
  {
    pattern: 'inferencerlabs Qwen3.5-27B-MLX-4.5bit',
    target: '#source-inferencerlabs-qwen3-5-27b-mlx-4-5bit',
  },
  {
    pattern: 'inferencerlabs Qwen3.5-27B-MLX-7bit',
    target: '#source-inferencerlabs-qwen3-5-27b-mlx-7bit',
  },
  {
    pattern: 'inferencerlabs Qwen3.5-35B-A3B-MLX-5.5bit',
    target: '#source-inferencerlabs-qwen3-5-35b-a3b-mlx-5-5bit',
  },
  {
    pattern: 'inferencerlabs Qwen3.5-122B-A10B-MLX-6.5bit',
    target: '#source-inferencerlabs-qwen3-5-122b-a10b-mlx-6-5bit',
  },
  {
    pattern: 'inferencerlabs Qwen3.5-122B-A10B-MLX-9bit',
    target: '#source-inferencerlabs-qwen3-5-122b-a10b-mlx-9bit',
  },
  {
    pattern: 'inferencerlabs NVIDIA-Nemotron-3-Super-120B-A12B-MLX-4.5bit',
    target: '#source-inferencerlabs-nvidia-nemotron-3-super-120b-a12b-mlx-4-5bit',
  },
  {
    pattern: 'NVIDIA Developer Forums DGX Spark vLLM MXFP4 post',
    target: '#source-nvidia-developer-forums-dgx-spark-gpt-oss-post',
  },
]

function getSourceExplorerTarget(coverage, metricsSource) {
  if (!['exact', 'source-backed', 'community-runtime'].includes(coverage)) return null

  const matchedTarget = SOURCE_EXPLORER_TARGETS.find((entry) => metricsSource?.includes(entry.pattern))
  if (matchedTarget) return matchedTarget.target
  return '#sources'
}

function getCoverageLabel(coverage) {
  if (coverage === 'exact') return 'Benchmark-backed'
  if (coverage === 'source-backed') return 'Source-backed runtime'
  if (coverage === 'community-runtime') return 'Community runtime'
  return 'Estimated run'
}

function getCoverageTone(coverage) {
  if (coverage === 'exact') return 'exact'
  if (coverage === 'source-backed') return 'source'
  if (coverage === 'community-runtime') return 'community'
  return 'estimate'
}

function getExperienceTone(experience) {
  if (experience === 'Feels instant') return 'instant'
  if (experience === 'Feels smooth') return 'smooth'
  if (experience === 'Feels like waiting') return 'waiting'
  return 'batch'
}

function describeModelEstimate(model) {
  if (model.scalingParamsB && model.scalingParamsB !== model.paramsB) {
    return `${model.name} is scaled using about ${model.scalingParamsB}B active parameters and ${model.quant} behavior instead of treating it like a plain ${model.paramsB}B dense model.`
  }

  return `${model.name} is projected from the baseline with LapTime's ${model.quant.toLowerCase()} size curve for a ${model.paramsB}B-class model.`
}

function getCoverageExplanation(coverage, hardware, model, benchmarkMatrix) {
  if (coverage === 'exact') {
    return `This lap is using a direct benchmark row for ${hardware.name} and ${model.name}, so prefill, decode, and first-token timing all come from a published measurement instead of extrapolation.`
  }

  if (coverage === 'source-backed') {
    return `This lap is anchored by a hardware-specific runtime source for ${model.name}. LapTime is using the published runtime data it has, then filling any missing pieces with benchmark-backed baseline modeling rather than pretending the full lap was measured.`
  }

  if (coverage === 'community-runtime') {
    return `This lap is anchored by a concrete community runtime report for ${hardware.name} and ${model.name}. LapTime is using the published throughput from that report and keeping the row explicitly labeled as community runtime so it is easier to audit than a generic estimate.`
  }

  const anchorBenchmark = hardware.estimateAnchorId
    ? benchmarkMatrix[hardware.estimateAnchorId]?.[model.id] ?? benchmarkMatrix[hardware.estimateAnchorId]?.['llama-3.1-8b']
    : null

  const hardwareExplanation = hardware.estimateAnchorName
    ? anchorBenchmark?.coverage === 'community-runtime'
      ? `For ${hardware.name}, LapTime anchors this estimate to the ${hardware.estimateAnchorName} community runtime row for ${model.name} because ${hardware.estimateReason}.`
      : `For ${hardware.name}, LapTime starts from the ${hardware.estimateAnchorName} reference row because ${hardware.estimateReason}.`
    : hardware.estimateSourceLabel
      ? `For ${hardware.name}, the hardware lane itself is estimated from ${hardware.estimateSourceLabel} because ${hardware.estimateReason}.`
      : `For ${hardware.name}, LapTime falls back to the closest available hardware baseline because no direct row exists yet.`

  return `${hardwareExplanation} ${describeModelEstimate(model)} That makes this useful for rough planning, but it should still be treated as modeled rather than measured until a direct row replaces it.`
}

function getFitLabel(status) {
  if (status === 'unfit') return "Won't fit"
  if (status === 'tight') return 'Tight fit'
  if (status === 'unknown') return 'Unknown fit'
  return 'Fits'
}

function getBottleneckLabel(metrics) {
  if (metrics.prefillSeconds >= metrics.streamingSeconds * 1.35 && metrics.prefillSeconds >= metrics.ttftMs / 1000) {
    return 'Long-context ingest is doing most of the waiting.'
  }
  if (metrics.ttftMs / 1000 >= metrics.prefillSeconds && metrics.ttftMs / 1000 >= metrics.streamingSeconds) {
    return 'First-token latency is the biggest visible pause.'
  }
  if (metrics.streamingSeconds >= metrics.prefillSeconds * 1.15) {
    return 'Decode speed dominates how this lap feels.'
  }
  return 'This setup feels fairly balanced across the whole lap.'
}

function getUseCaseLabel(metrics, fitAssessment) {
  if (fitAssessment.status === 'unfit') return 'Good for sizing, not for a real local run.'
  if (fitAssessment.status === 'tight') return 'Viable, but memory headroom may be the real limiter.'
  if (metrics.totalSeconds < 5) return 'Feels ready for interactive chat and quick agent loops.'
  if (metrics.totalSeconds < 10) return 'Comfortable for everyday coding, chat, and light retrieval.'
  if (metrics.totalSeconds < 18) return 'Fine for research-style work where a little waiting is acceptable.'
  return 'Better suited to batchy or long-context workflows than snappy back-and-forth chat.'
}

function SimulatorSection({
  hardware,
  hardwareId,
  hardwareQuery,
  setHardwareQuery,
  visibleHardwareOptions,
  hardwarePlatformOptions,
  hardwarePlatformFilter,
  setHardwarePlatformFilter,
  setHardwareId,
  customMetrics,
  setCustomMetrics,
  model,
  modelId,
  modelQuery,
  setModelQuery,
  visibleModelOptions,
  setModelId,
  modelFamilyOptions,
  modelFamilyFilter,
  setModelFamilyFilter,
  huggingFaceImportInput,
  setHuggingFaceImportInput,
  huggingFaceQuantOptions,
  huggingFaceQuantOverride,
  setHuggingFaceQuantOverride,
  huggingFaceImportState,
  importHuggingFaceModel,
  workload,
  workloadId,
  workloadOptions,
  setWorkloadId,
  contextTokens,
  setContextTokens,
  formatTokenCount,
  isPromptExpanded,
  setIsPromptExpanded,
  customPreset,
  setCustomPreset,
  metrics,
  runCoverage,
  benchmarkMatrix,
  communityBenchmarks,
  dataSources,
  modelOptions,
  fitAssessment,
  isPlaying,
  currentPhase,
  restartSimulation,
  streamedText,
  elapsedMs,
  streamStartMs,
  progress,
  formatSeconds,
  shareUrl,
  shareTitle,
}) {
  const playbackRef = useRef(null)
  const [isCompactMobile, setIsCompactMobile] = useState(false)
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false)
  const [isHuggingFaceImportOpen, setIsHuggingFaceImportOpen] = useState(false)
  const totalTimelineMs = metrics.prefillSeconds * 1000 + metrics.ttftMs + metrics.streamingSeconds * 1000
  const prefillShare = ((metrics.prefillSeconds * 1000) / totalTimelineMs) * 100
  const ttftShare = (metrics.ttftMs / totalTimelineMs) * 100
  const streamShare = ((metrics.streamingSeconds * 1000) / totalTimelineMs) * 100
  const bottleneckLabel = getBottleneckLabel(metrics)
  const useCaseLabel = getUseCaseLabel(metrics, fitAssessment)
  const coverageLabel = getCoverageLabel(runCoverage)
  const coverageTone = getCoverageTone(runCoverage)
  const experienceTone = getExperienceTone(metrics.experience)
  const coverageExplanation = getCoverageExplanation(runCoverage, hardware, model, benchmarkMatrix)
  const sourceExplorerTarget = getSourceExplorerTarget(runCoverage, metrics.source)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 760px)')

    function syncViewport() {
      setIsCompactMobile(mediaQuery.matches)
      if (!mediaQuery.matches) {
        setMobileEditorOpen(false)
      }
    }

    syncViewport()
    mediaQuery.addEventListener('change', syncViewport)

    return () => mediaQuery.removeEventListener('change', syncViewport)
  }, [])

  useEffect(() => {
    if (model.huggingFaceRepo) {
      setIsHuggingFaceImportOpen(true)
    }
  }, [model.huggingFaceRepo])

  function scrollPlaybackIntoView() {
    if (!isCompactMobile) return
    window.setTimeout(() => {
      playbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 40)
  }

  function handleRestart(options = {}) {
    const { collapseMobile = false } = options
    restartSimulation()
    if (collapseMobile && isCompactMobile) {
      setMobileEditorOpen(false)
      scrollPlaybackIntoView()
    }
  }

  const controlPanel = (
    <aside className={`control-panel${isCompactMobile ? ' control-panel-mobile' : ''}`}>
      <label className="control-group">
        <div className="control-label">
          <span>Hardware</span>
          <small>Race car</small>
        </div>
        <div className="chip-row">
          {hardwarePlatformOptions.map((platform) => (
            <button
              key={platform}
              className={`filter-chip ${hardwarePlatformFilter === platform ? 'active' : ''}`}
              type="button"
              onClick={() => setHardwarePlatformFilter(platform)}
            >
              {platform === 'all' ? (isCompactMobile ? 'All' : 'All platforms') : platform}
            </button>
          ))}
        </div>
        <input
          id="hardware-search"
          name="hardwareSearch"
          type="text"
          value={hardwareQuery}
          placeholder="Search hardware"
          onChange={(event) => setHardwareQuery(event.target.value)}
        />
        <select
          id="hardware-select"
          name="hardware"
          value={hardwareId}
          onChange={(event) => {
            setHardwareId(event.target.value)
            handleRestart({ collapseMobile: true })
          }}
        >
          {visibleHardwareOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.platform} · {option.name}
            </option>
          ))}
        </select>
        <small>
          {hardware.platform} · {hardware.spec}
        </small>
        <p>{hardware.buyer}</p>
      </label>

      {hardware.id === 'custom' ? (
        <div className="custom-grid">
          <label className="control-group">
            <span>Prefill tok/s</span>
            <input
              id="custom-prefill"
              name="customPrefillTps"
              min="1"
              step="1"
              type="number"
              value={customMetrics.prefillTps}
              onChange={(event) => {
                setCustomMetrics((current) => ({
                  ...current,
                  prefillTps: Number(event.target.value) || 1,
                }))
                handleRestart()
              }}
            />
          </label>
          <label className="control-group">
            <span>Decode tok/s</span>
            <input
              id="custom-decode"
              name="customDecodeTps"
              min="0.1"
              step="0.1"
              type="number"
              value={customMetrics.decodeTps}
              onChange={(event) => {
                setCustomMetrics((current) => ({
                  ...current,
                  decodeTps: Number(event.target.value) || 0.1,
                }))
                handleRestart()
              }}
            />
          </label>
          <label className="control-group">
            <span>TTFT ms</span>
            <input
              id="custom-ttft"
              name="customTtftMs"
              min="1"
              step="1"
              type="number"
              value={customMetrics.ttftMs}
              onChange={(event) => {
                setCustomMetrics((current) => ({
                  ...current,
                  ttftMs: Number(event.target.value) || 1,
                }))
                handleRestart()
              }}
            />
          </label>
        </div>
      ) : null}

      <label className="control-group">
        <div className="control-label">
          <span>Model</span>
          <small>Track</small>
        </div>
        <div className="chip-row">
          {modelFamilyOptions.map((family) => (
            <button
              key={family}
              className={`filter-chip ${modelFamilyFilter === family ? 'active' : ''}`}
              type="button"
              onClick={() => setModelFamilyFilter(family)}
            >
              {family === 'all' ? 'All' : family}
            </button>
          ))}
        </div>
        <input
          id="model-search"
          name="modelSearch"
          type="text"
          value={modelQuery}
          placeholder="Search models"
          onChange={(event) => setModelQuery(event.target.value)}
        />
        <select
          id="model-select"
          name="model"
          className={`select-fit select-fit-${fitAssessment.status}`}
          value={modelId}
          onChange={(event) => {
            setModelId(event.target.value)
            handleRestart({ collapseMobile: true })
          }}
        >
          {visibleModelOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {getFitLabel(option.fitAssessment.status)} · {option.name} · {option.quant}
            </option>
          ))}
        </select>
        <small>
          {model.family} · {model.quant}
          {model.paramsB ? ` · ${model.paramsB}B` : ''}
        </small>
        <div className={`fit-inline fit-inline-${fitAssessment.status}`}>
          {getFitLabel(fitAssessment.status)}
        </div>
        <p>{model.fit}</p>
      </label>

      <div className={`control-group dense hf-import-shell ${isHuggingFaceImportOpen ? 'open' : ''}`}>
        <div className="control-label">
          <span>Bring your own model</span>
          <small>Hugging Face</small>
        </div>
        {!isHuggingFaceImportOpen ? (
          <>
            <button
              className="ghost-button hf-import-toggle"
              type="button"
              onClick={() => setIsHuggingFaceImportOpen(true)}
            >
              Import from Hugging Face
            </button>
            <small>
              Import a public model only when you need it, so the main simulator stays focused.
            </small>
          </>
        ) : (
          <>
            <div className="hf-import-header-row">
              <strong className="hf-import-heading">Import a public Hugging Face model</strong>
              <button
                className="ghost-button hf-import-toggle"
                type="button"
                onClick={() => setIsHuggingFaceImportOpen(false)}
              >
                {model.huggingFaceRepo ? 'Hide import tools' : 'Collapse'}
              </button>
            </div>
            <input
              id="hf-model-import"
              name="huggingFaceModelImport"
              type="text"
              value={huggingFaceImportInput}
              placeholder="Qwen/Qwen2.5-7B-Instruct or huggingface.co URL"
              onChange={(event) => setHuggingFaceImportInput(event.target.value)}
            />
            <div className="submission-actions">
              <button
                className="ghost-button"
                type="button"
                disabled={huggingFaceImportState.status === 'loading'}
                onClick={() => {
                  importHuggingFaceModel()
                  handleRestart({ collapseMobile: true })
                }}
              >
                {huggingFaceImportState.status === 'loading' ? 'Importing...' : 'Import from Hugging Face'}
              </button>
            </div>
            <small>
              Pull a public model repo into the selector using Hugging Face metadata. Speeds remain
              modeled until a real lap replaces the estimate.
            </small>
            {huggingFaceImportState.message ? (
              <div className={`source-note hf-import-status hf-import-status-${huggingFaceImportState.status}`}>
                {huggingFaceImportState.message}
              </div>
            ) : null}
            {model.huggingFaceRepo ? (
              <>
                <label className="control-group dense">
                  <span>Imported quant / precision</span>
                  <select
                    id="hf-quant-override"
                    name="huggingFaceQuantOverride"
                    value={huggingFaceQuantOverride}
                    onChange={(event) => {
                      setHuggingFaceQuantOverride(event.target.value)
                      handleRestart({ collapseMobile: true })
                    }}
                  >
                    {huggingFaceQuantOptions.map((option) => (
                      <option key={option} value={option === 'Source precision' ? '' : option}>
                        {option === 'Source precision'
                          ? `Source precision (${model.importedSourceQuant ?? model.quant})`
                          : option}
                      </option>
                    ))}
                  </select>
                  <small>
                    Override the imported precision to see how memory fit changes for the same model.
                  </small>
                </label>
                <div className="source-note">
                  Imported repo: {model.huggingFaceRepo} · source precision:{' '}
                  {model.importedSourceQuant ?? model.quant}
                </div>
              </>
            ) : null}
          </>
        )}
      </div>

      <label className="control-group">
        <div className="control-label">
          <span>Workload</span>
          <small>Circuit type</small>
        </div>
        <select
          id="workload-select"
          name="workload"
          value={workloadId}
          onChange={(event) => {
            const nextId = event.target.value
            const nextWorkload = workloadOptions.find((option) => option.id === nextId)
            setWorkloadId(nextId)
            if (nextWorkload) {
              setContextTokens(nextWorkload.promptTokens)
            }
            setIsPromptExpanded(false)
            handleRestart({ collapseMobile: true })
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

      <label className="control-group">
        <span>Context size</span>
        <input
          id="context-size"
          name="contextSize"
          min="0"
          max="128000"
          step="256"
          type="range"
          value={contextTokens}
          onChange={(event) => {
            setContextTokens(Number(event.target.value))
            setIsPromptExpanded(false)
            handleRestart()
          }}
        />
        <div className="slider-meta">
          <strong>{formatTokenCount(contextTokens)} tokens</strong>
          <span>{workload.contextDescriptor}</span>
        </div>
        <div className="slider-scale" aria-hidden="true">
          <span>0</span>
          <span>8k</span>
          <span>32k</span>
          <span>128k</span>
        </div>
        <p>
          Estimated prompt ingest: {formatSeconds(metrics.prefillSeconds)} before TTFT. Slide this to
          see when long-context work starts to feel heavy.
        </p>
      </label>

      {workload.id === 'custom' ? (
        <div className="custom-grid one-up">
          <label className="control-group">
            <span>Response tokens</span>
            <input
              id="custom-response-tokens"
              name="customResponseTokens"
              min="1"
              step="1"
              type="number"
              value={customPreset.responseTokens}
              onChange={(event) => {
                setCustomPreset((current) => ({
                  ...current,
                  responseTokens: Number(event.target.value) || 1,
                }))
                handleRestart()
              }}
            />
          </label>
        </div>
      ) : null}

      {fitAssessment.status !== 'fit' ? (
        <div className={`fit-warning ${fitAssessment.status}`}>
          <strong>
            {fitAssessment.status === 'unfit' ? 'This combo will likely not run' : null}
            {fitAssessment.status === 'tight' ? 'This combo is a tight fit' : null}
            {fitAssessment.status === 'unknown' ? 'Memory fit is unknown' : null}
          </strong>
          <p>{fitAssessment.message}</p>
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
        {sourceExplorerTarget ? (
          <>
            {' '}·{' '}
            <a className="source-note-link" href={sourceExplorerTarget}>
              Inspect benchmark source
            </a>
          </>
        ) : null}
      </div>
      <div className={`run-provenance run-provenance-${coverageTone}`}>
        <div className="run-provenance-header">
          <span className={`run-provenance-badge run-provenance-badge-${coverageTone}`}>
            {coverageLabel}
          </span>
          <strong>
            {coverageTone === 'estimate'
              ? 'This lap is modeled, not measured.'
              : 'This lap includes explicit source provenance.'}
          </strong>
        </div>
        <p>{coverageExplanation}</p>
      </div>
      {fitAssessment.availableGb ? (
        <div className="source-note">
          Estimated memory split: {fitAssessment.weightGb.toFixed(1)} GB weights ·{' '}
          {fitAssessment.kvCacheGb.toFixed(1)} GB context cache ·{' '}
          {fitAssessment.runtimeOverheadGb.toFixed(1)} GB runtime overhead ·{' '}
          {fitAssessment.requiredGb.toFixed(1)} GB total on {fitAssessment.availableGb} GB available
        </div>
      ) : null}
      <div className="source-note">
        Coverage: {Object.keys(benchmarkMatrix).length} hardware tiers in the playback matrix ·{' '}
        {communityBenchmarks.length} community references · {dataSources.length} source groups ·{' '}
        {modelOptions.length} models · community-labeled where appropriate
      </div>
      {isCompactMobile ? (
        <button className="ghost-button mobile-editor-close" type="button" onClick={() => setMobileEditorOpen(false)}>
          Done editing
        </button>
      ) : null}
    </aside>
  )

  const playbackPanel = (
    <div className="playback-panel" ref={playbackRef}>
      <div className="terminal-card">
        <div className="terminal-topbar">
          <div className="playback-heading">
            <span>{workload.name} playback</span>
            <small>{currentPhase}</small>
          </div>
          <div className="playback-actions">
            <ShareSheet
              title={shareTitle}
              text={`${hardware.name} running ${model.name} in LapTime`}
              url={shareUrl}
            />
            <button className="ghost-button" type="button" onClick={() => handleRestart()}>
              Restart
            </button>
          </div>
        </div>

        <div className={`prompt-block ${isPromptExpanded ? 'expanded' : 'collapsed'}`}>
          <div className="prompt-block-header">
            <div>
              <div className="block-label">Prompt</div>
              <div className="prompt-hint">
                {formatTokenCount(workload.promptTokens)} context · {workload.contextDescriptor}
              </div>
            </div>
            <button
              className="ghost-button prompt-toggle"
              type="button"
              onClick={() => setIsPromptExpanded((current) => !current)}
            >
              {isPromptExpanded ? 'Collapse context' : 'Expand context'}
            </button>
          </div>
          <p>{workload.prompt}</p>
          {!isPromptExpanded ? (
            <div className="prompt-fade-hint">
              More context is hidden here. Expand to inspect the longer prompt shape that drives the
              ingest time.
            </div>
          ) : null}
        </div>

        <div className="response-block">
          <div className="block-label">Response Stream</div>
          {fitAssessment.status === 'unfit' ? (
            <div className="memory-bottleneck">
              <strong>Projected memory miss</strong>
              <p>
                LapTime is still simulating the timing here so you can get a feel for the speed profile,
                but this setup is projected to miss memory requirements in a real local run.
              </p>
              <p>
                LapTime estimates {fitAssessment.weightGb.toFixed(1)} GB for weights,{' '}
                {fitAssessment.kvCacheGb.toFixed(1)} GB for context cache, and{' '}
                {fitAssessment.runtimeOverheadGb.toFixed(1)} GB for runtime overhead. That lands at{' '}
                {fitAssessment.requiredGb.toFixed(1)} GB total versus {fitAssessment.availableGb} GB
                available on this hardware.
              </p>
            </div>
          ) : null}
          <p>{streamedText || ' '}</p>
          {isPlaying && elapsedMs >= streamStartMs ? (
            <span className="cursor" aria-hidden="true" />
          ) : null}
        </div>
      </div>

      <div className="timeline-card">
        <div className="timeline-segments" aria-hidden="true">
          <div className="timeline-segment phase-prefill" style={{ width: `${prefillShare}%` }} />
          <div className="timeline-segment phase-ttft" style={{ width: `${ttftShare}%` }} />
          <div className="timeline-segment phase-stream" style={{ width: `${streamShare}%` }} />
          <div className="timeline-progress-overlay" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="timeline-legend">
          <span className="phase-prefill">Prompt ingest</span>
          <span className="phase-ttft">First token</span>
          <span className="phase-stream">Token stream</span>
        </div>
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
        <div className="timeline-caption">
          <span>{currentPhase}</span>
          <span>{metrics.experience}</span>
        </div>
      </div>

      <div className="playback-insight-grid">
        <div className="playback-insight-card playback-insight-card-story">
          <div className="block-label">What This Lap Tells You</div>
          <div className={`playback-feel-pill playback-feel-pill-${experienceTone}`}>{metrics.experience}</div>
          <p>{bottleneckLabel}</p>
          <small>{useCaseLabel}</small>
        </div>
        <div className={`playback-insight-card playback-insight-card-audit playback-insight-card-audit-${coverageTone}`}>
          <div className="block-label">How This Was Derived</div>
          <div className={`run-provenance-badge run-provenance-badge-${coverageTone}`}>
            {coverageLabel}
          </div>
          <p>{coverageExplanation}</p>
          <small>{metrics.source}</small>
        </div>
      </div>
    </div>
  )

  return (
    <section className="simulator-section" id="simulator">
      <SectionHeading
        eyebrow="Simulator"
        title="Run a playback."
      />

      <div className="simulator-layout">
        {isCompactMobile ? (
          <div className="mobile-simulator-stack">
            <div className={`mobile-setup-shell ${mobileEditorOpen ? 'expanded' : ''}`}>
              <div className="mobile-setup-summary">
                <div className="mobile-summary-topline">
                  <div className="mobile-summary-heading">
                    <span className="mobile-summary-kicker">Setup</span>
                    <span className={`fit-inline fit-inline-${fitAssessment.status}`}>
                      {getFitLabel(fitAssessment.status)}
                    </span>
                  </div>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => setMobileEditorOpen((current) => !current)}
                  >
                    {mobileEditorOpen ? 'Hide controls' : 'Edit setup'}
                  </button>
                </div>
                <div className="mobile-summary-grid">
                  <div>
                    <span>Hardware</span>
                    <strong>{hardware.name}</strong>
                  </div>
                  <div>
                    <span>Model</span>
                    <strong>{model.name}</strong>
                  </div>
                </div>
              </div>

              {mobileEditorOpen ? controlPanel : null}
            </div>

            {playbackPanel}
          </div>
        ) : (
          <>
            {controlPanel}
            {playbackPanel}
          </>
        )}
      </div>
    </section>
  )
}

export default SimulatorSection
