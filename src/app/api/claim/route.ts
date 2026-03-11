import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { claimTerritory } from '@/lib/agent';

const TIER_PRICES: Record<string, string> = {
  outpost: '0.06', settlement: '0.08', kingdom: '0.10',
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { seed, tier, params, agentAddress } = body;

  if (!seed || !tier || !params) {
    return NextResponse.json({ error: 'Missing fields: seed, tier, params' }, { status: 400 });
  }

  const price = TIER_PRICES[tier?.toLowerCase()];
  if (!price) return NextResponse.json({ error: `Unknown tier: ${tier}` }, { status: 400 });

  // ── x402 Payment Check ─────────────────────────────────────────
  const paymentHeader = req.headers.get('x-payment');

  if (!paymentHeader) {
    return NextResponse.json({
      error: 'Payment Required',
      x402: {
        version: 1,
        accepts: [{
          scheme: 'exact',
          network: process.env.PAYMENT_NETWORK || 'base',
          maxAmountRequired: String(Math.round(parseFloat(price) * 1_000_000)),
          resource: `${req.nextUrl.origin}/api/claim`,
          description: `TERRARIA — Claim ${tier} territory (${price} USDC)`,
          mimeType: 'application/json',
          payTo: process.env.PAYMENT_RECIPIENT,
          maxTimeoutSeconds: 300,
          asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
          extra: { tier, name: 'TERRARIA Territory Claim' }
        }]
      }
    }, { status: 402 });
  }

  // ── Verify Payment ─────────────────────────────────────────────
  let txHash: string | null = null;

  try {
    const payment = JSON.parse(Buffer.from(paymentHeader, 'base64').toString());
    const verifyRes = await fetch('https://facilitator.openx402.ai/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment,
        expectedAmount: String(Math.round(parseFloat(price) * 1_000_000)),
        recipient: process.env.PAYMENT_RECIPIENT,
        asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      }),
    });
    const verified = await verifyRes.json();
    if (!verified.isValid) {
      return NextResponse.json({ error: 'Payment invalid', reason: verified.invalidReason }, { status: 402 });
    }
    txHash = verified.txHash ?? null;
  } catch (e: any) {
    return NextResponse.json({ error: 'Payment verification failed', detail: e.message }, { status: 402 });
  }

  // ── Run Conway Agent ───────────────────────────────────────────
  const jobId = `job-${Date.now()}`;
  const progressLog: string[] = [];

  try {
    const result = await claimTerritory({
      jobId, seed, tier, params,
      agentAddress: agentAddress ?? 'anonymous',
      onProgress: (step, pct) => {
        progressLog.push(`[${pct}%] ${step}`);
        console.log(`${jobId}: ${pct}% — ${step}`);
      },
    });

    // ── Persist territory ──────────────────────────────────────
    const territory = await db.createTerritory({
      seed, tier, params,
      biomes:        result.biomes,
      pngUrl:        result.pngUrl,
      jsonUrl:       result.jsonUrl,
      agentAddress:  agentAddress ?? 'anonymous',
      coordinates:   result.coordinates,
      dominantBiome: result.dominantBiome,
      txHash,
      vmId:          result.vmId,
    });

    return NextResponse.json({ success: true, territory, progressLog });

  } catch (e: any) {
    console.error('Claim error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
