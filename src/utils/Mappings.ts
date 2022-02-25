import type BitSet from '../BitSet.ts';
import type Chunk from '../Chunk.ts';
import type { Location } from './getLocator.ts';
import type { SourceMapLine, SourceMapMappings, SourceMapSegment } from './sourcemapCodec.ts';

export default class Mappings {
  hires?: boolean;
  generatedCodeLine = 0;
  generatedCodeColumn = 0;
  raw: SourceMapMappings = [];
  rawSegments: SourceMapLine;
  pending = null;

  constructor(hires?: boolean) {
    this.hires = hires;

    this.rawSegments = this.raw[this.generatedCodeLine] = [];
  }

  addEdit(sourceIndex: number, content: string, loc: Location, nameIndex: number) {
    if (content.length) {
      const segment: SourceMapSegment = [this.generatedCodeColumn, sourceIndex, loc.line, loc.column];
      if (nameIndex >= 0) {
        segment.push(nameIndex);
      }
      this.rawSegments.push(segment);
    } else if (this.pending) {
      this.rawSegments.push(this.pending);
    }

    this.advance(content);
    this.pending = null;
  }

  addUneditedChunk(sourceIndex: number, chunk: Chunk, original: string, loc: Location, sourcemapLocations: BitSet) {
    let originalCharIndex = chunk.start;
    let first = true;

    while (originalCharIndex < chunk.end) {
      if (this.hires || first || sourcemapLocations.has(originalCharIndex)) {
        this.rawSegments.push([this.generatedCodeColumn, sourceIndex, loc.line, loc.column]);
      }

      if (original[originalCharIndex] === '\n') {
        loc.line += 1;
        loc.column = 0;
        this.generatedCodeLine += 1;
        this.raw[this.generatedCodeLine] = this.rawSegments = [];
        this.generatedCodeColumn = 0;
        first = true;
      } else {
        loc.column += 1;
        this.generatedCodeColumn += 1;
        first = false;
      }

      originalCharIndex += 1;
    }

    this.pending = null;
  }

  advance(str: string) {
    if (!str) return;

    const lines = str.split('\n');

    if (lines.length > 1) {
      for (let i = 0; i < lines.length - 1; i++) {
        this.generatedCodeLine++;
        this.raw[this.generatedCodeLine] = this.rawSegments = [];
      }
      this.generatedCodeColumn = 0;
    }

    this.generatedCodeColumn += lines[lines.length - 1].length;
  }
}
