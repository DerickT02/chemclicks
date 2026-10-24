import type { SupabaseClient } from '@supabase/supabase-js'
import { getActivityDefinition } from '@/lib/activities/registry'

// Logic and types regarding the ACTIVITIES table.

export type ActivityType =
  | 'bohr_model_intro'
  | 'bohr_model_stability'
  | 'lewis_diagram'
  | 'lewis_structures_covalent'
  | 'lewis_structures_ionic'
  | 'measurement_ruler_tenths'
  | 'measurement_ruler_hundredths'
  | 'measurement_graduated_cylinder_whole'
  | 'measurement_graduated_cylinder'

export type Activity = {
  id: string
  title: string
  type: ActivityType
  order_index: number
}

export type InsertActivity = Pick<Activity, 'title' | 'type' | 'order_index'>

export type ActivityCatalogEntry = Activity & {
  description: string
  category: string
}

type CatalogError = {
  code: string
  message: string
}

export type ActivityCatalogResult = {
  data: ActivityCatalogEntry[] | null
  error: CatalogError | null
}

/**
 * Retain all rows for existing-assignment labels; the shared application
 * registry determines new-assignment support and selector visibility.
 * A secondary ID ordering keeps ties deterministic.
 */
export async function listActivityCatalog(
  supabase: SupabaseClient,
): Promise<ActivityCatalogResult> {
  const { data, error } = await supabase
    .from('activities')
    .select('id, title, type, order_index')
    .order('order_index', { ascending: true })
    .order('id', { ascending: true })

  if (error) return { data: null, error }

  return {
    data: ((data ?? []) as Activity[]).map((activity) => {
      const definition = getActivityDefinition(activity.type)
      return {
        ...activity,
        description: definition?.description ?? 'This activity is not supported yet.',
        category: definition?.category ?? 'Unavailable',
      }
    }),
    error: null,
  }
}
