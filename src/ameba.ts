import { spawn } from 'child_process';
import * as path from 'path';
import { existsSync } from 'fs';
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
import { outputChannel } from './extension';


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
        const dir = workspace.getWorkspaceFolder(document.uri)!.uri.fsPath;
        const configFile = path.join(dir, this.config.configFileName);
        if (existsSync(configFile)) args.push('--config', configFile);

        const task = new Task(document.uri, token => {
            return new Promise((resolve, reject) => {
                let stdoutArr: string[] = [];
                let stderrArr: string[] = [];

                outputChannel.appendLine(`$ ${args.join(' ')}`)
                const proc = spawn(args[0], args.slice(1), { cwd: dir });

                token.onCancellationRequested(_ => {
                    proc.kill();
                })

                proc.stdout.on('data', (data) => {
                    stdoutArr.push(data.toString());
                })

                proc.stderr.on('data', (data) => {
                    stderrArr.push(data.toString());
                })

                proc.on('error', (err) => {
                    console.error('Failed to start subprocess:', err);
                    window.showErrorMessage(`Failed to start Ameba: ${err.message}`)
                    reject(err);
                })

                proc.on('close', (code) => {
                    if (token.isCancellationRequested) {
                        resolve();
                        return;
                    }

                    this.diag.delete(document.uri);

                    const stdout = stdoutArr.join('')
                    const stderr = stderrArr.join('')

                    if (code !== 0 && stderr.length) {
                        if ((process.platform == 'win32' && code === 1) || code === 127) {
                            window.showErrorMessage(
                                `Could not execute Ameba file${args[0] === 'ameba' ? '.' : ` at ${args[0]}`}`,
                                'Disable (workspace)'
                            ).then(
                                disable => disable && commands.executeCommand('crystal.ameba.disable'),
                                _ => { }
                            );
                        } else {
                            window.showErrorMessage(stderr);
                        }

                        reject(new Error(stderr));
                        return;
                    }

                    let results: AmebaOutput;

                    try {
                        results = JSON.parse(stdout);
                    } catch (err) {
                        console.error(`Ameba: failed parsing JSON: ${err}`);
                        outputChannel.appendLine(`[Task] Error: failed to parse JSON:\n${stdout}`)
                        window.showErrorMessage('Ameba: failed to parse JSON response.');
                        reject(err);
                        return;
                    }

                    if (!results.summary.issues_count) {
                        resolve();
                        return;
                    }

                    const diagnostics: [Uri, Diagnostic[]][] = [];

                    for (const source of results.sources) {
                        if (!source.issues.length) continue;

                        let parsed: Diagnostic[] = [];

                        for (const issue of source.issues) {
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

                            diag.code = {
                                value: "Docs",
                                target: Uri.parse(`https://crystaldoc.info/github/crystal-ameba/ameba/v${results.metadata.ameba_version}/Ameba/Rule/${issue.rule_name}.html`)
                            }

                            parsed.push(diag);
                        }

                        let diagnosticUri: Uri;
                        if (path.isAbsolute(source.path)) {
                            diagnosticUri = Uri.parse(source.path)
                        } else if (document.isUntitled) {
                            diagnosticUri = document.uri;
                        } else {
                            diagnosticUri = Uri.parse(path.join(dir, source.path));
                        }

                        const logPath = path.relative(dir, diagnosticUri.fsPath)
                        outputChannel.appendLine(`[Task] (${logPath}) Found ${parsed.length} issues`)
                        diagnostics.push([diagnosticUri, parsed]);
                    }

                    this.diag.set(diagnostics);
                    outputChannel.appendLine(`[Task] Done!`)
                    resolve();
                });
            })
        });

        this.taskQueue.enqueue(task);
    }

    private parseSeverity(severity: string): DiagnosticSeverity {
        switch (severity) {
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

    public clear(document: TextDocument | null = null): void {
        if (document) {
            let uri = document.uri;
            if (uri.scheme === 'file') {
                this.taskQueue.cancel(uri);
                this.diag.delete(uri);
            }
        } else {
            this.taskQueue.clear();
            this.diag.clear();
        }
    }
}
