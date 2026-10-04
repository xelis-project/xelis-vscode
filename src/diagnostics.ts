import * as vscode from 'vscode';
import { findBracketDiagnostics, findSemanticDiagnostics } from './language';
import { DiagnosticSeverityName, PositionInfo } from './types';

const SEVERITIES: Record<DiagnosticSeverityName, vscode.DiagnosticSeverity> = {
    error: vscode.DiagnosticSeverity.Error,
    warning: vscode.DiagnosticSeverity.Warning,
    hint: vscode.DiagnosticSeverity.Hint
};

function toRange(entry: PositionInfo & { length: number }): vscode.Range {
    return new vscode.Range(
        entry.line,
        entry.character,
        entry.line,
        entry.character + entry.length
    );
}

export class XelDiagnostics {
    private readonly collection: vscode.DiagnosticCollection;

    constructor() {
        this.collection = vscode.languages.createDiagnosticCollection('xvm');
    }

    public update(document: vscode.TextDocument): void {
        const text = document.getText();
        const diagnostics: vscode.Diagnostic[] = [];

        for (const entry of findBracketDiagnostics(text)) {
            const diagnostic = new vscode.Diagnostic(toRange(entry), entry.message, vscode.DiagnosticSeverity.Error);
            diagnostic.source = 'xvm';
            diagnostic.code = entry.message.startsWith('Unclosed') ? 'unclosed-bracket' : 'unmatched-bracket';
            diagnostics.push(diagnostic);
        }

        for (const entry of findSemanticDiagnostics(text)) {
            const diagnostic = new vscode.Diagnostic(toRange(entry), entry.message, SEVERITIES[entry.severity]);
            diagnostic.source = 'xvm';
            diagnostic.code = entry.code;
            diagnostics.push(diagnostic);
        }

        this.collection.set(document.uri, diagnostics);
    }

    public clear(uri: vscode.Uri): void {
        this.collection.delete(uri);
    }

    public dispose(): void {
        this.collection.dispose();
    }
}