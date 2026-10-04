import * as vscode from 'vscode';
import { formatDocument } from '../language';

export class XelFormattingProvider implements vscode.DocumentFormattingEditProvider {
    public provideDocumentFormattingEdits(
        document: vscode.TextDocument,
        options: vscode.FormattingOptions,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.TextEdit[]> {
        const text = document.getText();
        const eol = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
        const formatted = formatDocument(
            text,
            { tabSize: options.tabSize, insertSpaces: options.insertSpaces },
            eol
        );

        if (formatted === text) {
            return [];
        }

        return [vscode.TextEdit.replace(new vscode.Range(document.positionAt(0), document.positionAt(text.length)), formatted)];
    }
}
