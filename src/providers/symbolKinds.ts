import * as vscode from 'vscode';
import { SymbolKind as SourceSymbolKind } from '../types';

export const SYMBOL_KINDS: Record<SourceSymbolKind, vscode.SymbolKind> = {
    function: vscode.SymbolKind.Function,
    struct: vscode.SymbolKind.Struct,
    enum: vscode.SymbolKind.Enum,
    hook: vscode.SymbolKind.Function,
    const: vscode.SymbolKind.Constant
};
