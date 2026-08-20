import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'

export default async function Home() {
  const { data, error } = await supabase.from('permissions').select('code')

  return (
    <div>
      <h1>Lantern connection test</h1>
      <p>{error ? `Error: ${error.message}` : `Found ${data?.length} permissions`}</p>
      <p><Link href="/login">Login</Link></p>
    </div>
  )
}