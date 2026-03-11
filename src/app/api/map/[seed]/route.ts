import { NextRequest, NextResponse } from 'next/server';
import { mulberry32, diamondSquare, caSmooth, assignBiomes, PAL } from '@/lib/terrain';

// GET /api/map/[seed]?tier=settlement&water=38&roughness=4&iterations=5&mountain=70&forest=40
// Returns a PNG of the territory for a given seed + params
export async function GET(
  req: NextRequest,
  { params }: { params: { seed: string } }
) {
  const seed = parseInt(params.seed);
  const q = req.nextUrl.searchParams;
  const tier = q.get('tier') ?? 'settlement';
  const SIZES: Record<string, number> = { outpost: 64, settlement: 128, kingdom: 256 };
  const size = SIZES[tier] || 128;

  const p = {
    water:      parseInt(q.get('water')      ?? '38'),
    roughness:  parseInt(q.get('roughness')  ?? '4'),
    iterations: parseInt(q.get('iterations') ?? '5'),
    mountain:   parseInt(q.get('mountain')   ?? '70'),
    forest:     parseInt(q.get('forest')     ?? '40'),
  };

  const rng    = mulberry32(seed * 1234567 + 13);
  const height = diamondSquare(size, p.roughness, rng);
  const land   = caSmooth(height, size, p.water, p.iterations);
  const biomes = assignBiomes(land, height, size, p);

  try {
    const sharp = (await import('sharp')).default;
    const pixels = new Uint8Array(size * size * 3);
    for (let i = 0; i < biomes.length; i++) {
      const [r, g, b] = PAL[biomes[i]];
      pixels[i * 3] = r; pixels[i * 3 + 1] = g; pixels[i * 3 + 2] = b;
    }
    const png = await sharp(Buffer.from(pixels), {
      raw: { width: size, height: size, channels: 3 }
    }).resize(512, 512, { kernel: 'nearest' }).png().toBuffer();

    return new NextResponse(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Disposition': `inline; filename="terraria-${seed}.png"`,
      }
    });
  } catch {
    return NextResponse.json({ error: 'PNG generation failed' }, { status: 500 });
  }
}
