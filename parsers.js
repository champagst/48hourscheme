;(function() {
   var root = this,
       R = {};

   // Dependencies ------------------------------------------------------------
   var _ = require('ramda'),
       P = require('parsimmon'),
       T = require('./types');

   // Helpers -----------------------------------------------------------------
   var _cat = _.join('');

   var _replace_backslash = _.replace(/\\\\/g, '\\');
   var _replace_newline   = _.replace(/\\n/g, '\n');
   var _replace_return    = _.replace(/\\r/g, '\r');
   var _replace_quotes    = _.replace(/\\"/g, '\"');

   var _replace_escaped = _.compose(_replace_newline,
                                    _replace_return,
                                    _replace_backslash,
                                    _replace_quotes);

   // Parsers -----------------------------------------------------------------
   R.Symbol = P.oneOf('!#$%&|*+-/:<=>?@^_~');

   R.Spaces = P.whitespace.atLeast(1);

   R.String = P.oneOf('"')
               .then(
                  P.alt(P.string('\\"'), P.noneOf('"'))
                   .many()
                   .map((value) => { 
                      value = _cat(value);
                      value = _replace_escaped(value);

                      return new T.String(value);
                   }))
               .skip(P.oneOf('"'));

   R.Character = P.string('#\\')
                  .then(
                    P.alt(P.string('space'), P.string('newline'), P.oneOf(' '), P.letter, P.digit)
                     .map((value) => {
                        if (value == 'space') {
                           return new T.Character(' ');
                        } else if (value == 'newline') {
                           return new T.Character('\n');
                        } else {
                           return new T.Character(value);
                        }
                     }));

   R.Atom = P.seqMap(P.alt(P.letter, R.Symbol),
                     P.alt(P.letter, P.digit, R.Symbol).many(),
                     (first, rest) => {
                        var atom = first + _cat(rest);

                        if (atom == '#t') {
                           return new T.Bool(true);
                        } else if (atom == '#f') {
                           return new T.Bool(false);
                        } else {
                           return new T.Atom(atom);
                        }
                     });

   R.Number = P.digit
               .atLeast(1)
               .map((value) => {
                  value = _cat(value);
                  value = parseInt(value);

                  return new T.Number(value);
               });
               
   R.Expr = P.lazy(() => {
      return P.alt(R.Character,
                   R.Atom,
                   R.String,
                   R.Number,
                   R.Quoted,
                   P.oneOf('(')
                    .then(P.alt(R.DottedList, R.List))
                    .skip(P.oneOf(')')));
   });

   R.List = P.sepBy(R.Expr, R.Spaces)
             .map((value) => {
                return new T.List(value);
             });

   R.DottedList = P.seqMap(P.sepBy(R.Expr, R.Spaces).skip(R.Spaces),
                           P.seq(P.oneOf('.'), R.Spaces).then(R.Expr),
                           (initial, last) => {
                              return new T.DottedList(initial, last);
                           });

   R.Quoted = P.oneOf("'")
               .then(
                  R.Expr.map((value) => {
                     return new T.List([new T.Atom('quote')].concat(value)); 
                  }));

   if (typeof exports !== 'undefined') {
      if (typeof module !== 'undefined') {
         exports = module.exports = R;
      }
      exports.R = R;
   } else {
      root.R = R;
   }
}).call(this);
