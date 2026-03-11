import Anthropic from '@anthropic-ai/sdk';
import { db } from './db';
import { mulberry32, diamondSquare, caSmooth, assignBiomes, calcStats, PAL } from './terrain';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BIOME_NAMES = ['Deep Ocean','Ocean','Beach','Grassland','Forest','Mountain','Snow Peak'];
const TIER_SIZES: Record<string, number> = { outpost: 64, settlement: 128, kingdom: 256 };

// Render biomes array → PNG buffer using sharp (no native canvas needed)
async function renderPNG(biomes: Uint8Array, size: number): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  const pixels = new Uint8Array(size * size * 3);
  for (let i = 0; i < biomes.length; i++) {
    const [r, g, b] = PAL[biomes[i]];
    pixels[i * 3]     = r;
    pixels[i * 3 + 1] = g;
    pixels[i * 3 + 2] = b;
  }
  return sharp(Buffer.from(pixels), { raw: { width: size, height: size, channels: 3 } })
    .resize(512, 512, { kernel: 'nearest' })
    .png()
    .toBuffer();
}

export interface ClaimParams {
  jobId: string;
  seed: number;
  tier: string;
  params: any;
  agentAddress: string;
  onProgress: (step: string, pct: number) => void;
}

export async function claimTerritory(input: ClaimParams) {
  const { jobId, seed, tier, params, agentAddress, onProgress } = input;
  const size = TIER_SIZES[tier] || 128;
  const fullParams = { seed, size, ...params };

  onProgress('Generating terrain...', 20);

  // Generate locally (Conway VM path runs same algorithm inside the VM)
  const rng = mulberry32(seed * 1234567 + 13);
  const height = diamondSquare(size, params.roughness ?? 4, rng);
  const land = caSmooth(height, size, params.water ?? 38, params.iterations ?? 5);
  const biomes = assignBiomes(land, height, size, params);
  const stats = calcStats(biomes);

  onProgress('Rendering PNG...', 60);

  let pngBuffer: Buffer | null = null;
  try {
    pngBuffer = await renderPNG(biomes, size);
  } catch (e) {
    console.warn('PNG render failed (sharp not available):', e);
  }

  onProgress('Assigning coordinates...', 85);
  const coordinates = await assignCoordinates();

  onProgress('Territory claimed!', 100);
  return {
    biomes,
    stats,
    vmId: 'local',
    coordinates,
    dominantBiome: BIOME_NAMES[stats.dominant],
    pngBuffer,
    pngUrl: null,
    jsonUrl: null,
  };
}

async function assignCoordinates(): Promise<{ col: number; row: number }> {
  const occupied = await db.getOccupiedCoords();
  for (let row = 0; row < 16; row++)
    for (let col = 0; col < 16; col++)
      if (!occupied.has(`${col},${row}`)) return { col, row };
  return { col: 0, row: 0 };
}
