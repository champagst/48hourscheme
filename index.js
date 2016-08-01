var P = require('parsimmon');

var symbol = P.oneOf('!#$%&|*+-/:<=>?@^_~');

var parseString = P.string('"')
                   .then(P.noneOf('"').many().map((result) => { 
                      return { type: 'string', value: result.join('') }; 
                   }))
                   .skip(P.string('"'));

var parseAtom = P.seqMap(P.alt(P.letter, symbol),
                         P.alt(P.letter, P.digit, symbol).many(),
                         (first, rest) => {
                            var atom = first + rest.join('');

                            if (atom === '#t') {
                               return { type: 'bool', value: true };
                            } else if (atom === '#f') {
                               return { type: 'bool', value: false };
                            } else {
                               return { type: 'atom', value: atom };
                            }
                         });

var parseNumber = P.digit.atLeast(1)
                   .map((result) => {
                      return { type: 'number', value: parseInt(result.join('')) };
                   });
            
var parseExpr = P.alt(parseAtom,
                      parseString,
                      parseNumber);

function readExpr(input) {
   var result = parseExpr.parse(input);

   if (result.status) {
      return 'Found value';
   } else {
      return 'No match: ' + P.formatError(input, result);
   }
}

console.log(readExpr(process.argv[2]));
