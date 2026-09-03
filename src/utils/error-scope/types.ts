export interface IErrorScopeContext {
  readonly hasErrors: boolean;

  push: (error: any) => void;
}
