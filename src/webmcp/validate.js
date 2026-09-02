/**
 * A deliberately small JSON Schema checker covering just the keywords the
 * tool descriptors use. Tools must reject bad input with a readable message
 * rather than throwing a raw exception at the agent, and the schema the
 * agent reads is the same object we validate against, so the contract and
 * the enforcement cannot drift.
 */

function describeType(value) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function checkProperty(name, schema, value) {
  const expected = schema.type

  if (expected === 'number' || expected === 'integer') {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return `"${name}" must be a number.`
    }
    if (expected === 'integer' && !Number.isInteger(value)) {
      return `"${name}" must be a whole number.`
    }
    if (schema.minimum !== undefined && value < schema.minimum) {
      return `"${name}" must be ${schema.minimum} or more.`
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      return `"${name}" must be ${schema.maximum} or less.`
    }
    return null
  }

  if (expected === 'string') {
    if (typeof value !== 'string') return `"${name}" must be a string.`
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      return `"${name}" must be at least ${schema.minLength} characters.`
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      return `"${name}" must be at most ${schema.maxLength} characters.`
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      return schema.patternMessage ?? `"${name}" is not in the expected format.`
    }
    if (schema.enum && !schema.enum.includes(value)) {
      return `"${name}" must be one of: ${schema.enum.join(', ')}.`
    }
    return null
  }

  if (expected === 'boolean' && typeof value !== 'boolean') {
    return `"${name}" must be true or false.`
  }

  return null
}

/**
 * Returns the input coerced to a plain object, or throws an Error whose
 * message is safe to hand straight back to the caller.
 */
export function validateInput(schema, input) {
  const value = input ?? {}

  if (describeType(value) !== 'object') {
    throw new Error('Tool input must be an object.')
  }

  for (const name of schema.required ?? []) {
    if (value[name] === undefined || value[name] === null || value[name] === '') {
      throw new Error(`"${name}" is required.`)
    }
  }

  const properties = schema.properties ?? {}
  for (const [name, propertySchema] of Object.entries(properties)) {
    if (value[name] === undefined) continue
    const problem = checkProperty(name, propertySchema, value[name])
    if (problem) throw new Error(problem)
  }

  return value
}

/** Shared fragment: an ISO date, the only date shape the API accepts. */
export const isoDateSchema = {
  type: 'string',
  pattern: '^\\d{4}-\\d{2}-\\d{2}$',
  patternMessage: 'Dates must look like YYYY-MM-DD.',
  description: 'Date in YYYY-MM-DD form.',
}

export const currencyCodeSchema = (description) => ({
  type: 'string',
  minLength: 3,
  maxLength: 3,
  description,
})
