import type { Dispatch, InputSource } from '@/types/action';

const ZOOM_WHEEL_FACTOR = 0.0015;
const ZOOM_KEY_STEP = 0.25;

/**
 * Translates mouse and keyboard DOM events into semantic Actions.
 * Panning is driven by pointer drag on the element this is bound to;
 * the element itself is supplied lazily via `bindElement` since the
 * viewer stage mounts after the InputManager is constructed.
 */
export class MouseKeyboardSource implements InputSource {
  private dispatch: Dispatch | null = null;
  private element: HTMLElement | null = null;

  private isDragging = false;
  private lastPointer = { x: 0, y: 0 };

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.dispatch) return;

    switch (e.key) {
      case 'ArrowRight':
        this.dispatch({ type: 'NEXT' });
        break;
      case 'ArrowLeft':
        this.dispatch({ type: 'PREVIOUS' });
        break;
      case ' ':
        e.preventDefault();
        this.dispatch({ type: 'TOGGLE_SLIDESHOW' });
        break;
      case 'Escape':
        this.dispatch({ type: 'EXIT' });
        break;
      case '+':
      case '=':
        this.dispatch({ type: 'ZOOM', delta: ZOOM_KEY_STEP });
        break;
      case '-':
      case '_':
        this.dispatch({ type: 'ZOOM', delta: -ZOOM_KEY_STEP });
        break;
      case '0':
        this.dispatch({ type: 'FIT' });
        break;
      case '1':
        this.dispatch({ type: 'ACTUAL_SIZE' });
        break;
      default:
        return;
    }
  };

  private onWheel = (e: WheelEvent) => {
    if (!this.dispatch) return;
    e.preventDefault();
    const delta = -e.deltaY * ZOOM_WHEEL_FACTOR;
    this.dispatch({
      type: 'ZOOM',
      delta,
      origin: { x: e.clientX, y: e.clientY },
    });
  };

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    this.isDragging = true;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.dispatch) return;

    this.dispatch({ type: 'CURSOR', position: { x: e.clientX, y: e.clientY } });

    if (this.isDragging) {
      const dx = e.clientX - this.lastPointer.x;
      const dy = e.clientY - this.lastPointer.y;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      this.dispatch({ type: 'PAN', dx, dy });
    }
  };

  private onPointerUp = () => {
    this.isDragging = false;
  };

  private onDoubleClick = (e: MouseEvent) => {
    if (!this.dispatch) return;
    this.dispatch({
      type: 'TOGGLE_ZOOM',
      origin: { x: e.clientX, y: e.clientY },
    });
  };

  bindElement(element: HTMLElement): void {
    this.element = element;
    element.addEventListener('wheel', this.onWheel, { passive: false });
    element.addEventListener('pointerdown', this.onPointerDown);
    element.addEventListener('pointermove', this.onPointerMove);
    element.addEventListener('pointerup', this.onPointerUp);
    element.addEventListener('pointerleave', this.onPointerUp);
    element.addEventListener('dblclick', this.onDoubleClick);
  }

  unbindElement(): void {
    if (!this.element) return;
    this.element.removeEventListener('wheel', this.onWheel);
    this.element.removeEventListener('pointerdown', this.onPointerDown);
    this.element.removeEventListener('pointermove', this.onPointerMove);
    this.element.removeEventListener('pointerup', this.onPointerUp);
    this.element.removeEventListener('pointerleave', this.onPointerUp);
    this.element.removeEventListener('dblclick', this.onDoubleClick);
    this.element = null;
  }

  attach(dispatch: Dispatch): void {
    this.dispatch = dispatch;
    window.addEventListener('keydown', this.onKeyDown);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.unbindElement();
    this.dispatch = null;
  }
}
