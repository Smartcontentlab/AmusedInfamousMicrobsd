const GRID = 8;
const HALF = GRID / 2;

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

/**
 * A deterministic, mirrored sprite so every contestant has a recognisable face
 * without shipping any image assets.
 */
export function PixelAvatar({ seed, size = 48, className }: { seed: string; size?: number; className?: string }) {
  const base = hash(seed);
  const hue = base % 360;
  const body = `hsl(${hue} 70% 55%)`;
  const shade = `hsl(${hue} 70% 38%)`;

  const cells: { x: number; y: number; fill: string }[] = [];

  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < HALF; x += 1) {
      // Top and bottom rows stay mostly clear so the sprite reads as a character.
      const edge = y === 0 || y === GRID - 1;
      const bit = (base >> ((y * HALF + x) % 29)) & 1;
      const filled = edge ? bit && x > 0 : bit || x === HALF - 1;
      if (!filled) continue;
      const fill = y >= GRID - 2 ? shade : body;
      cells.push({ x, y, fill });
      cells.push({ x: GRID - 1 - x, y, fill });
    }
  }

  const eyeRow = 3;
  const eyes = [
    { x: 2, y: eyeRow },
    { x: GRID - 3, y: eyeRow },
  ];

  return (
    <svg
      viewBox={`0 0 ${GRID} ${GRID}`}
      width={size}
      height={size}
      className={className}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`${seed} avatar`}
    >
      <rect width={GRID} height={GRID} fill={`hsl(${(hue + 40) % 360} 60% 92%)`} />
      {cells.map((cell) => (
        <rect key={`${cell.x}-${cell.y}`} x={cell.x} y={cell.y} width={1} height={1} fill={cell.fill} />
      ))}
      {eyes.map((eye) => (
        <rect key={`eye-${eye.x}`} x={eye.x} y={eye.y} width={1} height={1} fill="#111" />
      ))}
    </svg>
  );
}
