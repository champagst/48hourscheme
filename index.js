;(function(exports) {
   // Dependencies ------------------------------------------------------------
   var R = require('readline'),
       P = require('parsimmon'),
       _ = require('lodash');

   // Exceptions --------------------------------------------------------------
   var NotFunction = function(message, fn) {
      return {
         name: 'NotFunction',
         message: message + ': ' + fn
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

   var UnboundVar = function(message, varname) {
      return {
         name: 'UnboundVar',
         message: message + ': ' + varname
      };
   };

   // Helpers -----------------------------------------------------------------
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

   var unpack_equals = function(args) {
      return function(unpacker) {
         try {
            var unpacked1 = unpacker(args[0]),
                unpacked2 = unpacker(args[1]);

            return unpacked1 === unpacked2;
         } catch (e) {
            return false;
         }
      };
   };

   // Unpackers ---------------------------------------------------------------
   var unpack_num = function(n) {
      if (n instanceof LNumber) {
         return n.value;
      } else if (n instanceof LString) {
         var parsed = parseInt(n.value);

         if (!isNaN(parsed)) {
            return parsed;
         }
      } else if (n instanceof List) {
         return unpack_num(n.head());
      }

      throw TypeMismatch('number', n);
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

   // Binary Operators --------------------------------------------------------
   var numeric_binop = function(fn) {
      return function(args) {
         if (args.length >= 2) {
            return new LNumber(args.map(unpack_num).reduce(fn));
         } else {
            throw NumArgs(2, args);
         }
      };
   };

   var bool_binop = function(unpacker, fn) {
      return function(args) {
         if (args.length === 2) {
            var left, right;

            args = args.map(unpacker);
            left = _.head(args),
            right = _.last(args);

            return new Bool(fn(left, right));
         } else {
            throw NumArgs(2, args);
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

   // List Primitives ---------------------------------------------------------
   var car = function(args) {
      if (args.length === 1) {
         var form = _.head(args);

         if (form instanceof List) {
            return form.head();
         } else if (form instanceof DottedList) {
            return form.head();
         } else {
            throw TypeMismatch('pair', form);
         }
      } else {
         throw NumArgs(1, args);
      }
   };

   var cdr = function(args) {
      if (args.length === 1) {
         var form = _.head(args);

         if (form instanceof List) {
            return new List(form.tail());
         } else if (form instanceof DottedList) {
            var initial = form.initial(),
                last = form.last();

            if (initial.length === 1) {
               return last;
            } else {
               return new DottedList(_.tail(initial), last);
            }
         } else {
            throw TypeMismatch('pair', form);
         }
      } else {
         throw NumArgs(1, args);
      }
   };

   var cons = function(args) {
      if (args.length === 2) {
         var form = _.last(args);         

         if (form instanceof List) {
            return new List(_.initial(args).concat(form.value));
         } else if (form instanceof DottedList) {
            return new DottedList(_.initial(args).concat(form.initial()), form.last());
         } else {
            return new DottedList(_.initial(args), _.last(args));
         }
      } else {
         throw NumArgs(2, args);
      }
   };

   var eqv = function(args) {
      if (args.length === 2) {
         var args1 = _.head(args),
             args2 = _.last(args);

         if (args1 instanceof Bool && args2 instanceof Bool) {
            return new Bool(args1.value === args2.value);
         } else if (args1 instanceof LNumber && args2 instanceof LNumber) {
            return new Bool(args1.value === args2.value);
         } else if (args1 instanceof Character && args2 instanceof Character) { 
            return new Bool(args1.value === args2.value);
         } else if (args1 instanceof LString && args2 instanceof LString) {
            return new Bool(args1.value === args2.value);
         } else if (args1 instanceof Atom && args2 instanceof Atom) {
            return new Bool(args1.value === args2.value);
         } else if (args1 instanceof DottedList && args2 instanceof DottedList) {
            return eqv([new List(args1.initial().concat(args1.last())), new List(args2.initial().concat(args2.last()))]);
         } else if (args1 instanceof List && args2 instanceof List) {
            var l1 = args1.value,
                l2 = args2.value;

            return new Bool(_.every(_.zip(l1, l2), (x1, x2) => {
                                    return eqv(x1, x2).value;
                                    }));
         } else {
            return new Bool(false);            
         }
      } else {
         throw NumArgs(2, args);
      }
   };

   var equal = function(args) {
      if (args.length === 2) {
         var unpackers = [unpack_num, unpack_str, unpack_bool],
             primitive_equals = _.some(_.map(unpackers, unpack_equals(args))),
             eqv_equals = eqv(args);

         return new Bool(primitive_equals || eqv_equals.value);
      } else {
         throw NumArgs(2, args);
      }
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
      'string>=?': str_bool_binop((a, b) => { return a >= b; }),
      'car': car,
      'cdr': cdr,
      'cons': cons,
      'eq?': eqv,
      'eqv?': eqv,
      'equal?': equal
   };

   var apply = function(fn, args) {
      return fn.apply(args);
   }

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

   var DottedList = function(initial, last) {
      this._initial = initial;
      this._last = last;

      this.toString = function() {
         return '(' + unannotate(this._initial) + ' . ' + this._last.toString() + ')';
      };

      this.head = function() {
         return _.head(this._initial);
      };

      this.initial = function() {
         return this._initial;
      };

      this.last = function() {
         return this._last;
      };
   };

   var PrimitiveFunc = function(fn) {
      this.fn = fn;

      this.apply = function(args) {
         return this.fn(args);
      };

      this.toString = function() {
         return '<primitive>';
      };
   };

   // Parsing -----------------------------------------------------------------
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
                                  (initial, last) => {
                                     return new DottedList(initial, last);
                                  });

   var parseQuoted = P.oneOf("'")
                      .then(
                         parseExpr.map((value) => {
                            return new List([new Atom('quote')].concat(value)); 
                         }));

   var parse = function(string) {
      var result = parseExpr.parse(string);

      if (result.status) {
         return result.value;
      } else {
         throw Parser(P.formatError(string, result));
      }
   }
   
   // Evaluation --------------------------------------------------------------
   var eval_form = function(env, form) {
      if (form instanceof LString ||
          form instanceof LNumber ||
          form instanceof Bool ||
          form instanceof Character) {
         return form;
      } 

      if (form instanceof Atom) {
         return get_variable(env, form.value);
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

         if (atom instanceof Atom && atom.value === 'if' && args.length === 3) {
            var pred = args[0],
                conseq = args[1],
                alt = args[2];

            return eval_form(env, eval_form(env, pred).value ? conseq : alt);
         }
      }

      if (form instanceof List) {
         var atom = form.head(),
             args = form.tail();

         if (atom instanceof Atom && atom.value === 'set!') {
            var variable = args[0],
                value_form = args[1];

            if (variable instanceof Atom) {
               return set_variable(env, variable, eval_form(env, value_form));
            }
         }
      }

      if (form instanceof List) {
         var atom = form.head(),
             args = form.tail();

         if (atom instanceof Atom && atom.value === 'define') {
            var variable = args[0],
                value_form = args[1];

            if (variable instanceof Atom) {
               return define_variable(env, variable, eval_form(env, value_form));
            }
         }
      }

      if (form instanceof List) {
         var form = form.value.map(x => eval_form(env, x)),
             fn = _.head(form),
             args = _.tail(form);

         return apply(fn, args);
      }

      throw BadSpecialForm('Unrecognized special form', form);
   }

   var eval_string = function(env, expr) {
      try {
         return eval_form(env, parse(expr)).toString();
      } catch(e) {
         return e.message;
      }
   };

   var eval_and_print = function(env, expr) {
      console.log(eval_string(env, expr));
   };

   // Environment -------------------------------------------------------------
   var get_variable = function(env, variable) {
      if (variable in env) {
         return env[variable];
      } else {
         throw UnboundVar('Getting an unbound variable', variable);
      }
   };

   var set_variable = function(env, variable, value) {
      if (variable in env) {
         env[variable] = value;
         return value;
      } else {
         throw UnboundVar('Setting an unbound variable', variable);
      }
   };

   var define_variable = function(env, variable, value) {
      if (variable in env) {
         return set_variable(env, variable, value);
      } else {
         env[variable] = value;
         return value;
      }
   };

   var bind_vars = function(env, bindings) {
      var new_env = {};

      for (var prop in bindings) {
         new_env[prop] = bindings[prop];
      }

      for (var prop in env) {
         new_env[prop] = env[prop];
      }

      return new_env;
   };

   var primitive_bindings = function() {
      var new_primitives = {};

      for (var prop in primitives) {
         new_primitives[prop] = new PrimitiveFunc(primitives[prop]);
      }

      return new_primitives;
   };

   // REPL --------------------------------------------------------------------
   var run_one = function(expr) {
      var env = primitive_bindings();

      eval_and_print(env, expr);
   };

   var run_repl = function() {
      var rl = R.createInterface({
          input: process.stdin,
          output: process.stdout
      });

      var env = primitive_bindings();

      rl.prompt();

      rl.on('line', (line) => {
         if (line === 'quit') {
            rl.close();
            return;
         }

         eval_and_print(env, line);
         rl.prompt();
      }).on('close', () => {
         process.exit(0);
      });
   };

   // Main --------------------------------------------------------------------
   var main = function() {
      if (process.argv.length === 2) {
         run_repl();
      } else if (process.argv.length === 3) {
         run_one(process.argv[2]);
      } else {
         console.log('Program takes only 0 or 1 argument');
      }
   };

   main();

   exports.scheme = {
      parse: parse
   };
})(typeof exports === 'undefined' ? this : exports);
