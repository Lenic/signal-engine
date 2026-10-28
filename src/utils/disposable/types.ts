export interface IDisposable {
  readonly isDisposed: boolean;

  dispose(): void;
  disposeWithMe(disposable: IDisposable | (() => void)): void;
}
