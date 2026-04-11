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
