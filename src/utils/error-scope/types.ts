export interface IErrorScopeContext {
  push: (error: any) => void;
  capture: (action: () => void) => void;
}

export interface IErrorScope {
  run(callback: (context: IErrorScopeContext) => void): void;
}
