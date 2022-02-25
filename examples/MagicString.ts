import MagicString from '../mod.ts';
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
