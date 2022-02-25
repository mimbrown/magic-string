import { assertDeepEquals, assertEquals, assertStrictEquals } from './assert.ts';
import { SourceMapConsumer, BasicSourceMapConsumer } from './consumer.ts';
import MagicString, { Bundle } from '../mod.ts';
import { ExclusionRange } from "../src/MagicString.ts";

Deno.test('Bundle', async (t) => {
  await t.step('addSource', async (t) => {
    await t.step('should return this', () => {
      const b = new Bundle();
      const source = new MagicString('abcdefghijkl');

      assertStrictEquals(b.addSource({ content: source }), b);
    });

    await t.step('should accept MagicString instance as a single argument', () => {
      const b = new Bundle();
      const array: ExclusionRange[] = [];
      const source = new MagicString('abcdefghijkl', {
        filename: 'foo.js',
        indentExclusionRanges: array
      });

      b.addSource(source);
      assertStrictEquals(b.sources[0].content, source);
      assertStrictEquals(b.sources[0].filename, 'foo.js');
      assertStrictEquals(b.sources[0].indentExclusionRanges, array);
    });

    await t.step('respects MagicString init options with { content: source }', () => {
      const b = new Bundle();
      const array: ExclusionRange[] = [];
      const source = new MagicString('abcdefghijkl', {
        filename: 'foo.js',
        indentExclusionRanges: array
      });

      b.addSource({ content: source });
      assertStrictEquals(b.sources[0].content, source);
      assertStrictEquals(b.sources[0].filename, 'foo.js');
      assertStrictEquals(b.sources[0].indentExclusionRanges, array);
    });
  });

  await t.step('append', async (t) => {
    await t.step('should append content', () => {
      const b = new Bundle();

      b.addSource({ content: new MagicString('*') });

      b.append('123').append('456');
      assertEquals(b.toString(), '*123456');
    });

    await t.step('should append content before subsequent sources', () => {
      const b = new Bundle();

      b.addSource(new MagicString('*'));

      b.append('123').addSource(new MagicString('-')).append('456');
      assertEquals(b.toString(), '*123\n-456');
    });

    await t.step('should return this', () => {
      const b = new Bundle();
      assertStrictEquals(b.append('x'), b);
    });
  });

  await t.step('clone', async (t) => {
    await t.step('should clone a bundle', () => {
      const s1 = new MagicString('abcdef');
      const s2 = new MagicString('ghijkl');
      const b = new Bundle()
        .addSource({ content: s1 })
        .addSource({ content: s2 })
        .prepend('>>>')
        .append('<<<');
      const clone = b.clone();

      assertEquals(clone.toString(), '>>>abcdef\nghijkl<<<');

      s1.overwrite(2, 4, 'XX');
      assertEquals(b.toString(), '>>>abXXef\nghijkl<<<');
      assertEquals(clone.toString(), '>>>abcdef\nghijkl<<<');
    });
  });

  await t.step('generateMap', async (t) => {
    await t.step('should generate a sourcemap', () => {
      const b = new Bundle()
        .addSource({
          filename: 'foo.js',
          content: new MagicString('var answer = 42;')
        })
        .addSource({
          filename: 'bar.js',
          content: new MagicString('console.log( answer );')
        });


      const map = b.generateMap({
        file: 'bundle.js',
        includeContent: true,
        hires: true
      });

      assertEquals(map.version, 3);
      assertEquals(map.file, 'bundle.js');
      assertDeepEquals(map.sources, ['foo.js', 'bar.js']);
      assertDeepEquals(map.sourcesContent, ['var answer = 42;', 'console.log( answer );']);

      const smc = new SourceMapConsumer(map) as unknown as BasicSourceMapConsumer;
      let loc;

      loc = smc.originalPositionFor({ line: 1, column: 0 });
      assertEquals(loc.line, 1);
      assertEquals(loc.column, 0);
      assertEquals(loc.source, 'foo.js');

      loc = smc.originalPositionFor({ line: 1, column: 1 });
      assertEquals(loc.line, 1);
      assertEquals(loc.column, 1);
      assertEquals(loc.source, 'foo.js');

      loc = smc.originalPositionFor({ line: 2, column: 0 });
      assertEquals(loc.line, 1);
      assertEquals(loc.column, 0);
      assertEquals(loc.source, 'bar.js');

      loc = smc.originalPositionFor({ line: 2, column: 1 });
      assertEquals(loc.line, 1);
      assertEquals(loc.column, 1);
      assertEquals(loc.source, 'bar.js');
    });

    await t.step('should handle Windows-style paths', () => {
      const b = new Bundle()
        .addSource({
          filename: 'path\\to\\foo.js',
          content: new MagicString('var answer = 42;')
        })
        .addSource({
          filename: 'path\\to\\bar.js',
          content: new MagicString('console.log( answer );')
        });

      const map = b.generateMap({
        file: 'bundle.js',
        includeContent: true,
        hires: true
      });

      assertEquals(map.version, 3);
      assertEquals(map.file, 'bundle.js');
      assertDeepEquals(map.sources, ['path/to/foo.js', 'path/to/bar.js']);
      assertDeepEquals(map.sourcesContent, ['var answer = 42;', 'console.log( answer );']);

      assertEquals(map.toString(), '{"version":3,"file":"bundle.js","sources":["path/to/foo.js","path/to/bar.js"],"sourcesContent":["var answer = 42;","console.log( answer );"],"names":[],"mappings":"AAAA,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC;ACAf,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC"}');

      const smc = new SourceMapConsumer(map) as unknown as BasicSourceMapConsumer;
      let loc;

      loc = smc.originalPositionFor({ line: 1, column: 0 });
      assertEquals(loc.line, 1);
      assertEquals(loc.column, 0);
      assertEquals(loc.source, 'path/to/foo.js');

      loc = smc.originalPositionFor({ line: 1, column: 1 });
      assertEquals(loc.line, 1);
      assertEquals(loc.column, 1);
      assertEquals(loc.source, 'path/to/foo.js');

      loc = smc.originalPositionFor({ line: 2, column: 0 });
      assertEquals(loc.line, 1);
      assertEquals(loc.column, 0);
      assertEquals(loc.source, 'path/to/bar.js');

      loc = smc.originalPositionFor({ line: 2, column: 1 });
      assertEquals(loc.line, 1);
      assertEquals(loc.column, 1);
      assertEquals(loc.source, 'path/to/bar.js');
    });

    await t.step('should handle edge case with intro content', () => {
      const b = new Bundle()
        .addSource({
          filename: 'foo.js',
          content: new MagicString('var answer = 42;')
        })
        .addSource({
          filename: 'bar.js',
          content: new MagicString('\nconsole.log( answer );')
        })
        .indent().prepend('(function () {\n').append('\n}());');

      const map = b.generateMap({
        file: 'bundle.js',
        includeContent: true,
        hires: true
      });

      const smc = new SourceMapConsumer(map) as unknown as BasicSourceMapConsumer;
      let loc;

      loc = smc.originalPositionFor({ line: 2, column: 1 });
      assertEquals(loc.line, 1);
      assertEquals(loc.column, 0);
      assertEquals(loc.source, 'foo.js');

      loc = smc.originalPositionFor({ line: 2, column: 2 });
      assertEquals(loc.line, 1);
      assertEquals(loc.column, 1);
      assertEquals(loc.source, 'foo.js');

      loc = smc.originalPositionFor({ line: 4, column: 1 });
      assertEquals(loc.line, 2);
      assertEquals(loc.column, 0);
      assertEquals(loc.source, 'bar.js');

      loc = smc.originalPositionFor({ line: 4, column: 2 });
      assertEquals(loc.line, 2);
      assertEquals(loc.column, 1);
      assertEquals(loc.source, 'bar.js');
    });

    await t.step('should allow missing file option when generating map', () => {
      new Bundle()
        .addSource({
          filename: 'foo.js',
          content: new MagicString('var answer = 42;')
        })
        .generateMap({
          includeContent: true,
          hires: true
        });
    });

    await t.step('should handle repeated sources', () => {
      const b = new Bundle();

      const foo = new MagicString('var one = 1;\nvar three = 3;', {
        filename: 'foo.js'
      });

      const bar = new MagicString('var two = 2;\nvar four = 4;', {
        filename: 'bar.js'
      });

      b.addSource(foo.snip(0, 12));
      b.addSource(bar.snip(0, 12));
      b.addSource(foo.snip(13, 27));
      b.addSource(bar.snip(13, 26));

      const code = b.toString();
      assertEquals(code, 'var one = 1;\nvar two = 2;\nvar three = 3;\nvar four = 4;');

      const map = b.generateMap({
        includeContent: true,
        hires: true
      });

      assertEquals(map.sources.length, 2);
      assertEquals(map.sourcesContent.length, 2);

      const smc = new SourceMapConsumer(map) as unknown as BasicSourceMapConsumer;
      let loc;

      loc = smc.originalPositionFor({ line: 1, column: 0 });
      assertEquals(loc.line, 1);
      assertEquals(loc.column, 0);
      assertEquals(loc.source, 'foo.js');

      loc = smc.originalPositionFor({ line: 2, column: 0 });
      assertEquals(loc.line, 1);
      assertEquals(loc.column, 0);
      assertEquals(loc.source, 'bar.js');

      loc = smc.originalPositionFor({ line: 3, column: 0 });
      assertEquals(loc.line, 2);
      assertEquals(loc.column, 0);
      assertEquals(loc.source, 'foo.js');

      loc = smc.originalPositionFor({ line: 4, column: 0 });
      assertEquals(loc.line, 2);
      assertEquals(loc.column, 0);
      assertEquals(loc.source, 'bar.js');
    });

    await t.step('should recover original names', () => {
      const b = new Bundle();

      const one = new MagicString('function one () {}', { filename: 'one.js' });
      const two = new MagicString('function two () {}', { filename: 'two.js' });

      one.overwrite(9, 12, 'three', { storeName: true });
      two.overwrite(9, 12, 'four', { storeName: true });

      b.addSource(one);
      b.addSource(two);

      const map = b.generateMap({
        file: 'output.js',
        source: 'input.js',
        includeContent: true
      });

      const smc = new SourceMapConsumer(map) as unknown as BasicSourceMapConsumer;
      let loc;

      loc = smc.originalPositionFor({ line: 1, column: 9 });
      assertEquals(loc.name, 'one');

      loc = smc.originalPositionFor({ line: 2, column: 9 });
      assertEquals(loc.name, 'two');
    });

    await t.step('should exclude sources without filename from sourcemap', () => {
      const b = new Bundle();

      const one = new MagicString('function one () {}', { filename: 'one.js' });
      const two = new MagicString('function two () {}', { filename: undefined });
      const three = new MagicString('function three () {}', { filename: 'three.js' });

      b.addSource(one);
      b.addSource(two);
      b.addSource(three);

      const map = b.generateMap({
        file: 'output.js',
        source: 'input.js',
        includeContent: true
      });

      const smc = new SourceMapConsumer(map) as unknown as BasicSourceMapConsumer;
      let loc;

      loc = smc.originalPositionFor({ line: 1, column: 9 });
      assertEquals(loc.source, 'one.js');

      loc = smc.originalPositionFor({ line: 2, column: 9 });
      assertEquals(loc.source, null);

      loc = smc.originalPositionFor({ line: 3, column: 9 });
      assertEquals(loc.source, 'three.js');
    });

    await t.step('handles prepended content', () => {
      const b = new Bundle();

      const one = new MagicString('function one () {}', { filename: 'one.js' });
      const two = new MagicString('function two () {}', { filename: 'two.js' });
      two.prepend('function oneAndAHalf() {}\n');

      b.addSource(one);
      b.addSource(two);

      const map = b.generateMap({
        file: 'output.js',
        source: 'input.js',
        includeContent: true
      });

      const smc = new SourceMapConsumer(map) as unknown as BasicSourceMapConsumer;
      let loc;

      loc = smc.originalPositionFor({ line: 1, column: 9 });
      assertEquals(loc.source, 'one.js');

      loc = smc.originalPositionFor({ line: 3, column: 9 });
      assertEquals(loc.source, 'two.js');
    });

    await t.step('handles appended content', () => {
      const b = new Bundle();

      const one = new MagicString('function one () {}', { filename: 'one.js' });
      one.append('\nfunction oneAndAHalf() {}');
      const two = new MagicString('function two () {}', { filename: 'two.js' });

      b.addSource(one);
      b.addSource(two);

      const map = b.generateMap({
        file: 'output.js',
        source: 'input.js',
        includeContent: true
      });

      const smc = new SourceMapConsumer(map) as unknown as BasicSourceMapConsumer;
      let loc;

      loc = smc.originalPositionFor({ line: 1, column: 9 });
      assertEquals(loc.source, 'one.js');

      loc = smc.originalPositionFor({ line: 3, column: 9 });
      assertEquals(loc.source, 'two.js');
    });

    await t.step('should handle empty separator', () => {
      const b = new Bundle({
        separator: ''
      });

      b.addSource({
        content: new MagicString('if ( foo ) { ')
      });

      const s = new MagicString('console.log( 42 );');
      s.addSourcemapLocation(8);
      s.addSourcemapLocation(15);

      b.addSource({
        filename: 'input.js',
        content: s
      });

      b.addSource({
        content: new MagicString(' }')
      });

      assertEquals(b.toString(), 'if ( foo ) { console.log( 42 ); }');

      const map = b.generateMap({
        file: 'output.js',
        source: 'input.js',
        includeContent: true
      });

      const smc = new SourceMapConsumer(map) as unknown as BasicSourceMapConsumer;
      const loc = smc.originalPositionFor({ line: 1, column: 21 });

      assertDeepEquals(loc, {
        source: 'input.js',
        name: null,
        line: 1,
        column: 8
      });
    });

    // TODO tidy this up. is a recreation of a bug in Svelte
    await t.step('generates a correct sourcemap for a Svelte component', () => {
      const b = new Bundle({
        separator: ''
      });

      const s = new MagicString(`
<div></div>

<script>
\texport default {
\t\tonrender () {
\t\t\tconsole.log( 42 );
\t\t}
\t}
</script>`.trim());

      [21, 23, 38, 42, 50, 51, 54, 59, 66, 67, 70, 72, 74, 76, 77, 81, 84, 85].forEach(pos => {
        s.addSourcemapLocation(pos);
      });

      s.remove(0, 21);
      s.overwrite(23, 38, 'return ');
      s.prependRight(21, 'var template = (function () {');
      s.appendLeft(85, '}());');
      s.overwrite(85, 94, '');

      b.addSource({
        content: s,
        filename: 'input.js'
      });

      assertEquals(b.toString(), `
var template = (function () {
\treturn {
\t\tonrender () {
\t\t\tconsole.log( 42 );
\t\t}
\t}
}());`.trim());

      const map = b.generateMap({
        file: 'output.js',
        source: 'input.js',
        includeContent: true
      });

      const smc = new SourceMapConsumer(map) as unknown as BasicSourceMapConsumer;
      const loc = smc.originalPositionFor({ line: 4, column: 16 });

      assertDeepEquals(loc, {
        source: 'input.js',
        name: null,
        line: 6,
        column: 16
      });
    });
  });

  await t.step('indent', async (t) => {
    await t.step('should indent a bundle', () => {
      const b = new Bundle();

      b.addSource({ content: new MagicString('abcdef') });
      b.addSource({ content: new MagicString('ghijkl') });

      b.indent().prepend('>>>\n').append('\n<<<');
      assertEquals(b.toString(), '>>>\n\tabcdef\n\tghijkl\n<<<');
    });

    await t.step('should ignore non-indented sources when guessing indentation', () => {
      const b = new Bundle();

      b.addSource({ content: new MagicString('abcdef') });
      b.addSource({ content: new MagicString('ghijkl') });
      b.addSource({ content: new MagicString('  mnopqr') });

      b.indent();
      assertEquals(b.toString(), '  abcdef\n  ghijkl\n    mnopqr');
    });

    await t.step('should respect indent exclusion ranges', () => {
      const b = new Bundle();

      b.addSource({
        content: new MagicString('abc\ndef\nghi\njkl'),
        indentExclusionRanges: [7, 15]
      });

      b.indent('  ');
      assertEquals(b.toString(), '  abc\n  def\nghi\njkl');

      b.indent('>>');
      assertEquals(b.toString(), '>>  abc\n>>  def\nghi\njkl');
    });

    await t.step('does not indent sources with no preceding newline, i.e. append()', () => {
      const b = new Bundle();

      b.addSource(new MagicString('abcdef'));
      b.addSource(new MagicString('ghijkl'));

      b.prepend('>>>').append('<<<').indent();
      assertEquals(b.toString(), '\t>>>abcdef\n\tghijkl<<<');
    });

    await t.step('should noop with an empty string', () => {
      const b = new Bundle();

      b.addSource(new MagicString('abcdef'));
      b.addSource(new MagicString('ghijkl'));

      b.indent('');
      assertEquals(b.toString(), 'abcdef\nghijkl');
    });

    await t.step('indents prepended content', () => {
      const b = new Bundle();
      b.prepend('a\nb').indent();

      assertEquals(b.toString(), '\ta\n\tb');
    });

    await t.step('indents content immediately following intro with trailing newline', () => {
      const b = new Bundle({ separator: '\n\n' });

      const s = new MagicString('2');
      b.addSource({ content: s });

      b.prepend('1\n');

      assertEquals(b.indent().toString(), '\t1\n\t2');
    });

    await t.step('should return this', () => {
      const b = new Bundle();
      assertStrictEquals(b.indent(), b);
    });

    await t.step('should return this on noop', () => {
      const b = new Bundle();
      assertStrictEquals(b.indent(''), b);
    });
  });

  await t.step('prepend', async (t) => {
    await t.step('should append content', () => {
      const b = new Bundle();

      b.addSource({ content: new MagicString('*') });

      b.prepend('123').prepend('456');
      assertEquals(b.toString(), '456123*');
    });

    await t.step('should return this', () => {
      const b = new Bundle();
      assertStrictEquals(b.prepend('x'), b);
    });
  });

  await t.step('trim', async (t) => {
    await t.step('should trim bundle', () => {
      const b = new Bundle();

      b.addSource({
        content: new MagicString('   abcdef   ')
      });

      b.addSource({
        content: new MagicString('   ghijkl   ')
      });

      b.trim();
      assertEquals(b.toString(), 'abcdef   \n   ghijkl');
    });

    await t.step('should handle funky edge cases', () => {
      const b = new Bundle();

      b.addSource({
        content: new MagicString('   abcdef   ')
      });

      b.addSource({
        content: new MagicString('   x   ')
      });

      b.prepend('\n>>>\n').append('   ');

      b.trim();
      assertEquals(b.toString(), '>>>\n   abcdef   \n   x');
    });

    await t.step('should return this', () => {
      const b = new Bundle();
      assertStrictEquals(b.trim(), b);
    });
  });

  await t.step('toString', async (t) => {
    await t.step('should separate with a newline by default', () => {
      const b = new Bundle();

      b.addSource(new MagicString('abc'));
      b.addSource(new MagicString('def'));

      assertStrictEquals(b.toString(), 'abc\ndef');
    });

    await t.step('should accept separator option', () => {
      const b = new Bundle({ separator: '==' });

      b.addSource(new MagicString('abc'));
      b.addSource(new MagicString('def'));

      assertStrictEquals(b.toString(), 'abc==def');
    });

    await t.step('should accept empty string separator option', () => {
      const b = new Bundle({ separator: '' });

      b.addSource(new MagicString('abc'));
      b.addSource(new MagicString('def'));

      assertStrictEquals(b.toString(), 'abcdef');
    });
  });

  await t.step('mappings', async (t) => {
    await t.step('should produce correct mappings after remove and move in multiple sources', () => {
      const s1 = 'ABCDE';
      const ms1 = new MagicString(s1, { filename: 'first' });

      const s2 = 'VWXYZ';
      const ms2 = new MagicString(s2, { filename: 'second' });

      const bundle = new Bundle();
      bundle.addSource(ms1);
      bundle.addSource(ms2);

      ms1.remove(2,4);   // ABE
      ms1.move(0, 1, 5); // BEA

      ms2.remove(2,4);   // VWZ
      ms2.move(0, 1, 5); // WZV

      const map = bundle.generateMap({file: 'result', hires: true, includeContent: true});
      const smc = new SourceMapConsumer(map) as unknown as BasicSourceMapConsumer;

      const result1 = ms1.toString();
      assertStrictEquals(result1, 'BEA');

      const result2 = ms2.toString();
      assertStrictEquals(result2, 'WZV');

      assertStrictEquals(bundle.toString(), 'BEA\nWZV');

      // B = B
      // E = E
      // A = A
      let line = 1;
      for (let i = 0; i < result1.length; i++) {
        const loc = smc.originalPositionFor({ line, column: i });
        assertStrictEquals(s1[loc.column], result1[i]);
      }

      // W = W
      // Z = Z
      // V = V
      line = 2;
      for (let i = 0; i < result2.length; i++) {
        const loc = smc.originalPositionFor({ line, column: i });
        assertStrictEquals(s2[loc.column], result2[i]);
      }

      assertStrictEquals(map.toString(), '{"version":3,"file":"result","sources":["first","second"],"sourcesContent":["ABCDE","VWXYZ"],"names":[],"mappings":"AAAC,CAAG,CAAJ;ACAC,CAAG,CAAJ"}');
    });
  });
});
