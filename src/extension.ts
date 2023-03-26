import * as vscode from 'vscode';
import { Ameba } from './ameba';
import { getConfig } from './configuration';

export function activate(context: vscode.ExtensionContext) {

	const diag = vscode.languages.createDiagnosticCollection('crystal');
	let ameba: Ameba | null = new Ameba(diag);
	context.subscriptions.push(diag);

    context.subscriptions.push(
        vscode.commands.registerCommand('crystal.ameba.lint', async () => {
            if (!ameba) {
                const enable = await vscode.window.showWarningMessage('Ameba has been disabled for this workspace.', 'Enable');
                if (!enable) return;
                ameba = new Ameba(diag);
            }

            const editor = vscode.window.activeTextEditor;
            if (editor) ameba.execute(editor.document);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('crystal.ameba.restart', () => {
            if (ameba) {
                const editor = vscode.window.activeTextEditor;
                if (editor) ameba.clear(editor.document);
            } else {
                ameba = new Ameba(diag);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('crystal.ameba.disable', () => {
            if (!ameba) return;
            const editor = vscode.window.activeTextEditor;
            if (editor) ameba.clear(editor.document);
            ameba = null;
        })
    );

    const ws = vscode.workspace;
    ws.onDidChangeConfiguration(_ => {
        if (!ameba) return;
        ameba.config = getConfig();
    });

    ws.textDocuments.forEach(doc => {
        ameba && ameba.execute(doc);
    });

    ws.onDidOpenTextDocument(doc => {
        ameba && ameba.execute(doc);
    });

    ws.onDidSaveTextDocument(doc => {
        if (ameba && ameba.config.onSave) ameba.execute(doc);
    });

    ws.onDidCloseTextDocument(doc => {
        ameba && ameba.clear(doc);
    });
}

export function deactivate() {}
