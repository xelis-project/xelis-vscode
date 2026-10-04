import { builtinConstants, builtinFunctions } from './constants/builtins';
import {
    BracketDiagnostic,
    BuiltinConstant,
    BuiltinFunction,
    BuiltinReceiver,
    DiagnosticInfo,
    EnumVariant,
    FoldingRangeInfo,
    FormatOptions,
    FunctionSignatureInfo,
    PositionInfo,
    SemanticTokenInfo,
    SemanticTokenModifierName,
    SemanticTokenTypeName,
    SourceSymbol,
    StructField,
    StructInfo,
    UserMethod,
    VariableInfo,
    VariableTypeInfo
} from './types';

export function classifyType(typeName: string): BuiltinReceiver | undefined {
    const type = typeName.trim();

    if (/^(u8|u16|u32|u64|u128|u256)$/.test(type)) {
        return 'integer';
    }
    switch (type) {
        case 'string':
            return 'string';
        case 'bytes':
            return 'bytes';
        case 'bool':
            return 'bool';
        case 'any':
            return 'any';
    }
    if (type.startsWith('optional')) {
        return 'optional';
    }
    if (type.startsWith('map')) {
        return 'map';
    }
    if (type.startsWith('range')) {
        return 'range';
    }
    if (type.startsWith('Iterator')) {
        return 'iterator';
    }
    if (type.endsWith('[]')) {
        return 'array';
    }
    return undefined;
}

export function resolveVariableType(typeName: string): VariableTypeInfo {
    const trimmed = typeName.trim();
    const receiver = classifyType(trimmed);
    if (receiver) {
        return { receiver };
    }

    const open = trimmed.indexOf('<');
    const base = (open === -1 ? trimmed : trimmed.substring(0, open)).trim();
    if (!/^[A-Za-z_]\w*$/.test(base)) {
        return {};
    }
    if (open !== -1 && trimmed.endsWith('>')) {
        const args = splitTopLevel(trimmed.substring(open + 1, trimmed.length - 1));
        if (args.length > 0) {
            return { userType: base, typeArguments: args };
        }
    }
    return { userType: base };
}

export function inferVariableTypeInfo(text: string): Map<string, VariableTypeInfo> {
    const stripped = stripCode(text);
    const lineStarts = buildLineStarts(text);
    const types = new Map<string, VariableTypeInfo>();
    const pattern = /\b(?:let|const)\s+([A-Za-z_]\w*)\s*:\s*([A-Za-z_][\w]*(?:\s*<[^(){}]*>)?(?:\[\])*)/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(stripped)) !== null) {
        const info = resolveVariableType(match[2]);
        if (info.receiver || info.userType) {
            types.set(match[1], info);
        }
    }

    for (const parameter of collectParameters(stripped, lineStarts)) {
        if (!parameter.type || types.has(parameter.name)) {
            continue;
        }
        const info = resolveVariableType(parameter.type);
        if (info.receiver || info.userType) {
            types.set(parameter.name, info);
        }
    }

    for (const methods of scanMethods(text).values()) {
        for (const method of methods) {
            if (types.has(method.receiverName)) {
                continue;
            }
            const info = resolveVariableType(method.receiverType);
            if (info.receiver || info.userType) {
                types.set(method.receiverName, info);
            }
        }
    }

    return types;
}

export function inferVariableTypes(text: string): Map<string, BuiltinReceiver> {
    const types = new Map<string, BuiltinReceiver>();
    for (const [name, info] of inferVariableTypeInfo(text)) {
        if (info.receiver) {
            types.set(name, info.receiver);
        }
    }
    return types;
}

export function resolveFieldType(structure: StructInfo, field: StructField, info: VariableTypeInfo): string {
    const index = structure.typeParameters.indexOf(field.type.trim());
    if (index !== -1 && info.typeArguments && index < info.typeArguments.length) {
        return info.typeArguments[index];
    }
    return field.type;
}

export function resolveMemberType(text: string, expression: string): VariableTypeInfo {
    const segments = expression
        .split('.')
        .map(segment => segment.trim())
        .filter(segment => segment.length > 0);
    if (segments.length === 0) {
        return {};
    }

    const types = inferVariableTypeInfo(text);
    const structs = scanStructs(text);
    let current = types.get(segments[0]);
    if (!current) {
        return {};
    }

    for (let index = 1; index < segments.length; index++) {
        if (!current.userType) {
            return {};
        }
        const structure = structs.get(current.userType);
        const field = structure?.fields.find(candidate => candidate.name === segments[index]);
        if (!structure || !field) {
            return {};
        }
        current = resolveVariableType(resolveFieldType(structure, field, current));
        if (!current.receiver && !current.userType) {
            return {};
        }
    }

    return current;
}

export function getMethods(receiver?: BuiltinReceiver): BuiltinFunction[] {
    return builtinFunctions.filter(fn => {
        if (!fn.receivers || fn.receivers.length === 0) {
            return false;
        }
        return !receiver || fn.receivers.includes(receiver);
    });
}

export function getFreeFunctions(): BuiltinFunction[] {
    return builtinFunctions.filter(fn => !fn.receivers && !fn.isStatic);
}

export function getStatics(receiver?: BuiltinReceiver): BuiltinFunction[] {
    if (!receiver) {
        return [];
    }
    return builtinFunctions.filter(fn => fn.isStatic && fn.ownerType === receiver);
}

export function findBuiltin(name: string): BuiltinFunction | undefined {
    return builtinFunctions.find(fn => fn.name === name);
}

export function findAllBuiltins(name: string): BuiltinFunction[] {
    const seen = new Set<string>();
    return builtinFunctions.filter(fn => {
        if (fn.name !== name || seen.has(fn.signature)) {
            return false;
        }
        seen.add(fn.signature);
        return true;
    });
}

const NUMERIC_TYPES = new Set(['u8', 'u16', 'u32', 'u64', 'u128', 'u256']);

export function getConstantsForReceiver(receiver?: BuiltinReceiver): BuiltinConstant[] {
    if (!receiver) {
        return [];
    }
    return builtinConstants.filter(constant => {
        if (constant.ownerTypes.length === 0) {
            return true;
        }
        if (receiver === 'integer') {
            return constant.ownerTypes.some(type => NUMERIC_TYPES.has(type));
        }
        return constant.ownerTypes.includes(receiver);
    });
}

interface DeclarationPattern {
    regex: RegExp;
    group: number;
    kind: SourceSymbol['kind'];
    resolveKind?: (match: RegExpExecArray) => SourceSymbol['kind'];
}

const DECLARATION_PATTERNS: DeclarationPattern[] = [
    {
        regex: /^\s*(?:pub\s+)?fn\s*\([^)]*\)\s*(\w+)/d,
        group: 1,
        kind: 'function'
    },
    {
        regex: /^\s*(?:pub\s+)?(fn|entry|hook)\s+(\w+)/d,
        group: 2,
        kind: 'function',
        resolveKind: match => (match[1] === 'hook' ? 'hook' : 'function')
    },
    {
        regex: /^\s*struct\s+(\w+)/d,
        group: 1,
        kind: 'struct'
    },
    {
        regex: /^\s*enum\s+(\w+)/d,
        group: 1,
        kind: 'enum'
    },
    {
        regex: /^\s*const\s+(\w+)/d,
        group: 1,
        kind: 'const'
    }
];

function nameOffset(match: RegExpExecArray, group: number): number {
    const range = match.indices?.[group];
    return range ? range[0] : match.index;
}

export function scanSymbols(text: string): SourceSymbol[] {
    const symbols: SourceSymbol[] = [];
    const lines = text.split(/\r?\n/);

    for (let line = 0; line < lines.length; line++) {
        const content = lines[line];

        for (const pattern of DECLARATION_PATTERNS) {
            const match = pattern.regex.exec(content);
            if (!match) {
                continue;
            }

            symbols.push({
                name: match[pattern.group],
                kind: pattern.resolveKind ? pattern.resolveKind(match) : pattern.kind,
                line,
                character: nameOffset(match, pattern.group)
            });
            break;
        }
    }

    return symbols;
}

function buildLineStarts(text: string): number[] {
    const starts = [0];
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '\n') {
            starts.push(i + 1);
        }
    }
    return starts;
}

function positionAt(lineStarts: number[], offset: number): PositionInfo {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (lineStarts[mid] <= offset) {
            low = mid;
        } else {
            high = mid - 1;
        }
    }
    return { line: low, character: offset - lineStarts[low] };
}

const OPENING = '({[';
const CLOSING = ')}]';
const OPEN_TO_CLOSE: { [key: string]: string } = { '(': ')', '{': '}', '[': ']' };
const CLOSE_TO_OPEN: { [key: string]: string } = { ')': '(', '}': '{', ']': '[' };

export function stripCode(text: string): string {
    const out: string[] = new Array(text.length);
    let state: 'normal' | 'line' | 'block' | 'string' | 'bytes' = 'normal';

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (state === 'normal') {
            if (char === '/' && next === '/') {
                out[i] = ' ';
                out[i + 1] = ' ';
                i++;
                state = 'line';
            } else if (char === '/' && next === '*') {
                out[i] = ' ';
                out[i + 1] = ' ';
                i++;
                state = 'block';
            } else if (char === 'b' && next === '"') {
                out[i] = ' ';
                out[i + 1] = '"';
                i++;
                state = 'bytes';
            } else if (char === '"') {
                out[i] = '"';
                state = 'string';
            } else {
                out[i] = char;
            }
            continue;
        }

        if (state === 'line') {
            if (char === '\n') {
                out[i] = '\n';
                state = 'normal';
            } else {
                out[i] = ' ';
            }
        } else if (state === 'block') {
            if (char === '*' && next === '/') {
                out[i] = ' ';
                out[i + 1] = ' ';
                i++;
                state = 'normal';
            } else {
                out[i] = char === '\n' ? '\n' : ' ';
            }
        } else {
            if (char === '\\' && next) {
                out[i] = ' ';
                out[i + 1] = ' ';
                i++;
            } else if (char === '"') {
                out[i] = '"';
                state = 'normal';
            } else {
                out[i] = char === '\n' ? '\n' : ' ';
            }
        }
    }

    return out.join('');
}

export function findBracketDiagnostics(text: string): BracketDiagnostic[] {
    const stripped = stripCode(text);
    const lineStarts = buildLineStarts(text);
    const stack: Array<{ char: string; offset: number }> = [];
    const diagnostics: BracketDiagnostic[] = [];

    for (let i = 0; i < stripped.length; i++) {
        const char = stripped[i];
        if (OPENING.includes(char)) {
            stack.push({ char, offset: i });
        } else if (CLOSING.includes(char)) {
            const top = stack[stack.length - 1];
            if (!top || top.char !== CLOSE_TO_OPEN[char]) {
                diagnostics.push({
                    ...positionAt(lineStarts, i),
                    length: 1,
                    message: `Unmatched '${char}'`
                });
            } else {
                stack.pop();
            }
        }
    }

    for (const entry of stack) {
        diagnostics.push({
            ...positionAt(lineStarts, entry.offset),
            length: 1,
            message: `Unclosed '${entry.char}'`
        });
    }

    return diagnostics.sort((a, b) => a.line - b.line || a.character - b.character);
}

export function findFoldingRanges(text: string): FoldingRangeInfo[] {
    const strippedLines = stripCode(text).split(/\r?\n/);
    const sourceLines = text.split(/\r?\n/);
    const ranges: FoldingRangeInfo[] = [];
    const braceStack: number[] = [];
    const regionStack: number[] = [];

    for (let line = 0; line < strippedLines.length; line++) {
        const content = strippedLines[line];

        if (/^\s*\/\/\s*#?region\b/.test(sourceLines[line])) {
            regionStack.push(line);
        } else if (/^\s*\/\/\s*#?endregion\b/.test(sourceLines[line])) {
            const start = regionStack.pop();
            if (start !== undefined && line > start) {
                ranges.push({ start, end: line });
            }
        }

        for (const char of content) {
            if (char === '{') {
                braceStack.push(line);
            } else if (char === '}') {
                const start = braceStack.pop();
                if (start !== undefined && line > start) {
                    ranges.push({ start, end: line });
                }
            }
        }
    }

    return ranges.sort((a, b) => a.start - b.start || a.end - b.end);
}

export function findReferences(text: string, name: string): PositionInfo[] {
    if (!name) {
        return [];
    }
    const stripped = stripCode(text);
    const lineStarts = buildLineStarts(text);
    const pattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    const references: PositionInfo[] = [];
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
        if (stripped[match.index] === name[0]) {
            references.push(positionAt(lineStarts, match.index));
        }
    }

    return references;
}

export function countTopLevelCommas(text: string): number {
    let depth = 0;
    let commas = 0;
    for (const char of text) {
        if (char === '(' || char === '[' || char === '<' || char === '{') {
            depth++;
        } else if (char === ')' || char === ']' || char === '>' || char === '}') {
            depth = Math.max(0, depth - 1);
        } else if (char === ',' && depth === 0) {
            commas++;
        }
    }
    return commas;
}

interface TextRange {
    text: string;
    offset: number;
}

function splitTopLevelRanges(text: string): TextRange[] {
    const parts: TextRange[] = [];
    let depth = 0;
    let start = 0;

    const push = (end: number) => {
        const raw = text.substring(start, end);
        const leading = raw.length - raw.trimStart().length;
        const trimmed = raw.trim();
        if (trimmed.length > 0) {
            parts.push({ text: trimmed, offset: start + leading });
        }
    };

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '(' || char === '[' || char === '<' || char === '{') {
            depth++;
        } else if (char === ')' || char === ']' || char === '>' || char === '}') {
            depth = Math.max(0, depth - 1);
        } else if (char === ',' && depth === 0) {
            push(i);
            start = i + 1;
        }
    }

    push(text.length);

    return parts;
}

export function splitTopLevel(text: string): string[] {
    return splitTopLevelRanges(text).map(part => part.text);
}

export function scanEnums(text: string): Map<string, EnumVariant[]> {
    const stripped = stripCode(text);
    const lineStarts = buildLineStarts(text);
    const enums = new Map<string, EnumVariant[]>();
    const header = /\benum\s+(\w+)\s*(?:<[^>{}]*>)?\s*\{/g;
    let match: RegExpExecArray | null;

    while ((match = header.exec(stripped)) !== null) {
        const bodyStart = match.index + match[0].length;
        let depth = 1;
        let end = bodyStart;
        while (end < stripped.length && depth > 0) {
            const char = stripped[end];
            if (char === '{') {
                depth++;
            } else if (char === '}') {
                depth--;
            }
            end++;
        }

        const body = stripped.substring(bodyStart, Math.max(bodyStart, end - 1));
        const variants: EnumVariant[] = [];
        for (const part of splitTopLevelRanges(body)) {
            const name = /^(\w+)/.exec(part.text);
            if (!name) {
                continue;
            }
            variants.push({
                name: name[1],
                signature: part.text.replace(/\s+/g, ' '),
                ...positionAt(lineStarts, bodyStart + part.offset)
            });
        }
        enums.set(match[1], variants);
    }

    return enums;
}

export function scanStructs(text: string): Map<string, StructInfo> {
    const stripped = stripCode(text);
    const structs = new Map<string, StructInfo>();
    const header = /\bstruct\s+(\w+)\s*(?:<([^>{}]*)>)?\s*\{/g;
    let match: RegExpExecArray | null;

    while ((match = header.exec(stripped)) !== null) {
        const bodyStart = match.index + match[0].length;
        let depth = 1;
        let end = bodyStart;
        while (end < stripped.length && depth > 0) {
            const char = stripped[end];
            if (char === '{') {
                depth++;
            } else if (char === '}') {
                depth--;
            }
            end++;
        }

        const body = stripped.substring(bodyStart, Math.max(bodyStart, end - 1));
        const fields: StructField[] = [];
        for (const part of splitTopLevelRanges(body)) {
            const field = /^([A-Za-z_]\w*)\s*:\s*(.+)$/s.exec(part.text);
            if (!field) {
                continue;
            }
            fields.push({ name: field[1], type: field[2].replace(/\s+/g, ' ').trim() });
        }

        const typeParameters = (match[2] ?? '')
            .split(',')
            .map(parameter => parameter.trim())
            .filter(parameter => /^[A-Za-z_]\w*$/.test(parameter));
        structs.set(match[1], { name: match[1], typeParameters, fields });
    }

    return structs;
}

export function scanMethods(text: string): Map<string, UserMethod[]> {
    const stripped = stripCode(text);
    const lineStarts = buildLineStarts(text);
    const methods = new Map<string, UserMethod[]>();
    const pattern = /\bfn\s*\(\s*([A-Za-z_]\w*)\s+([A-Za-z_]\w*(?:\s*<[^(){}]*>)?)\s*\)\s*([A-Za-z_]\w*)\s*\(/dg;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(stripped)) !== null) {
        const openParen = match.index + match[0].length - 1;
        const closeParen = findMatchingParen(stripped, openParen);
        if (closeParen === -1) {
            continue;
        }

        const parameters = splitTopLevel(stripped.substring(openParen + 1, closeParen));
        const returnType = readReturnType(stripped, closeParen + 1);
        const receiverType = match[2].split('<')[0].trim();
        const signature = `${match[3]}(${parameters.join(', ')})${returnType ? ` -> ${returnType}` : ''}`;
        const list = methods.get(receiverType) ?? [];

        list.push({
            name: match[3],
            signature,
            parameters,
            receiverName: match[1],
            receiverType,
            ...positionAt(lineStarts, nameOffset(match, 3))
        });
        methods.set(receiverType, list);
    }

    return methods;
}

const CALL_KEYWORDS = new Set([
    'if', 'else', 'for', 'foreach', 'while', 'match', 'in', 'break', 'continue', 'return',
    'fn', 'entry', 'hook', 'pub', 'struct', 'enum', 'const', 'let', 'import', 'from', 'as',
    'true', 'false', 'null'
]);

const PRIMITIVE_TYPES = new Set([
    'bool', 'u8', 'u16', 'u32', 'u64', 'u128', 'u256',
    'string', 'bytes', 'optional', 'range', 'map', 'closure', 'any', 'Iterator'
]);

interface CallSite {
    name: string;
    offset: number;
    argumentCount: number;
    qualifier?: string;
    qualifierKind?: 'method' | 'static';
}

interface ParameterInfo {
    name: string;
    type: string;
    character: number;
    line: number;
}

function previousNonWhitespace(text: string, offset: number): number {
    let index = offset - 1;
    while (index >= 0 && /\s/.test(text[index])) {
        index--;
    }
    return index;
}

function qualifierBefore(stripped: string, offset: number): string | undefined {
    let index = previousNonWhitespace(stripped, offset);
    if (index < 1 || stripped[index] !== ':' || stripped[index - 1] !== ':') {
        return undefined;
    }

    index = previousNonWhitespace(stripped, index - 1);
    if (index >= 0 && stripped[index] === '>') {
        let depth = 0;
        while (index >= 0) {
            const char = stripped[index];
            if (char === '>') {
                depth++;
            } else if (char === '<') {
                depth--;
                if (depth === 0) {
                    index--;
                    break;
                }
            }
            index--;
        }
        index = previousNonWhitespace(stripped, index + 1);
    }

    const end = index + 1;
    while (index >= 0 && /[A-Za-z0-9_]/.test(stripped[index])) {
        index--;
    }
    return end > index + 1 ? stripped.substring(index + 1, end) : undefined;
}

function collectCallSites(stripped: string): CallSite[] {
    const calls: CallSite[] = [];
    const pattern = /\b([A-Za-z_]\w*)\s*\(/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(stripped)) !== null) {
        const parenOffset = match.index + match[0].length - 1;
        const before = previousNonWhitespace(stripped, match.index);
        let qualifierKind: 'method' | 'static' | undefined;
        let qualifier: string | undefined;
        let qualifierOffset = before;

        if (before >= 0 && stripped[before] === '.') {
            qualifierKind = 'method';
        } else if (before >= 1 && stripped[before] === ':' && stripped[before - 1] === ':') {
            qualifierKind = 'static';
            qualifierOffset = before - 1;
        }

        if (qualifierKind) {
            let end = qualifierOffset - 1;
            while (end >= 0 && /\s/.test(stripped[end])) {
                end--;
            }
            const wordEnd = end + 1;
            while (end >= 0 && /[A-Za-z0-9_]/.test(stripped[end])) {
                end--;
            }
            qualifier = stripped.substring(end + 1, wordEnd);
        }

        calls.push({
            name: match[1],
            offset: match.index,
            argumentCount: countArguments(stripped, parenOffset),
            qualifier,
            qualifierKind
        });
    }

    return calls;
}

function countArguments(text: string, openParen: number): number {
    let depth = 1;
    let commas = 0;
    let hasContent = false;

    for (let i = openParen + 1; i < text.length; i++) {
        const char = text[i];
        if (char === '(' || char === '[' || char === '{') {
            depth++;
        } else if (char === ')' || char === ']' || char === '}') {
            depth--;
            if (depth === 0) {
                break;
            }
        } else if (depth === 1) {
            if (char === ',') {
                commas++;
            } else if (!/\s/.test(char)) {
                hasContent = true;
            }
        }
    }

    return hasContent || commas > 0 ? commas + 1 : 0;
}

function parameterCount(signature: string): number {
    const open = signature.indexOf('(');
    if (open === -1) {
        return 0;
    }

    let depth = 0;
    let close = -1;
    for (let i = open; i < signature.length; i++) {
        const char = signature[i];
        if (char === '(') {
            depth++;
        } else if (char === ')') {
            depth--;
            if (depth === 0) {
                close = i;
                break;
            }
        }
    }

    if (close <= open) {
        return 0;
    }
    return splitTopLevel(signature.substring(open + 1, close)).filter(part => part.length > 0).length;
}

function expectedArgumentCounts(name: string, call: CallSite, variableTypes: Map<string, BuiltinReceiver>): Set<number> | undefined {
    const overloads = builtinFunctions.filter(fn => fn.name === name);
    if (overloads.length === 0) {
        return undefined;
    }

    let relevant: BuiltinFunction[];
    if (call.qualifierKind === 'method') {
        const receiver = call.qualifier ? variableTypes.get(call.qualifier) : undefined;
        if (!receiver) {
            return undefined;
        }
        relevant = getMethods(receiver).filter(fn => fn.name === name);
    } else if (call.qualifierKind === 'static') {
        const receiver = call.qualifier ? classifyType(call.qualifier) : undefined;
        if (!receiver) {
            return undefined;
        }
        relevant = getStatics(receiver).filter(fn => fn.name === name);
    } else {
        relevant = overloads.filter(fn => !fn.receivers && !fn.isStatic);
    }

    const counts = new Set<number>();
    for (const fn of relevant) {
        counts.add(parameterCount(fn.signature));
    }
    return counts.size > 0 ? counts : undefined;
}

const FUNCTION_HEADER_PATTERN = /\b(?:pub\s+)?(?:fn|hook|entry)\s*(?:\([^)]*\)\s*)?([A-Za-z_]\w*)\s*\(/dg;

const PARAMETER_PATTERN = /^([A-Za-z_]\w*)\s*:\s*(.+)$/s;

function collectParameters(stripped: string, lineStarts: number[]): ParameterInfo[] {
    const parameters: ParameterInfo[] = [];
    const pattern = new RegExp(FUNCTION_HEADER_PATTERN.source, 'dg');
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(stripped)) !== null) {
        const openParen = match.index + match[0].length - 1;
        const closeParen = findMatchingParen(stripped, openParen);
        if (closeParen === -1) {
            continue;
        }

        for (const part of splitTopLevelRanges(stripped.substring(openParen + 1, closeParen))) {
            const parameter = PARAMETER_PATTERN.exec(part.text);
            if (!parameter) {
                continue;
            }
            parameters.push({
                name: parameter[1],
                type: parameter[2].replace(/\s+/g, ' ').trim(),
                ...positionAt(lineStarts, openParen + 1 + part.offset)
            });
        }
    }

    return parameters;
}

function findMatchingParen(text: string, open: number): number {
    let depth = 0;
    for (let i = open; i < text.length; i++) {
        if (text[i] === '(') {
            depth++;
        } else if (text[i] === ')') {
            depth--;
            if (depth === 0) {
                return i;
            }
        }
    }
    return -1;
}

function readReturnType(stripped: string, offset: number): string {
    const arrow = /^\s*->\s*/.exec(stripped.substring(offset));
    if (!arrow) {
        return '';
    }

    let depth = 0;
    let end = offset + arrow[0].length;
    const start = end;
    while (end < stripped.length) {
        const char = stripped[end];
        if (char === '(' || char === '[' || char === '<') {
            depth++;
        } else if (char === ')' || char === ']' || char === '>') {
            if (depth > 0) {
                depth--;
            }
        } else if (depth === 0 && (char === '{' || char === '\n' || char === '\r')) {
            break;
        }
        end++;
    }
    return stripped.substring(start, end).trim();
}

export function scanFunctions(text: string): FunctionSignatureInfo[] {
    const stripped = stripCode(text);
    const lineStarts = buildLineStarts(text);
    const functions: FunctionSignatureInfo[] = [];
    const pattern = new RegExp(FUNCTION_HEADER_PATTERN.source, 'dg');
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(stripped)) !== null) {
        const openParen = match.index + match[0].length - 1;
        const closeParen = findMatchingParen(stripped, openParen);
        if (closeParen === -1) {
            continue;
        }

        const parameters = splitTopLevel(stripped.substring(openParen + 1, closeParen));
        const returnType = readReturnType(stripped, closeParen + 1);
        const signature = `${match[1]}(${parameters.join(', ')})${returnType ? ` -> ${returnType}` : ''}`;

        functions.push({
            name: match[1],
            signature,
            parameters,
            ...positionAt(lineStarts, nameOffset(match, 1))
        });
    }

    return functions;
}

export function scanVariables(text: string): VariableInfo[] {
    const stripped = stripCode(text);
    const lineStarts = buildLineStarts(text);
    const depths = new Uint32Array(stripped.length);
    let depth = 0;

    for (let i = 0; i < stripped.length; i++) {
        const char = stripped[i];
        if (char === '}') {
            depth = Math.max(0, depth - 1);
        }
        depths[i] = depth;
        if (char === '{') {
            depth++;
        }
    }

    const variables: VariableInfo[] = [];
    const seen = new Set<string>();

    const variablePattern = /\b(let|const)\s+([A-Za-z_]\w*)/dg;
    let match: RegExpExecArray | null;
    while ((match = variablePattern.exec(stripped)) !== null) {
        if (depths[match.index] === 0) {
            continue;
        }
        const name = match[2];
        if (seen.has(name)) {
            continue;
        }
        seen.add(name);
        variables.push({
            name,
            kind: match[1] === 'const' ? 'const' : 'variable',
            ...positionAt(lineStarts, nameOffset(match, 2))
        });
    }

    for (const parameter of collectParameters(stripped, lineStarts)) {
        if (seen.has(parameter.name)) {
            continue;
        }
        seen.add(parameter.name);
        variables.push({
            name: parameter.name,
            kind: 'parameter',
            line: parameter.line,
            character: parameter.character
        });
    }

    return variables;
}

function formatCounts(counts: Set<number>): string {
    const sorted = [...counts].sort((a, b) => a - b);
    if (sorted.length === 1) {
        return String(sorted[0]);
    }
    return sorted.slice(0, -1).join(', ') + ' or ' + sorted[sorted.length - 1];
}

export function findSemanticDiagnostics(text: string): DiagnosticInfo[] {
    const stripped = stripCode(text);
    const lineStarts = buildLineStarts(text);
    const diagnostics: DiagnosticInfo[] = [];
    const symbols = scanSymbols(text);
    const variableTypes = inferVariableTypes(text);
    const parameters = collectParameters(stripped, lineStarts);
    const parameterNames = new Set(parameters.map(parameter => parameter.name));
    const declaredNames = new Set(symbols.map(symbol => symbol.name));
    const builtinNames = new Set(builtinFunctions.map(fn => fn.name));
    const enumVariantNames = new Set<string>();
    for (const variants of scanEnums(text).values()) {
        for (const variant of variants) {
            enumVariantNames.add(variant.name);
        }
    }

    const seen = new Map<string, SourceSymbol>();
    for (const symbol of symbols) {
        const key = symbol.kind === 'const'
            ? `const:${symbol.name}`
            : symbol.kind === 'struct' || symbol.kind === 'enum'
                ? `type:${symbol.name}`
                : `function:${symbol.name}`;
        if (seen.has(key)) {
            diagnostics.push({
                line: symbol.line,
                character: symbol.character,
                length: symbol.name.length,
                message: `Duplicate declaration of '${symbol.name}'`,
                severity: 'warning',
                code: 'duplicate-declaration',
                data: { name: symbol.name }
            });
        } else {
            seen.set(key, symbol);
        }
    }

    const variablePattern = /\b(let|const)\s+([A-Za-z_]\w*)/dg;
    let variableMatch: RegExpExecArray | null;
    while ((variableMatch = variablePattern.exec(stripped)) !== null) {
        const name = variableMatch[2];
        if (name.startsWith('_')) {
            continue;
        }
        if (findReferences(text, name).length <= 1) {
            const position = positionAt(lineStarts, nameOffset(variableMatch, 2));
            diagnostics.push({
                line: position.line,
                character: position.character,
                length: name.length,
                message: `Unused ${variableMatch[1]} '${name}'`,
                severity: 'hint',
                code: 'unused-variable',
                data: { name }
            });
        }
    }

    for (const call of collectCallSites(stripped)) {
        const name = call.name;
        if (CALL_KEYWORDS.has(name)) {
            continue;
        }

        const position = positionAt(lineStarts, call.offset);

        if (call.qualifierKind) {
            if (builtinNames.has(name)) {
                const expected = expectedArgumentCounts(name, call, variableTypes);
                if (expected && !expected.has(call.argumentCount)) {
                    diagnostics.push({
                        ...position,
                        length: name.length,
                        message: `Function '${name}' expects ${formatCounts(expected)} argument(s), got ${call.argumentCount}`,
                        severity: 'warning',
                        code: 'arity-mismatch',
                        data: { name }
                    });
                }
            }
            continue;
        }

        if (
            declaredNames.has(name) ||
            enumVariantNames.has(name) ||
            variableTypes.has(name) ||
            parameterNames.has(name) ||
            PRIMITIVE_TYPES.has(name)
        ) {
            continue;
        }

        if (builtinNames.has(name)) {
            const expected = expectedArgumentCounts(name, call, variableTypes);
            if (expected && !expected.has(call.argumentCount)) {
                diagnostics.push({
                    ...position,
                    length: name.length,
                    message: `Function '${name}' expects ${formatCounts(expected)} argument(s), got ${call.argumentCount}`,
                    severity: 'warning',
                    code: 'arity-mismatch',
                    data: { name }
                });
            }
            continue;
        }

        diagnostics.push({
            ...position,
            length: name.length,
            message: `Unknown function '${name}'`,
            severity: 'warning',
            code: 'unknown-function',
            data: { name }
        });
    }

    return diagnostics.sort((a, b) => a.line - b.line || a.character - b.character);
}

export function collectSemanticTokens(text: string): SemanticTokenInfo[] {
    const stripped = stripCode(text);
    const lineStarts = buildLineStarts(text);
    const tokens: SemanticTokenInfo[] = [];

    const declarations = new Map<number, SourceSymbol>();
    for (const symbol of scanSymbols(text)) {
        declarations.set(lineStarts[symbol.line] + symbol.character, symbol);
    }

    const symbolsByName = new Map<string, SourceSymbol>();
    for (const symbol of scanSymbols(text)) {
        if (!symbolsByName.has(symbol.name)) {
            symbolsByName.set(symbol.name, symbol);
        }
    }

    const variantDeclarations = new Map<number, EnumVariant>();
    const enumVariants = new Map<string, Set<string>>();
    for (const [enumName, variants] of scanEnums(text)) {
        const names = new Set<string>();
        for (const variant of variants) {
            variantDeclarations.set(lineStarts[variant.line] + variant.character, variant);
            names.add(variant.name);
        }
        enumVariants.set(enumName, names);
    }

    const variables = new Map<number, string>();
    const variablePattern = /\b(let|const)\s+([A-Za-z_]\w*)/dg;
    let variableMatch: RegExpExecArray | null;
    while ((variableMatch = variablePattern.exec(stripped)) !== null) {
        variables.set(nameOffset(variableMatch, 2), variableMatch[1]);
    }

    const parameterOffsets = new Set<number>();
    for (const parameter of collectParameters(stripped, lineStarts)) {
        parameterOffsets.add(lineStarts[parameter.line] + parameter.character);
    }

    const wordPattern = /[A-Za-z_]\w*/g;
    let match: RegExpExecArray | null;
    while ((match = wordPattern.exec(stripped)) !== null) {
        const word = match[0];
        const offset = match.index;
        const position = positionAt(lineStarts, offset);

        if (word === 'pub') {
            tokens.push({ ...position, length: word.length, type: 'modifier', modifiers: [] });
            continue;
        }

        if (parameterOffsets.has(offset)) {
            tokens.push({ ...position, length: word.length, type: 'parameter', modifiers: ['declaration'] });
            continue;
        }

        const declaration = declarations.get(offset);
        if (declaration) {
            const type: SemanticTokenTypeName =
                declaration.kind === 'struct' ? 'struct'
                    : declaration.kind === 'enum' ? 'enum'
                        : declaration.kind === 'const' ? 'variable'
                            : 'function';
            const modifiers: SemanticTokenModifierName[] = ['declaration'];
            if (declaration.kind === 'const') {
                modifiers.push('readonly');
            }
            tokens.push({ ...position, length: word.length, type, modifiers });
            continue;
        }

        if (variantDeclarations.has(offset)) {
            tokens.push({ ...position, length: word.length, type: 'enumMember', modifiers: ['declaration'] });
            continue;
        }

        const qualifier = qualifierBefore(stripped, offset);
        if (qualifier && enumVariants.get(qualifier)?.has(word)) {
            tokens.push({ ...position, length: word.length, type: 'enumMember', modifiers: [] });
            continue;
        }

        const variableKeyword = variables.get(offset);
        if (variableKeyword) {
            const modifiers: SemanticTokenModifierName[] = ['declaration'];
            if (variableKeyword === 'const') {
                modifiers.push('readonly');
            }
            tokens.push({ ...position, length: word.length, type: 'variable', modifiers });
            continue;
        }

        const symbol = symbolsByName.get(word);
        if (symbol) {
            const type: SemanticTokenTypeName =
                symbol.kind === 'struct' ? 'struct'
                    : symbol.kind === 'enum' ? 'enum'
                        : symbol.kind === 'const' ? 'variable'
                            : 'function';
            const modifiers: SemanticTokenModifierName[] = symbol.kind === 'const' ? ['readonly'] : [];
            tokens.push({ ...position, length: word.length, type, modifiers });
            continue;
        }

        const builtins = findAllBuiltins(word);
        if (builtins.length > 0) {
            const before = previousNonWhitespace(stripped, offset);
            const isMethod = (before >= 0 && stripped[before] === '.') ||
                builtins.some(fn => fn.receivers && fn.receivers.length > 0);
            const modifiers: SemanticTokenModifierName[] = builtins.some(fn => fn.isStatic) ? ['static'] : [];
            tokens.push({
                ...position,
                length: word.length,
                type: isMethod ? 'method' : 'function',
                modifiers
            });
            continue;
        }

        if (PRIMITIVE_TYPES.has(word)) {
            tokens.push({ ...position, length: word.length, type: 'type', modifiers: [] });
        }
    }

    return tokens;
}

const MASKED = '\x00';
const LINE_BREAK = /\r\n|\n|\r/;

function buildCodeMask(text: string): string {
    const out: string[] = new Array(text.length);
    let state: 'normal' | 'line' | 'block' | 'string' | 'bytes' = 'normal';

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (state === 'normal') {
            if (char === '/' && next === '/') {
                out[i] = MASKED;
                out[i + 1] = MASKED;
                i++;
                state = 'line';
            } else if (char === '/' && next === '*') {
                out[i] = MASKED;
                out[i + 1] = MASKED;
                i++;
                state = 'block';
            } else if (char === 'b' && next === '"') {
                out[i] = MASKED;
                out[i + 1] = '"';
                i++;
                state = 'bytes';
            } else if (char === '"') {
                out[i] = '"';
                state = 'string';
            } else {
                out[i] = char;
            }
            continue;
        }

        if (state === 'line') {
            if (char === '\n') {
                out[i] = char;
                state = 'normal';
            } else if (char === '\r' && next !== '\n') {
                out[i] = char;
                state = 'normal';
            } else if (char === '\r') {
                out[i] = char;
            } else {
                out[i] = MASKED;
            }
        } else if (state === 'block') {
            if (char === '*' && next === '/') {
                out[i] = MASKED;
                out[i + 1] = MASKED;
                i++;
                state = 'normal';
            } else {
                out[i] = char === '\n' || char === '\r' ? char : MASKED;
            }
        } else {
            if (char === '\\' && next) {
                out[i] = MASKED;
                out[i + 1] = MASKED;
                i++;
            } else if (char === '"') {
                out[i] = '"';
                state = 'normal';
            } else {
                out[i] = char === '\n' || char === '\r' ? char : MASKED;
            }
        }
    }

    return out.join('');
}

function firstCodeIndex(maskLine: string): number {
    for (let i = 0; i < maskLine.length; i++) {
        if (maskLine[i] !== MASKED && !/\s/.test(maskLine[i])) {
            return i;
        }
    }
    return -1;
}

function normalizeLineBody(raw: string, mask: string): string {
    let out = '';
    let pendingSpace = false;
    let index = 0;

    while (index < raw.length && /\s/.test(raw[index])) {
        index++;
    }

    for (; index < raw.length; index++) {
        const char = raw[index];

        if (mask[index] === MASKED) {
            if (pendingSpace) {
                out += ' ';
                pendingSpace = false;
            }
            out += char;
            continue;
        }

        if (/\s/.test(char)) {
            if (out.length > 0) {
                pendingSpace = true;
            }
            continue;
        }

        if (pendingSpace) {
            const previous = out[out.length - 1];
            if (!/[)\],;]/.test(char) && previous !== '(' && previous !== '[') {
                out += ' ';
            }
            pendingSpace = false;
        }

        out += char;
    }

    return out.trimEnd();
}

export function formatDocument(text: string, options: FormatOptions, eol: string = '\n'): string {
    const tabSize = Math.max(1, options.tabSize || 4);
    const indentUnit = options.insertSpaces ? ' '.repeat(tabSize) : '\t';
    const rawLines = text.split(LINE_BREAK);
    const maskLines = buildCodeMask(text).split(LINE_BREAK);

    const out: string[] = [];
    let indent = 0;
    let chainActive = false;
    let chainBase = 0;
    let blankPending = false;

    for (let line = 0; line < rawLines.length; line++) {
        const raw = rawLines[line];
        const mask = maskLines[line] ?? '';

        if (raw.trim().length === 0) {
            blankPending = out.length > 0;
            continue;
        }

        const firstCode = firstCodeIndex(mask);
        let leadingClosers = 0;
        let dotLine = false;

        if (firstCode !== -1) {
            let index = firstCode;
            while (index < mask.length) {
                const char = mask[index];
                if (char === '}') {
                    leadingClosers++;
                } else if (char !== MASKED && !/\s/.test(char)) {
                    break;
                }
                index++;
            }
            dotLine = mask[firstCode] === '.';
        }

        if (chainActive && !dotLine && indent <= chainBase) {
            chainActive = false;
        }
        if (!chainActive && dotLine) {
            chainActive = true;
            chainBase = indent;
        }

        const printLevel = Math.max(0, indent - leadingClosers) + (chainActive ? 1 : 0);

        if (blankPending) {
            out.push('');
            blankPending = false;
        }

        const body = normalizeLineBody(raw, mask);
        out.push(body.length > 0 ? indentUnit.repeat(printLevel) + body : '');

        if (firstCode !== -1) {
            for (const char of mask) {
                if (char === '{') {
                    indent++;
                } else if (char === '}') {
                    indent = Math.max(0, indent - 1);
                }
            }
        }
    }

    if (out.length === 0) {
        return '';
    }

    return out.join(eol) + eol;
}
