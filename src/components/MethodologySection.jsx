import SectionHeading from './SectionHeading'

function MethodologySection({
  exactBenchmarkCount,
  exactHardwareCount,
  sourceBackedCount,
  sourceBackedHardwareCount,
  officialSourceCount,
  catalogSourceCount,
  communityCount,
  forumCount,
  approximateCount,
}) {
  return (
    <section className="methodology-section" id="methodology">
      <SectionHeading
        eyebrow="Method"
        title="How LapTime scores a lap."
        description="LapTime keeps benchmark-backed rows, modeled estimates, and community references separate so buyers can see what is measured, what is inferred, and where each lap comes from."
      />

      <div className="method-grid">
        <article className="method-card">
          <div className="method-kicker">Tier 1</div>
          <h3>Exact benchmark rows drive the closest laps.</h3>
          <p>
            When LapTime has a direct benchmark entry for a hardware and model pairing, it uses
            those published prompt, generation, and first-token values first and points back to
            the source that made the measurement available.
          </p>
          <div className="method-metrics">
            <div>
              <span>Exact benchmark pairs</span>
              <strong>{exactBenchmarkCount}</strong>
            </div>
            <div>
              <span>Benchmark-backed hardware tiers</span>
              <strong>{exactHardwareCount}</strong>
            </div>
          </div>
        </article>

        <article className="method-card">
          <div className="method-kicker">Tier 2</div>
          <h3>Source-backed runtime rows bridge the gaps carefully.</h3>
          <p>
            Some Hugging Face model pages publish hardware-specific runtime measurements without a
            full prompt-throughput and TTFT bundle. LapTime uses those decode measurements when they
            exist, keeps the row labeled separately, and still models prefill plus first-token
            behavior from benchmark-backed baselines instead of pretending the entire lap was
            published.
          </p>
          <div className="method-metrics">
            <div>
              <span>Source-backed runtime rows</span>
              <strong>{sourceBackedCount}</strong>
            </div>
            <div>
              <span>Hardware tiers with source-backed rows</span>
              <strong>{sourceBackedHardwareCount}</strong>
            </div>
          </div>
        </article>

        <article className="method-card">
          <div className="method-kicker">Tier 3</div>
          <h3>Estimates and community references stay labeled.</h3>
          <p>
            If LapTime still has no direct or source-backed row, it falls back to size and quant
            heuristics. Forum posts and roundup articles help widen coverage and sanity-check
            expectations, but they stay labeled separately from authoritative benchmark sources.
          </p>
          <div className="method-metrics">
            <div>
              <span>Official + catalog sources</span>
              <strong>
                {officialSourceCount} / {catalogSourceCount}
              </strong>
            </div>
            <div>
              <span>Community refs: forum / approximate / total</span>
              <strong>
                {forumCount} / {approximateCount} / {communityCount}
              </strong>
            </div>
          </div>
        </article>
      </div>

      <div className="method-principles">
        <article>
          <strong>What LapTime is trying to add</strong>
          <p>
            Buyer feel first: prompt ingest, time to first token, and streamed output matter more
            than a single tokens-per-second headline. The simulator is meant to help people explore
            source data, not replace the people collecting it.
          </p>
        </article>
        <article>
          <strong>What fit means here</strong>
          <p>
            Memory fit is a guardrail based on model size and quantization. It helps catch obvious
            misses, but backend overhead, KV cache growth, and long contexts can still change the
            real outcome.
          </p>
        </article>
        <article>
          <strong>What to audit next</strong>
          <p>
            Use the source explorer below to inspect the links behind the current catalog before you
            trust a buying decision or share a row with someone else.
          </p>
          <a className="source-link" href="#sources">
            Jump to source explorer
          </a>
        </article>
      </div>
    </section>
  )
}

export default MethodologySection
