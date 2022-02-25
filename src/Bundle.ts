import MagicString, { ExclusionRange, SourceMapOptions } from './MagicString.ts';
import SourceMap from './SourceMap.ts';
import getRelativePath from './utils/getRelativePath.ts';
import getLocator from './utils/getLocator.ts';
import Mappings from './utils/Mappings.ts';

const hasOwnProp = Object.prototype.hasOwnProperty;

export interface BundleOptions {
  intro?: string;
  separator?: string;
}

export interface BundleSource {
  filename?: string;
  separator?: string;
  indentExclusionRanges?: ExclusionRange | ExclusionRange[]
  content: MagicString;
}

export default class Bundle {
	intro: string;
	separator: string;
  sources: BundleSource[] = [];
  uniqueSources: { filename: string, content: string }[] = [];
  uniqueSourceIndexByFilename: Record<string, number> = {};

  constructor(options: BundleOptions = {}) {
    this.intro = options.intro ?? '';
    this.separator = options.separator ?? '\n';
  }

  addSource(source: MagicString | BundleSource): Bundle {
    if (source instanceof MagicString) {
      return this.addSource({
        content: source,
        filename: source.filename,
        separator: this.separator
      });
    }

    (['filename', 'indentExclusionRanges'] as const).forEach(option => {
      // deno-lint-ignore no-explicit-any
      if (!hasOwnProp.call(source, option)) (source as any)[option] = source.content[option];
    });
    
    source.separator ??= this.separator;

    const { filename } = source;
    if (filename) {
      if (!hasOwnProp.call(this.uniqueSourceIndexByFilename, filename)) {
        this.uniqueSourceIndexByFilename[filename] = this.uniqueSources.length;
        this.uniqueSources.push({ filename, content: source.content.original });
      } else {
        const uniqueSource = this.uniqueSources[this.uniqueSourceIndexByFilename[filename]];
        if (source.content.original !== uniqueSource.content) {
          throw new Error(`Illegal source: same filename (${source.filename}), different contents`);
        }
      }
    }

    this.sources.push(source);
    return this;
  }

  append(str: string, options?: { separator?: string }) {
    this.addSource({
      content: new MagicString(str),
      separator: options?.separator ?? '',
    });

    return this;
  }

  clone() {
    const bundle = new Bundle({
      intro: this.intro,
      separator: this.separator,
    });

    this.sources.forEach(source => {
      bundle.addSource({
        filename: source.filename,
        content: source.content.clone(),
        separator: source.separator
      });
    });

    return bundle;
  }

  generateDecodedMap(options: Partial<SourceMapOptions> = {}) {
    const names: string[] = [];
    this.sources.forEach(source => {
      Object.keys(source.content.storedNames).forEach(name => {
        if (!~names.indexOf(name)) names.push(name);
      });
    });

    const mappings = new Mappings(options.hires);

    if (this.intro) {
      mappings.advance(this.intro);
    }

    this.sources.forEach((source, i) => {
      if (i > 0) {
        mappings.advance(this.separator);
      }

      const sourceIndex = source.filename ? this.uniqueSourceIndexByFilename[source.filename] : -1;
      const magicString = source.content;
      const locate = getLocator(magicString.original);

      if (magicString.intro) {
        mappings.advance(magicString.intro);
      }

      magicString.firstChunk.eachNext(chunk => {
        const loc = locate(chunk.start);

        if (chunk.intro.length) mappings.advance(chunk.intro);

        if (source.filename) {
          if (chunk.edited) {
            mappings.addEdit(
              sourceIndex,
              chunk.content,
              loc,
              chunk.storeName ? names.indexOf(chunk.original) : -1
            );
          } else {
            mappings.addUneditedChunk(
              sourceIndex,
              chunk,
              magicString.original,
              loc,
              magicString.sourcemapLocations
            );
          }
        } else {
          mappings.advance(chunk.content);
        }

        if (chunk.outro.length) mappings.advance(chunk.outro);
      });

      if (magicString.outro) {
        mappings.advance(magicString.outro);
      }
    });

    return {
      file: options.file ? options.file.split(/[/\\]/).pop() : null,
      sources: this.uniqueSources.map(source => {
        return options.file ? getRelativePath(options.file, source.filename) : source.filename;
      }),
      sourcesContent: this.uniqueSources.map(source => {
        return options.includeContent ? source.content : null;
      }),
      names,
      mappings: mappings.raw
    };
  }

  generateMap(options?: Partial<SourceMapOptions>) {
    return new SourceMap(this.generateDecodedMap(options));
  }

  getIndentString() {
    const indentStringCounts: Record<string, number> = {};

    this.sources.forEach(source => {
      const indentStr = source.content.indentStr;

      if (indentStr === null) return;

      if (!indentStringCounts[indentStr]) indentStringCounts[indentStr] = 0;
      indentStringCounts[indentStr] += 1;
    });

    return (
      Object.keys(indentStringCounts).sort((a, b) => {
        return indentStringCounts[a] - indentStringCounts[b];
      })[0] || '\t'
    );
  }

  indent(indentStr?: string) {
    indentStr ??= this.getIndentString();

    if (indentStr === '') return this; // noop

    let trailingNewline = !this.intro || this.intro.slice(-1) === '\n';

    this.sources.forEach((source, i) => {
      const separator = source.separator !== undefined ? source.separator : this.separator;
      const indentStart = trailingNewline || (i > 0 && /\r?\n$/.test(separator));

      source.content.indent(indentStr, {
        exclude: source.indentExclusionRanges,
        indentStart //: trailingNewline || /\r?\n$/.test( separator )  //true///\r?\n/.test( separator )
      });

      trailingNewline = source.content.lastChar() === '\n';
    });

    if (this.intro) {
      this.intro =
        indentStr +
        this.intro.replace(/^[^\n]/gm, (match, index) => {
          return index > 0 ? indentStr + match : match;
        });
    }

    return this;
  }

  prepend(str: string) {
    this.intro = str + this.intro;
    return this;
  }

  toString() {
    const body = this.sources
      .map((source, i) => {
        const separator = source.separator !== undefined ? source.separator : this.separator;
        const str = (i > 0 ? separator : '') + source.content.toString();

        return str;
      })
      .join('');

    return this.intro + body;
  }

  isEmpty () {
    if (this.intro.length && this.intro.trim())
      return false;
    if (this.sources.some(source => !source.content.isEmpty()))
      return false;
    return true;
  }

  length() {
    return this.sources.reduce((length, source) => length + source.content.length(), this.intro.length);
  }

  trimLines() {
    return this.trim('[\\r\\n]');
  }

  trim(charType?: string) {
    return this.trimStart(charType).trimEnd(charType);
  }

  trimStart(charType = '\\s') {
    const rx = new RegExp('^' + charType + '+');
    this.intro = this.intro.replace(rx, '');

    if (!this.intro) {
      let source;
      let i = 0;

      do {
        source = this.sources[i++];
        if (!source) {
          break;
        }
      } while (!source.content.trimStartAborted(charType));
    }

    return this;
  }

  trimEnd(charType = '\\s') {
    const rx = new RegExp(charType || '\\s' + '+$');

    let source;
    let i = this.sources.length - 1;

    do {
      source = this.sources[i--];
      if (!source) {
        this.intro = this.intro.replace(rx, '');
        break;
      }
    } while (!source.content.trimEndAborted(charType));

    return this;
  }
}
