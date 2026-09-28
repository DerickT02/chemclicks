import 'server-only'

// Keep existing attempt callers on the shared admin client used by dev.
export { createAdminClient as createServiceClient } from '@/lib/supabase/admin'
