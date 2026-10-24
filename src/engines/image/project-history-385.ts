import {
  IMAGE_TRANSFORM_HISTORY_LIMIT,
  commitImageTransform,
  createImageTransformHistory,
  resetImageTransform,
  undoImageTransform,
  type ImageTransformHistory,
  type ImageTransformState,
} from "./transform-workspace";

/** Reuses the existing pixel-transform history; only the redo branch is new. */
export interface ImageProjectHistory385 extends ImageTransformHistory {
  readonly future: readonly ImageTransformState[];
}

export function createImageProjectHistory385(initial: ImageTransformState): ImageProjectHistory385 {
  return { ...createImageTransformHistory(initial), future: [] };
}

export function commitImageProject385(history: ImageProjectHistory385, next: ImageTransformState): ImageProjectHistory385 {
  const committed = commitImageTransform(history, next);
  return committed === history ? history : { ...committed, future: [] };
}

export function undoImageProject385(history: ImageProjectHistory385): ImageProjectHistory385 {
  if (history.past.length === 0) return history;
  return {
    ...undoImageTransform(history),
    future: [history.current, ...history.future].slice(0, IMAGE_TRANSFORM_HISTORY_LIMIT),
  };
}

export function redoImageProject385(history: ImageProjectHistory385): ImageProjectHistory385 {
  const next = history.future[0];
  if (next === undefined) return history;
  return { ...commitImageTransform(history, next), future: history.future.slice(1) };
}

export function resetImageProject385(history: ImageProjectHistory385): ImageProjectHistory385 {
  return { ...resetImageTransform(history), future: [] };
}
