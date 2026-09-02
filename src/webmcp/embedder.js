/**
 * Who, if anyone, is allowed to call this page's tools from another origin.
 *
 * By default a WebMCP tool is visible only to its own document: `getTools()`
 * returns the tools "exposed to this document", so an app that embeds this page
 * in an iframe discovers nothing at all unless registration opts in with
 * `exposedTo`. Standalone Cambiaro wants exactly that default — the tools are
 * for the agent driving *this* page and nobody else.
 *
 * An embedder announces itself by loading the page with its own origin in a
 * query parameter, and registration then names that one origin. The origin
 * arrives at runtime rather than being baked into a constant on purpose: the
 * embedding app's hostname is its own deployment detail, and a hardcoded
 * allowlist here would need a Cambiaro release every time that changed.
 *
 * Taking the value from the URL does mean any site can frame this page and ask
 * for the grant. That is a deliberate, and cheap, trade: the tools read public
 * ECB rates and move this page's own view, so an attacker gains nothing they
 * could not get by calling api.frankfurter.dev themselves — it is CORS-open.
 * There is no account here, nothing stored, and nothing to spend. What is still
 * worth refusing is a value that is not a real web origin, so the scheme is
 * checked: a `javascript:` or `data:` URL has no business in `exposedTo`.
 */

/** The query parameter an embedder passes its origin in. */
const EMBEDDER_PARAM = 'actuo'

/** Schemes a real embedding page can have. */
const EMBEDDABLE_SCHEMES = new Set(['https:', 'http:'])

/**
 * The embedder origin for this page load, or `null` when standalone.
 *
 * Anything that is not a parseable absolute URL is ignored rather than passed
 * through — `exposedTo` entries must be real origins, and a malformed one would
 * fail the whole `registerTool` call and leave the page with no tools at all.
 */
export function readEmbedderOrigin(search) {
  const query = search ?? (typeof location === 'undefined' ? '' : location.search)
  if (!query) return null

  const raw = new URLSearchParams(query).get(EMBEDDER_PARAM)
  if (!raw) return null

  try {
    const { origin, protocol } = new URL(raw)
    if (!EMBEDDABLE_SCHEMES.has(protocol)) return null
    // `new URL('mailto:x')` parses but has no usable origin.
    return origin && origin !== 'null' ? origin : null
  } catch {
    return null
  }
}

/**
 * The `exposedTo` list to register with — empty when running standalone.
 *
 * Kept separate from {@link readEmbedderOrigin} so the registration path never
 * has to decide what an absent embedder means.
 */
export function exposedOrigins(search) {
  const origin = readEmbedderOrigin(search)
  return origin ? [origin] : []
}
