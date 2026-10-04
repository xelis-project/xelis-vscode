import * as vscode from 'vscode';
import { findReferences } from '../language';

export class XelReferenceProvider implements vscode.ReferenceProvider {
    public provideReferences(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.ReferenceContext,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Location[]> {
        const range = document.getWordRangeAtPosition(position);
        if (!range) {
            return null;
        }

        const word = document.getText(range);
        return findReferences(document.getText(), word).map(
            reference => new vscode.Location(
                document.uri,
                new vscode.Position(reference.line, reference.character)
            )
        );
    }
}
