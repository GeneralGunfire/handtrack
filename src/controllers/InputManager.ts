import type { Action, Dispatch, InputSource, Point } from '@/types/action';

type ActionListener = (action: Action) => void;

/**
 * Sole entry point for turning user intent into viewer state changes.
 * Sources (mouse/keyboard today, gestures later) never talk to the
 * store or DOM directly — they only push Actions here.
 */
export class InputManager {
  private sources = new Set<InputSource>();
  private listeners = new Set<ActionListener>();
  private _cursorPosition: Point = { x: 0, y: 0 };

  get cursorPosition(): Point {
    return this._cursorPosition;
  }

  private dispatch: Dispatch = (action) => {
    if (action.type === 'CURSOR') {
      this._cursorPosition = action.position;
    }
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

  next(): void {
    this.dispatch({ type: 'NEXT' });
  }

  previous(): void {
    this.dispatch({ type: 'PREVIOUS' });
  }

  select(index: number): void {
    this.dispatch({ type: 'SELECT', index });
  }

  zoom(delta: number, origin?: Point): void {
    this.dispatch({ type: 'ZOOM', delta, origin });
  }

  pan(dx: number, dy: number): void {
    this.dispatch({ type: 'PAN', dx, dy });
  }

  fitToScreen(): void {
    this.dispatch({ type: 'FIT' });
  }

  orbit(dyaw: number, dpitch: number): void {
    this.dispatch({ type: 'ORBIT', dyaw, dpitch });
  }

  toggleUI(): void {
    this.dispatch({ type: 'TOGGLE_UI' });
  }

  startSlideshow(): void {
    this.dispatch({ type: 'START_SLIDESHOW' });
  }

  stopSlideshow(): void {
    this.dispatch({ type: 'STOP_SLIDESHOW' });
  }

  exit(): void {
    this.dispatch({ type: 'EXIT' });
  }
}
