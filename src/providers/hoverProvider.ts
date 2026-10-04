import * as vscode from 'vscode';
import { keywordDescriptions } from '../constants/keywords';
import { findAllBuiltins } from '../language';

export class XelHoverProvider implements vscode.HoverProvider {
    public provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Hover> {
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return null;
        }

        const word = document.getText(wordRange);
        const description = keywordDescriptions[word];

        if (description) {
            return new vscode.Hover(new vscode.MarkdownString(description));
        }

        const builtins = findAllBuiltins(word);
        if (builtins.length > 0) {
            const markdown = new vscode.MarkdownString();
            for (const builtin of builtins) {
                markdown.appendCodeblock(builtin.signature, 'silex');
                markdown.appendMarkdown(`${builtin.documentation}\n\n`);
            }
            return new vscode.Hover(markdown, wordRange);
        }

        return null;
    }
}
