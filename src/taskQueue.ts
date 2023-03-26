import { Uri } from 'vscode';

export interface TaskToken {
    readonly isCanceled: boolean;
    finished(): void;
}

export type CancelCallback = () => void;

/**
 * Task with async operation. It will be enqueued to and managed by
 * TaskQueue. Useful for spawning ChildProcess.
 */
export class Task {
    public readonly uri: Uri;
    public isEnqueued: boolean = false;
    private body: (token: TaskToken) => CancelCallback;
    private isCanceled: boolean = false;
    private resolver?: () => void;
    private onCancel?: CancelCallback;

    /**
     * @param body Function of task body, which returns callback called
     *             when cancelation is requested. You should call
     *             token.finished() after async operation is done.
     */
    constructor(uri: Uri, body: (token: TaskToken) => CancelCallback) {
        this.uri = uri;
        this.body = body;
    }

    public run(): Promise<void> {
        if (this.isCanceled) return Promise.resolve();

        const task = this;
        return new Promise(resolve => {
            task.resolver = () => resolve();
            const token = {
                get isCanceled(): boolean {
                    return task.isCanceled;
                },

                finished(): void {
                    task.resolveOnce();
                },
            };
            task.onCancel = this.body(token);
        });
    }

    public cancel(): void {
        if (this.isCanceled) return;
        this.isCanceled = true;
        if (this.onCancel) this.onCancel();
        this.resolveOnce();
    }

    private resolveOnce(): void {
        if (this.resolver) {
            this.resolver();
            this.resolver = undefined;
        }
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
        this.tasks.forEach(task => {
            if (task.uri.toString(true) === uriString) {
                task.cancel();
            }
        });
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
                await task.run();
            } catch (err) {
                console.error('Error while running ameba:', err);
            }
            this.tasks.shift();
        }
    }
}