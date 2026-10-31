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
      <h1 className="font-display text-[28px] font-semibold leading-tight text-text-primary sm:text-[32px]">Upload Document</h1>
      <UploadForm classes={classes ?? []} />
    </div>
  )
}