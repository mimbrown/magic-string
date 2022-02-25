export default class Chunk {
  start: number;
  end: number;
  original: string;

  intro = '';
  outro = '';

  content: string;
  storeName? = false;
  edited = false;

  previous!: Chunk | null;
  next!: Chunk | null;

  constructor(start: number, end: number, content: string) {
    this.start = start;
    this.end = end;
    this.original = content;

    this.content = content;

    // we make these non-enumerable, for sanity while debugging
    Object.defineProperties(this, {
      previous: { writable: true, value: null },
      next:     { writable: true, value: null }
    });
  }

  appendLeft(content: string) {
    this.outro += content;
  }

  appendRight(content: string) {
    this.intro = this.intro + content;
  }

  clone() {
    const chunk = new Chunk(this.start, this.end, this.original);

    chunk.intro = this.intro;
    chunk.outro = this.outro;
    chunk.content = this.content;
    chunk.storeName = this.storeName;
    chunk.edited = this.edited;

    return chunk;
  }

  contains(index: number) {
    return this.start < index && index < this.end;
  }

  eachNext(fn: (chunk: Chunk) => void) {
    // deno-lint-ignore no-this-alias
    let chunk: Chunk | null = this;
    while (chunk) {
      fn(chunk);
      chunk = chunk.next;
    }
  }

  eachPrevious(fn: (chunk: Chunk) => void) {
    // deno-lint-ignore no-this-alias
    let chunk: Chunk | null = this;
    while (chunk) {
      fn(chunk);
      chunk = chunk.previous;
    }
  }

  edit(content: string, storeName?: boolean, contentOnly?: boolean) {
    this.content = content;
    if (!contentOnly) {
      this.intro = '';
      this.outro = '';
    }
    this.storeName = storeName;

    this.edited = true;

    return this;
  }

  prependLeft(content: string) {
    this.outro = content + this.outro;
  }

  prependRight(content: string) {
    this.intro = content + this.intro;
  }

  split(index: number) {
    const sliceIndex = index - this.start;

    const originalBefore = this.original.slice(0, sliceIndex);
    const originalAfter = this.original.slice(sliceIndex);

    this.original = originalBefore;

    const newChunk = new Chunk(index, this.end, originalAfter);
    newChunk.outro = this.outro;
    this.outro = '';

    this.end = index;

    if (this.edited) {
      // TODO is this block necessary?...
      newChunk.edit('', false);
      this.content = '';
    } else {
      this.content = originalBefore;
    }

    newChunk.next = this.next;
    if (newChunk.next) newChunk.next.previous = newChunk;
    newChunk.previous = this;
    this.next = newChunk;

    return newChunk;
  }

  toString() {
    return this.intro + this.content + this.outro;
  }

  trimEnd(rx: RegExp) {
    this.outro = this.outro.replace(rx, '');
    if (this.outro.length) return true;

    const trimmed = this.content.replace(rx, '');

    if (trimmed.length) {
      if (trimmed !== this.content) {
        this.split(this.start + trimmed.length).edit('', undefined, true);
      }
      return true;

    } else {
      this.edit('', undefined, true);

      this.intro = this.intro.replace(rx, '');
      if (this.intro.length) return true;
    }
  }

  trimStart(rx: RegExp) {
    this.intro = this.intro.replace(rx, '');
    if (this.intro.length) return true;

    const trimmed = this.content.replace(rx, '');

    if (trimmed.length) {
      if (trimmed !== this.content) {
        this.split(this.end - trimmed.length);
        this.edit('', undefined, true);
      }
      return true;

    } else {
      this.edit('', undefined, true);

      this.outro = this.outro.replace(rx, '');
      if (this.outro.length) return true;
    }
  }
}
