// Minimal Node globals for the benchmark scripts (no @types/node in this package).
declare const process: { env: Record<string, string | undefined>; stderr: { write(text: string): void } };
declare const console: { log(...args: unknown[]): void };
