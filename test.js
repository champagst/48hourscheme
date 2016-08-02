import test from 'ava';

var s = require('./index').scheme;

var unannotate = function(input) {
   return input.value;
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
