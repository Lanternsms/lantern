/* eslint-disable @typescript-eslint/no-explicit-any */
import 'server-only'
import type Anthropic from '@anthropic-ai/sdk'

export type ProviderMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type StreamUsage = {
  tokensIn: number
  tokensOut: number
  model: string
}

export interface StreamAnswerParams {
  system: string
  /** The notes user-side prompt block already formatted by tutor-prompt.ts */
  notesUserBlock: string
  /** Conversation history from DB (last 6 messages). NEVER from client. */
  history: ProviderMessage[]
  /** The current user question, already validated and trimmed */
  question: string
  maxOutputTokens?: number
  signal?: AbortSignal
}

export interface StreamAnswerResult {
  /** Async iterable of text chunks */
  chunks: AsyncIterable<string>
  /** Available after iteration completes */
  getUsage: () => StreamUsage
}

// ─── Provider: Gemini ────────────────────────────────────────────────────────

async function streamWithGemini(
  params: StreamAnswerParams
): Promise<StreamAnswerResult> {
  const { GoogleGenAI } = await import('@google/genai')
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const model = process.env.AI_MODEL || 'gemini-3.5-flash-lite'
  const ai = new GoogleGenAI({ apiKey })

  // Build conversation contents (history + new question)
  // Notes block goes at the start of the first user turn for implicit caching
  const contents: Array<{ role: 'user' | 'model'; parts: [{ text: string }] }> = []

  if (params.history.length > 0) {
    // First historical user message gets the notes prefix
    let firstUser = true
    for (const msg of params.history) {
      const role = msg.role === 'assistant' ? 'model' : 'user'
      if (firstUser && msg.role === 'user') {
        contents.push({
          role: 'user',
          parts: [{ text: `${params.notesUserBlock}\n\n${msg.content}` }],
        })
        firstUser = false
      } else {
        contents.push({ role, parts: [{ text: msg.content }] })
      }
    }
    // Current question (notes already included in first turn above)
    contents.push({ role: 'user', parts: [{ text: params.question }] })
  } else {
    // First question in session — notes go here
    contents.push({
      role: 'user',
      parts: [{ text: `${params.notesUserBlock}\n\n${params.question}` }],
    })
  }

  const response = await ai.models.generateContentStream({
    model,
    config: {
      temperature: 0.5,
      maxOutputTokens: params.maxOutputTokens ?? 450,
      systemInstruction: params.system,
    },
    contents,
  })

  let tokensIn = 0
  let tokensOut = 0

  const chunks: AsyncIterable<string> = {
    [Symbol.asyncIterator]: async function* () {
      for await (const chunk of response) {
        if (params.signal?.aborted) return
        const text = (chunk as any).text ?? ''
        if (text) yield text
        if (chunk.usageMetadata) {
          tokensIn = chunk.usageMetadata.promptTokenCount ?? tokensIn
          tokensOut = chunk.usageMetadata.candidatesTokenCount ?? tokensOut
        }
      }
    },
  }

  return {
    chunks,
    getUsage: () => ({ tokensIn, tokensOut, model }),
  }
}

// ─── Provider: Anthropic ─────────────────────────────────────────────────────

async function streamWithAnthropic(
  params: StreamAnswerParams
): Promise<StreamAnswerResult> {
  const { default: AnthropicClient } = await import('@anthropic-ai/sdk')
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const model = process.env.AI_MODEL || 'claude-haiku-4-5'
  const client = new AnthropicClient({ apiKey })

  // Build messages — notes block in first user turn with cache_control for prompt caching
  const messages: Anthropic.Messages.MessageParam[] = []

  if (params.history.length > 0) {
    let firstUser = true
    for (const msg of params.history) {
      if (firstUser && msg.role === 'user') {
        messages.push({
          role: 'user',
          content: [
            {
              type: 'text',
              text: `${params.notesUserBlock}\n\n${msg.content}`,
              cache_control: { type: 'ephemeral' } as any,
            },
          ],
        })
        firstUser = false
      } else {
        messages.push({ role: msg.role, content: msg.content })
      }
    }
    messages.push({ role: 'user', content: params.question })
  } else {
    messages.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: `${params.notesUserBlock}\n\n${params.question}`,
          cache_control: { type: 'ephemeral' } as any,
        },
      ],
    })
  }

  const stream = await client.messages.stream({
    model,
    max_tokens: params.maxOutputTokens ?? 450,
    temperature: 0.5,
    system: [
      {
        type: 'text',
        text: params.system,
        cache_control: { type: 'ephemeral' } as any,
      },
    ],
    messages,
  })

  let tokensIn = 0
  let tokensOut = 0

  const chunks: AsyncIterable<string> = {
    [Symbol.asyncIterator]: async function* () {
      for await (const event of stream) {
        if (params.signal?.aborted) {
          stream.abort()
          return
        }
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield event.delta.text
        }
        if (event.type === 'message_delta' && event.usage) {
          tokensOut = event.usage.output_tokens ?? tokensOut
        }
      }
      const finalMsg = await stream.finalMessage()
      tokensIn = finalMsg.usage.input_tokens
      tokensOut = finalMsg.usage.output_tokens
    },
  }

  return {
    chunks,
    getUsage: () => ({ tokensIn, tokensOut, model }),
  }
}

// ─── Public interface ─────────────────────────────────────────────────────────

export async function streamAnswer(params: StreamAnswerParams): Promise<StreamAnswerResult> {
  if (process.env.AI_DISABLED === 'true') {
    throw new Error('AI_DISABLED')
  }

  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase()

  if (provider === 'anthropic') {
    return streamWithAnthropic(params)
  }

  return streamWithGemini(params)
}

/**
 * Returns true if the AI feature is globally configured (key present + not disabled).
 * Used to hide the UI entirely when no key is configured.
 */
export function isAiConfigured(): boolean {
  if (process.env.AI_DISABLED === 'true') return false
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase()
  if (provider === 'anthropic') return !!process.env.ANTHROPIC_API_KEY
  return !!process.env.GEMINI_API_KEY
}
