import BitSet from './BitSet.ts';
import Chunk from './Chunk.ts';
import SourceMap, { SourceMapProperties } from './SourceMap.ts';
// import guessIndent from './utils/guessIndent.js';
import getRelativePath from './utils/getRelativePath.ts';
import getLocator from './utils/getLocator.ts';
import Mappings from './utils/Mappings.ts';
import { SourceMapMappings } from './utils/sourcemapCodec.ts';
import guessIndent from './utils/guessIndent.ts';

const n = '\n';

interface Options {
  filename?: string;
  indentExclusionRanges?: ExclusionRange | Array<ExclusionRange>;
}

export type ExclusionRange = [number, number];

export interface SourceMapOptions {
  hires?: boolean;
  file?: string;
  source?: string;
  includeContent?: boolean;
}

export interface IndentOptions {
  exclude?: ExclusionRange | Array<ExclusionRange>;
  indentStart?: boolean;
}

export interface OverwriteOptions {
  storeName?: boolean;
  contentOnly?: boolean;
}

interface ChunkMap {
  [key: string | number]: Chunk;
}

export default class MagicString {
  original: string;
  outro = '';
  intro = '';
  firstChunk: Chunk;
  lastChunk: Chunk;
  lastSearchedChunk: Chunk;
  byStart: ChunkMap = {};
  byEnd: ChunkMap = {};
  filename?: string;
  indentExclusionRanges?: ExclusionRange | Array<ExclusionRange>;
  sourcemapLocations: BitSet = new BitSet();
  storedNames: Record<string, boolean> = {};
  indentStr: string | null;

  constructor(string: string, options: Options = {}) {
    const chunk = new Chunk(0, string.length, string);

    this.original = string;

    this.firstChunk = chunk;
    this.lastChunk = chunk;
    this.lastSearchedChunk = chunk;

    this.byStart[0] = chunk;
    this.byEnd[string.length] = chunk;

    this.filename = options.filename;
    this.indentExclusionRanges = options.indentExclusionRanges;

    this.indentStr = guessIndent(string);
  }

  /**
   * Adds the specified character index (with respect to the original string) to sourcemap mappings,
   * if `hires` is `false` (see below).
   */
  addSourcemapLocation(char: number) {
    this.sourcemapLocations.add(char);
  }

  /** Appends the specified `content` to the end of the string. */
  append(content: string) {
    this.outro += content;
    return this;
  }

  /**
   * Appends the specified `content` at the `index` in the original string.
   * If a range *ending* with `index` is subsequently moved, the insert will
   * be moved with it. See also {@link prependLeft}.
   */
  appendLeft(index: number, content: string) {
    this._split(index);

    const chunk = this.byEnd[index];

    if (chunk) {
      chunk.appendLeft(content);
    } else {
      this.intro += content;
    }

    return this;
  }

  /**
   * Appends the specified `content` at the `index` in the original string.
   * If a range *starting* with `index` is subsequently moved, the insert will
   * be moved with it. See also {@link prependRight}.
   */
  appendRight(index: number, content: string) {
    this._split(index);

    const chunk = this.byStart[index];

    if (chunk) {
      chunk.appendRight(content);
    } else {
      this.outro += content;
    }

    return this;
  }

  /** Does what you'd expect. */
  clone() {
    const cloned = new MagicString(this.original, { filename: this.filename });

    let originalChunk: Chunk | null = this.firstChunk;
    let clonedChunk = (cloned.firstChunk = cloned.lastSearchedChunk = originalChunk.clone());

    while (originalChunk) {
      cloned.byStart[clonedChunk.start] = clonedChunk;
      cloned.byEnd[clonedChunk.end] = clonedChunk;

      const nextOriginalChunk: Chunk | null = originalChunk.next;
      const nextClonedChunk = nextOriginalChunk && nextOriginalChunk.clone();

      if (nextClonedChunk) {
        clonedChunk.next = nextClonedChunk;
        nextClonedChunk.previous = clonedChunk;

        clonedChunk = nextClonedChunk;
      }

      originalChunk = nextOriginalChunk;
    }

    cloned.lastChunk = clonedChunk;

    if (this.indentExclusionRanges) {
      cloned.indentExclusionRanges = this.indentExclusionRanges.slice() as ExclusionRange | ExclusionRange[];
    }

    cloned.sourcemapLocations = new BitSet(this.sourcemapLocations);

    cloned.intro = this.intro;
    cloned.outro = this.outro;

    return cloned;
  }

  /**
   * Generates a sourcemap object with raw mappings in array form,
   * rather than encoded as a string. See {@link generateMap} documentation
   * below for options details. Useful if you need to manipulate the
   * sourcemap further, but most of the time you will use `generateMap`
   * instead.
   */
  generateDecodedMap(options: SourceMapOptions = {}): SourceMapProperties {
    const sourceIndex = 0;
    const names = Object.keys(this.storedNames);
    const mappings = new Mappings(options.hires);

    const locate = getLocator(this.original);

    if (this.intro) {
      mappings.advance(this.intro);
    }

    this.firstChunk.eachNext(chunk => {
      const loc = locate(chunk.start);

      if (chunk.intro.length) mappings.advance(chunk.intro);

      if (chunk.edited) {
        mappings.addEdit(
          sourceIndex,
          chunk.content,
          loc,
          chunk.storeName ? names.indexOf(chunk.original) : -1
        );
      } else {
        mappings.addUneditedChunk(sourceIndex, chunk, this.original, loc, this.sourcemapLocations);
      }

      if (chunk.outro.length) mappings.advance(chunk.outro);
    });

    return {
      file: options.file ? options.file.split(/[/\\]/).pop() : null,
      sources: [options.source ? getRelativePath(options.file || '', options.source) : null],
      sourcesContent: options.includeContent ? [this.original] : [null],
      names,
      mappings: mappings.raw as unknown as SourceMapMappings,
    };
  }

  /**
   * Generates a [version 3 sourcemap](https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit).
   * All options are, well, optional:
   * * `file` - the filename where you plan to write the sourcemap
   * * `source` - the filename of the file containing the original source
   * * `includeContent` - whether to include the original content in the map's `sourcesContent` array
   * * `hires` - whether the mapping should be high-resolution.
   *   Hi-res mappings map every single character, meaning (for example)
   *   your devtools will always be able to pinpoint the exact location
   *   of function calls and so on. With lo-res mappings, devtools may
   *   only be able to identify the correct line - but they're quicker
   *   to generate and less bulky. If sourcemap locations have been
   *   specified with {@link addSourceMapLocation}, they will be used here.
   * 
   * The returned sourcemap has two (non-enumerable) methods attached for convenience:
   * * `toString` - returns the equivalent of `JSON.stringify(map)`
   * * `toUrl` - returns a DataURI containing the sourcemap. Useful for doing this sort of thing:
   * 
   *   ```js
   *   code += '\n//# sourceMappingURL=' + map.toUrl();
   *   ```
   */
  generateMap(options?: SourceMapOptions) {
    return new SourceMap(this.generateDecodedMap(options));
  }

  getIndentString() {
    return this.indentStr ?? '\t';
  }

  /**
   * Prefixes each line of the string with `prefix`. If `prefix` is not supplied,
   * the indentation will be guessed from the original content, falling back
   * to a single tab character.
   * 
   * The `options` argument can have an `exclude` property, which is an array of
   * `[start, end]` character ranges. These ranges will be excluded from the
   * indentation - useful for (e.g.) multiline strings.
   */
  indent(indentStr?: string, options?: IndentOptions): MagicString;
  indent(options?: IndentOptions): MagicString;
  indent(indentStr?: string | IndentOptions, options?: IndentOptions) {
    const pattern = /^[^\r\n]/gm;

    if (indentStr && typeof indentStr === 'object') {
      options = indentStr;
      indentStr = undefined;
    }

    indentStr ??= '\t';

    if (indentStr === '') return this; // noop

    options ??= {};

    // Process exclusion ranges
    const isExcluded: Record<number, boolean> = {};

    if (options.exclude) {
      const exclusions =
        (typeof options.exclude[0] === 'number' ? [options.exclude] : options.exclude) as ExclusionRange[];
      exclusions.forEach(exclusion => {
        for (let i = exclusion[0]; i < exclusion[1]; i += 1) {
          isExcluded[i] = true;
        }
      });
    }

    let shouldIndentNextCharacter = options.indentStart !== false;
    const replacer = (match: string) => {
      if (shouldIndentNextCharacter) return `${indentStr}${match}`;
      shouldIndentNextCharacter = true;
      return match;
    };

    this.intro = this.intro.replace(pattern, replacer);

    let charIndex = 0;
    let chunk: Chunk | null = this.firstChunk;

    while (chunk) {
      const end = chunk.end;

      if (chunk.edited) {
        if (!isExcluded[charIndex]) {
          chunk.content = chunk.content.replace(pattern, replacer);

          if (chunk.content.length) {
            shouldIndentNextCharacter = chunk.content[chunk.content.length - 1] === '\n';
          }
        }
      } else {
        charIndex = chunk.start;

        while (charIndex < end) {
          if (!isExcluded[charIndex]) {
            const char = this.original[charIndex];

            if (char === '\n') {
              shouldIndentNextCharacter = true;
            } else if (char !== '\r' && shouldIndentNextCharacter) {
              shouldIndentNextCharacter = false;

              if (charIndex === chunk!.start) {
                chunk!.prependRight(indentStr);
              } else {
                this._splitChunk(chunk!, charIndex);
                chunk = chunk!.next;
                chunk!.prependRight(indentStr);
              }
            }
          }

          charIndex += 1;
        }
      }

      charIndex = chunk!.end;
      chunk = chunk!.next;
    }

    this.outro = this.outro.replace(pattern, replacer);

    return this;
  }

  /** Moves the characters from `start` and `end` to `index`. */
  move(start: number, end: number, index: number) {
    if (index >= start && index <= end) throw new Error('Cannot move a selection inside itself');

    this._split(start);
    this._split(end);
    this._split(index);

    const first = this.byStart[start];
    const last = this.byEnd[end];

    const oldLeft = first.previous;
    const oldRight = last.next;

    const newRight = this.byStart[index];
    if (!newRight && last === this.lastChunk) return this;
    const newLeft = newRight ? newRight.previous : this.lastChunk;

    if (oldLeft) oldLeft.next = oldRight;
    if (oldRight) oldRight.previous = oldLeft;

    if (newLeft) newLeft.next = first;
    if (newRight) newRight.previous = last;

    if (!first.previous) this.firstChunk = last.next!;
    if (!last.next) {
      this.lastChunk = first.previous!;
      this.lastChunk.next = null;
    }

    first.previous = newLeft;
    last.next = newRight || null;

    if (!newLeft) this.firstChunk = first;
    if (!newRight) this.lastChunk = last;

    return this;
  }

  /**
   * Replaces the characters from `start` to `end` with `content`.
   * The same restrictions as {@link remove} apply.
   * 
   * The fourth argument is optional. It can have a `storeName`
   * property — if `true`, the original name will be stored for
   * later inclusion in a sourcemap's `names` array — and a
   * `contentOnly` property which determines whether only the
   * content is overwritten, or anything that was appended/prepended
   * to the range as well.
   */
  overwrite(start: number, end: number, content: string, options?: OverwriteOptions) {
    while (start < 0) start += this.original.length;
    while (end < 0) end += this.original.length;

    if (end > this.original.length) throw new Error('end is out of bounds');
    if (start === end)
      throw new Error('Cannot overwrite a zero-length range – use appendLeft or prependRight instead');

    this._split(start);
    this._split(end);

    const storeName = options !== undefined ? options.storeName : false;
    const contentOnly = options !== undefined ? options.contentOnly : false;

    if (storeName) {
      const original = this.original.slice(start, end);
      this.storedNames[original] = true;
    }

    const first = this.byStart[start];
    const last = this.byEnd[end];

    if (first) {
      if (end > first.end && first.next !== this.byStart[first.end]) {
        throw new Error('Cannot overwrite across a split point');
      }

      first.edit(content, storeName, contentOnly);

      if (first !== last) {
        let chunk = first.next;
        while (chunk !== last) {
          chunk!.edit('', false);
          chunk = chunk!.next;
        }

        chunk.edit('', false);
      }
    } else {
      // must be inserting at the end
      const newChunk = new Chunk(start, end, '').edit(content, storeName);

      // TODO last chunk in the array may not be the last chunk, if it's moved...
      last.next = newChunk;
      newChunk.previous = last;
    }

    return this;
  }

  /** Prepends the string with the specified content. */
  prepend(content: string) {
    this.intro = content + this.intro;
    return this;
  }

  /**
   * Same as {@link appendLeft}, except that the inserted `content`
   * will go *before* any previous appends or prepends at `index`.
   */
  prependLeft(index: number, content: string) {
    this._split(index);

    const chunk = this.byEnd[index];

    if (chunk) {
      chunk.prependLeft(content);
    } else {
      this.intro = content + this.intro;
    }

    return this;
  }

  /**
   * Same as {@link appendRight}, except that the inserted `content`
   * will go *before* any previous appends or prepends at `index`.
   */
  prependRight(index: number, content: string) {
    this._split(index);

    const chunk = this.byStart[index];

    if (chunk) {
      chunk.prependRight(content);
    } else {
      this.outro = content + this.outro;
    }

    return this;
  }

  /**
   * Removes the characters from `start` to `end` (of the original
   * string, **not** the generated string). Removing the same content
   * twice, or making removals that partially overlap, will cause
   * an error.
   */
  remove(start: number, end: number) {
    while (start < 0) start += this.original.length;
    while (end < 0) end += this.original.length;

    if (start === end) return this;

    if (start < 0 || end > this.original.length) throw new Error('Character is out of bounds');
    if (start > end) throw new Error('end must be greater than start');

    this._split(start);
    this._split(end);

    let chunk: Chunk | null = this.byStart[start];

    while (chunk) {
      chunk.intro = '';
      chunk.outro = '';
      chunk.edit('');

      chunk = end > chunk.end ? this.byStart[chunk.end] : null;
    }

    return this;
  }

  lastChar() {
    if (this.outro.length)
      return this.outro[this.outro.length - 1];
    let chunk: Chunk | null = this.lastChunk;
    do {
      if (chunk.outro.length)
        return chunk.outro[chunk.outro.length - 1];
      if (chunk.content.length)
        return chunk.content[chunk.content.length - 1];
      if (chunk.intro.length)
        return chunk.intro[chunk.intro.length - 1];
    // deno-lint-ignore no-cond-assign
    } while (chunk = chunk.previous);
    if (this.intro.length)
      return this.intro[this.intro.length - 1];
    return '';
  }

  lastLine() {
    let lineIndex = this.outro.lastIndexOf(n);
    if (lineIndex !== -1)
      return this.outro.substr(lineIndex + 1);
    let lineStr = this.outro;
    let chunk: Chunk | null = this.lastChunk;
    do {
      if (chunk.outro.length > 0) {
        lineIndex = chunk.outro.lastIndexOf(n);
        if (lineIndex !== -1)
          return chunk.outro.substr(lineIndex + 1) + lineStr;
        lineStr = chunk.outro + lineStr;
      }

      if (chunk.content.length > 0) {
        lineIndex = chunk.content.lastIndexOf(n);
        if (lineIndex !== -1)
          return chunk.content.substr(lineIndex + 1) + lineStr;
        lineStr = chunk.content + lineStr;
      }

      if (chunk.intro.length > 0) {
        lineIndex = chunk.intro.lastIndexOf(n);
        if (lineIndex !== -1)
          return chunk.intro.substr(lineIndex + 1) + lineStr;
        lineStr = chunk.intro + lineStr;
      }
    // deno-lint-ignore no-cond-assign
    } while (chunk = chunk.previous);
    lineIndex = this.intro.lastIndexOf(n);
    if (lineIndex !== -1)
      return this.intro.substr(lineIndex + 1) + lineStr;
    return this.intro + lineStr;
  }

  /**
   * Returns the content of the generated string that
   * corresponds to the slice between `start` and `end` of
   * the original string. Throws error if the indices
   * are for characters that were already removed.
   */
  slice(start = 0, end = this.original.length) {
    while (start < 0) start += this.original.length;
    while (end < 0) end += this.original.length;

    let result = '';

    // find start chunk
    let chunk: Chunk | null = this.firstChunk;
    while (chunk && (chunk.start > start || chunk.end <= start)) {
      // found end chunk before start
      if (chunk.start < end && chunk.end >= end) {
        return result;
      }

      chunk = chunk.next;
    }

    if (chunk && chunk.edited && chunk.start !== start)
      throw new Error(`Cannot use replaced character ${start} as slice start anchor.`);

    const startChunk = chunk;
    while (chunk) {
      if (chunk.intro && (startChunk !== chunk || chunk.start === start)) {
        result += chunk.intro;
      }

      const containsEnd = chunk.start < end && chunk.end >= end;
      if (containsEnd && chunk.edited && chunk.end !== end)
        throw new Error(`Cannot use replaced character ${end} as slice end anchor.`);

      const sliceStart = startChunk === chunk ? start - chunk.start : 0;
      const sliceEnd = containsEnd ? chunk.content.length + end - chunk.end : chunk.content.length;

      result += chunk.content.slice(sliceStart, sliceEnd);

      if (chunk.outro && (!containsEnd || chunk.end === end)) {
        result += chunk.outro;
      }

      if (containsEnd) {
        break;
      }

      chunk = chunk.next;
    }

    return result;
  }

  // TODO deprecate this? not really very useful
  /**
   * Returns a clone of `this`, with all content before
   * the `start` and `end` characters of the original string
   * removed.
   */
  snip(start: number, end: number) {
    const clone = this.clone();
    clone.remove(0, start);
    clone.remove(end, clone.original.length);

    return clone;
  }

  _split(index: number) {
    if (this.byStart[index] || this.byEnd[index]) return;

    let chunk = this.lastSearchedChunk;
    const searchForward = index > chunk.end;

    while (chunk) {
      if (chunk.contains(index)) return this._splitChunk(chunk, index);

      chunk = searchForward ? this.byStart[chunk.end] : this.byEnd[chunk.start];
    }
  }

  _splitChunk(chunk: Chunk, index: number) {
    if (chunk.edited && chunk.content.length) {
      // zero-length edited chunks are a special case (overlapping replacements)
      const loc = getLocator(this.original)(index);
      throw new Error(
        `Cannot split a chunk that has already been edited (${loc.line}:${loc.column} – "${
          chunk.original
        }")`
      );
    }

    const newChunk = chunk.split(index);

    this.byEnd[index] = chunk;
    this.byStart[index] = newChunk;
    this.byEnd[newChunk.end] = newChunk;

    if (chunk === this.lastChunk) this.lastChunk = newChunk;

    this.lastSearchedChunk = chunk;
    return true;
  }

  /** Returns the generated string. */
  toString() {
    let str = this.intro;

    let chunk: Chunk | null = this.firstChunk;
    while (chunk) {
      str += chunk.toString();
      chunk = chunk.next;
    }

    return str + this.outro;
  }

  /** Returns `true` if the resulting source is empty (disregarding white space). */
  isEmpty() {
    let chunk: Chunk | null = this.firstChunk;
    do {
      if (chunk.intro.length && chunk.intro.trim() ||
          chunk.content.length && chunk.content.trim() ||
          chunk.outro.length && chunk.outro.trim())
        return false;
    // deno-lint-ignore no-cond-assign
    } while (chunk = chunk.next);
    return true;
  }

  length() {
    let chunk: Chunk | null = this.firstChunk;
    let length = 0;
    do {
      length += chunk.intro.length + chunk.content.length + chunk.outro.length;
    // deno-lint-ignore no-cond-assign
    } while (chunk = chunk.next);
    return length;
  }

  /** Removes empty lines from the start and end. */
  trimLines() {
    return this.trim('[\\r\\n]');
  }

  /**
   * Trims content matching `charType` (defaults to `\s`, i.e.
   * whitespace) from the `start` and `end`.
   */
  trim(charType?: string) {
    return this.trimStart(charType).trimEnd(charType);
  }

  trimEndAborted(charType = '\\s') {
    const rx = new RegExp(charType + '+$');

    this.outro = this.outro.replace(rx, '');
    if (this.outro.length) return true;

    let chunk: Chunk | null = this.lastChunk;

    do {
      const end = chunk.end;
      const aborted = chunk.trimEnd(rx);

      // if chunk was trimmed, we have a new lastChunk
      if (chunk.end !== end) {
        if (this.lastChunk === chunk) {
          this.lastChunk = chunk.next!;
        }

        this.byEnd[chunk.end] = chunk;
        this.byStart[chunk.next!.start] = chunk.next!;
        this.byEnd[chunk.next!.end] = chunk.next!;
      }

      if (aborted) return true;
      chunk = chunk.previous;
    } while (chunk);

    return false;
  }

  /**
   * Trims content matching `charType` (defaults to `\s`, i.e.
   * whitespace) from the end.
   */
  trimEnd(charType?: string) {
    this.trimEndAborted(charType);
    return this;
  }
  trimStartAborted(charType = '\\s') {
    const rx = new RegExp('^' + charType + '+');

    this.intro = this.intro.replace(rx, '');
    if (this.intro.length) return true;

    let chunk: Chunk | null = this.firstChunk;

    do {
      const end = chunk.end;
      const aborted = chunk.trimStart(rx);

      if (chunk.end !== end) {
        // special case...
        if (chunk === this.lastChunk) this.lastChunk = chunk.next!;

        this.byEnd[chunk.end] = chunk;
        this.byStart[chunk.next!.start] = chunk.next!;
        this.byEnd[chunk.next!.end] = chunk.next!;
      }

      if (aborted) return true;
      chunk = chunk.next;
    } while (chunk);

    return false;
  }

  /**
   * Trims content matching `charType` (defaults to `\s`, i.e.
   * whitespace) from the start.
   */
  trimStart(charType?: string) {
    this.trimStartAborted(charType);
    return this;
  }
}
