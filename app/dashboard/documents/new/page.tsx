import { createClient } from '@/lib/supabase/server'
import UploadForm from './upload-form'

export const dynamic = 'force-dynamic'

export default async function NewDocumentPage() {
  const supabase = await createClient()
  const { data: classes } = await supabase
    .from('classes')
    .select('id, name, level, arms(id, name)')
    .order('level')

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold text-text-primary">Upload Document</h1>
      <UploadForm classes={classes ?? []} />
    </div>
  )
}