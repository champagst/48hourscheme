;(function() {
   var root = this,
       S = {};

   // Dependencies ------------------------------------------------------------
   var _ = require('ramda'),
       P = require('parsimmon'),
       R = require('./parsers');

   // Helpers -----------------------------------------------------------------
   var _replace_comments = _.replace(/[;].*$/gm, '');

   var _scan = function(str, parser) {
      str = _replace_comments(str);

      var result = parser.parse(str);

      if (result.status) {
         return result.value;
      } else {
         throw Scanner(P.formatError(str, result));
      }
   };

   // Exceptions --------------------------------------------------------------
   var Scanner = function(str) {
      return {
         name: 'Scanner',
         message: 'Scan error at ' + str
      };
   };

   // Scanner -----------------------------------------------------------------
   S.scan = function(str) {
      return _scan(str, R.Expr);
   };

   S.scan_list = function(str) {
      return _scan(str, P.sepBy(R.Expr, R.Spaces).skip(P.optWhitespace));
   };

   if (typeof exports !== 'undefined') {
      if (typeof module !== 'undefined') {
         exports = module.exports = S;
      }
      exports.S = S;
   } else {
      root.S = S;
   }
}).call(this);
