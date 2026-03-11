// ─── PRNG ─────────────────────────────────────────────────────────
export function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Diamond-Square ───────────────────────────────────────────────
export function diamondSquare(size: number, roughness: number, rng: () => number): Float32Array {
  const n = size + 1;
  const grid = new Float32Array(n * n);
  const g = (x: number, y: number) => grid[y * n + x];
  const s = (x: number, y: number, v: number) => { grid[y * n + x] = v; };
  s(0,0,rng()); s(size,0,rng()); s(0,size,rng()); s(size,size,rng());
  let step = size, scale = 1.0;
  while (step > 1) {
    const half = step >> 1;
    scale *= Math.pow(2, -roughness * 0.3);
    for (let y = 0; y < size; y += step)
      for (let x = 0; x < size; x += step)
        s(x+half, y+half, (g(x,y)+g(x+step,y)+g(x,y+step)+g(x+step,y+step))/4 + (rng()*2-1)*scale);
    for (let y = 0; y <= size; y += half)
      for (let x = (y + half) % step; x <= size; x += step) {
        let sum = 0, cnt = 0;
        if (x-half>=0) { sum+=g(x-half,y); cnt++; }
        if (x+half<=size) { sum+=g(x+half,y); cnt++; }
        if (y-half>=0) { sum+=g(x,y-half); cnt++; }
        if (y+half<=size) { sum+=g(x,y+half); cnt++; }
        s(x, y, sum/cnt + (rng()*2-1)*scale);
      }
    step = half;
  }
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < grid.length; i++) { if (grid[i]<mn) mn=grid[i]; if (grid[i]>mx) mx=grid[i]; }
  const range = mx - mn;
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) out[y*size+x] = (g(x,y)-mn)/range;
  return out;
}

// ─── Cellular Automata ────────────────────────────────────────────
export function caSmooth(height: Float32Array, size: number, waterPct: number, iters: number): Uint8Array {
  const wl = waterPct / 100;
  let cur = new Uint8Array(size * size);
  for (let i = 0; i < cur.length; i++) cur[i] = height[i] >= wl ? 1 : 0;
  for (let it = 0; it < iters; it++) {
    const nxt = new Uint8Array(cur.length);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        let land = 0;
        for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++)
          land += cur[((y+dy+size)%size)*size+((x+dx+size)%size)];
        nxt[y*size+x] = land >= 5 ? 1 : 0;
      }
    cur.set(nxt);
  }
  return cur;
}

// ─── Biome Assignment ─────────────────────────────────────────────
export interface TerrainParams {
  water: number; roughness: number; iterations: number;
  mountain: number; forest: number;
}

export function assignBiomes(land: Uint8Array, height: Float32Array, size: number, p: TerrainParams): Uint8Array {
  const biomes = new Uint8Array(size * size);
  const wl = p.water/100, mt = p.mountain/100, fd = p.forest/100;
  for (let i = 0; i < size * size; i++) {
    const h = height[i];
    if (!land[i]) { biomes[i] = h < wl*0.55 ? 0 : 1; continue; }
    if (h < wl+0.045) { biomes[i] = 2; continue; }
    if (h > mt+0.07)  { biomes[i] = 6; continue; }
    if (h > mt)       { biomes[i] = 5; continue; }
    const fp = (h - (wl+0.045)) / (mt - (wl+0.045));
    biomes[i] = fp > (1-fd) ? 4 : 3;
  }
  return biomes;
}

// ─── Stats ────────────────────────────────────────────────────────
export const BIOME_NAMES = ['Deep Ocean','Ocean','Beach','Grassland','Forest','Mountain','Snow Peak'];
export const PAL: [number,number,number][] = [
  [13,34,64],[26,58,92],[138,115,85],[45,90,39],[26,61,24],[74,74,74],[200,200,204]
];

export function calcStats(biomes: Uint8Array) {
  const c = new Array(7).fill(0);
  biomes.forEach(b => c[b]++);
  const total = biomes.length;
  const pct = (n: number) => Math.round(n / total * 100) + '%';
  return {
    water:    pct(c[0]+c[1]),
    land:     pct(c[2]+c[3]+c[4]+c[5]+c[6]),
    forest:   pct(c[4]),
    mountain: pct(c[5]+c[6]),
    dominant: c.indexOf(Math.max(...c)),
  };
}

// ─── Canvas Render ────────────────────────────────────────────────
export function renderBiomesToCanvas(
  canvas: HTMLCanvasElement,
  biomes: Uint8Array,
  size: number
) {
  const scale = canvas.width / size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(canvas.width, canvas.height);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = PAL[biomes[y*size+x]];
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const p = ((y*scale+sy)*canvas.width + (x*scale+sx)) * 4;
          d[p]=r; d[p+1]=g; d[p+2]=b; d[p+3]=255;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}
