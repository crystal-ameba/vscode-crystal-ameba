import { CancellationToken, CancellationTokenSource, Uri } from 'vscode';

import { outputChannel } from './extension';


/**
 * Task with async operation. It will be enqueued to and managed by
 * TaskQueue. Useful for spawning ChildProcess.
 */
export class Task {
    public readonly uri: Uri;
    public isEnqueued: boolean = false;
    private body: (token: CancellationToken) => void;
    private cancelTokenSource: CancellationTokenSource = new CancellationTokenSource();
    private cancelToken: CancellationToken = this.cancelTokenSource.token;

    /**
     * @param body Function of task body, which returns callback called
     *             when cancelation is requested. You should call
     *             token.finished() after async operation is done.
     */
    constructor(uri: Uri, body: (token: CancellationToken) => void) {
        this.uri = uri;
        this.body = body;
    }

    public run(): void {
        if (this.cancelToken.isCancellationRequested) return;

        const task = this;
        return task.body(this.cancelToken);
    }

    public cancel(): void {
        this.cancelTokenSource.cancel()
    }
}

/**
 * Provides single-threaded task queue which runs single asynchronous
 * Task at a time. This restricts concurrent execution of ameba
 * processes to prevent from running out machine resource.
 */
export class TaskQueue {
    private tasks: Task[] = [];
    private busy: boolean = false;

    public get length(): number {
        return this.tasks.length;
    }

    public enqueue(task: Task): void {
        if (task.isEnqueued) throw new Error(`Task is already enqueued (uri: ${task.uri})`);

        this.cancel(task.uri);
        task.isEnqueued = true;
        this.tasks.push(task);
        this.kick();
        outputChannel.appendLine(`[Task] ${this.tasks.length} tasks in queue`)
    }

    public cancel(uri: Uri): void {
        const uriString = uri.toString(true);
        this.tasks.forEach(task => {
            if (task.uri.toString(true) === uriString) {
                task.cancel();
            }
        });
    }

    public clear(): void {
        this.tasks.forEach(task => {
            task.cancel();
        })
    }

    private async kick(): Promise<void> {
        if (this.busy) return;
        this.busy = true;

        while (true) {
            let task: Task | undefined = this.tasks[0];
            if (!task) {
                this.busy = false;
                return;
            }

            try {
                task.run();
            } catch (err) {
                console.error('Error while running ameba:', err);
            } finally {
                this.tasks.shift();
            }
        }
    }
}
