/** Generador determinístico (misma semilla, mismo laberinto) para las páginas de actividades. */
function random(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/**
 * Laberinto perfecto (un solo camino entre la entrada y la salida) por búsqueda en
 * profundidad, como SVG de líneas: se imprime bien en blanco y negro.
 */
export function mazeSvg(columns: number, rows: number, seed: number): string {
  const next = random(seed);
  const cell = 10;
  const at = (x: number, y: number) => y * columns + x;
  // Paredes a la derecha y abajo de cada celda.
  const right = new Array<boolean>(columns * rows).fill(true);
  const down = new Array<boolean>(columns * rows).fill(true);
  const seen = new Array<boolean>(columns * rows).fill(false);
  const stack: [number, number][] = [[0, 0]];
  seen[0] = true;
  for (let top = stack.at(-1); top; top = stack.at(-1)) {
    const [x, y] = top;
    const options = (
      [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ] as [number, number][]
    ).filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < columns && ny < rows && !seen[at(nx, ny)]);
    const choice = options[Math.floor(next() * options.length)];
    if (!choice) {
      stack.pop();
      continue;
    }
    const [nx, ny] = choice;
    if (nx !== x) right[at(Math.min(nx, x), y)] = false;
    if (ny !== y) down[at(x, Math.min(ny, y))] = false;
    seen[at(nx, ny)] = true;
    stack.push(choice);
  }
  const lines: string[] = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const px = x * cell;
      const py = y * cell;
      // La salida queda abierta en la última celda.
      if (right[at(x, y)] && !(x === columns - 1 && y === rows - 1)) {
        lines.push(`M${String(px + cell)} ${String(py)}v${String(cell)}`);
      }
      if (down[at(x, y)]) lines.push(`M${String(px)} ${String(py + cell)}h${String(cell)}`);
    }
  }
  const width = columns * cell;
  const height = rows * cell;
  return `<svg viewBox="-2 -2 ${String(width + 4)} ${String(height + 4)}" xmlns="http://www.w3.org/2000/svg"><path d="M${String(cell)} 0h${String(width - cell)}M0 0v${String(height)}${lines.join('')}" stroke="#342a40" stroke-width="1.1" stroke-linecap="round" fill="none"/><circle cx="${String(cell / 2)}" cy="${String(cell / 2)}" r="2.6" fill="#79518c"/><circle cx="${String(width - cell / 2)}" cy="${String(height - cell / 2)}" r="2.6" fill="#d6ab68"/></svg>`;
}
