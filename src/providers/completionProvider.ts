import * as vscode from 'vscode';
import {
    classifyType,
    getConstantsForReceiver,
    getFreeFunctions,
    getMethods,
    getStatics,
    resolveFieldType,
    resolveMemberType,
    scanEnums,
    scanMethods,
    scanStructs,
    scanSymbols,
    scanVariables
} from '../language';
import { BuiltinFunction, BuiltinReceiver, EnumVariant, SourceSymbol, VariableInfo, VariableTypeInfo } from '../types';

const KEYWORDS = [
    'if', 'else', 'for', 'foreach', 'while', 'in', 'break', 'continue', 'return', 'match',
    'as', 'let', 'const', 'fn', 'entry', 'hook', 'pub', 'struct', 'enum', 'import', 'from'
];

const TYPES = [
    'bool', 'u8', 'u16', 'u32', 'u64', 'u128', 'u256',
    'string', 'bytes', 'optional', 'range', 'map', 'closure', 'any', 'Iterator'
];

export class XelCompletionProvider implements vscode.CompletionItemProvider {
    public provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.CompletionItem[]> {
        const line = document.lineAt(position.line).text;
        const before = line.substring(0, position.character);
        const text = document.getText();

        if (isInCommentOrString(text, document.offsetAt(position))) {
            return [];
        }

        const methodAccess = /([A-Za-z_]\w*(?:\s*\.\s*[A-Za-z_]\w*)*)\s*\.(?!\.)\s*\w*$/.exec(before);
        if (methodAccess) {
            const type = resolveMemberType(text, methodAccess[1]);
            if (type.userType) {
                return buildStructItems(text, type);
            }
            return buildMethodItems(type.receiver);
        }

        if (/::\s*\w*$/.test(before)) {
            const owner = /([A-Za-z_]\w*)\s*(?:<[^<>]*>)?\s*::\s*\w*$/.exec(before);
            if (owner) {
                const variants = scanEnums(text).get(owner[1]);
                if (variants && variants.length > 0) {
                    return variants.map(variant => buildEnumVariantItem(variant, owner[1]));
                }
                return buildStaticItems(classifyType(owner[1]), owner[1]);
            }
            return buildStaticItems(undefined);
        }

        const items: vscode.CompletionItem[] = [];

        for (const keyword of KEYWORDS) {
            const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
            items.push(item);
        }
        for (const type of TYPES) {
            const item = new vscode.CompletionItem(type, vscode.CompletionItemKind.TypeParameter);
            items.push(item);
        }
        for (const fn of getFreeFunctions()) {
            items.push(buildFunctionItem(fn, vscode.CompletionItemKind.Function));
        }

        const seen = new Set<string>();
        for (const symbol of scanSymbols(text)) {
            seen.add(symbol.name);
            items.push(buildSymbolItem(symbol));
        }

        for (const variable of scanVariables(text)) {
            if (seen.has(variable.name)) {
                continue;
            }
            seen.add(variable.name);
            items.push(buildVariableItem(variable));
        }

        return items;
    }
}

const SYMBOL_COMPLETION_KINDS: Record<SourceSymbol['kind'], vscode.CompletionItemKind> = {
    function: vscode.CompletionItemKind.Function,
    hook: vscode.CompletionItemKind.Function,
    struct: vscode.CompletionItemKind.Struct,
    enum: vscode.CompletionItemKind.Enum,
    const: vscode.CompletionItemKind.Constant
};

function buildSymbolItem(symbol: SourceSymbol): vscode.CompletionItem {
    const item = new vscode.CompletionItem(symbol.name, SYMBOL_COMPLETION_KINDS[symbol.kind]);
    item.detail = symbol.kind;
    return item;
}

const VARIABLE_COMPLETION_KINDS: Record<VariableInfo['kind'], vscode.CompletionItemKind> = {
    variable: vscode.CompletionItemKind.Variable,
    const: vscode.CompletionItemKind.Constant,
    parameter: vscode.CompletionItemKind.Variable
};

function buildVariableItem(variable: VariableInfo): vscode.CompletionItem {
    const item = new vscode.CompletionItem(variable.name, VARIABLE_COMPLETION_KINDS[variable.kind]);
    item.detail = variable.kind;
    return item;
}

function buildEnumVariantItem(variant: EnumVariant, owner: string): vscode.CompletionItem {
    const item = new vscode.CompletionItem(variant.name, vscode.CompletionItemKind.EnumMember);
    item.detail = `${owner}::${variant.signature}`;
    return item;
}

function buildMethodItems(receiver?: BuiltinReceiver): vscode.CompletionItem[] {
    const methods = getMethods(receiver);
    const seen = new Set<string>();
    const items: vscode.CompletionItem[] = [];

    for (const method of methods) {
        if (!receiver && seen.has(method.name)) {
            continue;
        }
        seen.add(method.name);
        items.push(buildFunctionItem(method, vscode.CompletionItemKind.Method));
    }

    for (const constant of getConstantsForReceiver(receiver)) {
        const item = new vscode.CompletionItem(constant.name, vscode.CompletionItemKind.Constant);
        item.documentation = new vscode.MarkdownString(constant.documentation);
        items.push(item);
    }

    return items;
}

function buildStructItems(text: string, type: VariableTypeInfo): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];
    const seen = new Set<string>();
    const structure = type.userType ? scanStructs(text).get(type.userType) : undefined;

    for (const field of structure?.fields ?? []) {
        seen.add(field.name);
        const item = new vscode.CompletionItem(field.name, vscode.CompletionItemKind.Field);
        item.detail = structure ? resolveFieldType(structure, field, type) : field.type;
        items.push(item);
    }

    for (const method of type.userType ? scanMethods(text).get(type.userType) ?? [] : []) {
        if (seen.has(method.name)) {
            continue;
        }
        seen.add(method.name);
        const item = new vscode.CompletionItem(method.name, vscode.CompletionItemKind.Method);
        item.detail = method.signature;
        items.push(item);
    }

    for (const method of getMethods('any')) {
        if (seen.has(method.name)) {
            continue;
        }
        seen.add(method.name);
        items.push(buildFunctionItem(method, vscode.CompletionItemKind.Method));
    }

    return items;
}

function buildStaticItems(receiver?: BuiltinReceiver, owner?: string): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];
    const seen = new Set<string>();

    for (const fn of getStatics(receiver)) {
        if (seen.has(fn.name)) {
            continue;
        }
        seen.add(fn.name);
        const item = buildFunctionItem(fn, vscode.CompletionItemKind.Function);
        if (owner) {
            item.label = `${owner}::${fn.name}`;
            item.filterText = fn.name;
            item.insertText = fn.name;
        }
        items.push(item);
    }

    for (const constant of getConstantsForReceiver(receiver)) {
        const item = new vscode.CompletionItem(constant.name, vscode.CompletionItemKind.Constant);
        item.documentation = new vscode.MarkdownString(constant.documentation);
        items.push(item);
    }

    return items;
}

function buildFunctionItem(fn: BuiltinFunction, kind: vscode.CompletionItemKind): vscode.CompletionItem {
    const item = new vscode.CompletionItem(fn.name, kind);
    item.detail = fn.signature;
    item.documentation = new vscode.MarkdownString(fn.documentation);
    return item;
}

function isInCommentOrString(text: string, offset: number): boolean {
    const prefix = text.substring(0, offset);

    const lineStart = prefix.lastIndexOf('\n') + 1;
    const line = prefix.substring(lineStart);
    const lineComment = line.indexOf('//');
    if (lineComment !== -1) {
        return true;
    }

    const lastBlockStart = prefix.lastIndexOf('/*');
    const lastBlockEnd = prefix.lastIndexOf('*/');
    if (lastBlockStart !== -1 && lastBlockStart > lastBlockEnd) {
        return true;
    }

    const quoteLine = line;
    const quotes = (quoteLine.match(/(?<!\\)"/g) || []).length;
    return quotes % 2 === 1;
}
