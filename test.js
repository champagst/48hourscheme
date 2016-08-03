import test from 'ava';

var s = require('./index').scheme;

test('parser string', t => {
   t.is(s.parse('"astring"').toString(), '"astring"');
});

test('parser escaped quotes', t => {
   t.is(s.parse('"a \\"quoted\\" string"').toString(), '"a "quoted" string"');
});

test('parser escaped newline', t => {
   t.is(s.parse('"new\\nline"').toString(), '"new\nline"');
});

test('parser escaped backslash', t => {
   t.is(s.parse('"string\\\\a"').toString(), '"string\\a"');
});

test('parser escaped return', t => {
   t.is(s.parse('"string\\ra"').toString(), '"string\ra"');
});

test('parser atom', t => {
   t.is(s.parse('anatom').toString(), 'anatom');
});

test('parser bool true', t => {
   t.is(s.parse('#t').toString(), '#t');
});

test('parser bool false', t => {
   t.is(s.parse('#f').toString(), '#f');
});

test('parser number', t => {
   t.is(s.parse('42').toString(), '42');
});

test('parser character space', t => {
   t.is(s.parse('#\\space').toString(), '#\\space');
});

test('parser character space-character', t => {
   t.is(s.parse('#\\ ').toString(), '#\\space');
});

test('parser character newline', t => {
   t.is(s.parse('#\\newline').toString(), '#\\newline');
});

test('parser character lowercase', t => {
   t.is(s.parse('#\\n').toString(), '#\\n');
});

test('parser character uppercase', t => {
   t.is(s.parse('#\\N').toString(), '#\\N');
});

test('parser character digit', t => {
   t.is(s.parse('#\\9').toString(), '#\\9');
});

test('parser list', t => {
   t.is(s.parse('(a list)').toString(), '(a list)');
});

test('parser list nested', t => {
   t.is(s.parse('(a (nested list))').toString(), '(a (nested list))');
});

test('parser list quoted', t => {
   t.is(s.parse("'x").toString(), '(quote x)');
});

test('parser list quotedlist', t => {
   t.is(s.parse("'(a list)").toString(), '(quote (a list))');
});

test('parser dottedlist', t => {
   t.is(s.parse('(a nice dotted . list)').toString(), '(a nice dotted . list)');
});
