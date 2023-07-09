import { exec } from 'child_process';
import * as path from 'path';
import {
    commands,
    Diagnostic,
    DiagnosticCollection,
    DiagnosticSeverity,
    Range,
    TextDocument,
    Uri,
    window,
    workspace
} from 'vscode';
import { AmebaOutput } from './amebaOutput';
import { AmebaConfig, getConfig } from './configuration';
import { Task, TaskQueue } from './taskQueue';

export class Ameba {
    private diag: DiagnosticCollection;
    private taskQueue: TaskQueue;
    public config: AmebaConfig;

    constructor(diagnostics: DiagnosticCollection) {
        this.diag = diagnostics;
        this.taskQueue = new TaskQueue();
        this.config = getConfig();
    }

    public execute(document: TextDocument): void {
        if (document.languageId !== 'crystal' || document.isUntitled || document.uri.scheme !== 'file') {
            return;
        }

        const args = [this.config.command, document.fileName, '--format', 'json'];
        if (this.config.configFileName.length) {
            const dir = workspace.getWorkspaceFolder(document.uri)!.uri.fsPath;
            args.push('--config', path.join(dir, this.config.configFileName));
        }

        const task = new Task(document.uri, token => {
            const proc = exec(args.join(' '), (err, stdout, stderr) => {
                if (token.isCanceled) return;
                this.diag.delete(document.uri);

                if (err && stderr.length) {
                    if ((process.platform == 'win32' && err.code === 1) || err.code === 127) {
                        window.showErrorMessage(
                            `Could not execute Ameba file${args[0] === 'ameba' ? '.' : ` at ${args[0]}`}`,
                            'Disable (workspace)'
                        ).then(
                            disable => disable && commands.executeCommand('crystal.ameba.disable'),
                            _ => {}
                        );
                    } else {
                        window.showErrorMessage(stderr);
                    }
                    return;
                }

                let results: AmebaOutput;
                try {
                    results = JSON.parse(stdout);
                } catch (err) {
                    console.error(`Ameba: failed parsing JSON: ${err}`);
                    window.showErrorMessage('Ameba: failed to parse JSON response.');
                    return;
                }

                if (!results.summary.issues_count) return;
                const diagnostics: [Uri, Diagnostic[]][] = [];

                for (let source of results.sources) {
                    if (!source.issues.length) continue;
                    let parsed: Diagnostic[] = [];

                    source.issues.forEach(issue => {
                        let start = issue.location;
                        let end = issue.end_location;
                        if (!end.line || !end.column) {
                            end = start;
                        }
                        const range = new Range(
                            start.line - 1,
                            start.column - 1,
                            end.line - 1,
                            end.column
                        );

                        const diag = new Diagnostic(
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

    private parseSeverity(severity: string): DiagnosticSeverity {
        switch(severity) {
            case 'Error':
                return DiagnosticSeverity.Error;
            case 'Warning':
                return DiagnosticSeverity.Warning;
            case 'Refactoring':
                return DiagnosticSeverity.Hint;
            default:
                return DiagnosticSeverity.Information;
        }
    }

    public clear(document: TextDocument): void {
        let uri = document.uri;
        if (uri.scheme === 'file') {
            this.taskQueue.cancel(uri);
            this.diag.delete(uri);
        }
    }
}
