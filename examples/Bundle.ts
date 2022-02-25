import MagicString, { Bundle } from '../mod.ts';

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
