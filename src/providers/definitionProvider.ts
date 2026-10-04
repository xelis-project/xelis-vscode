import * as vscode from 'vscode';
import { scanSymbols } from '../language';

export class XelDefinitionProvider implements vscode.DefinitionProvider {
    public provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Definition> {
        const range = document.getWordRangeAtPosition(position);
        if (!range) {
            return null;
        }

        const word = document.getText(range);
        const locations = scanSymbols(document.getText())
            .filter(symbol => symbol.name === word)
            .map(symbol => new vscode.Location(
                document.uri,
                new vscode.Position(symbol.line, symbol.character)
            ));

        return locations.length > 0 ? locations : null;
    }
}
