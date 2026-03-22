import SectionHeading from './SectionHeading'

function ComparisonSection({
  hardware,
  model,
  metrics,
  compareHardware,
  compareHardwareId,
  compareHardwareQuery,
  setCompareHardwareQuery,
  visibleCompareHardwareOptions,
  setCompareHardwareId,
  compareModel,
  compareModelId,
  compareModelQuery,
  setCompareModelQuery,
  visibleCompareModelOptions,
  setCompareModelId,
  compareMetrics,
  formatSeconds,
}) {
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
          <div className="compare-subtitle">{model.name}</div>
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
              <input
                type="text"
                value={compareHardwareQuery}
                placeholder="Search hardware"
                onChange={(event) => setCompareHardwareQuery(event.target.value)}
              />
              <select value={compareHardwareId} onChange={(event) => setCompareHardwareId(event.target.value)}>
                {visibleCompareHardwareOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
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
              <select value={compareModelId} onChange={(event) => setCompareModelId(event.target.value)}>
                {visibleCompareModelOptions.map((option) => (
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
          <div className="compare-experience">{compareMetrics.experience}</div>
        </article>
      </div>

      <div className="delta-grid">
        <div className={compareMetrics.decodeTps >= metrics.decodeTps ? 'delta-positive' : 'delta-negative'}>
          <span>Decode delta</span>
          <strong>{(compareMetrics.decodeTps - metrics.decodeTps).toFixed(1)} tok/s</strong>
        </div>
        <div className={compareMetrics.ttftMs <= metrics.ttftMs ? 'delta-positive' : 'delta-negative'}>
          <span>TTFT delta</span>
          <strong>{Math.round(compareMetrics.ttftMs - metrics.ttftMs)} ms</strong>
        </div>
        <div
          className={
            compareMetrics.totalSeconds <= metrics.totalSeconds ? 'delta-positive' : 'delta-negative'
          }
        >
          <span>Total time delta</span>
          <strong>{formatSeconds(compareMetrics.totalSeconds - metrics.totalSeconds)}</strong>
        </div>
      </div>
    </section>
  )
}

export default ComparisonSection
