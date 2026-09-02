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
 */
export async function registerTool(tool, { signal }) {
  const { surface } = resolveSurface()
  if (!surface?.registerTool) return false

  await surface.registerTool(
    {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      execute: tool.execute,
    },
    { signal },
  )
  return true
}
