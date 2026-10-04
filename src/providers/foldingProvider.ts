import * as vscode from 'vscode';
import { findFoldingRanges } from '../language';

export class XelFoldingRangeProvider implements vscode.FoldingRangeProvider {
    public provideFoldingRanges(
        document: vscode.TextDocument,
        context: vscode.FoldingContext,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.FoldingRange[]> {
        const lines = document.getText().split(/\r?\n/);

        return findFoldingRanges(document.getText()).map(range => {
            const isRegion = /^\s*\/\/\s*#?region\b/.test(lines[range.start] ?? '');
            return new vscode.FoldingRange(
                range.start,
                range.end,
                isRegion ? vscode.FoldingRangeKind.Region : undefined
            );
        });
    }
}
