declare const process: {
  argv: string[];
  exitCode: number;
  env: Record<string, string | undefined>;
  stdout: {
    write(value: string): void;
  };
  stderr: {
    write(value: string): void;
  };
};

declare module "node:child_process" {
  export function execFile(...args: any[]): any;
}

declare module "node:fs/promises" {
  export function access(path: string): Promise<void>;
  export function mkdir(path: string, options?: unknown): Promise<void>;
  export function readFile(path: string, encoding: BufferEncoding): Promise<string>;
  export function writeFile(path: string, data: string | Uint8Array, encoding?: BufferEncoding): Promise<void>;
  export function stat(path: string): Promise<{ isFile(): boolean; isDirectory(): boolean }>;
}

declare module "node:module" {
  export function createRequire(url: string): (id: string) => unknown;
}

declare module "node:path" {
  export function basename(path: string): string;
  export function dirname(path: string): string;
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
  export function relative(from: string, to: string): string;
}

declare module "node:os" {
  export function homedir(): string;
  export function tmpdir(): string;
}

declare module "node:url" {
  export function fileURLToPath(url: string | URL): string;
}

declare module "node:util" {
  export function promisify(fn: any): (...args: any[]) => Promise<any>;
}

type BufferEncoding = "utf8" | "utf-8";
