'use client'

import { useState, useTransition } from 'react'
import { testAiConnection, type AiConnectionTestResult } from './actions'

export function AiConnectionTester() {
  const [result, setResult] = useState<AiConnectionTestResult | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleTest() {
    setResult(null)
    startTransition(async () => {
      const r = await testAiConnection()
      setResult(r)
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          id="test-ai-connection-btn"
          onClick={handleTest}
          disabled={isPending}
          className="px-4 py-2 rounded-xl bg-primary text-white font-medium text-xs hover:bg-primary-hover disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
        >
          {isPending ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Testing…
            </>
          ) : (
            <>
              <span>⚡</span>
              Test AI Connection
            </>
          )}
        </button>

        {result && !isPending && (
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
              result.success
                ? 'bg-success-bg text-success-text'
                : 'bg-red-500/10 text-red-700 dark:text-red-300'
            }`}
          >
            {result.success ? '✓ Connected' : '✕ Failed'}
            {result.latencyMs !== undefined && (
              <span className="opacity-70 font-normal">{result.latencyMs} ms</span>
            )}
          </span>
        )}
      </div>

      {result && !isPending && (
        <div
          className={`rounded-xl border p-4 text-xs space-y-2 ${
            result.success
              ? 'border-success/30 bg-success-bg/30'
              : 'border-red-300 bg-red-50 dark:bg-red-950/30'
          }`}
        >
          {/* Provider + Model */}
          <div className="flex flex-wrap gap-4 text-[11px]">
            <div>
              <span className="text-text-secondary block">Provider</span>
              <span className="font-semibold text-text-primary uppercase">{result.provider}</span>
            </div>
            <div>
              <span className="text-text-secondary block">Model ID</span>
              <span className="font-mono font-semibold text-text-primary">{result.model}</span>
            </div>
            {result.latencyMs !== undefined && (
              <div>
                <span className="text-text-secondary block">Latency</span>
                <span className="font-semibold text-text-primary">{result.latencyMs} ms</span>
              </div>
            )}
          </div>

          {/* Success: sample reply */}
          {result.success && result.reply && (
            <div>
              <span className="text-text-secondary text-[11px] block mb-0.5">Sample reply</span>
              <span className="italic text-text-primary">"{result.reply}"</span>
            </div>
          )}

          {/* Failure: exact error from provider (status + message, never key) */}
          {!result.success && (
            <div className="space-y-1">
              {result.errorStatus !== undefined && (
                <div className="text-[11px]">
                  <span className="text-text-secondary">Status: </span>
                  <span className="font-mono font-semibold text-red-700 dark:text-red-300">
                    {String(result.errorStatus)}
                  </span>
                </div>
              )}
              {result.errorMessage && (
                <div>
                  <span className="text-text-secondary text-[11px] block mb-0.5">Error message</span>
                  <span className="font-mono text-[11px] text-red-700 dark:text-red-300 break-words whitespace-pre-wrap">
                    {result.errorMessage}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
