import type { Dispatch, InputSource } from '@/types/action';

const ZOOM_WHEEL_FACTOR = 0.0012;
const ZOOM_KEY_STEP = 0.25;
/** Radians of orbit per pixel of drag. */
const ORBIT_PIXEL_GAIN = 0.0055;
/** A press that moves less than this (px) and releases quickly is a click-tap. */
const TAP_MOVE_PX = 5;
const TAP_MAX_MS = 400;

/**
 * Translates mouse and keyboard DOM events into semantic Actions for the
 * graph viewer: moving aims (AIM), a quick left-click commits (TAP),
 * left-drag orbits, right/middle/shift-drag pans, wheel dollies,
 * double-click resets the view.
 */
export class MouseKeyboardSource implements InputSource {
  private dispatch: Dispatch | null = null;
  private element: HTMLElement | null = null;

  private dragMode: 'none' | 'orbit' | 'pan' = 'none';
  private lastPointer = { x: 0, y: 0 };
  private pressStart = { x: 0, y: 0, timeMs: 0 };
  private moved = false;

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.dispatch) return;
    // Don't hijack typing in the search box.
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

    switch (e.key) {
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
      case 'Backspace':
        this.dispatch({ type: 'BACK' });
        break;
      default:
        return;
    }
  };

  private onWheel = (e: WheelEvent) => {
    if (!this.dispatch) return;
    e.preventDefault();
    this.dispatch({ type: 'ZOOM', delta: -e.deltaY * ZOOM_WHEEL_FACTOR });
  };

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
    this.dragMode = e.button === 0 && !e.shiftKey ? 'orbit' : 'pan';
    this.lastPointer = { x: e.clientX, y: e.clientY };
    this.pressStart = { x: e.clientX, y: e.clientY, timeMs: performance.now() };
    this.moved = false;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.dispatch || !this.element) return;

    const rect = this.element.getBoundingClientRect();
    this.dispatch({
      type: 'AIM',
      x: (e.clientX - rect.left) / Math.max(rect.width, 1),
      y: (e.clientY - rect.top) / Math.max(rect.height, 1),
      source: 'mouse',
    });

    if (this.dragMode === 'none') return;

    const dx = e.clientX - this.lastPointer.x;
    const dy = e.clientY - this.lastPointer.y;
    this.lastPointer = { x: e.clientX, y: e.clientY };

    if (
      Math.hypot(e.clientX - this.pressStart.x, e.clientY - this.pressStart.y) > TAP_MOVE_PX
    ) {
      this.moved = true;
    }

    if (this.dragMode === 'orbit') {
      this.dispatch({ type: 'ORBIT', dyaw: dx * ORBIT_PIXEL_GAIN, dpitch: dy * ORBIT_PIXEL_GAIN });
    } else {
      // Normalize by viewport height so pan speed matches gesture pan units.
      const h = this.element.clientHeight || window.innerHeight;
      this.dispatch({ type: 'PAN', dx: dx / h, dy: dy / h });
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    const wasOrbit = this.dragMode === 'orbit';
    this.dragMode = 'none';
    if (
      wasOrbit &&
      !this.moved &&
      e.type === 'pointerup' &&
      performance.now() - this.pressStart.timeMs <= TAP_MAX_MS
    ) {
      this.dispatch?.({ type: 'TAP' });
    }
  };

  private onDoubleClick = () => {
    this.dispatch?.({ type: 'FIT' });
  };

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  bindElement(element: HTMLElement): void {
    this.element = element;
    element.addEventListener('wheel', this.onWheel, { passive: false });
    element.addEventListener('pointerdown', this.onPointerDown);
    element.addEventListener('pointermove', this.onPointerMove);
    element.addEventListener('pointerup', this.onPointerUp);
    element.addEventListener('pointerleave', this.onPointerUp);
    element.addEventListener('dblclick', this.onDoubleClick);
    element.addEventListener('contextmenu', this.onContextMenu);
  }

  unbindElement(): void {
    if (!this.element) return;
    this.element.removeEventListener('wheel', this.onWheel);
    this.element.removeEventListener('pointerdown', this.onPointerDown);
    this.element.removeEventListener('pointermove', this.onPointerMove);
    this.element.removeEventListener('pointerup', this.onPointerUp);
    this.element.removeEventListener('pointerleave', this.onPointerUp);
    this.element.removeEventListener('dblclick', this.onDoubleClick);
    this.element.removeEventListener('contextmenu', this.onContextMenu);
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
