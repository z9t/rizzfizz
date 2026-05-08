import { createRequire } from "node:module";

type CuloriColor = Record<string, unknown>;
type CuloriApi = {
  converter(mode: string): (color: CuloriColor | string) => CuloriColor | undefined;
  parse(color: string): CuloriColor | undefined;
  formatHex(color: CuloriColor): string;
  clampRgb(color: CuloriColor): CuloriColor;
};

const require = createRequire(import.meta.url);
const culori = require("culori/require") as CuloriApi;

export default culori;
