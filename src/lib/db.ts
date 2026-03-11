// ─────────────────────────────────────────────────────────────────
// TERRARIA — Database (Supabase)
// ─────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';

function getServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export function getBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export interface Territory {
  id: string;
  seed: number;
  tier: string;
  col: number;
  row: number;
  params: any;
  biomes: number[];
  png_url: string | null;
  json_url: string | null;
  agent_address: string | null;
  dominant_biome: string | null;
  tx_hash: string | null;
  vm_id: string | null;
  claimed_at: string;
}

export const db = {

  async createTerritory(data: {
    seed: number; tier: string; params: any; biomes: Uint8Array;
    pngUrl?: string | null; jsonUrl?: string | null; agentAddress?: string;
    coordinates: { col: number; row: number };
    dominantBiome?: string; txHash?: string | null; vmId?: string | null;
  }): Promise<Territory> {
    const { data: row, error } = await getServerClient()
      .from('territories')
      .insert({
        seed: data.seed, tier: data.tier,
        col: data.coordinates.col, row: data.coordinates.row,
        params: data.params,
        biomes: Array.from(data.biomes),
        png_url: data.pngUrl ?? null,
        json_url: data.jsonUrl ?? null,
        agent_address: data.agentAddress ?? null,
        dominant_biome: data.dominantBiome ?? null,
        tx_hash: data.txHash ?? null,
        vm_id: data.vmId ?? null,
      })
      .select().single();
    if (error) throw new Error(error.message);
    return row;
  },

  async getTerritory(id: string): Promise<Territory | null> {
    const { data, error } = await getServerClient()
      .from('territories').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  },

  async getAllTerritories(): Promise<Territory[]> {
    const { data, error } = await getServerClient()
      .from('territories').select('*').order('claimed_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async getOccupiedCoords(): Promise<Set<string>> {
    const { data, error } = await getServerClient()
      .from('territories').select('col, row');
    if (error) throw new Error(error.message);
    return new Set((data ?? []).map((r: any) => `${r.col},${r.row}`));
  },

  async getStats() {
    const client = getServerClient();
    const { count: total } = await client
      .from('territories').select('*', { count: 'exact', head: true });
    const { data: agentRows } = await client
      .from('territories').select('agent_address');
    const agents = new Set((agentRows ?? []).map((r: any) => r.agent_address)).size;
    return { total: total ?? 0, agents, available: 256 - (total ?? 0) };
  },
};
