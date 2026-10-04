import * as vscode from 'vscode';

const OPEN_TO_CLOSE: { [key: string]: string } = { '(': ')', '{': '}', '[': ']' };
const UNCLOSED_PATTERN = /Unclosed '([^']+)'/;
const UNUSED_PATTERN = /Unused (?:let|const) '([^']+)'/;

export class XelCodeActionProvider implements vscode.CodeActionProvider {
    public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

    public provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken
    ): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];

        for (const diagnostic of context.diagnostics) {
            if (diagnostic.source !== 'xvm') {
                continue;
            }
            const code = typeof diagnostic.code === 'string' ? diagnostic.code : '';

            if (code === 'unmatched-bracket') {
                const char = document.getText(diagnostic.range);
                if (!char) {
                    continue;
                }
                const action = new vscode.CodeAction(`Delete '${char}'`, vscode.CodeActionKind.QuickFix);
                action.diagnostics = [diagnostic];
                action.isPreferred = true;
                action.edit = new vscode.WorkspaceEdit();
                action.edit.delete(document.uri, diagnostic.range);
                actions.push(action);
            } else if (code === 'unclosed-bracket') {
                const open = UNCLOSED_PATTERN.exec(diagnostic.message)?.[1] ?? document.getText(diagnostic.range);
                const close = OPEN_TO_CLOSE[open];
                if (!close) {
                    continue;
                }
                const action = new vscode.CodeAction(`Insert '${close}' at end of file`, vscode.CodeActionKind.QuickFix);
                action.diagnostics = [diagnostic];
                action.isPreferred = true;
                action.edit = new vscode.WorkspaceEdit();
                action.edit.insert(document.uri, document.positionAt(document.getText().length), close);
                actions.push(action);
            } else if (code === 'unused-variable') {
                const name = UNUSED_PATTERN.exec(diagnostic.message)?.[1];
                if (!name) {
                    continue;
                }
                const line = document.lineAt(diagnostic.range.start.line);
                const declaration = new RegExp(`^\\s*(?:let|const)\\s+${name}\\b`);
                if (!declaration.test(line.text) || line.text.includes(',')) {
                    continue;
                }
                const action = new vscode.CodeAction(`Remove unused '${name}'`, vscode.CodeActionKind.QuickFix);
                action.diagnostics = [diagnostic];
                action.edit = new vscode.WorkspaceEdit();
                action.edit.delete(document.uri, line.rangeIncludingLineBreak);
                actions.push(action);
            }
        }

        return actions;
    }
}