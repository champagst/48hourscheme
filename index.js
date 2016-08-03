;(function(exports) {
   // Dependencies ------------------------------------------------------------
   var P = require('parsimmon');

   // Helpers -----------------------------------------------------------------
   function fail(string) {
      throw new Error(string);
   }

   var cat = function (array) {
      return array.join('');
   };

   var replace_newline = function(string) {
      return string.replace(/\\n/g, '\n');
   };

   var replace_return = function(string) {
      return string.replace(/\\r/g, '\r');
   };

   var replace_backslash = function(string) {
      return string.replace(/\\\\/g, '\\');
   };

   var replace_quotes = function(string) {
      return string.replace(/\\"/g, '\"');
   };

   var replace_escaped = function(string) {
      var result = string;

      result = replace_newline(result);
      result = replace_return(result);
      result = replace_backslash(result);
      result = replace_quotes(result);

      return result;
   };

   // Parsers -----------------------------------------------------------------
   var symbol = P.oneOf('!#$%&|*+-/:<=>?@^_~');

   var spaces = P.whitespace.atLeast(1)

   var parseString = P.oneOf('"')
                      .then(
                         P.alt(P.string('\\"'), P.noneOf('"'))
                          .many()
                          .map((result) => { 
                             var value;

                             value = cat(result);
                             value = replace_escaped(value);

                             return { type: 'string', value: value }; 
                          }))
                      .skip(P.oneOf('"'));

   var parseCharacter = P.string('#\\')
                         .then(
                           P.alt(P.string('space'), P.string('newline'), P.oneOf(' '), P.letter, P.digit)
                            .map((value) => {
                               if (value === 'space') {
                                  return { type: 'character', value: ' ' };
                               } else if (value === 'newline') {
                                  return { type: 'character', value: '\n' };
                               } else {
                                  return { type: 'character', value: value };
                               }
                            }));

   var parseAtom = P.seqMap(P.alt(P.letter, symbol),
                            P.alt(P.letter, P.digit, symbol).many(),
                            (first, rest) => {
                               var atom = first + cat(rest);

                               if (atom === '#t') {
                                  return { type: 'bool', value: true };
                               } else if (atom === '#f') {
                                  return { type: 'bool', value: false };
                               } else {
                                  return { type: 'atom', value: atom };
                               }
                            });

   var parseNumber = P.digit
                      .atLeast(1)
                      .map((result) => {
                         var value;

                         value = cat(result);
                         value = parseInt(value);

                        return { type: 'number', value: value };
                      });
               
   var parseExpr = P.lazy(() => {
      return P.alt(parseCharacter,
                   parseAtom,
                   parseString,
                   parseNumber,
                   parseQuoted,
                   P.oneOf('(')
                    .then(P.alt(parseDottedList, parseList))
                    .skip(P.oneOf(')')));
   });

   var parseList = P.sepBy(parseExpr, spaces)
                    .map((value) => {
                       return { type: 'list', value: value };
                    });

   var parseDottedList = P.seqMap(P.sepBy(parseExpr, spaces).skip(spaces),
                                  P.seq(P.oneOf('.'), spaces).then(parseExpr),
                                  (head, tail) => {
                                     return { type: 'dottedlist', value: head.concat(tail) };
                                  });

   var parseQuoted = P.oneOf("'")
                      .then(
                         parseExpr.map((result) => {
                            return { type: 'list', value: [{ type: 'atom', value: 'quote'}, result] };
                         }));

   // Main --------------------------------------------------------------------
   var parse = function(string) {
      var result = parseExpr.parse(string);

      if (result.status) {
         return result.value;
      } else {
         fail(P.formatError(string, result));
      }
   }

   exports.scheme = {
      parse: parse
   };
})(typeof exports === 'undefined' ? this : exports);
