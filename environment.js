;(function() {
   var root = this,
       V = {};

   // Dependencies ------------------------------------------------------------
   var _ = require('ramda'),
       fs = require('fs'),
       S = require('./scanner'),
       T = require('./types');

   // Helpers -----------------------------------------------------------------
   var _car = _.head;
   var _cdr = _.tail;
   var _cadr = _.compose(_car, _cdr);
   var _caddr = _.compose(_car, _cdr, _cdr);
   var _second = _.compose(_.head, _.tail);

   // Exceptions --------------------------------------------------------------
   var NumArgs = function(expected, found) {
      return {
         name: 'NumArgs',
         message: 'Expected ' + expected + ' args; found values ' + T.unannotate(found)
      };
   };

   var TypeMismatch = function(expected, found) {
      return {
         name: 'TypeMismatch',
         message: 'Invalid type: expected ' + expected + ', found ' + found
      };
   };

   var UnboundVar = function(message, varname) {
      return {
         name: 'UnboundVar',
         message: message + ': ' + varname
      };
   };

   var BadSpecialForm = function(message, form) {
      return {
         name: 'BadSpecialForm',
         message: message + ': ' + form
      };
   };

   var NumArgs = function(expected, found) {
      return {
         name: 'NumArgs',
         message: 'Expected ' + expected + ' args; found values ' + T.unannotate(found)
      };
   };

   // Eval --------------------------------------------------------------------
   var _apply = function(proc, args) {
      if (proc instanceof T.PrimitiveFunc) {
         return proc.fn(args);
      } else if (proc instanceof T.Func) {
         if (proc.params.length != args.length && !proc.varargs) {
            throw NumArgs(proc.params.length, args);
         } else {
            return V.eval(proc.body, new V.Environment(proc.params, args, proc.varargs, proc.closure));
         }
      }
   };

   V.eval = function(form, env) {
      if (form instanceof T.String ||
          form instanceof T.Number ||
          form instanceof T.Bool ||
          form instanceof T.Character) {
         return form;
      }

      if (form instanceof T.Atom) {
         return env.get(form.value);
      }

      if (form instanceof T.List) {
         if (form.head().value in special_forms) {
            var proc = form.head().value,
                params = form.tail();

            return _apply_sp_form(proc, params, env);
         } else {
            var head = V.eval(form.head(), env),
                params = _.map(param => V.eval(param, env), form.tail());

            return _apply(head, params);
         }
      }

      throw BadSpecialForm('Unrecognized special form', form);
   };

   // Special Forms -----------------------------------------------------------
   var _apply_sp_form = function(proc, args, env) {
      return special_forms[proc](args, env);
   };

   var _make_func = function(params, varargs, body, env) {
      return new T.Func(_.map(x => x.toString(), params), varargs, body, env);
   };

   var _make_normal_func = function(params, body, env) {
      return _make_func(params, undefined, body, env);
   };

   var _make_var_args = function(params, varargs, body, env) {
      return _make_func(params, varargs.toString(), body, env);
   };

   var _load_proc = function(filename) {
      return S.scan_list(fs.readFileSync(filename, 'utf8'));
   };

   var _load = function(args, env) {
      var filename = _car(args).value,
          forms = _load_proc(filename);

      forms = _.map(form => V.eval(form, env), forms);

      return _.last(forms);
   };

   var _if = function(args, env) {
      var pred = _car(args),
          conseq = _cadr(args),
          alt = _caddr(args),
          result;

      result = V.eval(pred, env).value ? conseq : alt;

      return V.eval(result, env);
   };

   var _quote = function(args) {
      return _car(args);
   };

   var _set = function(args, env) {
      var variable = _car(args),
          value = _cadr(args);

      return env.set(variable, V.eval(value, env));
   };

   var _define = function(args, env) {
      var head = _car(args);

      if (head instanceof T.Atom) {
         var value = _cadr(args);

         return env.define(head, V.eval(value, env));
      }

      if (head instanceof T.List) {
         var proc = head.head(),
             params = head.tail(),
             body = _cadr(args),
             fn = _make_normal_func(params, body, env);

         env.define(proc, fn);

         return fn;
      }

      if (head instanceof T.DottedList) {
         var proc = head.head(),
             params = _.tail(head.initial()),
             varargs = head.last(),
             body = _cadr(args),
             fn = _make_var_args(params, varargs, body, env);

         env.define(proc, fn);

         return fn;
      }
   };

   var _lambda = function(args, env) {
      var head = _car(args);

      if (head instanceof T.List) {
         var params = head.value,
             body = _cadr(args),
             fn = _make_normal_func(params, body, env);

         return fn;
      }

      if (head instanceof T.DottedList) {
         var params = head.initial(),
             varargs = head.last(),
             body = _cadr(args),
             fn = _make_var_args(params, varargs, body, env);

         return fn;
      }

      if (head instanceof T.Atom) {
         var varargs = head,
             body = _cadr(args),
             fn = _make_var_args([], varargs, body, env);

         return fn;
      }
   };

   var special_forms = {
      'load': _load,
      'if': _if,
      'quote': _quote,
      'set!': _set,
      'define': _define,
      'lambda': _lambda
   };

   // Unpackers ---------------------------------------------------------------
   var _unpack_num = function(n) {
      if (n instanceof T.Number) {
         return n.value;
      } else if (n instanceof T.String) {
         var parsed = parseInt(n.value);

         if (!isNaN(parsed)) {
            return parsed;
         }
      } else if (n instanceof T.List) {
         return _unpack_num(n.head());
      }

      throw TypeMismatch('number', n);
   };

   var _unpack_bool = function(b) {
      if (b instanceof T.Bool) {
         return b.value;
      } else {
         throw TypeMismatch('boolean', b);
      }
   };

   var _unpack_str = function(s) {
      if (s instanceof T.String) {
         return s.value;
      } else if (s instanceof T.Number) {
         return s.toString();
      } else if (s instanceof T.Bool) {
         return s.toString();
      } else {
         throw TypeMismatch('string', s);
      }
   };

   var _unpack_equals = function(args) {
      return function(unpacker) {
         try {
            var unpacked1 = unpacker(args[0]),
                unpacked2 = unpacker(args[1]);

            return unpacked1 == unpacked2;
         } catch(e) {
            return false;
         }
      };
   };

   // Binary Operators --------------------------------------------------------
   var _bool_binop = function(unpacker, fn) {
      return function(args) {
         if (args.length == 2) {
            args = _.map(unpacker, args);

            var left = _.head(args),
                right = _second(args);

            return new T.Bool(fn(left, right));
         } else {
            throw NumArgs(2, args);
         }
      };
   };

   var _numeric_binop = function(fn) {
      return function(args) {
         if (args.length >= 2) {
            args = _.map(_unpack_num, args);

            var head = _.head(args),
                rest = _.tail(args);

            return new T.Number(_.reduce(fn, head, rest));
         } else {
            throw NumArgs(2, args);
         }
      };
   };

   var _num_bool_binop = function(fn) {
      return _bool_binop(_unpack_num, fn);
   };

   var _bool_bool_binop = function(fn) {
      return _bool_binop(_unpack_bool, fn);
   };

   var _str_bool_binop = function(fn) {
      return _bool_binop(_unpack_str, fn);
   };

   // List Primitives ---------------------------------------------------------
   var _car_proc = function(args) {
      if (args.length == 1) {
         var form = _.head(args);

         if (form instanceof T.List) {
            return form.head();
         } else if (form instanceof T.DottedList) {
            return form.head();
         } else {
            throw TypeMismatch('pair', form);
         }
      } else {
         throw NumArgs(1, args);
      }
   };

   var _cdr_proc = function(args) {
      if (args.length == 1) {
         var form = _.head(args);

         if (form instanceof T.List) {
            var rest = form.tail();

            return new T.List(rest);
         } else if (form instanceof T.DottedList) {
            var rest = form.tail();

            if (rest.length == 1) {
               return rest[0];
            } else {
               var init = _.tail(form.initial()),
                   last = form.last();

               return new T.DottedList(init, last);
            }
         } else {
            throw TypeMismatch('pair', form);
         }
      } else {
         throw NumArgs(1, args);
      }
   };

   var _cons = function(args) {
      if (args.length == 2) {
         var form = _second(args);

         if (form instanceof T.List) {
            var head = _.init(args),
                rest = form.value;

            if (rest.length == 0) {
               return new T.List(head);
            }

            return new T.List(_.concat(head, rest));
         } else if (form instanceof T.DottedList) {
            var head = _.init(args),
                rest = form.init(),
                last = form.last();

            return new T.DottedList(_.concat(head, rest), last);
         } else {
            var head = _.init(args),
                rest = _.last(args);

            return new T.DottedList(head, rest);
         }
      } else {
         throw NumArgs(2, args);
      }
   };

   var _eqv = function(args) {
      if (args.length == 2) {
         var arg1 = _.head(args),
             arg2 = _second(args);

         if (arg1 instanceof T.Bool && arg2 instanceof T.Bool) {
            return new T.Bool(arg1.value == arg2.value);
         } else if (arg1 instanceof T.Number && arg2 instanceof T.Number) {
            return new T.Bool(arg1.value == arg2.value);
         } else if (arg1 instanceof T.Character && arg2 instanceof T.Character) {
            return new T.Bool(arg1.value == arg2.value);
         } else if (arg1 instanceof T.String && arg2 instanceof T.String) {
            return new T.Bool(arg1.value == arg2.value);
         } else if (arg1 instanceof T.Atom && arg2 instanceof T.Atom) {
            return new T.Bool(arg1.value == arg2.value);
         } else if (arg1 instanceof T.DottedList && arg2 instanceof T.DottedList) {
            return _eqv([new T.List(arg1.initial().concat(arg1.last())), new T.List(arg2.initial().concat(arg2.last()))]);
         } else if (arg1 instanceof T.List && arg2 instanceof T.List) {
            var l1 = arg1.value,
                l2 = arg2.value,
                pairs = _.zip(l1, l2),
                are_eqv = _.all((a, b) => { return _eqv(a, b).value; });

            return new T.Bool(l1.length == l2.length && are_eqv(pairs));
         } else {
            return new T.Bool(false);
         }
      } else {
         throw NumArgs(2, args);
      }
   };

   var _equal = function(args) {
      if (args.length == 2) {
         var unpackers = [_unpack_num, _unpack_bool, _unpack_str],
             primitive_equals = _.compose(_.any(_.identity), _.map(_unpack_equals(args)))(unpackers),
             eqv_equals = _eqv(args);

         return new T.Bool(primitive_equals || eqv_equals.value);
      } else {
         throw NumArgs(2, args);
      }
   };

   // IO Primitives -----------------------------------------------------------
   var _apply_proc = function(args) {
      var proc = _.head(args),
          arg = _second(args);

      if (arg instanceof T.List) {
         args = arg.value;
      } else {
         args = _.tail(args);
      }

      return _apply(proc, args);
   };

   // Primitives --------------------------------------------------------------
   var primitives = {
      '+': _numeric_binop((a, b) => { return a + b; }),
      '-': _numeric_binop((a, b) => { return a - b; }),
      '*': _numeric_binop((a, b) => { return a * b; }),
      '/': _numeric_binop((a, b) => { return a / b; }),
      'mod': _numeric_binop((a, b) => { return a % b; }),
      'quotient': _numeric_binop((a, b) => { return Math.floor(a / b); }),
      '=': _num_bool_binop((a, b) => { return a === b; }),
      '<': _num_bool_binop((a, b) => { return a < b; }),
      '>': _num_bool_binop((a, b) => { return a > b; }),
      '/=': _num_bool_binop((a, b) => { return a !== b; }),
      '>=': _num_bool_binop((a, b) => { return a >= b; }),
      '<=': _num_bool_binop((a, b) => { return a <= b; }),
      '&&': _bool_bool_binop((a, b) => { return a && b; }),
      '||': _bool_bool_binop((a, b) => { return a || b; }),
      'string=?': _str_bool_binop((a, b) => { return a === b; }),
      'string<?': _str_bool_binop((a, b) => { return a < b; }),
      'string>?': _str_bool_binop((a, b) => { return a > b; }),
      'string<=?': _str_bool_binop((a, b) => { return a <= b; }),
      'string>=?': _str_bool_binop((a, b) => { return a >= b; }),
      'car': _car_proc,
      'cdr': _cdr_proc,
      'cons': _cons,
      'eq?': _eqv,
      'eqv?': _eqv,
      'equal?': _equal,
      'apply': _apply_proc
   };

   // Environment -------------------------------------------------------------
   V.Environment = function(params, args, varargs, outer) {
      this.params = params || [];
      this.args = args || [];
      this.varargs = varargs || null;
      this.outer = outer || null;
      this.bindings = _.zip(this.params, this.args).reduce((previous, [param, arg]) => {
         previous[param] = arg;
         return previous;
      }, {});

      var remaining_args = _.drop(this.params.length, this.args);

      if (this.varargs && remaining_args.length) {
         this.bindings[this.varargs] = new T.List(remaining_args);
      }

      this.get = function(variable) {
         if (!(variable in this.bindings)) {
            if (!this.outer) {
               throw UnboundVar('Getting an unbound variable', variable);
            } else {
               return this.outer.get(variable);
            }
         }

         return this.bindings[variable];
      };

      this.set = function(variable, value) {
         if (!(variable in this.bindings)) {
            if (!this.outer) {
               throw UnboundVar('Setting an unbound variable', variable);
            } else {
               return this.outer.set(variable, value);
            }
         }

         this.bindings[variable] = value;
         return value;
      };

      this.define = function(variable, value) {
         this.bindings[variable] = value;
         return value;
      };
   };

   var standard_env = function() {
      var env = new V.Environment();

      Object.keys(primitives).forEach((variable) => {
         env.define(variable, new T.PrimitiveFunc(primitives[variable]));
      });

      return env;
   };

   V.Globals = (function() {
      var env = standard_env();

      return function() {
         return env;
      };
   })();

   if (typeof exports !== 'undefined') {
      if (typeof module !== 'undefined') {
         exports = module.exports = V;
      }
      exports.V = V;
   } else {
      root.V = V;
   }
}).call(this);
