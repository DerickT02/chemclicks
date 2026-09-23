import type { SupabaseClient } from '@supabase/supabase-js'

// Logic and types regarding the ACTIVITIES table.

export type ActivityType =
  | 'bohr_model_intro'
  | 'bohr_model_stability'
  | 'lewis_diagram'
  | 'lewis_structures_covalent'
  | 'lewis_structures_ionic'
  | 'measurement_ruler_tenths'
  | 'measurement_ruler_hundredths'
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

const ACTIVITY_DESCRIPTIONS: Record<ActivityType, string> = {
  bohr_model_intro: 'Introduction to electron shells',
  bohr_model_stability: 'Determine atomic stability from electron shells',
  lewis_diagram: 'Explore valence electrons with Lewis dot diagrams',
  lewis_structures_covalent: 'Build covalent Lewis structures',
  lewis_structures_ionic: 'Build ionic Lewis structures',
  measurement_ruler_tenths: 'Practice ruler measurements to the nearest tenth',
  measurement_ruler_hundredths: 'Practice ruler measurements to the nearest hundredth',
  measurement_graduated_cylinder: 'Read liquid volume from a graduated cylinder',
}

const ACTIVITY_CATEGORIES: Record<ActivityType, string> = {
  bohr_model_intro: 'Bohr Models',
  bohr_model_stability: 'Bohr Models',
  lewis_diagram: 'Lewis Structures',
  lewis_structures_covalent: 'Lewis Structures',
  lewis_structures_ionic: 'Lewis Structures',
  measurement_ruler_tenths: 'Measurement',
  measurement_ruler_hundredths: 'Measurement',
  measurement_graduated_cylinder: 'Measurement',
}

/**
 * The current schema has no publication column, so every catalog row is
 * considered available. A secondary ID ordering keeps ties deterministic.
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
    data: ((data ?? []) as Activity[]).map((activity) => ({
      ...activity,
      description: ACTIVITY_DESCRIPTIONS[activity.type],
      category: ACTIVITY_CATEGORIES[activity.type],
    })),
    error: null,
  }
}
