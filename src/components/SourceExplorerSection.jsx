import SectionHeading from './SectionHeading'

function SourceExplorerSection({
  sourceQuery,
  setSourceQuery,
  communityFilter,
  setCommunityFilter,
  filteredStructuredSources,
  filteredCommunityBenchmarks,
}) {
  return (
    <section className="source-section">
      <SectionHeading
        eyebrow="Sources"
        title="Source explorer."
        description="Exact simulator math uses structured benchmark entries first, with community data kept separate."
      />

      <div className="explorer-controls">
        <label className="control-group dense">
          <span>Search</span>
          <input
            id="source-search"
            name="sourceSearch"
            type="text"
            value={sourceQuery}
            placeholder="Search hardware, model, or source"
            onChange={(event) => setSourceQuery(event.target.value)}
          />
        </label>
        <label className="control-group dense">
          <span>Community filter</span>
          <select
            id="community-filter"
            name="communityFilter"
            value={communityFilter}
            onChange={(event) => setCommunityFilter(event.target.value)}
          >
            <option value="all">All qualities</option>
            <option value="forum">Forum</option>
            <option value="approximate">Approximate</option>
          </select>
        </label>
      </div>

      <div className="source-grid">
        <div className="source-card">
          <div className="metrics-heading">Structured sources · {filteredStructuredSources.length}</div>
          <div className="source-list">
            {filteredStructuredSources.map((source) => (
              <article key={source.name}>
                <div className="source-name-row">
                  <strong>{source.name}</strong>
                  <span className="source-type-pill">{source.type}</span>
                </div>
                <p>{source.notes}</p>
                <a className="source-link" href={source.url} target="_blank" rel="noreferrer">
                  {source.url}
                </a>
              </article>
            ))}
            {filteredStructuredSources.length === 0 ? (
              <div className="empty-state">No structured sources match that search yet.</div>
            ) : null}
          </div>
        </div>

        <div className="source-card">
          <div className="metrics-heading">Community references · {filteredCommunityBenchmarks.length}</div>
          <div className="community-table">
            {filteredCommunityBenchmarks.map((entry) => (
              <article key={`${entry.hardware}-${entry.model}-${entry.metric}`}>
                <div className="source-name-row">
                  <strong>{entry.hardware}</strong>
                  <span className="source-type-pill">{entry.quality}</span>
                </div>
                <p>{entry.model}</p>
                <p className="community-value">
                  {entry.metric === 'decode_tps_range'
                    ? `${entry.value[0]}-${entry.value[1]} tok/s decode`
                    : `${entry.value} tok/s decode`}
                </p>
                <a className="source-link" href={entry.url} target="_blank" rel="noreferrer">
                  {entry.source}
                </a>
              </article>
            ))}
            {filteredCommunityBenchmarks.length === 0 ? (
              <div className="empty-state">No community references match that filter.</div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

export default SourceExplorerSection
