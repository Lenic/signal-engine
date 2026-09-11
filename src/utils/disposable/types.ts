export interface IDisposable {
  readonly isDisposed: boolean;

  dispose(): void;
  [Symbol.dispose](): void;
  disposeWithMe(disposable: IDisposable | (() => void)): void;
}
