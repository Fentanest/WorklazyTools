export class VideoOutputQueue {
  private pending = Promise.resolve();

  enqueue(handler: () => void | Promise<void>) {
    this.pending = this.pending.then(handler);
    return this.pending;
  }

  wait() {
    return this.pending;
  }
}
