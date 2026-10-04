import * as vscode from 'vscode';
import { findAllBuiltins, scanFunctions } from '../language';
import { BuiltinFunction, FunctionSignatureInfo } from '../types';

export class XelSignatureHelpProvider implements vscode.SignatureHelpProvider {
    public provideSignatureHelp(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.SignatureHelpContext
    ): vscode.ProviderResult<vscode.SignatureHelp> {
        const offset = document.offsetAt(position);
        const text = document.getText();
        const paren = findOpenParen(text, offset);
        if (paren === -1) {
            return null;
        }

        const name = readFunctionName(text, paren);
        if (!name) {
            return null;
        }

        const builtins = findAllBuiltins(name);
        const functions = scanFunctions(text).filter(fn => fn.name === name);
        if (builtins.length === 0 && functions.length === 0) {
            return null;
        }

        const activeParameter = countTopLevelCommas(text.substring(paren + 1, offset));

        const signatureHelp = new vscode.SignatureHelp();
        signatureHelp.activeSignature = 0;
        signatureHelp.activeParameter = activeParameter;
        signatureHelp.signatures = [
            ...functions.map(fn => buildUserSignature(fn)),
            ...builtins.map(builtin => buildSignature(builtin))
        ];
        return signatureHelp;
    }
}

function buildUserSignature(fn: FunctionSignatureInfo): vscode.SignatureInformation {
    const signature = new vscode.SignatureInformation(fn.signature);
    signature.parameters = fn.parameters.map(parameter => new vscode.ParameterInformation(parameter));
    return signature;
}

function buildSignature(builtin: BuiltinFunction): vscode.SignatureInformation {
    const signature = new vscode.SignatureInformation(builtin.signature, new vscode.MarkdownString(builtin.documentation));
    const open = builtin.signature.indexOf('(');
    const close = builtin.signature.lastIndexOf(')');
    if (open !== -1 && close > open) {
        const parameters = splitTopLevel(builtin.signature.substring(open + 1, close));
        signature.parameters = parameters.filter(p => p.length > 0).map(p => new vscode.ParameterInformation(p));
    }
    return signature;
}

function findOpenParen(text: string, offset: number): number {
    let depth = 0;
    for (let i = offset - 1; i >= 0; i--) {
        const char = text[i];
        if (char === ')') {
            depth++;
        } else if (char === '(') {
            if (depth === 0) {
                return i;
            }
            depth--;
        } else if (char === '\n' && depth === 0) {
            break;
        }
    }
    return -1;
}

function readFunctionName(text: string, parenIndex: number): string | undefined {
    const match = /([A-Za-z_]\w*)\s*$/.exec(text.substring(0, parenIndex));
    return match ? match[1] : undefined;
}

function countTopLevelCommas(text: string): number {
    let depth = 0;
    let commas = 0;
    for (const char of text) {
        if (char === '(' || char === '[' || char === '<') {
            depth++;
        } else if (char === ')' || char === ']' || char === '>') {
            depth = Math.max(0, depth - 1);
        } else if (char === ',' && depth === 0) {
            commas++;
        }
    }
    return commas;
}

function splitTopLevel(text: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let current = '';
    for (const char of text) {
        if (char === '(' || char === '[' || char === '<') {
            depth++;
        } else if (char === ')' || char === ']' || char === '>') {
            depth = Math.max(0, depth - 1);
        }
        if (char === ',' && depth === 0) {
            parts.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    if (current.trim().length > 0) {
        parts.push(current.trim());
    }
    return parts;
}
