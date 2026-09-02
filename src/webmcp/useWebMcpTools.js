import { useEffect, useRef, useState } from 'react'
import { useConverter } from '../state/converterContext.js'
import { SUPPORT, detectSupport, registerTool } from './adapter.js'
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

    async function register() {
      try {
        for (const tool of tools) {
          await registerTool(tool, { signal: controller.signal })
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
