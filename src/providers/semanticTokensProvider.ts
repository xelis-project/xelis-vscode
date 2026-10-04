import * as vscode from 'vscode';
import { collectSemanticTokens } from '../language';

export const SEMANTIC_TOKEN_TYPES = [
    'function',
    'method',
    'struct',
    'enum',
    'enumMember',
    'type',
    'variable',
    'parameter',
    'modifier'
] as const;

export const SEMANTIC_TOKEN_MODIFIERS = ['declaration', 'readonly', 'static'] as const;

export const XVM_SEMANTIC_TOKEN_LEGEND = new vscode.SemanticTokensLegend(
    [...SEMANTIC_TOKEN_TYPES],
    [...SEMANTIC_TOKEN_MODIFIERS]
);

export class XelSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
    public provideDocumentSemanticTokens(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.SemanticTokens> {
        const builder = new vscode.SemanticTokensBuilder(XVM_SEMANTIC_TOKEN_LEGEND);

        for (const entry of collectSemanticTokens(document.getText())) {
            const type = SEMANTIC_TOKEN_TYPES.indexOf(entry.type);
            if (type === -1) {
                continue;
            }
            let modifiers = 0;
            for (const modifier of entry.modifiers) {
                const index = SEMANTIC_TOKEN_MODIFIERS.indexOf(modifier);
                if (index !== -1) {
                    modifiers |= 1 << index;
                }
            }
            builder.push(entry.line, entry.character, entry.length, type, modifiers);
        }

        return builder.build();
    }
}