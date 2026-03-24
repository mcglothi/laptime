import { useEffect, useMemo, useRef, useState } from 'react'

function buildMailtoUrl(title, text, url) {
  const subject = encodeURIComponent(title)
  const body = encodeURIComponent(`${text}\n\n${url}`)
  return `mailto:?subject=${subject}&body=${body}`
}

function buildXUrl(text, url) {
  const params = new URLSearchParams({
    text: `${text} ${url}`,
  })
  return `https://twitter.com/intent/tweet?${params.toString()}`
}

function buildRedditUrl(title, url) {
  const params = new URLSearchParams({
    title,
    url,
  })
  return `https://www.reddit.com/submit?${params.toString()}`
}

function ShareSheet({ label = 'Share results', title, text, url }) {
  const [isOpen, setIsOpen] = useState(false)
  const [status, setStatus] = useState('')
  const panelRef = useRef(null)
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const sectionLabel = url.includes('#comparison') ? 'Race view' : 'Playback view'
  const sectionHint = url.includes('#comparison')
    ? 'Drop someone straight into this head-to-head race.'
    : 'Drop someone straight into this exact lap replay.'
  const displayUrl = useMemo(() => {
    if (!url) return ''

    try {
      const parsedUrl = new URL(url)
      return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`
    } catch {
      return url
    }
  }, [url])

  const targets = useMemo(
    () => [
      { label: 'Post to X', href: buildXUrl(text, url) },
      { label: 'Post to Reddit', href: buildRedditUrl(title, url) },
      { label: 'Send email', href: buildMailtoUrl(title, text, url) },
    ],
    [text, title, url],
  )

  useEffect(() => {
    if (!isOpen) return undefined

    function handlePointerDown(event) {
      if (!panelRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setStatus('Link copied')
      window.setTimeout(() => setStatus(''), 1800)
    } catch {
      setStatus('Copy failed')
      window.setTimeout(() => setStatus(''), 1800)
    }
  }

  async function handleNativeShare() {
    if (!canNativeShare) return
    try {
      await navigator.share({ title, text, url })
      setStatus('Shared')
      window.setTimeout(() => setStatus(''), 1800)
      setIsOpen(false)
    } catch {
      setStatus('')
    }
  }

  return (
    <div className={`share-sheet ${isOpen ? 'open' : ''}`} ref={panelRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="ghost-button share-trigger"
        type="button"
        onClick={() => setIsOpen((current) => !current)}
      >
        {label}
      </button>

      {isOpen ? (
        <>
          <button
            aria-hidden="true"
            className="share-sheet-backdrop"
            tabIndex="-1"
            type="button"
            onClick={() => setIsOpen(false)}
          />
          <div className="share-sheet-panel" role="dialog" aria-label={title}>
            <div className="share-sheet-header">
              <div>
                <div className="block-label">Share Results</div>
                <strong>{title}</strong>
              </div>
              <button className="ghost-button share-close" type="button" onClick={() => setIsOpen(false)}>
                Close
              </button>
            </div>

            <div className="share-sheet-hero">
              <div className="share-sheet-mode">
                <span className="share-sheet-badge">{sectionLabel}</span>
                <p>{sectionHint}</p>
              </div>
              <p className="share-sheet-copy">{text}</p>
            </div>

            <div className="share-sheet-section">
              <div className="share-sheet-section-label">Copy or send</div>
              <div className="share-sheet-link-preview">
                <span>Shareable link</span>
                <code>{displayUrl}</code>
              </div>
              <div className="share-sheet-actions">
                <button className="share-action share-action-primary" type="button" onClick={handleCopy}>
                  Copy link
                </button>
                {canNativeShare ? (
                  <button className="share-action" type="button" onClick={handleNativeShare}>
                    Open share sheet
                  </button>
                ) : null}
              </div>
            </div>

            <div className="share-sheet-section">
              <div className="share-sheet-section-label">Post elsewhere</div>
              <div className="share-sheet-targets">
                {targets.map((target) => (
                  <a
                    key={target.label}
                    className="share-target"
                    href={target.href}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {target.label}
                  </a>
                ))}
              </div>
            </div>

            <div className="share-status">
              {status || 'Links preserve the exact hardware, model, workload, and section you are viewing.'}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

export default ShareSheet
