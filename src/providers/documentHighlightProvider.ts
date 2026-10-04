import * as vscode from 'vscode';
import { findReferences } from '../language';

const MAX_HIGHLIGHTS = 500;

export class XelDocumentHighlightProvider implements vscode.DocumentHighlightProvider {
    public provideDocumentHighlights(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DocumentHighlight[]> {
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return null;
        }

        const word = document.getText(wordRange);
        const highlights = findReferences(document.getText(), word)
            .slice(0, MAX_HIGHLIGHTS)
            .map(reference => new vscode.DocumentHighlight(
                new vscode.Range(
                    reference.line,
                    reference.character,
                    reference.line,
                    reference.character + word.length
                ),
                vscode.DocumentHighlightKind.Read
            ));

        return highlights.length > 0 ? highlights : null;
    }
}