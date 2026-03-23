function SectionHeading({ eyebrow, title, description, compact = true }) {
  const normalizedTitle = typeof title === 'string' ? title.replace(/\.+$/, '') : title

  return (
    <div className={`section-heading${compact ? ' compact' : ''}`}>
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{normalizedTitle}</h2>
      </div>
      {description ? <p>{description}</p> : null}
    </div>
  )
}

export default SectionHeading
