import { IEffectAction } from '../types';
import { IChangeListenerSource } from './types';

export const globalContext = {
  isRunning: false,
  sourceList: [] as IChangeListenerSource<unknown>[],
  activeEffect: undefined as IEffectAction | undefined,
};
