// H hair, S skin, E eye, M mouth, T shirt, A sleeve, P pants, B shoes, . empty
const BODY = [
  ".TTTTTTTT.",
  "ATTTTTTTTA",
  "ATTTTTTTTA",
  "S.TTTTTT.S",
  "..PPPPPP..",
  "..PP..PP..",
  "..PP..PP..",
  "..BB..BB..",
];

const HEADS = [
  // short hair
  ["..HHHHHH..", ".HHHHHHHH.", ".HSSSSSSH.", ".SSESSESS.", ".SSSSSSSS.", "..SSMMSS.."],
  // long hair
  ["..HHHHHH..", ".HHHHHHHH.", "HHSSSSSSHH", "HSSESSESSH", "HSSSSSSSSH", "HHSSMMSSHH"],
  // top bun
  ["....HH....", "..HHHHHH..", ".HSSSSSSH.", ".SSESSESS.", ".SSSSSSSS.", "..SSMMSS.."],
  // spiky
  [".H.HH.HH.H", ".HHHHHHHH.", ".HSSSSSSH.", ".SSESSESS.", ".SSSSSSSS.", "..SSMMSS.."],
];

const HAIR = ["#2b2b2b", "#6b4a2b", "#c9a35b", "#b3473b", "#7a8fb8", "#9c7a97", "#5fbf9f", "#e8e3da"];
const SKIN = ["#f5d0b0", "#e8b88f", "#c98f68", "#9a6644", "#6b4430"];

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

export function PixelPerson({ seed, size = 36, className }: { seed: string; size?: number; className?: string }) {
  const base = hash(seed);
  const head = HEADS[base % HEADS.length];
  const hair = HAIR[(base >>> 3) % HAIR.length];
  const skin = SKIN[(base >>> 7) % SKIN.length];
  const shirtHue = (base >>> 11) % 360;
  const colors: Record<string, string> = {
    H: hair,
    S: skin,
    E: "#222222",
    M: "#b5545c",
    T: `hsl(${shirtHue} 45% 58%)`,
    A: `hsl(${shirtHue} 45% 50%)`,
    P: "#3f4a5c",
    B: "#2a2a2a",
  };

  const rows = [...head, ...BODY];
  const width = rows[0].length;

  return (
    <svg
      viewBox={`0 0 ${width} ${rows.length}`}
      width={size}
      height={(size / width) * rows.length}
      className={className}
      shapeRendering="crispEdges"
      role="img"
      aria-label={seed}
    >
      {rows.flatMap((row, y) =>
        [...row].map((cell, x) =>
          colors[cell] ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={colors[cell]} /> : null,
        ),
      )}
    </svg>
  );
}
