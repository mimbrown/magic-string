import Chunk from '../../src/Chunk.ts';
import MagicString from '../../mod.ts';
import { assertStrictEquals } from '../assert.ts';

export default class IntegrityCheckingMagicString extends MagicString {
  checkIntegrity() {
    let prevChunk = null;
    let chunk: Chunk | null = this.firstChunk;
    let numNodes = 0;
    while (chunk) {
      assertStrictEquals(this.byStart[chunk.start], chunk);
      assertStrictEquals(this.byEnd[chunk.end], chunk);
      assertStrictEquals(chunk.previous, prevChunk);
      if (prevChunk) {
        assertStrictEquals(prevChunk.next, chunk);
      }
      prevChunk = chunk;
      chunk = chunk.next;
      numNodes++;
    }
    assertStrictEquals(prevChunk, this.lastChunk);
    assertStrictEquals(this.lastChunk.next, null);
    assertStrictEquals(Object.keys(this.byStart).length, numNodes);
    assertStrictEquals(Object.keys(this.byEnd).length, numNodes);
  }
}

for (const key of Reflect.ownKeys(MagicString.prototype)) {
  const func = MagicString.prototype[key as keyof typeof MagicString.prototype];
  if (typeof func === 'function') {
    // deno-lint-ignore no-explicit-any
    (IntegrityCheckingMagicString.prototype as any)[key] = function (this: IntegrityCheckingMagicString) {
      // deno-lint-ignore no-explicit-any
      const result = (func as any).apply(this, arguments);
      try {
        this.checkIntegrity();
      } catch (e) {
        e.message = `Integrity error after invoking ${key as string}:\n${e.message}`;
        throw e;
      }
      return result;
    };
  }
}
