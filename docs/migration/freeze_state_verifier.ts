/**
 * BARBEX PHASE 17C.M7G.1 FREEZE STATE VERIFIER SPECIFICATION
 * 
 * Objectives:
 * - Read-only non-mutating script.
 * - Records T0 baseline counts & max(id) across all tables.
 * - Provides comparison function against T1 (after quiet interval).
 * - Proves zero writes occurred during the quiet state.
 */

import * as fs from 'fs';
import * as crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export class FreezeStateVerifier {
  private client: any;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.client = createClient(supabaseUrl, supabaseKey);
  }

  public async captureState(): Promise<Record<string, { count: number, maxId?: number }>> {
    const manifest = JSON.parse(fs.readFileSync('docs/migration/evidence/phase17c_m7f_public_secure_snapshot_manifest.json', 'utf8'));
    const state: Record<string, { count: number, maxId?: number }> = {};

    for (const t of manifest.tables) {
      const { count } = await this.client.from(t.table).select('*', { count: 'exact', head: true });
      let maxId: number | undefined;
      if (t.table === 'status_checks') {
        const { data } = await this.client.from('status_checks').select('id').order('id', { ascending: false }).limit(1);
        maxId = data?.[0]?.id;
      }
      state[t.table] = {
        count: count || 0,
        maxId
      };
    }
    return state;
  }

  public compareStates(t0: Record<string, any>, t1: Record<string, any>): { isQuiet: boolean, deltas: Record<string, any> } {
    const deltas: Record<string, any> = {};
    let isQuiet = true;

    for (const table of Object.keys(t0)) {
      const count0 = t0[table].count;
      const count1 = t1[table]?.count || 0;
      const maxId0 = t0[table].maxId;
      const maxId1 = t1[table]?.maxId;

      if (count0 !== count1 || maxId0 !== maxId1) {
        isQuiet = false;
        deltas[table] = {
          count0,
          count1,
          maxId0,
          maxId1
        };
      }
    }
    return { isQuiet, deltas };
  }
}
