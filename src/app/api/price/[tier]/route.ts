import { NextResponse } from 'next/server';

const PRICES: Record<string, { usdc: string; label: string; size: number }> = {
  outpost:    { usdc: '0.06', label: 'Outpost',    size: 64  },
  settlement: { usdc: '0.08', label: 'Settlement', size: 128 },
  kingdom:    { usdc: '0.10', label: 'Kingdom',    size: 256 },
};

export async function GET(_: Request, { params }: { params: { tier: string } }) {
  const price = PRICES[params.tier.toLowerCase()];
  if (!price) return NextResponse.json({ error: 'Unknown tier' }, { status: 404 });
  return NextResponse.json(price);
}
