import { assertEquals, assertStrictEquals, assertThrows, assertNotEquals, assertNotStrictEquals, assertDeepEquals } from './assert.ts';
import { SourceMapConsumer, BasicSourceMapConsumer } from './consumer.ts';
import { ExclusionRange } from '../src/MagicString.ts';
import MagicString from './utils/IntegrityCheckingMagicString.ts';

// require('source-map-support').install();

Deno.test('MagicString', async (t) => {
  await t.step('options', async (t) => {
    await t.step('stores source file information', () => {
      const s = new MagicString('abc', {
        filename: 'foo.js'
      });

      assertEquals(s.filename, 'foo.js');
    });
  });

  await t.step('append', async (t) => {
    await t.step('should append content', () => {
      const s = new MagicString('abcdefghijkl');

      s.append('xyz');
      assertEquals(s.toString(), 'abcdefghijklxyz');

      s.append('xyz');
      assertEquals(s.toString(), 'abcdefghijklxyzxyz');
    });

    await t.step('should return this', () => {
      const s = new MagicString('abcdefghijkl');
      assertStrictEquals(s.append('xyz'), s);
    });
  });

  await t.step('(ap|pre)pend(Left|Right)', async (t) => {
    await t.step('preserves intended order', () => {
      const s = new MagicString('0123456789');

      s.appendLeft(5, 'A');
      s.prependRight(5, 'a');
      s.prependRight(5, 'b');
      s.appendLeft(5, 'B');
      s.appendLeft(5, 'C');
      s.prependRight(5, 'c');

      assertEquals(s.toString(), '01234ABCcba56789');
      assertEquals(s.slice(0, 5), '01234ABC');
      assertEquals(s.slice(5), 'cba56789');

      s.prependLeft(5, '<');
      s.prependLeft(5, '{');
      assertEquals(s.toString(), '01234{<ABCcba56789');

      s.appendRight(5, '>');
      s.appendRight(5, '}');
      assertEquals(s.toString(), '01234{<ABCcba>}56789');

      s.appendLeft(5, '(');
      s.appendLeft(5, '[');
      assertEquals(s.toString(), '01234{<ABC([cba>}56789');

      s.prependRight(5, ')');
      s.prependRight(5, ']');
      assertEquals(s.toString(), '01234{<ABC([])cba>}56789');

      assertEquals(s.slice(0, 5), '01234{<ABC([');
      assertEquals(s.slice(5), '])cba>}56789');
    });

    await t.step('preserves intended order at beginning of string', () => {
      const s = new MagicString('x');

      s.appendLeft(0, '1');
      s.prependLeft(0, '2');
      s.appendLeft(0, '3');
      s.prependLeft(0, '4');

      assertEquals(s.toString(), '4213x');
    });

    await t.step('preserves intended order at end of string', () => {
      const s = new MagicString('x');

      s.appendRight(1, '1');
      s.prependRight(1, '2');
      s.appendRight(1, '3');
      s.prependRight(1, '4');

      assertEquals(s.toString(), 'x4213');
    });
  });

  await t.step('appendLeft', async (t) => {
    await t.step('should return this', () => {
      const s = new MagicString('abcdefghijkl');
      assertStrictEquals(s.appendLeft(0, 'a'), s);
    });
  });

  await t.step('appendRight', async (t) => {
    await t.step('should return this', () => {
      const s = new MagicString('abcdefghijkl');
      assertStrictEquals(s.appendRight(0, 'a'), s);
    });
  });

  await t.step('clone', async (t) => {
    await t.step('should clone a magic string', () => {
      const s = new MagicString('abcdefghijkl');

      s.overwrite(3, 9, 'XYZ');
      const c = s.clone();

      assertNotEquals(s, c);
      assertEquals(c.toString(), 'abcXYZjkl');
    });

    await t.step('should clone filename info', () => {
      const s = new MagicString('abcdefghijkl', { filename: 'foo.js' });
      const c = s.clone();

      assertEquals(c.filename, 'foo.js');
    });

    await t.step('should clone indentExclusionRanges', () => {
      const array: ExclusionRange = [3, 6];
      const source = new MagicString('abcdefghijkl', {
        filename: 'foo.js',
        indentExclusionRanges: array
      });

      const clone = source.clone();

      assertNotStrictEquals(source.indentExclusionRanges, clone.indentExclusionRanges);
      assertDeepEquals(source.indentExclusionRanges, clone.indentExclusionRanges);
    });

    await t.step('should clone complex indentExclusionRanges', () => {
      const array: ExclusionRange[] = [[3, 6], [7, 9]];
      const source = new MagicString('abcdefghijkl', {
        filename: 'foo.js',
        indentExclusionRanges: array
      });

      const clone = source.clone();

      assertNotStrictEquals(source.indentExclusionRanges, clone.indentExclusionRanges);
      assertDeepEquals(source.indentExclusionRanges, clone.indentExclusionRanges);
    });

    await t.step('should clone sourcemapLocations', () => {
      const source = new MagicString('abcdefghijkl', {
        filename: 'foo.js'
      });

      source.addSourcemapLocation(3);

      const clone = source.clone();

      assertNotStrictEquals(source.sourcemapLocations, clone.sourcemapLocations);
      assertDeepEquals(source.sourcemapLocations, clone.sourcemapLocations);
    });

    await t.step('should clone intro and outro', () => {
      const source = new MagicString('defghi');

      source.prepend('abc');
      source.append('jkl');

      const clone = source.clone();

      assertEquals(source.toString(), clone.toString());
    });
  });

  await t.step('generateMap', async (t) => {
    await t.step('should generate a sourcemap', () => {
      const s = new MagicString('abcdefghijkl').remove(3, 9);

      const map = s.generateMap({
        file: 'output.md',
        source: 'input.md',
        includeContent: true,
        hires: true
      });

      assertEquals(map.version, 3);
      assertEquals(map.file, 'output.md');
      assertDeepEquals(map.sources, ['input.md']);
      assertDeepEquals(map.sourcesContent, ['abcdefghijkl']);
      assertEquals(map.mappings, 'AAAA,CAAC,CAAC,CAAO,CAAC,CAAC');

      assertEquals(map.toString(), '{"version":3,"file":"output.md","sources":["input.md"],"sourcesContent":["abcdefghijkl"],"names":[],"mappings":"AAAA,CAAC,CAAC,CAAO,CAAC,CAAC"}');
      assertEquals(map.toUrl(), 'data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0Lm1kIiwic291cmNlcyI6WyJpbnB1dC5tZCJdLCJzb3VyY2VzQ29udGVudCI6WyJhYmNkZWZnaGlqa2wiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsQ0FBQyxDQUFDLENBQU8sQ0FBQyxDQUFDIn0=');

      const smc = new SourceMapConsumer(map) as unknown as BasicSourceMapConsumer;
      let loc;

      loc = smc.originalPositionFor({ line: 1, column: 0 });
      assertEquals(loc.line, 1);
      assertEquals(loc.column, 0);

      loc = smc.originalPositionFor({ line: 1, column: 1 });
      assertEquals(loc.line, 1);
      assertEquals(loc.column, 1);

      loc = smc.originalPositionFor({ line: 1, column: 4 });
      assertEquals(loc.line, 1);
      assertEquals(loc.column, 10);
    });

    await t.step('should generate a correct sourcemap for prepend content when hires = false', () => {
      const s = new MagicString('x\nq');

      s.prepend('y\n');

      const map = s.generateMap({
        includeContent: true,
      });

      assertEquals(map.mappings,';AAAA;AACA');
    });

    await t.step('should generate a correct sourcemap for indented content', () => {
      const s = new MagicString('var answer = 42;\nconsole.log("the answer is %s", answer);');

      s.prepend('\'use strict\';\n\n');
      s.indent('\t').prepend('(function () {\n').append('\n}).call(global);');

      const map = s.generateMap({
        source: 'input.md',
        includeContent: true,
        hires: true
      });

      const smc = new SourceMapConsumer(map) as unknown as BasicSourceMapConsumer;

      const originLoc = smc.originalPositionFor({ line: 5, column: 1 });
      assertEquals(originLoc.line, 2);
      assertEquals(originLoc.column, 0);
    });

    await t.step('should generate a sourcemap using specified locations', () => {
      const s = new MagicString('abcdefghijkl');

      s.addSourcemapLocation(0);
      s.addSourcemapLocation(3);
      s.addSourcemapLocation(10);

      s.remove(6, 9);
      const map = s.generateMap({
        file: 'output.md',
        source: 'input.md',
        includeContent: true
      });

      assertEquals(map.version, 3);
      assertEquals(map.file, 'output.md');
      assertDeepEquals(map.sources, ['input.md']);
      assertDeepEquals(map.sourcesContent, ['abcdefghijkl']);

      assertEquals(map.toString(), '{"version":3,"file":"output.md","sources":["input.md"],"sourcesContent":["abcdefghijkl"],"names":[],"mappings":"AAAA,GAAG,GAAM,CAAC"}');
      assertEquals(map.toUrl(), 'data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0Lm1kIiwic291cmNlcyI6WyJpbnB1dC5tZCJdLCJzb3VyY2VzQ29udGVudCI6WyJhYmNkZWZnaGlqa2wiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsR0FBRyxHQUFNLENBQUMifQ==');

      const smc = new SourceMapConsumer(map) as unknown as BasicSourceMapConsumer;
      let loc;

      loc = smc.originalPositionFor({ line: 1, column: 0 });
      assertEquals(loc.line, 1);
      assertEquals(loc.column, 0);

      loc = smc.originalPositionFor({ line: 1, column: 3 });
      assertEquals(loc.line, 1);
      assertEquals(loc.column, 3);

      loc = smc.originalPositionFor({ line: 1, column: 7 });
      assertEquals(loc.line, 1);
      assertEquals(loc.column, 10);
    });

    await t.step('should correctly map inserted content', () => {
      const s = new MagicString('function Foo () {}');

      s.overwrite(9, 12, 'Bar');

      const map = s.generateMap({
        file: 'output.js',
        source: 'input.js',
        includeContent: true
      });

      const smc = new SourceMapConsumer(map) as unknown as BasicSourceMapConsumer;

      const loc = smc.originalPositionFor({ line: 1, column: 9 });
      assertEquals(loc.line, 1);
      assertEquals(loc.column, 9);
    });

    await t.step('should yield consistent results between appendLeft and prependRight', () => {
      const s1 = new MagicString('abcdefghijkl');
      s1.appendLeft(6, 'X');

      const s2 = new MagicString('abcdefghijkl');
      s2.prependRight(6, 'X');

      const m1 = s1.generateMap({ file: 'output', source: 'input', includeContent: true });
      const m2 = s2.generateMap({ file: 'output', source: 'input', includeContent: true });

      assertDeepEquals(m1, m2);
    });

    await t.step('should recover original names', () => {
      const s = new MagicString('function Foo () {}');

      s.overwrite(9, 12, 'Bar', { storeName: true });

      const map = s.generateMap({
        file: 'output.js',
        source: 'input.js',
        includeContent: true
      });

      const smc = new SourceMapConsumer(map) as unknown as BasicSourceMapConsumer;

      const loc = smc.originalPositionFor({ line: 1, column: 9 });
      assertEquals(loc.name, 'Foo');
    });

    await t.step('should generate one segment per replacement', () => {
      const s = new MagicString('var answer = 42');
      s.overwrite(4, 10, 'number', { storeName: true });

      const map = s.generateMap({
        file: 'output.js',
        source: 'input.js',
        includeContent: true
      });

      const smc = new SourceMapConsumer(map);

      let numMappings = 0;
      smc.eachMapping(() => numMappings += 1, null, null);

      assertEquals(numMappings, 3); // one at 0, one at the edit, one afterwards
    });

    await t.step('should generate a sourcemap that correctly locates moved content', () => {
      const s = new MagicString('abcdefghijkl');
      s.move(3, 6, 9);

      const result = s.toString();
      const map = s.generateMap({
        file: 'output.js',
        source: 'input.js',
        includeContent: true,
        hires: true
      });

      const smc = new SourceMapConsumer(map) as unknown as BasicSourceMapConsumer;

      'abcdefghijkl'.split('').forEach((letter, i) => {
        const column = result.indexOf(letter);
        const loc = smc.originalPositionFor({ line: 1, column });

        assertEquals(loc.line, 1);
        assertEquals(loc.column, i);
      });
    });

    await t.step('generates a map with trimmed content (#53)', () => {
      const s1 = new MagicString('abcdefghijkl ').trim();
      const map1 = s1.generateMap({
        file: 'output',
        source: 'input',
        includeContent: true,
        hires: true
      });

      const smc1 = new SourceMapConsumer(map1) as unknown as BasicSourceMapConsumer;
      const loc1 = smc1.originalPositionFor({ line: 1, column: 11 });

      assertEquals(loc1.column, 11);

      const s2 = new MagicString(' abcdefghijkl').trim();
      const map2 = s2.generateMap({
        file: 'output',
        source: 'input',
        includeContent: true,
        hires: true
      });

      const smc2 = new SourceMapConsumer(map2) as unknown as BasicSourceMapConsumer;
      const loc2 = smc2.originalPositionFor({ line: 1, column: 1 });

      assertEquals(loc2.column, 2);
    });

    await t.step('skips empty segments at the start', () => {
      const s = new MagicString('abcdefghijkl');
      s.remove(0, 3).remove(3, 6);

      const map = s.generateMap();
      const smc = new SourceMapConsumer(map) as unknown as BasicSourceMapConsumer;
      const loc = smc.originalPositionFor({ line: 1, column: 6 });

      assertEquals(loc.column, 6);
    });

    await t.step('skips indentation at the start', () => {
      const s = new MagicString('abcdefghijkl');
      s.indent('    ');

      const map = s.generateMap();
      assertEquals(map.mappings, 'IAAA');
    });
  });

  await t.step('getIndentString', async (t) => {
    await t.step('should guess the indent string', () => {
      const s = new MagicString('abc\n\tdef\nghi');
      assertEquals(s.getIndentString(), '\t');
    });

    await t.step('should return a tab if no lines are indented', () => {
      const s = new MagicString('abc\ndef\nghi');
      assertEquals(s.getIndentString(), '\t');
    });
  });

  await t.step('indent', async (t) => {
    await t.step('should indent content with a single tab character by default', () => {
      const s = new MagicString('abc\ndef\nghi\njkl');

      s.indent();
      assertEquals(s.toString(), '\tabc\n\tdef\n\tghi\n\tjkl');

      s.indent();
      assertEquals(s.toString(), '\t\tabc\n\t\tdef\n\t\tghi\n\t\tjkl');
    });

    await t.step('should indent content, using existing indentation as a guide', () => {
      const s = new MagicString('abc\n\tdef\n\t\tghi\n\tjkl');

      s.indent();
      assertEquals(s.toString(), '\tabc\n\t\tdef\n\t\t\tghi\n\t\tjkl');

      s.indent();
      assertEquals(s.toString(), '\t\tabc\n\t\t\tdef\n\t\t\t\tghi\n\t\t\tjkl');
    });

    await t.step('should disregard single-space indentation when auto-indenting', () => {
      const s = new MagicString('abc\n/**\n *comment\n */');

      s.indent();
      assertEquals(s.toString(), '\tabc\n\t/**\n\t *comment\n\t */');
    });

    await t.step('should indent content using the supplied indent string', () => {
      const s = new MagicString('abc\ndef\nghi\njkl');

      s.indent('  ');
      assertEquals(s.toString(), '  abc\n  def\n  ghi\n  jkl');

      s.indent('>>');
      assertEquals(s.toString(), '>>  abc\n>>  def\n>>  ghi\n>>  jkl');
    });

    await t.step('should indent content using the empty string if specified (i.e. noop)', () => {
      const s = new MagicString('abc\ndef\nghi\njkl');

      s.indent('');
      assertEquals(s.toString(), 'abc\ndef\nghi\njkl');
    });

    await t.step('should prevent excluded characters from being indented', () => {
      const s = new MagicString('abc\ndef\nghi\njkl');

      s.indent('  ', { exclude: [7, 15] });
      assertEquals(s.toString(), '  abc\n  def\nghi\njkl');

      s.indent('>>', { exclude: [7, 15] });
      assertEquals(s.toString(), '>>  abc\n>>  def\nghi\njkl');
    });

    await t.step('should not add characters to empty lines', () => {
      const s = new MagicString('\n\nabc\ndef\n\nghi\njkl');

      s.indent();
      assertEquals(s.toString(), '\n\n\tabc\n\tdef\n\n\tghi\n\tjkl');

      s.indent();
      assertEquals(s.toString(), '\n\n\t\tabc\n\t\tdef\n\n\t\tghi\n\t\tjkl');
    });

    await t.step('should not add characters to empty lines, even on Windows', () => {
      const s = new MagicString('\r\n\r\nabc\r\ndef\r\n\r\nghi\r\njkl');

      s.indent();
      assertEquals(s.toString(), '\r\n\r\n\tabc\r\n\tdef\r\n\r\n\tghi\r\n\tjkl');

      s.indent();
      assertEquals(s.toString(), '\r\n\r\n\t\tabc\r\n\t\tdef\r\n\r\n\t\tghi\r\n\t\tjkl');
    });

    await t.step('should indent content with removals', () => {
      const s = new MagicString('/* remove this line */\nvar foo = 1;');

      s.remove(0, 23);
      s.indent();

      assertEquals(s.toString(), '\tvar foo = 1;');
    });

    await t.step('should not indent patches in the middle of a line', () => {
      const s = new MagicString('class Foo extends Bar {}');

      s.overwrite(18, 21, 'Baz');
      assertEquals(s.toString(), 'class Foo extends Baz {}');

      s.indent();
      assertEquals(s.toString(), '\tclass Foo extends Baz {}');
    });

    await t.step('should return this', () => {
      const s = new MagicString('abcdefghijkl');
      assertStrictEquals(s.indent(), s);
    });

    await t.step('should return this on noop', () => {
      const s = new MagicString('abcdefghijkl');
      assertStrictEquals(s.indent(''), s);
    });
  });

  // await t.step('insert', async (t) => {
    // TODO move this into prependRight and appendLeft tests

    // it( 'should insert characters in the correct location', () => {
    //   const s = new MagicString( 'abcdefghijkl' );
    //
    //   s.insert( 0, '>>>' );
    //   s.insert( 6, '***' );
    //   s.insert( 12, '<<<' );
    //
    //   assertEquals( s.toString(), '>>>abcdef***ghijkl<<<' );
    // });
    //
    // it( 'should return this', () => {
    //   const s = new MagicString( 'abcdefghijkl' );
    //   assertStrictEquals( s.insert( 0, 'a' ), s );
    // });
    //
    // it( 'should insert repeatedly at the same position correctly', () => {
    //   const s = new MagicString( 'ab' );
    //   assertEquals( s.insert(1, '1').toString(), 'a1b' );
    //   assertEquals( s.insert(1, '2').toString(), 'a12b' );
    // });
    //
    // it( 'should insert repeatedly at the beginning correctly', () => {
    //   const s = new MagicString( 'ab' );
    //   assertEquals( s.insert(0, '1').toString(), '1ab' );
    //   assertEquals( s.insert(0, '2').toString(), '12ab' );
    // });
    //
    // it( 'should throw when given non-string content', () => {
    //   const s = new MagicString( '' );
    //   assertThrows(
    //     function () { s.insert( 0, [] ); },
    //     TypeError
    //   );
    // });
    //
    // it( 'should allow inserting after removed range', () => {
    //   const s = new MagicString( 'abcd' );
    //   s.remove( 1, 2 );
    //   s.insert( 2, 'z' );
    //   assertEquals( s.toString(), 'azcd' );
    // });
  // });

  await t.step('move', async (t) => {
    await t.step('moves content from the start', () => {
      const s = new MagicString('abcdefghijkl');
      s.move(0, 3, 6);

      assertEquals(s.toString(), 'defabcghijkl');
    });

    await t.step('moves content to the start', () => {
      const s = new MagicString('abcdefghijkl');
      s.move(3, 6, 0);

      assertEquals(s.toString(), 'defabcghijkl');
    });

    await t.step('moves content from the end', () => {
      const s = new MagicString('abcdefghijkl');
      s.move(9, 12, 6);

      assertEquals(s.toString(), 'abcdefjklghi');
    });

    await t.step('moves content to the end', () => {
      const s = new MagicString('abcdefghijkl');
      s.move(6, 9, 12);

      assertEquals(s.toString(), 'abcdefjklghi');
    });

    await t.step('ignores redundant move', () => {
      const s = new MagicString('abcdefghijkl');
      s.prependRight(9, 'X');
      s.move(9, 12, 6);
      s.appendLeft(12, 'Y');
      s.move(6, 9, 12); // this is redundant – [6,9] is already after [9,12]

      assertEquals(s.toString(), 'abcdefXjklYghi');
    });

    await t.step('moves content to the middle', () => {
      const s = new MagicString('abcdefghijkl');
      s.move(3, 6, 9);

      assertEquals(s.toString(), 'abcghidefjkl');
    });

    await t.step('handles multiple moves of the same snippet', () => {
      const s = new MagicString('abcdefghijkl');

      s.move(0, 3, 6);
      assertEquals(s.toString(), 'defabcghijkl');

      s.move(0, 3, 9);
      assertEquals(s.toString(), 'defghiabcjkl');
    });

    await t.step('handles moves of adjacent snippets', () => {
      const s = new MagicString('abcdefghijkl');

      s.move(0, 2, 6);
      assertEquals(s.toString(), 'cdefabghijkl');

      s.move(2, 4, 6);
      assertEquals(s.toString(), 'efabcdghijkl');
    });

    await t.step('handles moves to same index', () => {
      const s = new MagicString('abcdefghijkl');
      s.move(0, 2, 6).move(3, 5, 6);

      assertEquals(s.toString(), 'cfabdeghijkl');
    });

    await t.step('refuses to move a selection to inside itself', () => {
      const s = new MagicString('abcdefghijkl');

      assertThrows(() => s.move(3, 6, 3), (err: Error) => /Cannot move a selection inside itself/.test(err.message));

      assertThrows(() => s.move(3, 6, 4), (err: Error) => /Cannot move a selection inside itself/.test(err.message));

      assertThrows(() => s.move(3, 6, 6), (err: Error) => /Cannot move a selection inside itself/.test(err.message));
    });

    await t.step('allows edits of moved content', () => {
      const s1 = new MagicString('abcdefghijkl');

      s1.move(3, 6, 9);
      s1.overwrite(3, 6, 'DEF');

      assertEquals(s1.toString(), 'abcghiDEFjkl');

      const s2 = new MagicString('abcdefghijkl');

      s2.move(3, 6, 9);
      s2.overwrite(4, 5, 'E');

      assertEquals(s2.toString(), 'abcghidEfjkl');
    });

    // it( 'move follows inserts', () => {
    //   const s = new MagicString( 'abcdefghijkl' );
    //
    //   s.appendLeft( 3, 'X' ).move( 6, 9, 3 );
    //   assertEquals( s.toString(), 'abcXghidefjkl' );
    // });
    //
    // it( 'inserts follow move', () => {
    //   const s = new MagicString( 'abcdefghijkl' );
    //
    //   s.insert( 3, 'X' ).move( 6, 9, 3 ).insert( 3, 'Y' );
    //   assertEquals( s.toString(), 'abcXghiYdefjkl' );
    // });
    //
    // it( 'discards inserts at end of move by default', () => {
    //   const s = new MagicString( 'abcdefghijkl' );
    //
    //   s.insert( 6, 'X' ).move( 3, 6, 9 );
    //   assertEquals( s.toString(), 'abcXghidefjkl' );
    // });

    await t.step('moves content inserted at end of range', () => {
      const s = new MagicString('abcdefghijkl');

      s.appendLeft(6, 'X').move(3, 6, 9);
      assertEquals(s.toString(), 'abcghidefXjkl');
    });

    await t.step('returns this', () => {
      const s = new MagicString('abcdefghijkl');
      assertStrictEquals(s.move(3, 6, 9), s);
    });
  });

  await t.step('overwrite', async (t) => {
    await t.step('should replace characters', () => {
      const s = new MagicString('abcdefghijkl');

      s.overwrite(5, 8, 'FGH');
      assertEquals(s.toString(), 'abcdeFGHijkl');
    });

    await t.step('should throw an error if overlapping replacements are attempted', () => {
      const s = new MagicString('abcdefghijkl');

      s.overwrite(7, 11, 'xx');

      assertThrows(() => s.overwrite(8, 12, 'yy'), (err: Error) => /Cannot split a chunk that has already been edited/.test(err.message));

      assertEquals(s.toString(), 'abcdefgxxl');

      s.overwrite(6, 12, 'yes');
      assertEquals(s.toString(), 'abcdefyes');
    });

    await t.step('should allow contiguous but non-overlapping replacements', () => {
      const s = new MagicString('abcdefghijkl');

      s.overwrite(3, 6, 'DEF');
      assertEquals(s.toString(), 'abcDEFghijkl');

      s.overwrite(6, 9, 'GHI');
      assertEquals(s.toString(), 'abcDEFGHIjkl');

      s.overwrite(0, 3, 'ABC');
      assertEquals(s.toString(), 'ABCDEFGHIjkl');

      s.overwrite(9, 12, 'JKL');
      assertEquals(s.toString(), 'ABCDEFGHIJKL');
    });

    await t.step('does not replace zero-length inserts at overwrite start location', () => {
      const s = new MagicString('abcdefghijkl');

      s.remove(0, 6);
      s.appendLeft(6, 'DEF');
      s.overwrite(6, 9, 'GHI');
      assertEquals(s.toString(), 'DEFGHIjkl');
    });

    await t.step('replaces zero-length inserts inside overwrite', () => {
      const s = new MagicString('abcdefghijkl');

      s.appendLeft(6, 'XXX');
      s.overwrite(3, 9, 'DEFGHI');
      assertEquals(s.toString(), 'abcDEFGHIjkl');
    });

    await t.step('replaces non-zero-length inserts inside overwrite', () => {
      const s = new MagicString('abcdefghijkl');

      s.overwrite(3, 4, 'XXX');
      s.overwrite(3, 5, 'DE');
      assertEquals(s.toString(), 'abcDEfghijkl');

      s.overwrite(7, 8, 'YYY');
      s.overwrite(6, 8, 'GH');
      assertEquals(s.toString(), 'abcDEfGHijkl');
    });

    await t.step('should return this', () => {
      const s = new MagicString('abcdefghijkl');
      assertStrictEquals(s.overwrite(3, 4, 'D'), s);
    });

    await t.step('should disallow overwriting zero-length ranges', () => {
      const s = new MagicString('x');
      assertThrows(() => s.overwrite(0, 0, 'anything'), (err: Error) => /Cannot overwrite a zero-length range – use appendLeft or prependRight instead/.test(err.message));
    });

    await t.step('replaces interior inserts', () => {
      const s = new MagicString('abcdefghijkl');

      s.appendLeft(1, '&');
      s.prependRight(1, '^');
      s.appendLeft(3, '!');
      s.prependRight(3, '?');
      s.overwrite(1, 3, '...');
      assertEquals(s.toString(), 'a&...?defghijkl');
    });

    await t.step('preserves interior inserts with `contentOnly: true`', () => {
      const s = new MagicString('abcdefghijkl');

      s.appendLeft(1, '&');
      s.prependRight(1, '^');
      s.appendLeft(3, '!');
      s.prependRight(3, '?');
      s.overwrite(1, 3, '...', { contentOnly: true });
      assertEquals(s.toString(), 'a&^...!?defghijkl');
    });

    await t.step('disallows overwriting across moved content', () => {
      const s = new MagicString('abcdefghijkl');

      s.move(6, 9, 3);
      assertThrows(() => s.overwrite(5, 7, 'XX'), (err: Error) => /Cannot overwrite across a split point/.test(err.message));
    });

    await t.step('allows later insertions at the end', () => {
      const s = new MagicString('abcdefg');

      s.appendLeft(4, '(');
      s.overwrite(2, 7, '');
      s.appendLeft(7, 'h');
      assertEquals(s.toString(), 'abh');
    });
  });

  await t.step('prepend', async (t) => {
    await t.step('should prepend content', () => {
      const s = new MagicString('abcdefghijkl');

      s.prepend('xyz');
      assertEquals(s.toString(), 'xyzabcdefghijkl');

      s.prepend('123');
      assertEquals(s.toString(), '123xyzabcdefghijkl');
    });

    await t.step('should return this', () => {
      const s = new MagicString('abcdefghijkl');
      assertStrictEquals(s.prepend('xyz'), s);
    });
  });

  await t.step('prependLeft', async (t) => {
    await t.step('should return this', () => {
      const s = new MagicString('abcdefghijkl');
      assertStrictEquals(s.prependLeft(0, 'a'), s);
    });
  });

  await t.step('prependRight', async (t) => {
    await t.step('should return this', () => {
      const s = new MagicString('abcdefghijkl');
      assertStrictEquals(s.prependRight(0, 'a'), s);
    });
  });

  await t.step('remove', async (t) => {
    await t.step('should remove characters from the original string', () => {
      const s = new MagicString('abcdefghijkl');

      s.remove(1, 5);
      assertEquals(s.toString(), 'afghijkl');

      s.remove(9, 12);
      assertEquals(s.toString(), 'afghi');
    });

    await t.step('should remove from the start', () => {
      const s = new MagicString('abcdefghijkl');

      s.remove(0, 6);
      assertEquals(s.toString(), 'ghijkl');
    });

    await t.step('should remove from the end', () => {
      const s = new MagicString('abcdefghijkl');

      s.remove(6, 12);
      assertEquals(s.toString(), 'abcdef');
    });

    await t.step('should treat zero-length removals as a no-op', () => {
      const s = new MagicString('abcdefghijkl');

      s.remove(0, 0).remove(6, 6).remove(9, -3);
      assertEquals(s.toString(), 'abcdefghijkl');
    });

    await t.step('should remove overlapping ranges', () => {
      const s1 = new MagicString('abcdefghijkl');

      s1.remove(3, 7).remove(5, 9);
      assertEquals(s1.toString(), 'abcjkl');

      const s2 = new MagicString('abcdefghijkl');

      s2.remove(3, 7).remove(4, 6);
      assertEquals(s2.toString(), 'abchijkl');
    });

    await t.step('should remove overlapping ranges, redux', () => {
      const s = new MagicString('abccde');

      s.remove(2, 3); // c
      s.remove(1, 3); // bc
      assertEquals(s.toString(), 'acde');
    });

    await t.step('should remove modified ranges', () => {
      const s = new MagicString('abcdefghi');

      s.overwrite(3, 6, 'DEF');
      s.remove(2, 7); // cDEFg
      assertEquals(s.slice(1, 8), 'bh');
      assertEquals(s.toString(), 'abhi');
    });

    await t.step('should not remove content inserted after the end of removed range', () => {
      const s = new MagicString('ab.c;');

      s.prependRight(0, '(');
      s.prependRight(4, ')');
      s.remove(2, 4);
      assertEquals(s.toString(), '(ab);');
    });

    await t.step('should remove interior inserts', () => {
      const s = new MagicString('abc;');

      s.appendLeft(1, '[');
      s.prependRight(1, '(');
      s.appendLeft(2, ')');
      s.prependRight(2, ']');
      s.remove(1, 2);
      assertEquals(s.toString(), 'a[]c;');
    });

    await t.step('should provide a useful error when illegal removals are attempted', () => {
      const s = new MagicString('abcdefghijkl');

      s.overwrite(5, 7, 'XX');

      assertThrows(() => s.remove(4, 6), (err: Error) => /Cannot split a chunk that has already been edited/.test(err.message));
    });

    await t.step('should return this', () => {
      const s = new MagicString('abcdefghijkl');
      assertStrictEquals(s.remove(3, 4), s);
    });

    await t.step('removes across moved content', () => {
      const s = new MagicString('abcdefghijkl');

      s.move(6, 9, 3);
      s.remove(5, 7);

      assertEquals(s.toString(), 'abchidejkl');
    });
  });

  await t.step('slice', async (t) => {
    await t.step('should return the generated content between the specified original characters', () => {
      const s = new MagicString('abcdefghijkl');

      assertEquals(s.slice(3, 9), 'defghi');
      s.overwrite(4, 8, 'XX');
      assertEquals(s.slice(3, 9), 'dXXi');
      s.overwrite(2, 10, 'ZZ');
      assertEquals(s.slice(1, 11), 'bZZk');
      assertEquals(s.slice(2, 10), 'ZZ');

      assertThrows(() => s.slice(3, 9));
    });

    await t.step('defaults `end` to the original string length', () => {
      const s = new MagicString('abcdefghijkl');
      assertEquals(s.slice(3), 'defghijkl');
    });

    await t.step('allows negative numbers as arguments', () => {
      const s = new MagicString('abcdefghijkl');
      assertEquals(s.slice(-3), 'jkl');
      assertEquals(s.slice(0, -3), 'abcdefghi');
    });

    await t.step('includes inserted characters, respecting insertion direction', () => {
      const s = new MagicString('abefij');

      s.prependRight(2, 'cd');
      s.appendLeft(4, 'gh');

      assertEquals(s.slice(), 'abcdefghij');
      assertEquals(s.slice(1, 5), 'bcdefghi');
      assertEquals(s.slice(2, 4), 'cdefgh');
      assertEquals(s.slice(3, 4), 'fgh');
      assertEquals(s.slice(0, 2), 'ab');
      assertEquals(s.slice(0, 3), 'abcde');
      assertEquals(s.slice(4, 6), 'ij');
      assertEquals(s.slice(3, 6), 'fghij');
    });

    await t.step('supports characters moved outward', () => {
      const s = new MagicString('abcdEFghIJklmn');

      s.move(4, 6, 2);
      s.move(8, 10, 12);
      assertEquals(s.toString(), 'abEFcdghklIJmn');

      assertEquals(s.slice(1, -1), 'bEFcdghklIJm');
      assertEquals(s.slice(2, -2), 'cdghkl');
      assertEquals(s.slice(3, -3), 'dghk');
      assertEquals(s.slice(4, -4), 'EFcdghklIJ');
      assertEquals(s.slice(5, -5), 'FcdghklI');
      assertEquals(s.slice(6, -6), 'gh');
    });

    await t.step('supports characters moved inward', () => {
      const s = new MagicString('abCDefghijKLmn');

      s.move(2, 4, 6);
      s.move(10, 12, 8);
      assertEquals(s.toString(), 'abefCDghKLijmn');

      assertEquals(s.slice(1, -1), 'befCDghKLijm');
      assertEquals(s.slice(2, -2), 'CDghKL');
      assertEquals(s.slice(3, -3), 'DghK');
      assertEquals(s.slice(4, -4), 'efCDghKLij');
      assertEquals(s.slice(5, -5), 'fCDghKLi');
      assertEquals(s.slice(6, -6), 'gh');
    });

    await t.step('supports characters moved opposing', () => {
      const s = new MagicString('abCDefghIJkl');

      s.move(2, 4, 8);
      s.move(8, 10, 4);
      assertEquals(s.toString(), 'abIJefghCDkl');

      assertEquals(s.slice(1, -1), 'bIJefghCDk');
      assertEquals(s.slice(2, -2), '');
      assertEquals(s.slice(3, -3), '');
      assertEquals(s.slice(-3, 3), 'JefghC');
      assertEquals(s.slice(4, -4), 'efgh');
      assertEquals(s.slice(0, 3), 'abIJefghC');
      assertEquals(s.slice(3), 'Dkl');
      assertEquals(s.slice(0, -3), 'abI');
      assertEquals(s.slice(-3), 'JefghCDkl');
    });

    await t.step('errors if replaced characters are used as slice anchors', () => {
      const s = new MagicString('abcdef');
      s.overwrite(2, 4, 'CD');

      assertThrows(() => s.slice(2, 3), (err: Error) => /slice end anchor/.test(err.message));

      assertThrows(() => s.slice(3, 4), (err: Error) => /slice start anchor/.test(err.message));

      assertThrows(() => s.slice(3, 5), (err: Error) => /slice start anchor/.test(err.message));

      assertEquals(s.slice(1, 5), 'bCDe');
    });

    await t.step('does not error if slice is after removed characters', () => {
      const s = new MagicString('abcdef');

      s.remove(0, 2);

      assertEquals(s.slice(2, 4), 'cd');
    });
  });

  await t.step('snip', async (t) => {
    await t.step('should return a clone with content outside `start` and `end` removed', () => {
      const s = new MagicString('abcdefghijkl', {
        filename: 'foo.js'
      });

      s.overwrite(6, 9, 'GHI');

      const snippet = s.snip(3, 9);
      assertEquals(snippet.toString(), 'defGHI');
      assertEquals(snippet.filename, 'foo.js');
    });

    await t.step('should snip from the start', () => {
      const s = new MagicString('abcdefghijkl');
      const snippet = s.snip(0, 6);

      assertEquals(snippet.toString(), 'abcdef');
    });

    await t.step('should snip from the end', () => {
      const s = new MagicString('abcdefghijkl');
      const snippet = s.snip(6, 12);

      assertEquals(snippet.toString(), 'ghijkl');
    });

    await t.step('should respect original indices', () => {
      const s = new MagicString('abcdefghijkl');
      const snippet = s.snip(3, 9);

      snippet.overwrite(6, 9, 'GHI');
      assertEquals(snippet.toString(), 'defGHI');
    });
  });

  await t.step('trim', async (t) => {
    await t.step('should trim original content', () => {
      assertEquals(new MagicString('   abcdefghijkl   ').trim().toString(), 'abcdefghijkl');
      assertEquals(new MagicString('   abcdefghijkl').trim().toString(), 'abcdefghijkl');
      assertEquals(new MagicString('abcdefghijkl   ').trim().toString(), 'abcdefghijkl');
    });

    await t.step('should trim replaced content', () => {
      const s = new MagicString('abcdefghijkl');

      s.overwrite(0, 3, '   ').overwrite(9, 12, '   ').trim();
      assertEquals(s.toString(), 'defghi');
    });

    await t.step('should trim original content before replaced content', () => {
      const s = new MagicString('abc   def');

      s.remove(6, 9);
      assertEquals(s.toString(), 'abc   ');

      s.trim();
      assertEquals(s.toString(), 'abc');
    });

    await t.step('should trim original content after replaced content', () => {
      const s = new MagicString('abc   def');

      s.remove(0, 3);
      assertEquals(s.toString(), '   def');

      s.trim();
      assertEquals(s.toString(), 'def');
    });

    await t.step('should trim original content before and after replaced content', () => {
      const s = new MagicString('abc   def   ghi');

      s.remove(0, 3);
      s.remove(12, 15);
      assertEquals(s.toString(), '   def   ');

      s.trim();
      assertEquals(s.toString(), 'def');
    });

    await t.step('should trim appended/prepended content', () => {
      const s = new MagicString(' abcdefghijkl ');

      s.prepend('  ').append('  ').trim();
      assertEquals(s.toString(), 'abcdefghijkl');
    });

    await t.step('should trim empty string', () => {
      const s = new MagicString('   ');

      assertEquals(s.trim().toString(), '');
    });

    await t.step('should return this', () => {
      const s = new MagicString('  abcdefghijkl  ');
      assertStrictEquals(s.trim(), s);
    });

    await t.step('should support trimming chunks with intro and outro', () => {
      const s = new MagicString('    \n');
      s.appendRight(4, 'test');
      assertStrictEquals(s.trim().toString(), 'test');
    });
  });

  await t.step('trimLines', async (t) => {
    await t.step('should trim original content', () => {
      const s = new MagicString('\n\n   abcdefghijkl   \n\n');

      s.trimLines();
      assertEquals(s.toString(), '   abcdefghijkl   ');
    });
  });

  await t.step('isEmpty', async (t) => {
    await t.step('should support isEmpty', () => {
      const s = new MagicString(' abcde   fghijkl ');

      assertEquals(s.isEmpty(), false);

      s.prepend('  ');
      s.append('  ');
      s.remove(1, 6);
      s.remove(9, 15);

      assertEquals(s.isEmpty(), false);

      s.remove(15, 16);

      assertEquals(s.isEmpty(), true);
    });
  });

  await t.step('length', async (t) => {
    await t.step('should support length', () => {
      const s = new MagicString(' abcde   fghijkl ');

      assertEquals(s.length(), 17);

      s.prepend('  ');
      s.append('  ');
      s.remove(1, 6);
      s.remove(9, 15);

      assertEquals(s.length(), 6);

      s.remove(15, 16);

      assertEquals(s.length(), 5);
    });
  });

  await t.step('lastLine', async (t) => {
    await t.step('should support lastLine', () => {
      const s = new MagicString(' abcde\nfghijkl ');

      assertEquals(s.lastLine(), 'fghijkl ');

      s.prepend('  ');
      s.append('  ');
      s.remove(1, 6);
      s.remove(9, 15);

      assertEquals(s.lastLine(), 'fg  ');

      s.overwrite(7, 8, '\n');

      assertEquals(s.lastLine(), 'g  ');

      s.append('\n//lastline');

      assertEquals(s.lastLine(), '//lastline');
    });
  });
});