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
               
   var parseExpr = P.alt(parseAtom,
                         parseString,
                         parseNumber);

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
