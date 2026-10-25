import { NextRequest, NextResponse } from 'next/server'
import { processBatch } from '@/lib/messaging/worker'
import { timingSafeEqualStr } from '@/lib/messaging/utils'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

async function handleCron(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
  }

  const expectedHeader = `Bearer ${cronSecret}`
  if (!authHeader || !timingSafeEqualStr(authHeader, expectedHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  let totalClaimed = 0
  let totalSent = 0
  let totalFailed = 0
  let totalSkipped = 0

  // Run batches until empty or approaching timeout (~48s)
  while (Date.now() - startTime < 48000) {
    const result = await processBatch(50)
    totalClaimed += result.claimed
    totalSent += result.sent
    totalFailed += result.failed
    totalSkipped += result.skipped

    if (!result.remaining || result.claimed === 0) {
      break
    }
  }

  return NextResponse.json({
    claimed: totalClaimed,
    sent: totalSent,
    failed: totalFailed,
    skipped: totalSkipped,
  })
}

export async function GET(request: NextRequest) {
  return handleCron(request)
}

export async function POST(request: NextRequest) {
  return handleCron(request)
}
