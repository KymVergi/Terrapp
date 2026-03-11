import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [territories, stats] = await Promise.all([
      db.getAllTerritories(),
      db.getStats(),
    ]);
    return NextResponse.json({ territories, stats });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
