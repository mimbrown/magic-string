import { assertStrictEquals } from 'https://deno.land/std@0.127.0/testing/asserts.ts';

export * from 'https://deno.land/std@0.127.0/testing/asserts.ts';

export function assertDeepEquals(a: unknown, b: unknown, msg?: string) {
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set<string | symbol>(Object.keys(a));
    for (const key of Object.keys(b)) {
      keys.add(key);
    }
    for (const key of keys) {
      assertDeepEquals(a[key as keyof typeof a], b[key as keyof typeof b], msg);
    }
  } else {
    assertStrictEquals(a, b, msg);
  }
}
