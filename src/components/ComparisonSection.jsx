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
  formatSeconds,
}) {
  const comparisonLimited =
    fitAssessment.status === 'unfit' || compareFitAssessment.status === 'unfit'

  return (
    <section className="compare-section">
      <SectionHeading
        eyebrow="Comparison"
        title="Compare two setups."
        description="Use the same workload to see what actually changes between rigs and models."
      />

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
                type="text"
                value={compareHardwareQuery}
                placeholder="Search hardware"
                onChange={(event) => setCompareHardwareQuery(event.target.value)}
              />
              <select value={compareHardwareId} onChange={(event) => setCompareHardwareId(event.target.value)}>
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
                type="text"
                value={compareModelQuery}
                placeholder="Search models"
                onChange={(event) => setCompareModelQuery(event.target.value)}
              />
              <select
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

      {comparisonLimited ? (
        <div className="compare-caveat">
          Memory fit blocks a clean apples-to-apples comparison here. One lane likely will not load the
          selected model normally.
        </div>
      ) : null}

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
