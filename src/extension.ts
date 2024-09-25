import { commands, ExtensionContext, languages, window, workspace } from 'vscode';
import { Ameba } from './ameba';
import { getConfig } from './configuration';

export function activate(context: ExtensionContext) {
    const diag = languages.createDiagnosticCollection('crystal');
    let ameba: Ameba | null = new Ameba(diag);
    context.subscriptions.push(diag);

    context.subscriptions.push(
        commands.registerCommand('crystal.ameba.lint', () => {
            if (ameba) {
                const editor = window.activeTextEditor;
                if (editor) ameba.execute(editor.document);
            } else {
                window.showWarningMessage(
                    'Ameba has been disabled for this workspace.',
                    'Enable'
                ).then(
                    enable => {
                        if (!enable) return;
                        ameba = new Ameba(diag);
                        const editor = window.activeTextEditor;
                        if (editor) ameba.execute(editor.document);
                    },
                    _ => { }
                );
            }
        })
    );

    context.subscriptions.push(
        commands.registerCommand('crystal.ameba.restart', () => {
            if (ameba) {
                const editor = window.activeTextEditor;
                if (editor) ameba.clear(editor.document);
            } else {
                ameba = new Ameba(diag);
            }
        })
    );

    context.subscriptions.push(
        commands.registerCommand('crystal.ameba.disable', () => {
            if (!ameba) return;
            const editor = window.activeTextEditor;
            if (editor) ameba.clear(editor.document);
            ameba = null;
        })
    );

    workspace.onDidChangeConfiguration(_ => {
        if (!ameba) return;
        ameba.config = getConfig();
    });

    workspace.textDocuments.forEach(doc => {
        ameba && ameba.execute(doc);
    });

    workspace.onDidOpenTextDocument(doc => {
        ameba && ameba.execute(doc);
    });

    workspace.onDidChangeTextDocument(e => {
        if (ameba && ameba.config.onType) ameba.execute(e.document, true);
    })

    workspace.onDidSaveTextDocument(doc => {
        if (ameba && ameba.config.onSave) ameba.execute(doc);
    });

    workspace.onDidCloseTextDocument(doc => {
        ameba && ameba.clear(doc);
    });
}

export function deactivate() { }
