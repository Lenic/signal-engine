import { IDependencyNode, ISubscriber, IObservable } from './types';

/**
 * Concrete implementation of a dependency node within the doubly linked list.
 */
export class DependencyNode implements IDependencyNode {
  public prev: IDependencyNode | null = null;
  public next: IDependencyNode | null = null;

  /**
   * Creates a new dependency node.
   *
   * @param subscriber - The subscriber tracking the observable.
   * @param list - The observable dependency list.
   */
  constructor(
    public subscriber: ISubscriber | null,
    public list: IObservable | null
  ) {}
}
