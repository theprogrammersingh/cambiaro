/**
 * Binds tools to whatever WebMCP surface the browser provides.
 *
 * The spec settled on `document.modelContext`; earlier drafts (and the
 * PRD) used `navigator.modelContext`, and neither exists in a browser
 * without the flag enabled. Rather than degrade to an inert page, an
 * unsupported browser falls back to an internal registry: the tools are
 * still described, listed and callable from the in-app console, so the
 * WebMCP surface stays inspectable and demoable everywhere, and picks up
 * a real agent automatically once the browser ships support.
 */

export const SUPPORT = {
  NATIVE: 'native',
  LEGACY: 'legacy',
  UNSUPPORTED: 'unsupported',
}

export const SUPPORT_LABEL = {
  [SUPPORT.NATIVE]: 'Connected to document.modelContext',
  [SUPPORT.LEGACY]: 'Connected to navigator.modelContext',
  [SUPPORT.UNSUPPORTED]: 'WebMCP not supported in this browser',
}

export function resolveSurface() {
  if (typeof document !== 'undefined' && document.modelContext) {
    return { surface: document.modelContext, support: SUPPORT.NATIVE }
  }
  if (typeof navigator !== 'undefined' && navigator.modelContext) {
    return { surface: navigator.modelContext, support: SUPPORT.LEGACY }
  }
  return { surface: null, support: SUPPORT.UNSUPPORTED }
}

export function detectSupport() {
  return resolveSurface().support
}

/**
 * Register one tool, aborting registration when `signal` fires — the
 * dynamic-registration lifecycle the spec describes.
 * Resolves to true when a real surface accepted the tool.
 *
 * `exposedTo` is what makes a tool reachable from a page that embeds this one.
 * Omitted (or empty) it stays same-origin, which is the standalone default —
 * see `embedder.js`. It is spread in rather than always passed because an empty
 * array is not the same as absent to every implementation, and "no embedder"
 * should register exactly the call this page made before the option existed.
 */
export async function registerTool(tool, { signal, exposedTo }) {
  const { surface } = resolveSurface()
  if (!surface?.registerTool) return false

  const descriptor = {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    execute: tool.execute,
    annotations: tool.annotations,
  }

  if (exposedTo?.length) {
    try {
      await surface.registerTool(descriptor, { signal, exposedTo })
      return true
    } catch (error) {
      /*
       * Not every surface supports cross-origin exposure: the WebMCP polyfill
       * rejects a non-empty `exposedTo` outright with NotSupportedError, and a
       * native implementation can refuse it when the embedding permissions
       * policy withholds the origin.
       *
       * Falling through to a plain registration is the difference between
       * "embedded, but the host cannot see the tools" and "embedded, and the
       * page has no tools at all" — the caller treats a throw here as the
       * browser not supporting WebMCP and drops the whole surface. Degrading to
       * same-origin keeps the converter fully usable by the person looking at
       * it, which is the outcome that matters most.
       */
      if (error?.name === 'AbortError') throw error
    }
  }

  await surface.registerTool(descriptor, { signal })
  return true
}
