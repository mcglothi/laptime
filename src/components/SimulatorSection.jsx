import SectionHeading from './SectionHeading'

function SimulatorSection({
  hardware,
  hardwareId,
  hardwareQuery,
  setHardwareQuery,
  visibleHardwareOptions,
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
  workload,
  workloadId,
  workloadOptions,
  setWorkloadId,
  customPreset,
  setCustomPreset,
  metrics,
  benchmarkMatrix,
  communityBenchmarks,
  dataSources,
  modelOptions,
  isPlaying,
  currentPhase,
  restartSimulation,
  streamedText,
  elapsedMs,
  streamStartMs,
  progress,
  formatSeconds,
}) {
  return (
    <section className="simulator-section">
      <SectionHeading
        eyebrow="Simulator"
        title="Run a playback."
        description="Fast to try, easy to compare, and built for real buying decisions."
      />

      <div className="simulator-layout">
        <aside className="control-panel">
          <label className="control-group">
            <span>Hardware</span>
            <input
              type="text"
              value={hardwareQuery}
              placeholder="Search hardware"
              onChange={(event) => setHardwareQuery(event.target.value)}
            />
            <select
              value={hardwareId}
              onChange={(event) => {
                setHardwareId(event.target.value)
                restartSimulation()
              }}
            >
              {visibleHardwareOptions.map((option) => (
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
              type="text"
              value={modelQuery}
              placeholder="Search models"
              onChange={(event) => setModelQuery(event.target.value)}
            />
            <select
              value={modelId}
              onChange={(event) => {
                setModelId(event.target.value)
                restartSimulation()
              }}
            >
              {visibleModelOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} · {option.quant}
                </option>
              ))}
            </select>
            <small>
              {model.family} · {model.quant}
              {model.paramsB ? ` · ${model.paramsB}B` : ''}
            </small>
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
            {communityBenchmarks.length} community references · {dataSources.length} source groups ·{' '}
            {modelOptions.length} models
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
              {isPlaying && elapsedMs >= streamStartMs ? <span className="cursor" aria-hidden="true" /> : null}
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
  )
}

export default SimulatorSection
