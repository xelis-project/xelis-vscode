import * as vscode from 'vscode';
import { scanSymbols } from '../language';
import { SYMBOL_KINDS } from './symbolKinds';

export class XelDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
    public provideDocumentSymbols(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.SymbolInformation[] | vscode.DocumentSymbol[]> {
        return scanSymbols(document.getText()).map(symbol => {
            const line = document.lineAt(symbol.line);
            const selection = new vscode.Range(
                new vscode.Position(symbol.line, symbol.character),
                new vscode.Position(symbol.line, symbol.character + symbol.name.length)
            );
            return new vscode.DocumentSymbol(
                symbol.name,
                symbol.kind,
                SYMBOL_KINDS[symbol.kind],
                line.range,
                selection
            );
        });
    }
}
