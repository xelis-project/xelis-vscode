const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vsctm = require('vscode-textmate');
const onig = require('vscode-oniguruma');

let grammarPromise;

async function getGrammar() {
    if (!grammarPromise) {
        grammarPromise = (async () => {
            const wasm = fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm'));
            await onig.loadWASM({ data: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) });
            const onigLib = {
                createOnigScanner: onig.createOnigScanner,
                createOnigString: onig.createOnigString
            };
            const registry = new vsctm.Registry({
                onigLib: Promise.resolve(onigLib),
                loadGrammar: async scope => {
                    if (scope !== 'source.xvm') {
                        return null;
                    }
                    const grammarPath = path.join(__dirname, '..', 'syntaxes', 'xvm.tmLanguage.json');
                    return vsctm.parseRawGrammar(fs.readFileSync(grammarPath, 'utf8'), 'xvm.tmLanguage.json');
                }
            });
            return registry.loadGrammar('source.xvm');
        })();
    }
    return grammarPromise;
}

async function tokenize(source) {
    const grammar = await getGrammar();
    let ruleStack = vsctm.INITIAL;
    const tokens = [];
    for (const line of source.split(/\r?\n/)) {
        const lineResult = grammar.tokenizeLine(line, ruleStack);
        ruleStack = lineResult.ruleStack;
        for (const token of lineResult.tokens) {
            tokens.push({ text: line.substring(token.startIndex, token.endIndex), scopes: token.scopes });
        }
    }
    return tokens;
}

function scopeOf(tokens, text) {
    const token = tokens.find(t => t.text === text);
    return token ? token.scopes : [];
}

test('tokenizes function declarations and types', async () => {
    const tokens = await tokenize('fn foo(a: u64) -> bool { return true }');
    assert.ok(scopeOf(tokens, 'fn').includes('keyword.declaration.function.xvm'));
    assert.ok(scopeOf(tokens, 'foo').includes('entity.name.function.xvm'));
    assert.ok(scopeOf(tokens, 'u64').includes('storage.type.numeric.xvm'));
    assert.ok(scopeOf(tokens, '->').includes('keyword.operator.return-type.xvm'));
    assert.ok(scopeOf(tokens, 'true').includes('constant.language.boolean.xvm'));
    assert.ok(scopeOf(tokens, 'return').includes('keyword.control.xvm'));
});

test('tokenizes enums, variants and namespaces', async () => {
    const tokens = await tokenize('enum Result<T, E> { Ok(T), Err(E) }\nlet x: Result<u64, string> = Result::Ok(1u64)');
    assert.ok(scopeOf(tokens, 'enum').includes('storage.type.enum.xvm'));
    assert.ok(scopeOf(tokens, 'Result').includes('entity.name.type.enum.xvm'));
    assert.ok(scopeOf(tokens, '::').includes('punctuation.separator.namespace.xvm'));
    assert.ok(scopeOf(tokens, 'string').includes('storage.type.string.xvm'));
    assert.ok(scopeOf(tokens, '1u64').includes('constant.numeric.xvm'));
});

test('tokenizes enum variants and qualified variant access', async () => {
    const tokens = await tokenize('enum Command { Quit, Move(u64, u64), Write { text: string } }\nCommand::Move(1u64, 2u64)');

    assert.ok(scopeOf(tokens, 'Quit').includes('variable.other.enummember.xvm'));
    assert.ok(scopeOf(tokens, 'Write').includes('variable.other.enummember.xvm'));

    const moveTokens = tokens.filter(t => t.text === 'Move');
    assert.strictEqual(moveTokens.length, 2);
    for (const move of moveTokens) {
        assert.ok(move.scopes.includes('variable.other.enummember.xvm'));
        assert.ok(!move.scopes.includes('entity.name.function.xvm'));
    }
});

test('tokenizes structs, match and fat arrows', async () => {
    const tokens = await tokenize('struct Point { x: u64 }\nmatch p { Point { x } => { println(x) } }');
    assert.ok(scopeOf(tokens, 'struct').includes('storage.type.struct.xvm'));
    assert.ok(scopeOf(tokens, 'match').includes('keyword.control.xvm'));
    assert.ok(scopeOf(tokens, '=>').includes('keyword.operator.fat-arrow.xvm'));
    assert.ok(scopeOf(tokens, 'println').includes('support.function.builtin.xvm'));
});

test('tokenizes hooks, pub and receivers', async () => {
    const tokens = await tokenize('pub fn transfer() {}\nhook on_transfer(amount: u64) {}\nfn (p Point) manhattan() -> u64 {}');
    assert.ok(scopeOf(tokens, 'pub').includes('storage.modifier.xvm'));
    assert.ok(scopeOf(tokens, 'hook').includes('keyword.declaration.function.xvm'));
    assert.ok(scopeOf(tokens, 'on_transfer').includes('entity.name.function.xvm'));
    assert.ok(scopeOf(tokens, 'manhattan').includes('entity.name.function.xvm'));
});

test('tokenizes typed, hex and binary numeric literals', async () => {
    const tokens = await tokenize('let a: u8 = 5u8\nlet b: u64 = 0x10u64\nlet c: u128 = 100_000_000u128');
    assert.ok(scopeOf(tokens, '5u8').includes('constant.numeric.xvm'));
    assert.ok(scopeOf(tokens, '0x10u64').includes('constant.numeric.xvm'));
    assert.ok(scopeOf(tokens, '100_000_000u128').includes('constant.numeric.xvm'));
});

test('tokenizes strings and byte strings', async () => {
    const tokens = await tokenize('let s: string = "hi"\nlet b: bytes = b"Hi"');
    assert.ok(scopeOf(tokens, '"').includes('string.quoted.double.xvm'));
    assert.ok(scopeOf(tokens, 'b"').includes('string.quoted.other.bytes.xvm'));
});

test('tokenizes closures, operators and ranges', async () => {
    const tokens = await tokenize('let f: closure(u64) -> u64 = |x: u64| { return x * 2u64 }\nforeach i in 0..10 {}\nlet y: u64 = a << 2u64 | b & c ^ d');
    assert.ok(scopeOf(tokens, 'closure').includes('storage.type.closure.xvm'));
    assert.ok(scopeOf(tokens, '|').includes('keyword.operator.bitwise.xvm'));
    assert.ok(scopeOf(tokens, '..').includes('keyword.operator.range.xvm'));
    assert.ok(scopeOf(tokens, '<<').includes('keyword.operator.bitwise.shift.xvm'));
    assert.ok(scopeOf(tokens, '^').includes('keyword.operator.bitwise.xvm'));
    assert.ok(scopeOf(tokens, '*').includes('keyword.operator.arithmetic.xvm'));
});

test('tokenizes line and block comments', async () => {
    const tokens = await tokenize('// line\n/* block */\nlet x: u64 = 1');
    assert.ok(scopeOf(tokens, '//').includes('comment.line.double-slash.xvm'));
    assert.ok(scopeOf(tokens, '/*').includes('comment.block.xvm'));
});

test('optional, range and map generics are typed', async () => {
    const tokens = await tokenize('let a: optional<u64> = null\nlet b: range<u64> = 0..10\nlet c: map<string, u64> = {}');
    assert.ok(scopeOf(tokens, 'optional').includes('storage.type.generic.xvm'));
    assert.ok(scopeOf(tokens, 'range').includes('storage.type.generic.xvm'));
    assert.ok(scopeOf(tokens, 'map').includes('storage.type.generic.xvm'));
    assert.ok(scopeOf(tokens, 'null').includes('constant.language.null.xvm'));
});
