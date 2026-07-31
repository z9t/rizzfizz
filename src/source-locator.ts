import { basename } from "node:path";

/** Opaque builder-facing locator for a Design Markdown source path. */
export function sourceSafeDesignMdLocator(sourcePath: string): string {
  return `design-md:${basename(sourcePath)}`;
}
