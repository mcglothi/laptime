import SectionHeading from './SectionHeading'

function getFitLabel(status) {
  if (status === 'unfit') return "Won't fit"
  if (status === 'tight') return 'Tight fit'
  if (status === 'unknown') return 'Unknown fit'
  return 'Fits'
}

function ComparisonSection({
  hardware,
  model,
  metrics,
  fitAssessment,
  compareHardware,
  compareHardwareId,
  compareHardwareQuery,
  setCompareHardwareQuery,
  visibleCompareHardwareOptions,
  hardwarePlatformOptions,
  compareHardwarePlatformFilter,
  setCompareHardwarePlatformFilter,
  setCompareHardwareId,
  compareModel,
  compareModelId,
  compareModelQuery,
  setCompareModelQuery,
  visibleCompareModelOptions,
  setCompareModelId,
  compareMetrics,
  compareFitAssessment,
  elapsedMs,
  restartSimulation,
  formatSeconds,
}) {
  const comparisonLimited =
    fitAssessment.status === 'unfit' || compareFitAssessment.status === 'unfit'
  const laneATotalMs = metrics.totalSeconds * 1000
  const laneBTotalMs = compareMetrics.totalSeconds * 1000
  const laneAProgress = comparisonLimited ? 0 : Math.min(elapsedMs / laneATotalMs, 1)
  const laneBProgress = comparisonLimited ? 0 : Math.min(elapsedMs / laneBTotalMs, 1)
  const laneAPrefillShare = (metrics.prefillSeconds * 1000) / laneATotalMs
  const laneATTFTShare = metrics.ttftMs / laneATotalMs
  const laneBPrefillShare = (compareMetrics.prefillSeconds * 1000) / laneBTotalMs
  const laneBTTFTShare = compareMetrics.ttftMs / laneBTotalMs

  return (
    <section className="compare-section">
      <SectionHeading
        eyebrow="Comparison"
        title="Compare two setups."
        description="Use the same workload to see what actually changes between rigs and models."
      />

      <div className="race-card">
        <div className="race-header">
          <div>
            <div className="metrics-heading">Lap race</div>
            <p>Restart the playback to watch both setups launch, clear TTFT, and race through generation.</p>
          </div>
          <button className="ghost-button" type="button" onClick={restartSimulation}>
            Run the race
          </button>
        </div>

        {comparisonLimited ? (
          <div className="compare-caveat">
            Memory fit blocks a clean apples-to-apples race here. One lane likely will not load the
            selected model normally.
          </div>
        ) : (
          <div className="race-lanes">
            <div className="race-lane">
              <div className="race-lane-head">
                <strong>Lane A</strong>
                <span>{hardware.name}</span>
              </div>
              <div className="race-track">
                <div className="race-phase phase-prefill" style={{ width: `${laneAPrefillShare * 100}%` }} />
                <div className="race-phase phase-ttft" style={{ width: `${laneATTFTShare * 100}%` }} />
                <div
                  className="race-phase phase-stream"
                  style={{ width: `${Math.max(0, 1 - laneAPrefillShare - laneATTFTShare) * 100}%` }}
                />
                <div className="race-marker lane-a" style={{ left: `${laneAProgress * 100}%` }}>
                  A
                </div>
              </div>
              <div className="race-lane-meta">
                <span>{formatSeconds(metrics.totalSeconds)}</span>
                <span>{metrics.experience}</span>
              </div>
            </div>

            <div className="race-lane">
              <div className="race-lane-head">
                <strong>Lane B</strong>
                <span>{compareHardware.name}</span>
              </div>
              <div className="race-track">
                <div className="race-phase phase-prefill" style={{ width: `${laneBPrefillShare * 100}%` }} />
                <div className="race-phase phase-ttft" style={{ width: `${laneBTTFTShare * 100}%` }} />
                <div
                  className="race-phase phase-stream"
                  style={{ width: `${Math.max(0, 1 - laneBPrefillShare - laneBTTFTShare) * 100}%` }}
                />
                <div className="race-marker lane-b" style={{ left: `${laneBProgress * 100}%` }}>
                  B
                </div>
              </div>
              <div className="race-lane-meta">
                <span>{formatSeconds(compareMetrics.totalSeconds)}</span>
                <span>{compareMetrics.experience}</span>
              </div>
            </div>

            <div className="timeline-legend">
              <span className="phase-prefill">
                <i className="timeline-swatch" />
                Engine rev / prompt ingest
              </span>
              <span className="phase-ttft">
                <i className="timeline-swatch" />
                Launch / first token
              </span>
              <span className="phase-stream">
                <i className="timeline-swatch" />
                Top speed / generation
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="compare-grid">
        <article className="compare-card">
          <div className="compare-header">
            <span>Lane A</span>
            <strong>Current run</strong>
          </div>
          <div className="compare-title">{hardware.name}</div>
          <div className="compare-subtitle">
            {hardware.platform} · {model.name}
          </div>
          <div className="metric-list">
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
          {fitAssessment.status !== 'fit' ? (
            <div className={`fit-warning compact ${fitAssessment.status}`}>
              <strong>
                {fitAssessment.status === 'unfit' ? 'Will likely not fit' : 'Tight fit warning'}
              </strong>
              <p>{fitAssessment.message}</p>
            </div>
          ) : null}
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
              <div className="chip-row">
                {hardwarePlatformOptions.map((platform) => (
                  <button
                    key={platform}
                    className={`filter-chip ${compareHardwarePlatformFilter === platform ? 'active' : ''}`}
                    type="button"
                    onClick={() => setCompareHardwarePlatformFilter(platform)}
                  >
                    {platform === 'all' ? 'All platforms' : platform}
                  </button>
                ))}
              </div>
              <input
                id="compare-hardware-search"
                name="compareHardwareSearch"
                type="text"
                value={compareHardwareQuery}
                placeholder="Search hardware"
                onChange={(event) => setCompareHardwareQuery(event.target.value)}
              />
              <select
                id="compare-hardware-select"
                name="compareHardware"
                value={compareHardwareId}
                onChange={(event) => setCompareHardwareId(event.target.value)}
              >
                {visibleCompareHardwareOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.platform} · {option.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="control-group dense">
              <span>Model</span>
              <input
                id="compare-model-search"
                name="compareModelSearch"
                type="text"
                value={compareModelQuery}
                placeholder="Search models"
                onChange={(event) => setCompareModelQuery(event.target.value)}
              />
              <select
                id="compare-model-select"
                name="compareModel"
                className={`select-fit select-fit-${compareFitAssessment.status}`}
                value={compareModelId}
                onChange={(event) => setCompareModelId(event.target.value)}
              >
                {visibleCompareModelOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {getFitLabel(option.fitAssessment.status)} · {option.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="compare-title">{compareHardware.name}</div>
          <div className="compare-subtitle">
            {compareHardware.platform} · {compareModel.name}
          </div>
          <div className={`fit-inline fit-inline-${compareFitAssessment.status}`}>
            {getFitLabel(compareFitAssessment.status)}
          </div>
          <div className="metric-list">
            <div>
              <span>Prefill</span>
              <strong>{compareMetrics.prefillTps.toFixed(0)} tok/s</strong>
            </div>
            <div>
              <span>Decode</span>
              <strong>{compareMetrics.decodeTps.toFixed(1)} tok/s</strong>
            </div>
            <div>
              <span>TTFT</span>
              <strong>{Math.round(compareMetrics.ttftMs)} ms</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{formatSeconds(compareMetrics.totalSeconds)}</strong>
            </div>
          </div>
          {compareFitAssessment.status !== 'fit' ? (
            <div className={`fit-warning compact ${compareFitAssessment.status}`}>
              <strong>
                {compareFitAssessment.status === 'unfit' ? 'Will likely not fit' : 'Tight fit warning'}
              </strong>
              <p>{compareFitAssessment.message}</p>
            </div>
          ) : null}
          <div className="compare-experience">{compareMetrics.experience}</div>
        </article>
      </div>

      <div className="delta-grid">
        <div
          className={
            comparisonLimited
              ? 'delta-neutral'
              : compareMetrics.decodeTps >= metrics.decodeTps
                ? 'delta-positive'
                : 'delta-negative'
          }
        >
          <span>Decode delta</span>
          <strong>
            {comparisonLimited ? 'Blocked by memory fit' : `${(compareMetrics.decodeTps - metrics.decodeTps).toFixed(1)} tok/s`}
          </strong>
        </div>
        <div
          className={
            comparisonLimited
              ? 'delta-neutral'
              : compareMetrics.ttftMs <= metrics.ttftMs
                ? 'delta-positive'
                : 'delta-negative'
          }
        >
          <span>TTFT delta</span>
          <strong>
            {comparisonLimited ? 'Blocked by memory fit' : `${Math.round(compareMetrics.ttftMs - metrics.ttftMs)} ms`}
          </strong>
        </div>
        <div
          className={
            comparisonLimited
              ? 'delta-neutral'
              : compareMetrics.totalSeconds <= metrics.totalSeconds
                ? 'delta-positive'
                : 'delta-negative'
          }
        >
          <span>Total time delta</span>
          <strong>
            {comparisonLimited
              ? 'Blocked by memory fit'
              : formatSeconds(compareMetrics.totalSeconds - metrics.totalSeconds)}
          </strong>
        </div>
      </div>
    </section>
  )
}

export default ComparisonSection
