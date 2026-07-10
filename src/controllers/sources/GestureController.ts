import type { Dispatch, GestureController as IGestureController } from '@/types/action';

/**
 * Placeholder for future MediaPipe hand-tracking input. Implements the
 * GestureController contract so it can be registered with InputManager
 * exactly like MouseKeyboardSource, but emits no Actions today.
 *
 * When hand tracking is implemented, a real controller replaces this
 * (e.g. `MediaPipeGestureController`), calling `dispatch` with the same
 * Action union in response to recognized hand poses. No changes are
 * needed to InputManager or any Viewer component.
 */
export class NoOpGestureController implements IGestureController {
  readonly isTracking = false;

  attach(_dispatch: Dispatch): void {
    // No-op: a real implementation stores `dispatch` and calls it as
    // hand poses are recognized.
  }

  detach(): void {
    // No-op.
  }
}
