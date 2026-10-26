import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractText } from 'unpdf'

export type NotesExtractionStatus = 'pending' | 'ready' | 'scanned' | 'too_long' | 'failed'

export interface NotesExtractionResult {
  status: NotesExtractionStatus
  pageCount: number
  charCount: number
  content: string | null
  error?: string | null
}

/**
 * Extracts and normalises text from a PDF buffer.
 * Retains page markers like "[Page 1]" and calculates character/page counts.
 */
export async function parsePdfBuffer(buffer: ArrayBuffer | Uint8Array): Promise<NotesExtractionResult> {
  try {
    const { totalPages, text: pageTexts } = await extractText(buffer, { mergePages: false })

    const pages = Array.isArray(pageTexts) ? pageTexts : [pageTexts]
    const formattedPages: string[] = []
    let totalChars = 0

    pages.forEach((pageText, idx) => {
      // Normalise whitespace while keeping structural line breaks
      const normalised = (pageText || '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim()

      totalChars += normalised.length
      formattedPages.push(`[Page ${idx + 1}]\n${normalised}`)
    })

    const combinedContent = formattedPages.join('\n\n')
    const pageCount = totalPages || pages.length

    // Status evaluation rules
    if (totalChars > 120_000) {
      return {
        status: 'too_long',
        pageCount,
        charCount: totalChars,
        content: null,
      }
    }

    if (pageCount > 0 && totalChars / pageCount < 200) {
      return {
        status: 'scanned',
        pageCount,
        charCount: totalChars,
        content: null,
      }
    }

    return {
      status: 'ready',
      pageCount,
      charCount: totalChars,
      content: combinedContent,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      status: 'failed',
      pageCount: 0,
      charCount: 0,
      content: null,
      error: message.slice(0, 500),
    }
  }
}

/**
 * Downloads notes PDF from bucket `lms-notes`, extracts text, and upserts to `lms_lesson_notes_text`.
 * Uses admin client since lms_lesson_notes_text has RLS enabled with NO policies.
 */
export async function extractNotesText(
  lessonId: string,
  schoolId: string,
  notesPath: string
): Promise<NotesExtractionResult> {
  const admin = createAdminClient()

  // Download object
  const { data: blob, error: dlErr } = await admin.storage
    .from('lms-notes')
    .download(notesPath)

  if (dlErr || !blob) {
    const result: NotesExtractionResult = {
      status: 'failed',
      pageCount: 0,
      charCount: 0,
      content: null,
      error: (dlErr?.message || 'Failed to download notes PDF').slice(0, 500),
    }

    await (admin as any)
      .from('lms_lesson_notes_text')
      .upsert({
        lesson_id: lessonId,
        school_id: schoolId,
        status: result.status,
        content: null,
        page_count: 0,
        char_count: 0,
        error: result.error,
        extracted_at: new Date().toISOString(),
      })

    return result
  }

  const arrayBuffer = await blob.arrayBuffer()
  const result = await parsePdfBuffer(arrayBuffer)

  // Save extracted result
  await (admin as any)
    .from('lms_lesson_notes_text')
    .upsert({
      lesson_id: lessonId,
      school_id: schoolId,
      status: result.status,
      content: result.content,
      page_count: result.pageCount,
      char_count: result.charCount,
      error: result.error || null,
      extracted_at: new Date().toISOString(),
    })

  return result
}
