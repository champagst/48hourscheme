;(function() {
   var root = this,
       T = {};

   // Dependencies ------------------------------------------------------------
   var _ = require('ramda');

   // Helpers -----------------------------------------------------------------
   T.unannotate = _.compose(_.join(' '), _.map(x => { return x.toString(); }));

   // Types -------------------------------------------------------------------
   T.String = function(contents) {
      this.value = contents;

      this.toString = function() {
         return '"' + this.value + '"';
      };
   };

   T.Atom = function(name) {
      this.value = name;

      this.toString = function() {
         return this.value;
      };
   };

   T.Number = function(contents) {
      this.value = contents;

      this.toString = function() {
         return this.value.toString();
      };
   };

   T.Character = function(contents) {
      this.value = contents;

      this.toString = function() {
         if (this.value === ' ') {
            return '#\\space';
         } else if (this.value === '\n') {
            return '#\\newline';
         } else {
            return '#\\' + this.value;
         }
      };
   };

   T.Bool = function(contents) {
      this.value = contents;

      this.toString = function() {
         if (this.value === true) {
            return '#t';
         } else if (this.value === false) {
            return '#f';
         }
      };
   };

   T.List = function(array) {
      this.value = array;

      this.toString = function() {
         return '(' + T.unannotate(this.value) + ')';
      };

      this.head = function() {
         return _.head(this.value);
      };

      this.tail = function() {
         return _.tail(this.value);
      };
   };

   T.DottedList = function(initial, last) {
      this.value = initial.concat(last);

      this.head = function() {
         return _.head(this.value);
      };

      this.tail = function() {
         return _.tail(this.value);
      };

      this.initial = function() {
         return _.init(this.value);
      };

      this.toString = function() {
         return '(' + T.unannotate(_.init(this.value)) + ' . ' + _.last(this.value).toString() + ')';
      };

      this.last = function() {
         return _.last(this.value);
      };
   };

   T.Func = function(params, varargs, body, closure) {
      this.params = params;
      this.varargs = varargs;
      this.body = body;
      this.closure = closure;

      this.toString = function() {
         var result = '(lambda (' + T.unannotate(this.params);

         if (this.varargs) {
            result += ' . ' + this.varargs;
         }

         result += ') ...)';

         return result;
      };
   };

   T.PrimitiveFunc = function(fn) {
      this.fn = fn;

      this.toString = function() {
         return '<primitive>';
      };
   };

   if (typeof exports !== 'undefined') {
      if (typeof module !== 'undefined') {
         exports = module.exports = T;
      }
      exports.T = T;
   } else {
      root.T = T;
   }
}).call(this);
