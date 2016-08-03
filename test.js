import test from 'ava';

var s = require('./index').scheme;

var unannotate = function(input, acc) {
   acc = acc || '';

   if (input.type === 'list') {
      return acc + '(' + input.value.map(value => unannotate(value, acc)).join(' ') + ')';
   } else {
      return input.value;
   }
};

test('parser string', t => {
   t.is(unannotate(s.parse('"astring"')), 'astring');
});

test('parser escaped quotes', t => {
   t.is(unannotate(s.parse('"a \\"quoted\\" string"')), 'a "quoted" string');
});

test('parser escaped newline', t => {
   t.is(unannotate(s.parse('"new\\nline"')), 'new\nline');
});

test('parser escaped backslash', t => {
   t.is(unannotate(s.parse('"string\\\\a"')), 'string\\a');
});

test('parser escaped return', t => {
   t.is(unannotate(s.parse('"string\\ra"')), 'string\ra');
});

test('parser atom', t => {
   t.is(unannotate(s.parse('anatom')), 'anatom');
});

test('parser bool true', t => {
   t.true(unannotate(s.parse('#t')));
});

test('parser bool false', t => {
   t.false(unannotate(s.parse('#f')));
});

test('parser number', t => {
   t.is(unannotate(s.parse('42')), 42);
});

test('parser character space', t => {
   t.is(unannotate(s.parse('#\\space')), ' ');
});

test('parser character space-character', t => {
   t.is(unannotate(s.parse('#\\ ')), ' ');
});

test('parser character newline', t => {
   t.is(unannotate(s.parse('#\\newline')), '\n');
});

test('parser character lowercase', t => {
   t.is(unannotate(s.parse('#\\n')), 'n');
});

test('parser character uppercase', t => {
   t.is(unannotate(s.parse('#\\N')), 'N');
});

test('parser character digit', t => {
   t.is(unannotate(s.parse('#\\9')), '9');
});

test('parser list', t => {
   t.is(unannotate(s.parse('(a list)')), '(a list)');
});

test('parser list nested', t => {
   t.is(unannotate(s.parse('(a (nested list))')), '(a (nested list))');
});

test('parser list quoted', t => {
   t.is(unannotate(s.parse("'x")), '(quote x)');
});

test('parser list quotedlist', t => {
   t.is(unannotate(s.parse("'(a list)")), '(quote (a list))');
});
