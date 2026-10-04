import * as vscode from 'vscode';
import { scanSymbols } from '../language';
import { SYMBOL_KINDS } from './symbolKinds';

const MAX_FILES = 500;

export class XelWorkspaceSymbolProvider implements vscode.WorkspaceSymbolProvider {
    public async provideWorkspaceSymbols(
        query: string,
        token: vscode.CancellationToken
    ): Promise<vscode.SymbolInformation[]> {
        const files = await vscode.workspace.findFiles('**/*.slx', '**/node_modules/**', MAX_FILES);
        const lowered = query.toLowerCase();
        const results: vscode.SymbolInformation[] = [];

        for (const file of files) {
            if (token.isCancellationRequested) {
                break;
            }
            let document: vscode.TextDocument;
            try {
                document = await vscode.workspace.openTextDocument(file);
            } catch {
                continue;
            }

            for (const symbol of scanSymbols(document.getText())) {
                if (lowered.length > 0 && !symbol.name.toLowerCase().includes(lowered)) {
                    continue;
                }
                results.push(new vscode.SymbolInformation(
                    symbol.name,
                    SYMBOL_KINDS[symbol.kind],
                    vscode.workspace.asRelativePath(file),
                    new vscode.Location(file, new vscode.Position(symbol.line, symbol.character))
                ));
            }
        }

        return results;
    }
}
