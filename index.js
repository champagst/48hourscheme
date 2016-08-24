;(function(exports) {
   'use strict';

   // Dependencies ------------------------------------------------------------
   var R = require('readline'),
       P = require('parsimmon'),
       _ = require('lodash'),
       fs = require('fs');

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

   var make_func = function(varargs, env, params, body) {
      return new Func(params.map(x => x.toString()), varargs, body, env);
   };

   var make_normal_func = function(env, params, body) {
      return make_func(undefined, env, params, body);
   };

   var make_var_args = function(varargs, env, params, body) {
      return make_func(varargs.toString(), env, params, body);
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

   // IO Primitives -----------------------------------------------------------
   var apply_proc = function(args) {
      var fn = _.head(args),
          list = args[1];

      if (list instanceof List) {
         args = list.value;
      } else {
         args = _.tail(args);
      }

      return fn.apply(args);
   };

   var load = function(filename) {
      return read_expr_list(fs.readFileSync(filename, 'utf8'));
   };

   var read_all = function(args) {
      var filename = args[0].value;

      return new List(load(filename));
   };

   var read_contents = function(args) {
      var filename = _.head(args).value;

      return new LString(load(filename));
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
      'equal?': equal,
      'apply': apply_proc,
      'read-contents': read_contents,
      'read-all': read_all
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

      this.get = function(idx) {
         return this.value[idx];
      };

      this.length = function() {
         return this.value.length;
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

   var Func = function(params, varargs, body, closure) {
      this.params = params;
      this.varargs = varargs;
      this.body = body;
      this.closure = closure;

      this.apply = function(args) {
         if (this.params.length != args.length && !this.varargs) {
            throw NumArgs(this.params.length, args);
         } else {
            var locals = bind_vars(this.closure, _.zip(params, args)),
                remaining_args = _.drop(args, this.params.length);

            if (remaining_args.length) {
               locals = bind_vars(locals, [[this.varargs, new List(remaining_args)]]);
            }
                             
            return eval_form(locals, this.body);
         }
      };

      this.toString = function() {
         var result = '(lambda (' + unannotate(this.params);

         if (this.varargs) {
            result += ' . ' + this.varargs;
         }

         result += ') ...)';

         return result;
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

   var read_or_throw = function(parser, input) {
      var result = parser.parse(input);

      if (result.status) {
         return result.value;
      } else {
         throw Parser(P.formatError(input, result));
      }
   };

   var read_expr = function(input) {
      return read_or_throw(parseExpr, input);
   };

   var read_expr_list = function(input) {
      return read_or_throw(P.sepBy(parseExpr, spaces).skip(P.optWhitespace), input);
   };
   
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
         if (form.length() === 2) {
            var atom = form.head(),
                string = form.last();

            if (atom instanceof Atom && atom.value === 'load' && string instanceof LString) {
               var filename = string.value,
                   listing = load(filename);
              
               return _.last(_.map(listing, form => { return eval_form(env, form); }));
            }
         }
      }

      if (form instanceof List) {
         if (form.length() === 2) {
            var atom = form.head(),
                value = form.last();

            if (atom instanceof Atom && atom.value === 'quote') {
               return value;
            }
         }
      } 
      
      if (form instanceof List) {
         if (form.length() === 4) {
            var atom = form.get(0),
                pred = form.get(1),
                conseq = form.get(2),
                alt = form.get(3);

            if (atom instanceof Atom && atom.value === 'if') {
               return eval_form(env, eval_form(env, pred).value ? conseq : alt);
            }
         }
      }

      if (form instanceof List) {
         if (form.length() === 3) {
            var atom = form.get(0),
                variable = form.get(1),
                value = form.get(2);

            if (atom instanceof Atom && atom.value === 'set!' && variable instanceof Atom) {
               return set_variable(env, variable, eval_form(env, value));
            }
         }
      }

      if (form instanceof List) {
         if (form.length() === 3) {
            var atom = form.get(0),
                variable = form.get(1),
                value = form.get(2);

            if (atom instanceof Atom && atom.value === 'define' && variable instanceof Atom) {
               return define_variable(env, variable, eval_form(env, value));
            }
         }
      }

      if (form instanceof List) {
         if (form.length() === 3) {
            var atom = form.get(0),
                args = form.get(1),
                body = form.get(2);

            if (atom instanceof Atom && atom.value === 'define' && args instanceof List) {
               var proc = args.head(),
                   params = args.tail(),
                   fn = make_normal_func(env, params, body);

               define_variable(env, proc, fn);

               return fn;
            }
         }
      }

      if (form instanceof List) {
         if (form.length() === 3) {
            var atom = form.get(0),
                args = form.get(1),
                body = form.get(2);

            if (atom instanceof Atom && atom.value === 'define' && args instanceof DottedList) {
               var initial = args.initial(),
                   proc = _.head(initial),
                   params = _.tail(initial),
                   varargs = args.last(),
                   fn = make_var_args(varargs, env, params, body);

               define_variable(env, proc, fn);

               return fn;
            }
         }
      }

      if (form instanceof List) {
         if (form.length() === 3) {
            var atom = form.get(0),
                args = form.get(1),
                body = form.get(2);

            if (atom instanceof Atom && atom.value === 'lambda' && args instanceof List) {
               var params = args.value,
                   fn = make_normal_func(env, params, body);

               return fn;
            }
         }
      }

      if (form instanceof List) {
         if (form.length() === 3) {
            var atom = form.get(0),
                args = form.get(1),
                body = form.get(2);

            if (atom instanceof Atom && atom.value === 'lambda' && args instanceof DottedList) {
               var params = args.initial(),
                   varargs = args.last(),
                   fn = make_var_args(varargs, env, params, body);
                   
               return fn;
            }
         }
      }

      if (form instanceof List) {
         if (form.length() === 3) {
            var atom = form.get(0),
                varargs = form.get(1),
                body = form.get(2);

            if (atom instanceof Atom && atom.value === 'lambda' && varargs instanceof Atom) {
               var fn = make_var_args(varargs, env, [], body);

               return fn;
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
         return eval_form(env, read_expr(expr)).toString();
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
      var locals = {};

      for (var prop in env) {
         locals[prop] = env[prop];
      }

      _.each(bindings, pair => {
         var param = pair[0],
             arg = pair[1];

         locals[param] = arg;
      });

      return locals;
   };

   var primitive_bindings = function() {
      var new_primitives = {};

      for (var prop in primitives) {
         new_primitives[prop] = new PrimitiveFunc(primitives[prop]);
      }

      return new_primitives;
   };

   // REPL --------------------------------------------------------------------
   var run_one = function(args) {
      var env = primitive_bindings();

      try {
         console.error(eval_form(env, new List([new Atom('load'), new LString(args[2])])).toString());
      } catch (e) {
         console.error(e.message);
      }
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
         run_one(process.argv);
      } else {
         console.log('Program takes only 0 or 1 argument');
      }
   };

   main();
})(typeof exports === 'undefined' ? this : exports);
