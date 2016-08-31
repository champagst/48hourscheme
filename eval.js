;(function() {
   var root = this,
       E = {};

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

   var _bind_vars = function(bindings, env) {
      var locals = {};

      for (var prop in env) {
         locals[prop] = env[prop];
      }

      _.forEach(pair => {
         var param = pair[0],
             arg = pair[1];

         locals[param] = arg;
      }, bindings);

      return locals;
   };

   // Special Forms -----------------------------------------------------------
   var _get_variable = function(variable, env) {
      if (!(variable in env)) {
         throw UnboundVar('Getting an unbound variable', variable);
      }

      return env[variable];
   };

   var _set_variable = function(variable, value, env) {
      if (!(variable in env)) {
         throw UnboundVar('Setting an unbound variable', variable);
      }

      env[variable] = value;

      return value;
   };

   var _define_variable = function(variable, value, env) {
      env[variable] = value;

      return value;
   };

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

      forms = _.map(form => E.eval(form, env), forms);

      return _.last(forms);
   };

   var _if = function(args, env) {
      var pred = _car(args),
          conseq = _cadr(args),
          alt = _caddr(args),
          result;

      result = E.eval(pred, env).value ? conseq : alt;

      return E.eval(result, env);
   };

   var _quote = function(args) {
      return _car(args);
   };

   var _set = function(args, env) {
      var variable = _car(args),
          value = _cadr(args);

      return _set_variable(variable, E.eval(value, env), env);
   };

   var _define = function(args, env) {
      var head = _car(args);

      if (head instanceof T.Atom) {
         var value = _cadr(args);

         return _define_variable(head, E.eval(value, env), env);
      }

      if (head instanceof T.List) {
         var proc = head.head(),
             params = head.tail(),
             body = _cadr(args),
             fn = _make_normal_func(params, body, env);

         _define_variable(proc, fn, env);

         return fn;
      }

      if (head instanceof T.DottedList) {
         var proc = head.head(),
             params = _.drop(1, head.initial()),
             varargs = head.tail(),
             body = _cadr(args),
             fn = _make_var_args(params, varargs, body, env);

         _define_variable(proc, fn, env);

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

   // Exceptions --------------------------------------------------------------
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
   E.apply = function(proc, args) {
      if (proc instanceof T.PrimitiveFunc) {
         return proc.fn(args);
      } else if (proc instanceof T.Func) {
         if (proc.params.length != args.length && !proc.varargs) {
            throw NumArgs(proc.params.length, args);
         } else {
            proc.closure = _bind_vars(_.zip(proc.params, args), proc.closure);

            var remaining_args = _.drop(proc.params.length, args);

            if (remaining_args.length) {
               proc.closure = _bind_vars([[proc.varargs, new T.List(remaining_args)]], proc.closure);
            }

            return E.eval(proc.body, proc.closure);
         }
      }
   };

   E.eval = function(form, env) {
      if (form instanceof T.String ||
          form instanceof T.Number ||
          form instanceof T.Bool ||
          form instanceof T.Character) {
         return form;
      }

      if (form instanceof T.Atom) {
         return _get_variable(form.value, env);
      }

      if (form instanceof T.List) {
         if (form.head().value in special_forms) {
            var proc = form.head().value,
                params = form.tail();

            return _apply_sp_form(proc, params, env);
         } else {
            var head = E.eval(form.head(), env),
                params = _.map(param => E.eval(param, env), form.tail());

            return E.apply(head, params);
         }
      }

      throw BadSpecialForm('Unrecognized special form', form);
   };

   if (typeof exports !== 'undefined') {
      if (typeof module !== 'undefined') {
         exports = module.exports = E;
      }
      exports.E = E;
   } else {
      root.E = E;
   }
}).call(this);
