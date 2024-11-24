import { CancellationToken, CancellationTokenSource, Uri } from 'vscode';

import { outputChannel } from './extension';


/**
 * Task with async operation. It will be enqueued to and managed by
 * TaskQueue. Useful for spawning ChildProcess.
 */
export class Task {
    public readonly uri: Uri;
    public isEnqueued: boolean = false;
    private body: (token: CancellationToken) => Promise<void>;
    private cancelTokenSource: CancellationTokenSource = new CancellationTokenSource();
    private cancelToken: CancellationToken = this.cancelTokenSource.token;

    /**
     * @param body Function of task body, which returns callback called
     *             when cancelation is requested. You should call
     *             token.finished() after async operation is done.
     */
    constructor(uri: Uri, body: (token: CancellationToken) => Promise<void>) {
        this.uri = uri;
        this.body = body;
    }

    public async run(): Promise<void> {
        if (this.cancelToken.isCancellationRequested) return Promise.resolve();

        const task = this;
        return await task.body(this.cancelToken);
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
    }

    public cancel(uri: Uri): void {
        const uriString = uri.toString(true);

        for (const task of this.tasks) {
            if (task.uri.toString(true) === uriString) {
                task.cancel();
            }
        }
    }

    public clear(): void {
        for (const task of this.tasks) {
            task.cancel();
        }
    }

    private async kick(): Promise<void> {
        if (this.busy) return;
        this.busy = true;

        while (true) {
            let task: Task | undefined = this.tasks[0];
            outputChannel.appendLine(`[Task] ${this.tasks.length} tasks in queue`);

            if (!task) {
                this.busy = false;
                return;
            }

            try {
                await task.run();
            } catch (err) {
                console.error('Error while running ameba:', err);
            } finally {
                this.tasks.shift();
            }
        }
    }
}
