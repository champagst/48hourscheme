;(function() {
   // Dependencies ------------------------------------------------------------
   var R = require('readline'),
       S = require('./scanner'),
       T = require('./types'),
       E = require('./eval'),
       V = require('./environment');

   // Helpers -----------------------------------------------------------------
   var _eval_str = function(str, env) {
      try {
         return E.eval(S.scan(str), env).toString();
      } catch(e) {
         return e.message;
      }
   };

   var _run_repl = function() {
      var rl = R.createInterface({
         input: process.stdin,
         output: process.stdout
      });

      var env = V.primitive_bindings();

      rl.prompt();

      rl.on('line', line => {
         if (line == 'quit') {
            rl.close();
            return;
         }

         console.log(_eval_str(line, env));
         rl.prompt();
      }).on('close', () => {
         process.exit(0);
      });
   };

   var _run_one = function(args) {
      var env = V.primitive_bindings();

      try {
         console.error(E.eval(new T.List([new T.Atom('load'), new T.String(args[2])])).toString());
      } catch(e) {
         console.error(e.message);
      }
   };

   // Main --------------------------------------------------------------------
   var main = function() {
      if (process.argv.length == 2) {
         _run_repl();
      } else if (process.argv.length == 3) {
         _run_one(process.argv);
      } else {
         console.log('Program takes only 0 or 1 arguments');
      }
   };

   main();
}).call(this);
