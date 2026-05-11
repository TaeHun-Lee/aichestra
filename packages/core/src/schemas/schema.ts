import { ValidationError } from "../domain/errors.ts";

export type Schema<T> = {
  parse(input: unknown): T;
};

export function schema<T>(parse: (input: unknown) => T): Schema<T> {
  return { parse };
}

export function asObject(input: unknown, label: string): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new ValidationError([`${label} must be an object`]);
  }

  return input as Record<string, unknown>;
}

export function stringField(input: Record<string, unknown>, key: string, options: { optional?: boolean } = {}): string | undefined {
  const value = input[key];
  if (value === undefined || value === null) {
    if (options.optional) return undefined;
    throw new ValidationError([`${key} is required`]);
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError([`${key} must be a non-empty string`]);
  }

  return value;
}

export function numberField(input: Record<string, unknown>, key: string, options: { optional?: boolean; min?: number } = {}): number | undefined {
  const value = input[key];
  if (value === undefined || value === null) {
    if (options.optional) return undefined;
    throw new ValidationError([`${key} is required`]);
  }
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new ValidationError([`${key} must be a number`]);
  }
  if (options.min !== undefined && value < options.min) {
    throw new ValidationError([`${key} must be at least ${options.min}`]);
  }

  return value;
}

export function stringArrayField(input: Record<string, unknown>, key: string, options: { optional?: boolean } = {}): string[] {
  const value = input[key];
  if (value === undefined || value === null) {
    if (options.optional) return [];
    throw new ValidationError([`${key} is required`]);
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new ValidationError([`${key} must be an array of strings`]);
  }

  return value;
}
