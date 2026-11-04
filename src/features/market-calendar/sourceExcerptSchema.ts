import { DateTime } from 'luxon'
import contract from './source-excerpts.schema.json' with { type: 'json' }

interface Schema {
  $schema?: string; title?: string; type?: string; const?: unknown; enum?: unknown[]
  required?: string[]; additionalProperties?: boolean; properties?: Record<string, Schema>
  items?: Schema; minItems?: number; maxItems?: number
  minLength?: number; maxLength?: number; pattern?: string; format?: string
}
const supported = new Set(['$schema', 'title', 'type', 'const', 'enum', 'required', 'additionalProperties', 'properties', 'items', 'minItems', 'maxItems', 'minLength', 'maxLength', 'pattern', 'format'])
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
function dateTime(value: string) {
  // RFC3339 clock/offset syntax plus a real calendar date, not Date.parse rollover.
  const match = /^(\d{4})-(\d{2})-(\d{2})[tT](?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:[zZ]|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value)
  return Boolean(match && Number(match[1]) > 0 && DateTime.fromObject({ year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }, { zone: 'UTC' }).isValid)
}
function accepts(value: unknown, schema: Schema): boolean {
  // This evaluator supports exactly the checked-in contract's keywords. New
  // validation keywords fail closed instead of silently losing constraints.
  if (Object.keys(schema).some(key => !supported.has(key))) return false
  if ('const' in schema && value !== schema.const) return false
  if (schema.enum && !schema.enum.includes(value)) return false
  if (schema.type === 'object') {
    if (!object(value) || schema.required?.some(key => !Object.hasOwn(value, key))) return false
    if (schema.additionalProperties === false && Object.keys(value).some(key => !Object.hasOwn(schema.properties ?? {}, key))) return false
    return Object.entries(schema.properties ?? {}).every(([key, child]) => !Object.hasOwn(value, key) || accepts(value[key], child))
  }
  if (schema.type === 'array') {
    return Array.isArray(value) && value.length >= (schema.minItems ?? 0) && value.length <= (schema.maxItems ?? Infinity) &&
      Boolean(schema.items) && value.every(item => accepts(item, schema.items!))
  }
  if (schema.type === 'string') {
    if (typeof value !== 'string') return false
    const length = [...value].length
    return length >= (schema.minLength ?? 0) && length <= (schema.maxLength ?? Infinity) &&
      (!schema.pattern || new RegExp(schema.pattern, 'u').test(value)) &&
      (!schema.format || schema.format === 'date-time' && dateTime(value))
  }
  return schema.type === undefined
}
export function matchesSourceExcerptSchema(value: unknown) {
  return accepts(value, contract as Schema)
}
