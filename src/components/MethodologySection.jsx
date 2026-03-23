import SectionHeading from './SectionHeading'

function MethodologySection({
  exactBenchmarkCount,
  exactHardwareCount,
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
        description="The simulator keeps exact benchmarks, modeled estimates, and community references separate so buyers can tell what is measured versus inferred."
      />

      <div className="method-grid">
        <article className="method-card">
          <div className="method-kicker">Tier 1</div>
          <h3>Exact benchmark rows drive the closest laps.</h3>
          <p>
            When LapTime has a direct benchmark entry for a hardware and model pairing, it uses
            those measured prompt, generation, and first-token values first.
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
          <h3>Estimated laps stay visible as estimates.</h3>
          <p>
            If a pairing has no direct row yet, LapTime scales from benchmark-backed baselines using
            model size, quantization, and memory-fit heuristics instead of pretending the result is
            measured.
          </p>
          <div className="method-metrics">
            <div>
              <span>Official spec sources</span>
              <strong>{officialSourceCount}</strong>
            </div>
            <div>
              <span>Catalog expansion sources</span>
              <strong>{catalogSourceCount}</strong>
            </div>
          </div>
        </article>

        <article className="method-card">
          <div className="method-kicker">Tier 3</div>
          <h3>Community references add texture, not fake certainty.</h3>
          <p>
            Forum posts and roundup articles help widen coverage and sanity-check expectations, but
            they stay labeled separately from the exact benchmark path.
          </p>
          <div className="method-metrics">
            <div>
              <span>Total community references</span>
              <strong>{communityCount}</strong>
            </div>
            <div>
              <span>Forum vs approximate</span>
              <strong>
                {forumCount} / {approximateCount}
              </strong>
            </div>
          </div>
        </article>
      </div>

      <div className="method-principles">
        <article>
          <strong>What the simulator optimizes for</strong>
          <p>
            Buyer feel first: prompt ingest, time to first token, and streamed output matter more
            than a single tokens-per-second headline.
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
            trust a buying decision.
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
