# Magic String

This is a port of [Rich Harris'](https://github.com/Rich-Harris) [magic-string](https://github.com/Rich-Harris/magic-string) module, written for the Deno/Browser environment.

## Differences from the original

* This repo was written in Typescript instead of Javascript. Because of this, I removed some explicit type validation in the original code; the user is responsible to use the API in conformance with the Typescript typings.
* Deprecated APIs (`insertLeft`, `insertRight`, `locate`, and `locateOrigin`) were not ported.
* In keeping with Deno style, the entry point is `mod.ts` instead of `index.ts`.

## Usage

### MagicString

```ts
import MagicString from 'https://deno.land/x/magic_string/mod.ts';
const s = new MagicString( 'problems = 99' );

s.overwrite( 0, 8, 'answer' );
s.toString(); // 'answer = 99'

s.overwrite( 11, 13, '42' ); // character indices always refer to the original string
s.toString(); // 'answer = 42'

s.prepend( 'const ' ).append( ';' ); // most methods are chainable

console.log('=== FILE: converted.js');
console.log(s.toString());
// 'const answer = 42;'

const map = s.generateMap({
  source: 'source.js',
  file: 'converted.js.map',
  includeContent: true
}); // generates a v3 sourcemap
console.log('\n=== FILE: converted.js.map');
console.log(map.toString());
```

### Bundle

```ts
import MagicString, { Bundle } from 'https://deno.land/x/magic_string/mod.ts';

const bundle = new Bundle();

bundle.addSource({
  filename: 'foo.js',
  content: new MagicString( 'var answer = 42;' )
});

bundle.addSource({
  filename: 'bar.js',
  content: new MagicString( 'console.log( answer )' )
});

// Advanced: a source can include an `indentExclusionRanges` property
// alongside `filename` and `content`. This will be passed to `s.indent()`

bundle.indent() // optionally, pass an indent string, otherwise it will be guessed
  .prepend( '(function () {\n' )
  .append( '\n}());' );

console.log('=== FILE: bundled.js');
console.log(bundle.toString());
// (function () {
//   var answer = 42;
//   console.log( answer );
// }());

const map = bundle.generateMap({
  file: 'bundle.js',
  includeContent: true,
  hires: true
});
console.log('\n=== FILE: bundled.js.map');
console.log(map.toString());
```
