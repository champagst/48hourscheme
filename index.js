;(function(exports) {
   // Dependencies ------------------------------------------------------------
   var P = require('parsimmon');

   // Exceptions --------------------------------------------------------------
   var NotFunction = function(message, func) {
      return {
         name: 'NotFunction',
         message: message + ': ' + func
      };
   };

   var BadSpecialForm = function(message, form) {
      return {
         name: 'BadSpecialForm',
         message: message + ': ' + form
      };
   };

   var Parser = function(parseErr) {
      return {
         name: 'Parser',
         message: 'Parse error at ' + parseErr
      };
   };

   var TypeMismatch = function(expected, found) {
      return {
         name: 'TypeMismatch',
         message: 'Invalid type: expected ' + expected + ', found ' + found
      };
   };

   var NumArgs = function(expected, found) {
      return {
         name: 'NumArgs',
         message: 'Expected ' + expected + ' args; found values ' + unannotate(found)
      };
   };

   // Helpers -----------------------------------------------------------------
   var _ = {
      head: function(array) {
         return array[0];
      },
      tail: function(array) {
         return array.slice(1);
      },
      last: function(array) {
         return array[array.length - 1];
      }
   };

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

   var unannotate = function(array) {
      return array.map(x => { return x.toString(); }).join(' ');
   };

   var unpack_num = function(n) {
      if (n instanceof LNumber) {
         return n.value;
      } else if (n instanceof LString) {
         var parsed = parseInt(n.value);

         if (isNaN(parsed)) {
            throw TypeMismatch('number', n);
         }

         return parsed;
      } else if (n instanceof List) {
         return unpack_num(n.head());
      } else {
         throw TypeMismatch('number', n);
      }
   };

   var unpack_str = function(s) {
      if (s instanceof LString) {
         return s.value;
      } else if (s instanceof LNumber) {
         return s.toString();
      } else if (s instanceof Bool) {
         return s.toString();
      } else {
         throw TypeMismatch('string', s);
      }
   };

   var unpack_bool = function(b) {
      if (b instanceof Bool) {
         return b;
      } else {
         throw TypeMismatch('boolean', b);
      }
   };

   var numeric_binop = function(fn) {
      return function(args) {
         if (args.length < 2) {
            throw NumArgs(2, args);
         }

         return new LNumber(args.map(unpack_num).reduce(fn));
      };
   };

   var bool_binop = function(unpacker, fn) {
      return function(args) {
         if (args.length != 2) {
            throw NumArgs(2, args);
         } else {
            args = args.map(unpacker);
            left = _.head(args);
            right = _.last(args);

            return new Bool(fn(left, right));                 
         }
      };
   };

   var num_bool_binop = function(fn) {
      return bool_binop(unpack_num, fn);
   };

   var str_bool_binop = function(fn) {
      return bool_binop(unpack_str, fn);
   };

   var bool_bool_binop = function(fn) {
      return bool_binop(unpack_bool, fn);
   };

   // Primitives --------------------------------------------------------------
   var primitives = {
      '+': numeric_binop((a, b) => { return a + b; }),
      '-': numeric_binop((a, b) => { return a - b; }),
      '*': numeric_binop((a, b) => { return a * b; }),
      '/': numeric_binop((a, b) => { return a / b; }),
      'mod': numeric_binop((a, b) => { return a % b; }),
      'quotient': numeric_binop((a, b) => { return Math.floor(a / b); }),
      '=': num_bool_binop((a, b) => { return a === b; }),
      '<': num_bool_binop((a, b) => { return a < b; }),
      '>': num_bool_binop((a, b) => { return a > b; }),
      '/=': num_bool_binop((a, b) => { return a !== b; }),
      '>=': num_bool_binop((a, b) => { return a >= b; }),
      '<=': num_bool_binop((a, b) => { return a <= b; }),
      '&&': bool_bool_binop((a, b) => { return a && b; }),
      '||': bool_bool_binop((a, b) => { return a || b; }),
      'string=?': str_bool_binop((a, b) => { return a === b; }),
      'string<?': str_bool_binop((a, b) => { return a < b; }),
      'string>?': str_bool_binop((a, b) => { return a > b; }),
      'string<=?': str_bool_binop((a, b) => { return a <= b; }),
      'string>=?': str_bool_binop((a, b) => { return a >= b; })
   };

   // Types -------------------------------------------------------------------
   var LString = function(contents) {
      this.value = contents;

      this.toString = function() {
         return '"' + this.value + '"';
      };
   };

   var Atom = function(name) {
      this.value = name;

      this.toString = function() {
         return this.value;
      };
   };

   var LNumber = function(contents) {
      this.value = contents;

      this.toString = function() {
         return this.value.toString();
      };
   };

   var Character = function(contents) {
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

   var Bool = function(contents) {
      this.value = contents;

      this.toString = function() {
         if (this.value === true) {
            return '#t';
         } else if (this.value === false) {
            return '#f';
         }
      };
   };

   var List = function(array) {
      this.value = array;

      this.toString = function() {
         return '(' + unannotate(this.value) + ')';
      };

      this.head = function() {
         return _.head(this.value);
      };

      this.tail = function() {
         return _.tail(this.value);
      };

      this.last = function() {
         return _.last(this.value);
      };
   };

   var DottedList = function(head, tail) {
      this.head = head;
      this.tail = tail;

      this.toString = function() {
         return '(' + unannotate(this.head) + ' . ' + this.tail.toString() + ')';
      };
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

                             return new LString(value);
                          }))
                      .skip(P.oneOf('"'));

   var parseCharacter = P.string('#\\')
                         .then(
                           P.alt(P.string('space'), P.string('newline'), P.oneOf(' '), P.letter, P.digit)
                            .map((value) => {
                               if (value === 'space') {
                                  return new Character(' ');
                               } else if (value === 'newline') {
                                  return new Character('\n');
                               } else {
                                  return new Character(value);
                               }
                            }));

   var parseAtom = P.seqMap(P.alt(P.letter, symbol),
                            P.alt(P.letter, P.digit, symbol).many(),
                            (first, rest) => {
                               var atom = first + cat(rest);

                               if (atom === '#t') {
                                  return new Bool(true);
                               } else if (atom === '#f') {
                                  return new Bool(false);
                               } else {
                                  return new Atom(atom);
                               }
                            });

   var parseNumber = P.digit
                      .atLeast(1)
                      .map((result) => {
                         var value;

                         value = cat(result);
                         value = parseInt(value);

                         return new LNumber(value);
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
                       return new List(value);
                    });

   var parseDottedList = P.seqMap(P.sepBy(parseExpr, spaces).skip(spaces),
                                  P.seq(P.oneOf('.'), spaces).then(parseExpr),
                                  (head, tail) => {
                                     return new DottedList(head, tail);
                                  });

   var parseQuoted = P.oneOf("'")
                      .then(
                         parseExpr.map((value) => {
                            return new List([new Atom('quote')].concat(value)); 
                         }));

   // Main --------------------------------------------------------------------
   function parse(string) {
      var result = parseExpr.parse(string);

      if (result.status) {
         return result.value;
      } else {
         throw Parser(P.formatError(string, result));
      }
   }
   
   function apply(func, args) {
      if (!(func in primitives)) {
         throw NotFunction('Unrecognized primitive function args', func);
      }

      return primitives[func](args);
   }

   function eval_form(form) {
      if (form instanceof LString ||
          form instanceof LNumber ||
          form instanceof Bool ||
          form instanceof Character) {
         return form;
      }

      if (form instanceof List) {
         var atom = form.head();

         if (atom instanceof Atom && atom.value === 'quote') {
            return form.last();
         }
      }

      if (form instanceof List) {
         var atom = form.head(),
             args = form.tail();

         if (atom instanceof Atom && atom.value === 'if' &&
             args.length === 3) {
            var pred = args[0],
                conseq = args[1],
                alt = args[2],
                result = eval_form(pred).value;

            if (result === false) {
               return eval_form(alt);
            } else {
               return eval_form(conseq);
            }
         }
      }

      if (form instanceof List) {
         var func = form.head(),
             args = form.tail().map(eval_form);

         return apply(func, args);
      }

      throw BadSpecialForm('Unrecognized special form', form);
   }

   exports.scheme = {
      parse: parse
   };
})(typeof exports === 'undefined' ? this : exports);
