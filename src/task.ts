import { CancellationToken, CancellationTokenSource, Uri } from 'vscode';

/**
 * Task with async operation. It will be enqueued to and managed by
 * TaskQueue. Useful for spawning ChildProcess.
 */
export class Task {
  public readonly uri: Uri;
  public isEnqueued = false;

  private body: (token: CancellationToken) => Promise<void>;
  private cancelTokenSource: CancellationTokenSource =
    new CancellationTokenSource();
  private cancelToken: CancellationToken = this.cancelTokenSource.token;

  /**
   * @param body Function of task body, which returns callback called
   *             when cancellation is requested. You should call
   *             token.finished() after async operation is done.
   */
  constructor(uri: Uri, body: (token: CancellationToken) => Promise<void>) {
    this.uri = uri;
    this.body = body;
  }

  public async run(): Promise<void> {
    if (this.cancelToken.isCancellationRequested) {
      return Promise.resolve();
    }
    const task = this;
    return await task.body(this.cancelToken);
  }

  public cancel(): void {
    this.cancelTokenSource.cancel();
  }
}
