// lib/training-store.ts
export type TrainingState = { prompt: string; updatedAt: string | null };

const g = globalThis as any;
if (!g.__TRAINING__) {
  g.__TRAINING__ = <TrainingState>{ prompt: "", updatedAt: null };
}

export function getTraining(): TrainingState {
  return g.__TRAINING__;
}

export function setTraining(patch: Partial<TrainingState>): TrainingState {
  const t = g.__TRAINING__ as TrainingState;
  g.__TRAINING__ = { ...t, ...patch, updatedAt: new Date().toISOString() };
  return g.__TRAINING__;
}
