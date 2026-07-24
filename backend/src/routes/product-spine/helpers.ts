/**
 * UI-level suppression of the 'Product Taxonomy' model component across every
 * product-spine payload (workspace Products board + Products tab). The rows
 * and attribute data stay untouched in the DB — only the API responses that
 * feed the UI omit them.
 */
import type { Prisma } from '@prisma/client';

const HIDDEN_COMPONENT = 'product taxonomy';

/** True for an L5 model-component node that must not surface in the UI. */
export function isHiddenComponent(levelNumber: number, name: string): boolean {
  return levelNumber === 5 && name.trim().toLowerCase() === HIDDEN_COMPONENT;
}

/** Strip the hidden component name from a node's attributes.patterns[].components. */
export function sanitizeAttributes(attributes: Prisma.JsonValue): Prisma.JsonValue {
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) return attributes;
  const a = attributes as Prisma.JsonObject;
  const patterns = a.patterns;
  if (!Array.isArray(patterns)) return attributes;
  return {
    ...a,
    patterns: patterns.map((p) => {
      if (!p || typeof p !== 'object' || Array.isArray(p)) return p;
      const po = p as Prisma.JsonObject;
      if (!Array.isArray(po.components)) return p;
      return {
        ...po,
        components: po.components.filter(
          (c) => !(typeof c === 'string' && c.trim().toLowerCase() === HIDDEN_COMPONENT),
        ),
      };
    }),
  };
}
