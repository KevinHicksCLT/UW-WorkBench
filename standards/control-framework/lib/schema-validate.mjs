// schema-validate.mjs — a tiny, zero-dependency JSON-Schema (subset) validator.
//
// Why not ajv? The framework is meant to run anywhere with only Node (v20+) and no
// install step, so the demo stays self-contained. This covers the keywords the
// control / run / registry schemas actually use: type, required, properties,
// additionalProperties:false, enum, pattern, minLength, minItems, minimum, maximum,
// items, oneOf, anyOf, format (lenient). For richer needs, swap in ajv — the schemas
// are standard draft 2020-12.
//
// Usage:
//   import { validate } from './schema-validate.mjs';
//   const { valid, errors } = validate(data, schema);

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const typeOf = (v) => {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (Number.isInteger(v)) return 'integer';
  if (typeof v === 'number') return 'number';
  return typeof v; // string | boolean | object | undefined
};

const typeMatches = (v, t) => {
  if (Array.isArray(t)) return t.some((x) => typeMatches(v, x));
  const actual = typeOf(v);
  if (t === 'number') return actual === 'number' || actual === 'integer';
  if (t === 'object') return isObj(v);
  return actual === t;
};

function check(data, schema, path, errors) {
  if (schema == null || typeof schema !== 'object') return;

  // Combinators
  if (Array.isArray(schema.oneOf)) {
    const ok = schema.oneOf.filter((s) => validate(data, s).valid).length;
    if (ok !== 1) errors.push(`${path}: must match exactly one of oneOf (matched ${ok})`);
  }
  if (Array.isArray(schema.anyOf)) {
    const ok = schema.anyOf.some((s) => validate(data, s).valid);
    if (!ok) errors.push(`${path}: must match at least one of anyOf`);
  }

  // Type
  if (schema.type && !typeMatches(data, schema.type)) {
    errors.push(`${path}: expected type ${JSON.stringify(schema.type)}, got ${typeOf(data)}`);
    return; // further checks are unreliable on a type mismatch
  }

  // enum
  if (schema.enum && !schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(data))) {
    errors.push(`${path}: ${JSON.stringify(data)} not in enum ${JSON.stringify(schema.enum)}`);
  }

  // strings
  if (typeof data === 'string') {
    if (schema.minLength != null && data.length < schema.minLength)
      errors.push(`${path}: shorter than minLength ${schema.minLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(data))
      errors.push(`${path}: does not match pattern ${schema.pattern}`);
  }

  // numbers
  if (typeof data === 'number') {
    if (schema.minimum != null && data < schema.minimum) errors.push(`${path}: less than minimum ${schema.minimum}`);
    if (schema.maximum != null && data > schema.maximum) errors.push(`${path}: greater than maximum ${schema.maximum}`);
  }

  // arrays
  if (Array.isArray(data)) {
    if (schema.minItems != null && data.length < schema.minItems)
      errors.push(`${path}: fewer than minItems ${schema.minItems}`);
    if (schema.items) data.forEach((item, i) => check(item, schema.items, `${path}[${i}]`, errors));
  }

  // objects
  if (isObj(data)) {
    for (const req of schema.required || []) {
      if (!(req in data)) errors.push(`${path}: missing required property "${req}"`);
    }
    const props = schema.properties || {};
    for (const [k, v] of Object.entries(data)) {
      if (props[k]) check(v, props[k], `${path}.${k}`, errors);
      else if (schema.additionalProperties === false)
        errors.push(`${path}: additional property "${k}" not allowed`);
    }
  }
}

export function validate(data, schema) {
  const errors = [];
  check(data, schema, '$', errors);
  return { valid: errors.length === 0, errors };
}
