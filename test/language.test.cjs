const test = require('node:test');
const assert = require('node:assert');
const language = require('../dist/language.js');
const { builtinFunctions, builtinConstants } = require('../dist/constants/builtins.js');

test('classifyType maps primitive and generic types', () => {
    assert.strictEqual(language.classifyType('u64'), 'integer');
    assert.strictEqual(language.classifyType('u256'), 'integer');
    assert.strictEqual(language.classifyType('string'), 'string');
    assert.strictEqual(language.classifyType('bytes'), 'bytes');
    assert.strictEqual(language.classifyType('bool'), 'bool');
    assert.strictEqual(language.classifyType('optional<u64>'), 'optional');
    assert.strictEqual(language.classifyType('range<u64>'), 'range');
    assert.strictEqual(language.classifyType('map<string, u64>'), 'map');
    assert.strictEqual(language.classifyType('u64[]'), 'array');
    assert.strictEqual(language.classifyType('Iterator<u64>'), 'iterator');
    assert.strictEqual(language.classifyType('Point'), undefined);
});

test('inferVariableTypes finds declared variables', () => {
    const source = [
        'const MAX: u64 = 10',
        'entry main() {',
        '  let name: string = "hi"',
        '  let items: u64[] = []',
        '  let lookup: map<string, u64> = {}',
        '}'
    ].join('\n');

    const types = language.inferVariableTypes(source);
    assert.strictEqual(types.get('MAX'), 'integer');
    assert.strictEqual(types.get('name'), 'string');
    assert.strictEqual(types.get('items'), 'array');
    assert.strictEqual(types.get('lookup'), 'map');
});

test('inferVariableTypeInfo tracks user structs, parameters and receiver types', () => {
    const source = [
        'struct Point { x: u64 }',
        'struct Rectangle { top_left: Point, width: u64 }',
        'fn (rectangle Rectangle) area() -> u64 {',
        '  return rectangle.width',
        '}',
        'fn build(point: Point, label: string) -> u64 {',
        '  let rectangle: Rectangle = Rectangle { top_left: point, width: 1u64 }',
        '  return rectangle.width',
        '}'
    ].join('\n');

    const types = language.inferVariableTypeInfo(source);
    assert.deepStrictEqual(types.get('rectangle'), { userType: 'Rectangle' });
    assert.deepStrictEqual(types.get('point'), { userType: 'Point' });
    assert.deepStrictEqual(types.get('label'), { receiver: 'string' });
});

test('scanStructs extracts field names and types', () => {
    const source = [
        'struct Point {',
        '    x: u64,',
        '    y: u64',
        '}',
        'struct Rectangle {',
        '    top_left: Point,',
        '    width: u64,',
        '    height: u64',
        '}'
    ].join('\n');

    const structs = language.scanStructs(source);
    assert.deepStrictEqual(structs.get('Point').fields, [
        { name: 'x', type: 'u64' },
        { name: 'y', type: 'u64' }
    ]);
    assert.deepStrictEqual(structs.get('Point').typeParameters, []);
    assert.deepStrictEqual(structs.get('Rectangle').fields.map(field => field.name), ['top_left', 'width', 'height']);
    assert.strictEqual(structs.get('Rectangle').fields[0].type, 'Point');

    const generic = language.scanStructs('struct Entry<K, V> {\n    key: K,\n    value: V\n}').get('Entry');
    assert.deepStrictEqual(generic.typeParameters, ['K', 'V']);
    assert.deepStrictEqual(generic.fields.map(field => field.name), ['key', 'value']);
});

test('scanMethods extracts receiver methods and generic receivers', () => {
    const source = [
        'fn (point Point) manhattan() -> u64 {',
        '  return point.x + point.y',
        '}',
        'fn (rectangle Rectangle) area() -> u64 {',
        '  return rectangle.width * rectangle.height',
        '}',
        'fn (entry Entry<string, u64>) is_large() -> bool {',
        '  return entry.value > 10u64',
        '}'
    ].join('\n');

    const methods = language.scanMethods(source);
    assert.deepStrictEqual(methods.get('Point').map(method => method.name), ['manhattan']);
    assert.strictEqual(methods.get('Point')[0].signature, 'manhattan() -> u64');
    assert.strictEqual(methods.get('Point')[0].receiverName, 'point');
    assert.deepStrictEqual(methods.get('Rectangle').map(method => method.name), ['area']);
    assert.strictEqual(methods.get('Entry')[0].signature, 'is_large() -> bool');
});

test('resolveMemberType resolves variables, nested fields and builtin fields', () => {
    const source = [
        'struct Point {',
        '    x: u64,',
        '    y: u64',
        '}',
        'struct Rectangle {',
        '    top_left: Point,',
        '    width: u64,',
        '    height: u64',
        '}',
        'entry main() {',
        '    let rectangle: Rectangle = Rectangle { top_left: Point { x: 1u64, y: 2u64 }, width: 3u64, height: 4u64 }',
        '    let moved: Rectangle = rectangle.clone()',
        '}'
    ].join('\n');

    assert.deepStrictEqual(language.resolveMemberType(source, 'rectangle'), { userType: 'Rectangle' });
    assert.deepStrictEqual(language.resolveMemberType(source, 'rectangle.top_left'), { userType: 'Point' });
    assert.deepStrictEqual(language.resolveMemberType(source, 'rectangle.top_left.x'), { receiver: 'integer' });
    assert.deepStrictEqual(language.resolveMemberType(source, 'moved.width'), { receiver: 'integer' });
    assert.deepStrictEqual(language.resolveMemberType(source, 'unknown'), {});
    assert.deepStrictEqual(language.resolveMemberType(source, 'rectangle.missing'), {});
});

test('resolveMemberType substitutes generic type arguments', () => {
    const source = [
        'struct Entry<K, V> {',
        '    key: K,',
        '    value: V',
        '}',
        'fn (entry Entry<string, u64>) is_large() -> bool {',
        '  return entry.value > 10u64',
        '}',
        'entry main() {',
        '    let count: Entry<string, u64> = Entry { key: "items", value: 12u64 }',
        '    let nested: Entry<string, Entry<u32, u64>> = Entry { key: "nested", value: Entry { key: 7u32, value: 99u64 } }',
        '}'
    ].join('\n');

    assert.deepStrictEqual(language.resolveMemberType(source, 'count'), {
        userType: 'Entry',
        typeArguments: ['string', 'u64']
    });
    assert.deepStrictEqual(language.resolveMemberType(source, 'count.value'), { receiver: 'integer' });
    assert.deepStrictEqual(language.resolveMemberType(source, 'nested.key'), { receiver: 'string' });
    assert.deepStrictEqual(language.resolveMemberType(source, 'nested.value'), {
        userType: 'Entry',
        typeArguments: ['u32', 'u64']
    });
    assert.deepStrictEqual(language.resolveMemberType(source, 'nested.value.key'), { receiver: 'integer' });
    assert.deepStrictEqual(language.resolveVariableType('Entry<string, Entry<u32, u64>>'), {
        userType: 'Entry',
        typeArguments: ['string', 'Entry<u32, u64>']
    });
});

test('scanVariables finds local variables and parameters but not top-level consts', () => {
    const source = [
        'const LIMIT: u64 = 10',
        'entry main(amount: u64) {',
        '  let name: string = "hi"',
        '  let lookup: map<string, u64> = {}',
        '  const local: u64 = 1',
        '  let name: string = "other"',
        '}'
    ].join('\n');

    const variables = language.scanVariables(source);
    const byName = Object.fromEntries(variables.map(v => [v.name, v.kind]));

    assert.strictEqual(byName['LIMIT'], undefined);
    assert.strictEqual(byName['amount'], 'parameter');
    assert.strictEqual(byName['name'], 'variable');
    assert.strictEqual(byName['lookup'], 'variable');
    assert.strictEqual(byName['local'], 'const');
    assert.strictEqual(variables.filter(v => v.name === 'name').length, 1);
});

test('scanVariables keeps same-named locals from different functions once', () => {
    const source = [
        'fn a() {',
        '  let value: u64 = 1',
        '}',
        'fn b(value: string) {',
        '  let other: string = value',
        '}'
    ].join('\n');

    const variables = language.scanVariables(source);
    const byName = Object.fromEntries(variables.map(v => [v.name, v.kind]));

    assert.strictEqual(byName['value'], 'variable');
    assert.strictEqual(byName['other'], 'variable');
    assert.strictEqual(variables.length, 2);
});

test('scanSymbols finds functions, structs, enums, hooks and constants', () => {
    const source = [
        'const LIMIT: u64 = 10',
        'struct Point { x: u64 }',
        'enum Status { Ready }',
        'pub fn helper() {}',
        'fn (p Point) manhattan() -> u64 {}',
        'hook on_transfer(amount: u64) {}',
        'entry main() {}'
    ].join('\n');

    const symbols = language.scanSymbols(source);
    const byName = Object.fromEntries(symbols.map(s => [s.name, s.kind]));

    assert.strictEqual(byName['LIMIT'], 'const');
    assert.strictEqual(byName['Point'], 'struct');
    assert.strictEqual(byName['Status'], 'enum');
    assert.strictEqual(byName['helper'], 'function');
    assert.strictEqual(byName['manhattan'], 'function');
    assert.strictEqual(byName['on_transfer'], 'hook');
    assert.strictEqual(byName['main'], 'function');
});

test('getMethods filters by receiver but falls back to all', () => {
    const stringMethods = language.getMethods('string').map(m => m.name);
    assert.ok(stringMethods.includes('trim'));
    assert.ok(!stringMethods.includes('shift_remove'));

    const mapMethods = language.getMethods('map').map(m => m.name);
    assert.ok(mapMethods.includes('shift_remove'));

    const allMethods = language.getMethods(undefined).map(m => m.name);
    assert.ok(allMethods.includes('trim'));
    assert.ok(allMethods.includes('shift_remove'));
});

test('getStatics resolves per owner type', () => {
    assert.ok(language.getStatics('bytes').some(fn => fn.name === 'from_hex'));
    assert.ok(language.getStatics('integer').some(fn => fn.name === 'from_be_bytes'));
    assert.ok(language.getStatics('iterator').some(fn => fn.name === 'once'));
});

test('findAllBuiltins returns overloads without duplicates', () => {
    const signatures = language.findAllBuiltins('get').map(fn => fn.signature);
    assert.ok(signatures.length >= 2);
    assert.strictEqual(new Set(signatures).size, signatures.length);

    const lenSignatures = language.findAllBuiltins('len').map(fn => fn.signature);
    assert.strictEqual(new Set(lenSignatures).size, lenSignatures.length);
});

test('builtin data is complete and documented', () => {
    assert.ok(builtinFunctions.length > 50);
    for (const fn of builtinFunctions) {
        assert.ok(fn.signature.trim().length > 0, `missing signature for ${fn.name}`);
        assert.ok(fn.documentation.trim().length > 0, `missing documentation for ${fn.name}`);
    }
    for (const constant of builtinConstants) {
        assert.ok(constant.documentation.trim().length > 0);
        assert.ok(constant.ownerTypes.length > 0);
    }
});

test('stripCode blanks strings and comments but preserves code', () => {
    const stripped = language.stripCode('let s: string = "a { b }"\n// } comment\nlet b: bytes = b"x{"\n/* { */');
    assert.ok(!stripped.includes('a { b }'));
    assert.ok(stripped.includes('let s: string ='));
    const codeBraces = (stripped.match(/\{/g) || []).length;
    assert.strictEqual(codeBraces, 0);
});

test('findBracketDiagnostics reports unmatched and unclosed brackets', () => {
    assert.deepStrictEqual(language.findBracketDiagnostics('fn foo() { let a: u64 = 1 }'), []);

    const unclosed = language.findBracketDiagnostics('fn foo() {\n  let a: u64 = 1\n');
    assert.strictEqual(unclosed.length, 1);
    assert.match(unclosed[0].message, /Unclosed '\{'/);

    const unmatched = language.findBracketDiagnostics('entry main() {\n}\n}');
    assert.strictEqual(unmatched.length, 1);
    assert.match(unmatched[0].message, /Unmatched '\}'/);
});

test('findBracketDiagnostics ignores braces in strings, bytes and comments', () => {
    const source = [
        'let a: string = "{"',
        'let b: bytes = b"}"',
        '// { unclosed',
        '/* } stray */',
        'entry main() {}'
    ].join('\n');
    assert.deepStrictEqual(language.findBracketDiagnostics(source), []);
});

test('findFoldingRanges folds blocks and regions', () => {
    const source = [
        '// region setup',
        'struct Point {',
        '  x: u64,',
        '  y: u64',
        '}',
        'entry main() {',
        '  return 0',
        '}',
        '// endregion'
    ].join('\n');

    const ranges = language.findFoldingRanges(source);
    assert.ok(ranges.some(r => r.start === 1 && r.end === 4));
    assert.ok(ranges.some(r => r.start === 5 && r.end === 7));
    assert.ok(ranges.some(r => r.start === 0 && r.end === 8));
});

test('findReferences finds identifiers but skips comments and strings', () => {
    const source = [
        'const LIMIT: u64 = 10',
        'fn helper() -> u64 {',
        '  return LIMIT',
        '}',
        '// LIMIT in a comment',
        'let s: string = "LIMIT"'
    ].join('\n');

    const references = language.findReferences(source, 'LIMIT');
    assert.strictEqual(references.length, 2);
    assert.deepStrictEqual(references[0], { line: 0, character: 6 });
    assert.deepStrictEqual(references[1], { line: 2, character: 9 });
});

test('scanSymbols reports the identifier column, not the declaration start', () => {
    const source = [
        'pub fn helper() {}',
        '  struct Point { x: u64 }',
        'fn (p Point) manhattan() -> u64 {}'
    ].join('\n');

    const symbols = language.scanSymbols(source);
    const byName = Object.fromEntries(symbols.map(s => [s.name, s]));

    assert.strictEqual(byName['helper'].character, 7);
    assert.strictEqual(byName['Point'].character, 9);
    assert.strictEqual(byName['manhattan'].character, 13);
});

test('scanFunctions extracts parameters, receiver methods and return types', () => {
    const source = [
        'fn cost(command: Command) -> u64 {',
        '  return 0',
        '}',
        'fn apply(value: u64, f: closure(u64) -> u64) -> u64 {',
        '  return value',
        '}',
        'fn (point Point) manhattan() -> u64 {',
        '  return point.x',
        '}',
        'fn (entry Entry<string, u64>) is_large() -> bool {',
        '  return true',
        '}',
        'hook on_transfer(amount: u64) -> u64 {',
        '  return amount',
        '}',
        'entry main(n: u64) {',
        '}'
    ].join('\n');

    const functions = language.scanFunctions(source);
    const byName = Object.fromEntries(functions.map(fn => [fn.name, fn]));

    assert.strictEqual(byName['cost'].signature, 'cost(command: Command) -> u64');
    assert.deepStrictEqual(byName['cost'].parameters, ['command: Command']);
    assert.strictEqual(byName['cost'].line, 0);
    assert.strictEqual(byName['cost'].character, 3);
    assert.strictEqual(byName['apply'].signature, 'apply(value: u64, f: closure(u64) -> u64) -> u64');
    assert.deepStrictEqual(byName['apply'].parameters, ['value: u64', 'f: closure(u64) -> u64']);
    assert.strictEqual(byName['manhattan'].signature, 'manhattan() -> u64');
    assert.deepStrictEqual(byName['manhattan'].parameters, []);
    assert.strictEqual(byName['is_large'].signature, 'is_large() -> bool');
    assert.deepStrictEqual(byName['is_large'].parameters, []);
    assert.strictEqual(byName['on_transfer'].signature, 'on_transfer(amount: u64) -> u64');
    assert.strictEqual(byName['main'].signature, 'main(n: u64)');
});

test('scanFunctions handles tuple, generic and multiline signatures', () => {
    const source = [
        'fn pair() -> (string, u64) {',
        '  return ("", 0)',
        '}',
        'fn maybe() -> optional<u64> {',
        '  return null',
        '}',
        '  pub fn helper() {}',
        'fn build(',
        '  a: u64,',
        '  b: map<string, u64[]>',
        ') -> u64[] {',
        '  return []',
        '}'
    ].join('\n');

    const functions = language.scanFunctions(source);
    const byName = Object.fromEntries(functions.map(fn => [fn.name, fn]));

    assert.strictEqual(byName['pair'].signature, 'pair() -> (string, u64)');
    assert.strictEqual(byName['maybe'].signature, 'maybe() -> optional<u64>');
    assert.strictEqual(byName['helper'].signature, 'helper()');
    assert.strictEqual(byName['helper'].line, 6);
    assert.strictEqual(byName['helper'].character, 9);
    assert.strictEqual(byName['build'].signature, 'build(a: u64, b: map<string, u64[]>) -> u64[]');
    assert.deepStrictEqual(byName['build'].parameters, ['a: u64', 'b: map<string, u64[]>']);
});

test('scanFunctions ignores comments and strings', () => {
    const source = [
        '// fn commented(a: u64) {}',
        'let s: string = "fn quoted(a: u64) {}"',
        '/* fn blocked(a: u64) {} */',
        'fn real(a: u64) {}'
    ].join('\n');

    const functions = language.scanFunctions(source);
    assert.deepStrictEqual(functions.map(fn => fn.name), ['real']);
});

test('scanEnums finds variants with signatures and positions', () => {
    const source = [
        'enum Command {',
        '    Quit,',
        '    Move(u64, u64),',
        '    Write {',
        '        text: string',
        '    }',
        '}'
    ].join('\n');

    const command = language.scanEnums(source).get('Command');
    assert.deepStrictEqual(command.map(v => v.name), ['Quit', 'Move', 'Write']);
    assert.strictEqual(command[1].signature, 'Move(u64, u64)');
    assert.strictEqual(command[2].signature, 'Write { text: string }');
    assert.strictEqual(command[1].line, 2);
    assert.strictEqual(command[1].character, 4);
});

test('scanEnums handles generic enums', () => {
    const result = language.scanEnums('enum Result<T, E> {\n    Ok(T),\n    Err(E)\n}').get('Result');
    assert.deepStrictEqual(result.map(v => v.name), ['Ok', 'Err']);
});

test('getConstantsForReceiver filters by owner type', () => {
    const integer = language.getConstantsForReceiver('integer').map(c => c.name);
    assert.ok(integer.includes('MIN'));
    assert.ok(integer.includes('MAX'));

    assert.deepStrictEqual(language.getConstantsForReceiver('string'), []);
    assert.deepStrictEqual(language.getConstantsForReceiver(undefined), []);
});

test('getStatics requires a known receiver', () => {
    assert.deepStrictEqual(language.getStatics(undefined), []);
    assert.ok(language.getStatics('bytes').some(fn => fn.name === 'from_hex'));
});

test('findSemanticDiagnostics reports duplicates, unknown functions, arity and unused variables', () => {
    const source = [
        'fn helper() {}',
        'fn helper() {}',
        'entry main() {',
        '  mystery(1)',
        '  assert()',
        '  let unused: u64 = 1',
        '}'
    ].join('\n');

    const diagnostics = language.findSemanticDiagnostics(source);
    const codes = diagnostics.map(d => d.code);

    assert.ok(codes.includes('duplicate-declaration'));
    assert.ok(codes.includes('unknown-function'));
    assert.ok(codes.includes('arity-mismatch'));
    assert.ok(codes.includes('unused-variable'));

    const duplicate = diagnostics.find(d => d.code === 'duplicate-declaration');
    assert.strictEqual(duplicate.line, 1);
    assert.strictEqual(duplicate.character, 3);

    const unknown = diagnostics.find(d => d.code === 'unknown-function');
    assert.strictEqual(unknown.line, 3);
    assert.strictEqual(unknown.character, 2);

    const unused = diagnostics.find(d => d.code === 'unused-variable');
    assert.strictEqual(unused.line, 5);
});

test('findSemanticDiagnostics does not flag known names or qualified calls', () => {
    const source = [
        'struct Point { x: u64 }',
        'fn build() -> u64 {',
        '  let point: Point = Point(1)',
        '  let text: string = "hi"',
        '  let upper: string = text.to_uppercase()',
        '  let copy: string = upper',
        '  let hex: u64 = bytes::from_hex("ff").len()',
        '  return copy.len() + hex + point.x',
        '}'
    ].join('\n');

    assert.deepStrictEqual(language.findSemanticDiagnostics(source), []);
});

test('findSemanticDiagnostics does not flag zero-argument methods with tuple return types', () => {
    const source = [
        'entry main() {',
        '  let lookup: map<string, u64> = {}',
        '  let numbers: u64[] = [1u64, 2u64]',
        '  println(lookup.entries())',
        '  println(numbers.iter().enumerate())',
        '  return 0',
        '}'
    ].join('\n');

    assert.deepStrictEqual(language.findSemanticDiagnostics(source), []);
});

test('findSemanticDiagnostics ignores enum variant constructors', () => {
    const source = [
        'enum Command {',
        '    Quit,',
        '    Move(u64, u64),',
        '    Write { text: string }',
        '}',
        'entry main() {',
        '    let command: Command = Command::Move(1u64, 2u64)',
        '    println(command)',
        '    return 0',
        '}'
    ].join('\n');

    assert.deepStrictEqual(language.findSemanticDiagnostics(source), []);
});

test('collectSemanticTokens classifies declarations, calls and methods', () => {
    const source = [
        'fn helper(value: u64) -> u64 {',
        '  return value.len()',
        '}',
        'entry main() {',
        '  let count: u64 = helper(1)',
        '  count.to_string(10)',
        '}'
    ].join('\n');

    const tokens = language.collectSemanticTokens(source);
    const at = (line, character) => tokens.find(t => t.line === line && t.character === character);

    assert.strictEqual(at(0, 3).type, 'function');
    assert.ok(at(0, 3).modifiers.includes('declaration'));
    assert.strictEqual(at(0, 10).type, 'parameter');
    assert.strictEqual(at(0, 17).type, 'type');
    assert.strictEqual(at(1, 15).type, 'method');
    assert.strictEqual(at(4, 6).type, 'variable');
    assert.ok(at(4, 6).modifiers.includes('declaration'));
    assert.strictEqual(at(4, 19).type, 'function');
    assert.strictEqual(at(5, 8).type, 'method');
});

test('collectSemanticTokens marks enum variants and qualified access', () => {
    const source = [
        'enum Command { Quit, Move(u64, u64) }',
        'fn run(command: Command) -> Command {',
        '  let next: Command = Command::Move(1u64, 2u64)',
        '  return next',
        '}'
    ].join('\n');

    const tokens = language.collectSemanticTokens(source);
    const at = (line, character) => tokens.find(t => t.line === line && t.character === character);

    assert.strictEqual(at(0, 15).type, 'enumMember');
    assert.ok(at(0, 15).modifiers.includes('declaration'));
    assert.strictEqual(at(0, 21).type, 'enumMember');
    assert.ok(at(0, 21).modifiers.includes('declaration'));
    assert.strictEqual(at(2, 31).type, 'enumMember');
});

test('formatDocument reindents nested blocks with the configured tab size', () => {
    const source = [
        'entry main() {',
        'let x: u64 = 1',
        'if x > 0 {',
        'return x',
        '} else {',
        'return 0',
        '}',
        '}'
    ].join('\n');

    const formatted = language.formatDocument(source, { tabSize: 4, insertSpaces: true });
    assert.strictEqual(formatted, [
        'entry main() {',
        '    let x: u64 = 1',
        '    if x > 0 {',
        '        return x',
        '    } else {',
        '        return 0',
        '    }',
        '}',
        ''
    ].join('\n'));
});

test('formatDocument ignores braces in strings, bytes and comments', () => {
    const source = [
        'entry main() {',
        'let s: string = "a { b }"',
        '// } not a closer',
        'let b: bytes = b"x{"',
        '/* } stray */',
        'return 0',
        '}'
    ].join('\n');

    const formatted = language.formatDocument(source, { tabSize: 4, insertSpaces: true });
    assert.strictEqual(formatted, [
        'entry main() {',
        '    let s: string = "a { b }"',
        '    // } not a closer',
        '    let b: bytes = b"x{"',
        '    /* } stray */',
        '    return 0',
        '}',
        ''
    ].join('\n'));
});

test('formatDocument collapses code spacing but preserves string and comment contents', () => {
    const source = [
        'entry main() {   ',
        'let   x:   u64 = 1   ',
        'let s: string = "keep  double  spaces"   ',
        'println( x )',
        '// comment   spacing stays',
        '}',
        ''
    ].join('\n');

    const formatted = language.formatDocument(source, { tabSize: 4, insertSpaces: true });
    assert.strictEqual(formatted, [
        'entry main() {',
        '    let x: u64 = 1',
        '    let s: string = "keep  double  spaces"',
        '    println(x)',
        '    // comment   spacing stays',
        '}',
        ''
    ].join('\n'));
});

test('formatDocument indents method chain continuations', () => {
    const source = [
        'entry main() {',
        'let evens: u64[] = all.iter()',
        '.filter(|x: u64| {',
        'return x % 2u64 == 0u64',
        '})',
        '.collect()',
        'return 0',
        '}'
    ].join('\n');

    const formatted = language.formatDocument(source, { tabSize: 4, insertSpaces: true });
    assert.strictEqual(formatted, [
        'entry main() {',
        '    let evens: u64[] = all.iter()',
        '        .filter(|x: u64| {',
        '            return x % 2u64 == 0u64',
        '        })',
        '        .collect()',
        '    return 0',
        '}',
        ''
    ].join('\n'));
});

test('formatDocument is idempotent and preserves CRLF line endings', () => {
    const source = 'entry main() {\r\nlet x: u64 = 1\r\nreturn x\r\n}\r\n';
    const once = language.formatDocument(source, { tabSize: 4, insertSpaces: true }, '\r\n');
    const twice = language.formatDocument(once, { tabSize: 4, insertSpaces: true }, '\r\n');

    assert.strictEqual(once, twice);
    assert.ok(once.includes('\r\n'));
    assert.ok(!/(^|[^\r])\n/.test(once));
});
