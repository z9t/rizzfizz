declare module "culori" {
  export type Color = Record<string, unknown>;

  export function converter(mode: string): (color: Color | string) => Color | undefined;
  export function parse(color: string): Color | undefined;
  export function formatHex(color: Color): string;
  export function clampRgb(color: Color): Color;
}

declare module "culori/require" {
  type Color = Record<string, unknown>;

  const culori: {
    converter(mode: string): (color: Color | string) => Color | undefined;
    parse(color: string): Color | undefined;
    formatHex(color: Color): string;
    clampRgb(color: Color): Color;
  };

  export default culori;
}
