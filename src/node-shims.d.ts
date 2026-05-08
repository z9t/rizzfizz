declare const process: {
  argv: string[];
  exitCode: number;
  stdout: {
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
  export function writeFile(path: string, data: string, encoding?: BufferEncoding): Promise<void>;
}

declare module "node:module" {
  export function createRequire(url: string): (id: string) => unknown;
}

declare module "node:path" {
  export function basename(path: string): string;
  export function dirname(path: string): string;
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
}

declare module "node:util" {
  export function promisify(fn: any): (...args: any[]) => Promise<any>;
}

type BufferEncoding = "utf8" | "utf-8";
