import { useEffect, useRef, useState } from 'react'
import { useConverter } from '../state/converterContext.js'
import { SUPPORT, detectSupport, registerTool } from './adapter.js'
import { exposedOrigins } from './embedder.js'
import { buildTools } from './toolDefinitions.js'
import { validateInput } from './validate.js'

/**
 * Registers the tool surface for the lifetime of the component.
 *
 * Registration happens once: the handlers read live state through a ref
 * rather than closing over it, so the descriptors keep a stable identity
 * and the page does not churn its tool list on every keystroke.
 */
export function useWebMcpTools() {
  const context = useConverter()
  const contextRef = useRef(context)
  const [support, setSupport] = useState(detectSupport)

  useEffect(() => {
    contextRef.current = context
  })

  // Built once, from a getter — stable identity without memoisation.
  const [tools] = useState(() => {
    const definitions = buildTools(() => contextRef.current)
    return definitions.map((definition) => ({
      ...definition,
      /*
       * `readOnly` is NOT `!mutates`, and conflating them is the obvious wrong
       * move here. `mutates` is this page's own flag for "repaints the
       * converter", which is why it gates the approval prompt. `readOnlyHint`
       * is the spec's, and it means "does not modify its environment" — moving
       * our own view is not that.
       *
       * The split matters most to an embedder. `convertCurrency` repaints the
       * screen *and* answers a question; derived from `mutates` it would
       * announce itself as mutating, and inside, say, an expense app that reads
       * as "this might change my money" — the opposite of true. So the four
       * tools that answer something are read-only, and the three that exist
       * only to move the UI and have no answer to give are not.
       *
       * `untrustedContentHint` is true across the board: every result carries
       * rate data fetched from a third party (the ECB, via Frankfurter). None
       * of it is authored here, so none of it should be treated as trusted text
       * by whatever is reading it.
       */
      annotations: {
        readOnlyHint: definition.readOnly,
        untrustedContentHint: true,
      },
      /** The wrapper every caller goes through: validate, gate, run, log. */
      async execute(rawInput) {
        const live = contextRef.current
        const startedAt = Date.now()
        try {
          const input = validateInput(definition.inputSchema, rawInput)

          if (definition.mutates) {
            const approved = await live.requestApproval(definition.name, input)
            if (!approved) throw new Error('The person using this page declined that action.')
          }

          const structuredContent = await definition.run(input)
          const text = definition.summarize(structuredContent)

          contextRef.current.logToolCall({
            tool: definition.name,
            input,
            summary: text,
            durationMs: Date.now() - startedAt,
          })

          return { content: [{ type: 'text', text }], structuredContent }
        } catch (error) {
          contextRef.current.logToolCall({
            tool: definition.name,
            input: rawInput ?? {},
            error: error.message,
            durationMs: Date.now() - startedAt,
          })
          // Structured failure, not a thrown exception.
          return { isError: true, content: [{ type: 'text', text: error.message }] }
        }
      },
    }))
  })

  useEffect(() => {
    const controller = new AbortController()
    /*
     * Read once per registration pass, not per tool: every tool in a pass must
     * be exposed to the same origin, and re-reading would let a mid-pass
     * navigation split the surface in two.
     */
    const exposedTo = exposedOrigins()

    async function register() {
      try {
        for (const tool of tools) {
          await registerTool(tool, { signal: controller.signal, exposedTo })
        }
      } catch (error) {
        if (error.name !== 'AbortError') setSupport(SUPPORT.UNSUPPORTED)
      }
    }
    register()

    // Aborting unregisters every tool — the dynamic-registration lifecycle.
    return () => controller.abort()
  }, [tools])

  return { tools, support }
}
