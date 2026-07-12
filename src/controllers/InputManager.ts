import type { Action, Dispatch, InputSource } from '@/types/action';

type ActionListener = (action: Action) => void;

/**
 * Sole entry point for turning user intent into viewer state changes.
 * Sources (mouse/keyboard, hand gestures) never talk to the store or DOM
 * directly — they only push Actions here.
 */
export class InputManager {
  private sources = new Set<InputSource>();
  private listeners = new Set<ActionListener>();

  private dispatch: Dispatch = (action) => {
    for (const listener of this.listeners) {
      listener(action);
    }
  };

  registerSource(source: InputSource): () => void {
    this.sources.add(source);
    source.attach(this.dispatch);
    return () => this.unregisterSource(source);
  }

  unregisterSource(source: InputSource): void {
    if (this.sources.delete(source)) {
      source.detach();
    }
  }

  subscribe(listener: ActionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    for (const source of this.sources) {
      source.detach();
    }
    this.sources.clear();
    this.listeners.clear();
  }

  zoom(delta: number): void {
    this.dispatch({ type: 'ZOOM', delta });
  }

  orbit(dyaw: number, dpitch: number): void {
    this.dispatch({ type: 'ORBIT', dyaw, dpitch });
  }

  fitToScreen(): void {
    this.dispatch({ type: 'FIT' });
  }

  toggleUI(): void {
    this.dispatch({ type: 'TOGGLE_UI' });
  }

  exit(): void {
    this.dispatch({ type: 'EXIT' });
  }
}
