export interface IErrorScopeContext {
  readonly hasErrors: boolean;

  push(error: unknown): void;
  [Symbol.dispose](): void;
}
