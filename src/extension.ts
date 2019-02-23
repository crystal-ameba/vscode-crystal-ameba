import * as vscode from 'vscode';
import { Ameba } from './ameba';
import { onDidChangeConfiguration } from './configuration';

export function activate(context: vscode.ExtensionContext) {

	const diag = vscode.languages.createDiagnosticCollection('crystal');
	context.subscriptions.push(diag);

	const ameba = new Ameba(diag);

	let disposable = vscode.commands.registerCommand('crystal.ameba', () => {
		const textEditor = vscode.window.activeTextEditor;
		if (textEditor) {
			const document = textEditor.document;
			ameba.execute(document);
		}
	});

	context.subscriptions.push(disposable);

    const ws = vscode.workspace;

    ws.onDidChangeConfiguration(onDidChangeConfiguration(ameba));

    ws.textDocuments.forEach((e: vscode.TextDocument) => {
        ameba.execute(e);
    });

    ws.onDidOpenTextDocument((e: vscode.TextDocument) => {
        ameba.execute(e);
    });

    ws.onDidSaveTextDocument((e: vscode.TextDocument) => {
        if (ameba.config.onSave) {
            ameba.execute(e);
        }
    });

    ws.onDidCloseTextDocument((e: vscode.TextDocument) => {
        ameba.clear(e);
    });
}

export function deactivate() {}
