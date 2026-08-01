import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

interface QrCodeProps {
  value: string;
  /** Accessible description; the QR itself is decorative to a screen reader. */
  label: string;
}

/**
 * Builds every dark module into a single SVG path rather than one `<rect>` per
 * module. A join link is a type-4 symbol or thereabouts, so the naive version
 * is several hundred elements re-rendered on every lobby update; one path is
 * one element, and the browser fills it in a single pass.
 *
 * Rendered as React elements rather than the library's own `createSvgTag`,
 * which returns markup and would need `dangerouslySetInnerHTML` — the security
 * review checked that nothing in the app uses it, and that is worth keeping
 * true for a nicety like this.
 */
function modulePath(matrix: { count: number; isDark: (row: number, col: number) => boolean }): string {
  const segments: string[] = [];

  for (let row = 0; row < matrix.count; row += 1) {
    for (let col = 0; col < matrix.count; col += 1) {
      if (matrix.isDark(row, col)) segments.push(`M${col} ${row}h1v1h-1z`);
    }
  }

  return segments.join('');
}

export function QrCode({ value, label }: QrCodeProps) {
  const { path, size } = useMemo(() => {
    // Type 0 lets the library pick the smallest symbol that fits, and 'L' is
    // the right correction level for something displayed on a clean screen a
    // foot from the camera rather than printed and scuffed.
    const symbol = qrcode(0, 'L');
    symbol.addData(value);
    symbol.make();

    const count = symbol.getModuleCount();
    return {
      size: count,
      path: modulePath({ count, isDark: (row, col) => symbol.isDark(row, col) }),
    };
  }, [value]);

  // One module of quiet zone each side. The spec asks for four; on a backlit
  // screen with a light border already around it, one scans reliably and keeps
  // the code legible at lobby size.
  const extent = size + 2;

  return (
    <svg
      className="qr"
      viewBox={`0 0 ${extent} ${extent}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={extent} height={extent} fill="#eef6ff" />
      <g transform="translate(1 1)" fill="#04101f">
        <path d={path} />
      </g>
    </svg>
  );
}
