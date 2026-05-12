export type JsonObject = Record<string, unknown>;

export type Clock = {
  now(): Date;
};

export const systemClock: Clock = {
  now: () => new Date()
};

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export * from "./dashboard-read-models.ts";
