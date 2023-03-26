import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { TaskQueue, Task } from './taskQueue';
import { getConfig, AmebaConfig } from './configuration';
import { AmebaOutput } from './amebaOutput';

export class Ameba {
    private diag: vscode.DiagnosticCollection;
    private taskQueue: TaskQueue;
    public config: AmebaConfig;

    constructor(diagnostics: vscode.DiagnosticCollection) {
        this.diag = diagnostics;
        this.taskQueue = new TaskQueue();
        this.config = getConfig();
    }

    public execute(document: vscode.TextDocument): void {
        if (document.languageId !== 'crystal' || document.isUntitled || document.uri.scheme !== 'file') {
            return;
        }

        const args = [this.config.command, document.fileName, '--format', 'json'];
        if (this.config.configFileName.length) {
            const dir = vscode.workspace.getWorkspaceFolder(document.uri)!.uri.fsPath;
            args.push('--config', path.join(dir, this.config.configFileName));
        }

        const task = new Task(document.uri, token => {
            const proc = cp.exec(args.join(' '), (err, stdout, stderr) => {
                if (token.isCanceled) return;

                if (err && stderr.length) {
                    if ((process.platform == 'win32' && err.code === 1) || err.code === 127) {
                        vscode.window.showErrorMessage(`Could not execute the Ameba file at: ${args[0]}`);
                    } else {
                        vscode.window.showErrorMessage(stderr);
                    }
                    return;
                }

                let results: AmebaOutput;
                try {
                    results = JSON.parse(stdout);
                } catch (err) {
                    console.error(`Ameba: failed parsing JSON: ${err}`);
                    vscode.window.showErrorMessage('Ameba: failed to parse JSON response.');
                    return;
                }

                if (!results.summary.issues_count) return;
                const diagnostics: [vscode.Uri, vscode.Diagnostic[]][] = [];

                for (let source of results.sources) {
                    if (!source.issues.length) continue;
                    let parsed: vscode.Diagnostic[] = [];

                    source.issues.forEach(issue => {
                        let start = issue.location;
                        let end = issue.end_location;
                        const range = new vscode.Range(
                            start.line - 1,
                            start.column - 1,
                            end.line - 1,
                            end.column
                        );

                        const diag = new vscode.Diagnostic(
                            range,
                            `[${issue.rule_name}] ${issue.message}`,
                            this.parseSeverity(issue.severity)
                        );
                        parsed.push(diag);
                    });

                    diagnostics.push([document.uri, parsed]);
                }

                this.diag.set(diagnostics);
            });

            return () => proc.kill();
        });

        this.taskQueue.enqueue(task);
    }

    private parseSeverity(severity: string): vscode.DiagnosticSeverity {
        switch(severity) {
            case 'Error':
                return vscode.DiagnosticSeverity.Error;
            case 'Warning':
                return vscode.DiagnosticSeverity.Warning;
            case 'Refactoring':
                return vscode.DiagnosticSeverity.Hint;
            default:
                return vscode.DiagnosticSeverity.Information;
        }
    }

    public clear(document: vscode.TextDocument): void {
        let uri = document.uri;
        if (uri.scheme === 'file') {
            this.taskQueue.cancel(uri);
            this.diag.delete(uri);
        }
    }
}
