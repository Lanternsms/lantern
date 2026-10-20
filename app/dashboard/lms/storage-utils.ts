/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Recursively removes all files inside a folder path in Supabase Storage.
 * Subfolders in Supabase storage have `id === null` in `.list()`.
 */
export async function removeStorageDirectory(
  admin: any,
  bucket: string,
  dirPath: string
): Promise<{ error?: string }> {
  const { data: items, error: listErr } = await admin.storage
    .from(bucket)
    .list(dirPath, { limit: 1000 })

  if (listErr) {
    return { error: listErr.message }
  }

  if (!items || items.length === 0) return {}

  const filesToRemove: string[] = []
  for (const item of items) {
    const itemPath = `${dirPath}/${item.name}`
    if (item.id === null) {
      // Subfolder - recurse into it
      const res = await removeStorageDirectory(admin, bucket, itemPath)
      if (res.error) return res
    } else {
      filesToRemove.push(itemPath)
    }
  }

  if (filesToRemove.length > 0) {
    const { error: removeErr } = await admin.storage
      .from(bucket)
      .remove(filesToRemove)
    if (removeErr) {
      return { error: removeErr.message }
    }
  }

  return {}
}
