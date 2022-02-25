export interface Location {
  line: number;
  column: number;
}

export default function getLocator(source: string) {
  const originalLines = source.split('\n');
  const lineOffsets: number[] = [];

  for (let i = 0, pos = 0; i < originalLines.length; i++) {
    lineOffsets.push(pos);
    pos += originalLines[i].length + 1;
  }

  return function locate(index: number) {
    let i = 0;
    let j = lineOffsets.length;
    while (i < j) {
      const m = (i + j) >> 1;
      if (index < lineOffsets[m]) {
        j = m;
      } else {
        i = m + 1;
      }
    }
    const line = i - 1;
    const column = index - lineOffsets[line];
    return { line, column };
  };
}
