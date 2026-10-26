/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { AI_NAME, AI_DISCLOSURE } from '@/lib/ai/brand'
import { escalateAiQuestionToTeacher } from './ai/actions'

export interface MessageItem {
  id: string
  role: 'user' | 'assistant'
  content: string
  intent?: string
  timestamp: string
}

interface LessonAiPanelProps {
  lessonId: string
  lessonTitle: string
  mode?: 'class' | 'student'
  studentId?: string
  aiTutorEnabled?: boolean
  notesReady?: boolean
  className?: string
  initialOpen?: boolean
}

// ── Lumi "L" avatar (Lantern brand mark, no sparkles/robots) ──────────────────
function LumiAvatar({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const dim = size === 'lg' ? 'w-9 h-9 text-base' : 'w-7 h-7 text-xs'
  return (
    <div
      className={`shrink-0 ${dim} rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white font-bold shadow-sm`}
      aria-hidden="true"
    >
      L
    </div>
  )
}

// ── CSS-only typing dots ───────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1" aria-label={`${AI_NAME} is typing`}>
      <span
        className="w-2 h-2 rounded-full bg-primary/60"
        style={{ animation: 'lumi-dot 1.2s ease-in-out infinite', animationDelay: '0ms' }}
      />
      <span
        className="w-2 h-2 rounded-full bg-primary/60"
        style={{ animation: 'lumi-dot 1.2s ease-in-out infinite', animationDelay: '200ms' }}
      />
      <span
        className="w-2 h-2 rounded-full bg-primary/60"
        style={{ animation: 'lumi-dot 1.2s ease-in-out infinite', animationDelay: '400ms' }}
      />
      <style>{`
        @keyframes lumi-dot {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ── Strip LaTeX and markdown for TTS ─────────────────────────────────────────
function stripForSpeech(text: string): string {
  return text
    .replace(/\[\[.*?\]\]/g, '')   // grounded markers
    .replace(/\$[^$]+\$/g, '')     // inline LaTeX
    .replace(/\*\*(.*?)\*\*/g, '$1') // bold
    .replace(/`[^`]+`/g, '')       // inline code
    .replace(/[#_>]/g, '')         // headings/italics/blockquotes
    .trim()
}

// ── Render Lumi message content (bold + LaTeX + paragraph breaks) ─────────────
function MessageContent({ text }: { text: string }) {
  // Split by paragraph breaks, bold, LaTeX, inline code
  const parts = text.split(/(\*\*[^*]+\*\*|\$[^$]+\$|`[^`]+`|\n\n)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return <strong key={i}>{part.slice(2, -2)}</strong>
        }
        if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
          return (
            <code
              key={i}
              className="inline-block bg-primary/10 text-primary font-mono px-1.5 py-0.5 rounded border border-primary/20 font-semibold text-[0.85em]"
            >
              {part.slice(1, -1)}
            </code>
          )
        }
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
          return (
            <code key={i} className="bg-surface-muted text-text-primary px-1 py-0.5 rounded font-mono text-[0.85em]">
              {part.slice(1, -1)}
            </code>
          )
        }
        if (part === '\n\n') {
          return <span key={i} className="block my-2" />
        }
        return (
          <span key={i} className="whitespace-pre-wrap">
            {part}
          </span>
        )
      })}
    </>
  )
}

export function LessonAiPanel({
  lessonId,
  lessonTitle,
  mode = 'student',
  studentId,
  aiTutorEnabled = true,
  notesReady = true,
  className = '',
  initialOpen = false,
}: LessonAiPanelProps) {
  const [isOpen, setIsOpen] = useState(initialOpen)
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  // Separate "typing" state (before first token) from "has content" state
  const [isTyping, setIsTyping] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [errorMsg, setErrorMsg] = useState<{ message: string; reason?: string; why?: string } | null>(null)
  const [escalatedNotice, setEscalatedNotice] = useState<string | null>(null)
  const [isEscalating, setIsEscalating] = useState(false)
  const [isClassProjectorMode, setIsClassProjectorMode] = useState(false)
  // Track whether a quiz is in progress (suppress "Test me" button)
  const [quizInProgress, setQuizInProgress] = useState(false)

  // Voice speech-to-text
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const recognitionRef = useRef<any>(null)

  // Text-to-speech read-aloud
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null)

  // Session ID persistent for this component mount
  const [sessionId] = useState(() =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : '00000000-0000-0000-0000-000000000000'
  )

  const abortControllerRef = useRef<AbortController | null>(null)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  // Track whether user has scrolled up manually
  const userScrolledUpRef = useRef(false)

  // ── Speech recognition setup ─────────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        queueMicrotask(() => setSpeechSupported(true))
        const rec = new SpeechRecognition()
        rec.continuous = false
        rec.interimResults = true
        rec.lang = 'en-NG'

        rec.onresult = (event: any) => {
          let transcript = ''
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript
          }
          if (transcript) setInputValue(transcript)
        }
        rec.onerror = () => setIsListening(false)
        rec.onend = () => setIsListening(false)
        recognitionRef.current = rec
      }
    }
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  // ── Auto-scroll: only when user hasn't manually scrolled up ──────────────
  useEffect(() => {
    const el = chatScrollRef.current
    if (!el || userScrolledUpRef.current) return
    el.scrollTop = el.scrollHeight
  }, [messages, streamingContent, isTyping])

  const handleChatScroll = useCallback(() => {
    const el = chatScrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    userScrolledUpRef.current = !atBottom
  }, [])

  // ── Voice listening toggle ────────────────────────────────────────────────
  function toggleSpeechListening() {
    if (!recognitionRef.current) return
    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      try {
        setErrorMsg(null)
        recognitionRef.current.start()
        setIsListening(true)
      } catch {
        setIsListening(false)
      }
    }
  }

  // ── Read aloud: strip markup, sentence-by-sentence, en-NG preferred ───────
  function handleReadAloud(msgId: string, text: string) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return

    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel()
      setSpeakingMsgId(null)
      return
    }

    window.speechSynthesis.cancel()
    const cleanText = stripForSpeech(text)
    if (!cleanText) return

    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.rate = 0.95

    // Pick best available voice: en-NG > en-GB > any en
    const voices = window.speechSynthesis.getVoices()
    const preferred =
      voices.find(v => v.lang === 'en-NG') ||
      voices.find(v => v.lang === 'en-GB') ||
      voices.find(v => v.lang.startsWith('en'))
    if (preferred) utterance.voice = preferred

    utterance.onend = () => setSpeakingMsgId(null)
    utterance.onerror = () => setSpeakingMsgId(null)

    setSpeakingMsgId(msgId)
    window.speechSynthesis.speak(utterance)
  }

  // ── Error reason → friendly message ──────────────────────────────────────
  function friendlyReasonMessage(reason?: string, serverMsg?: string): string {
    switch (reason) {
      case 'not_authorized':         return 'Not found.'
      case 'ai_disabled':            return `${AI_NAME} is not currently available for this lesson.`
      case 'no_notes':               return 'This lesson has no notes yet. Please check back after your teacher adds notes.'
      case 'notes_unreadable':       return serverMsg || 'The lesson notes could not be read by the AI. Please contact your teacher.'
      case 'limit_reached':          return serverMsg || 'Question limit reached. Try again later.'
      case 'provider_unavailable':   return `${AI_NAME} is temporarily unavailable. Try again in a moment.`
      case 'provider_misconfigured': return `${AI_NAME} is not properly configured. Contact your administrator.`
      case 'bad_request':            return 'Your question could not be sent. Please try again.'
      default:                       return serverMsg || 'Something went wrong. Please try again.'
    }
  }

  // ── Send a question / intent ──────────────────────────────────────────────
  async function handleSendQuestion(
    questionText: string,
    intent: 'ask' | 'simpler' | 'example' | 'quiz_me' = 'ask'
  ) {
    const q = questionText.trim()
    if (!q || isStreaming) return

    setErrorMsg(null)
    setEscalatedNotice(null)
    setInputValue('')
    userScrolledUpRef.current = false // snap back to bottom on new message

    if (intent === 'quiz_me') setQuizInProgress(true)

    const userMsg: MessageItem = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `usr-${Date.now()}`,
      role: 'user',
      content: q,
      intent,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages(prev => [...prev, userMsg])
    setIsStreaming(true)
    setIsTyping(true)
    setStreamingContent('')

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const res = await fetch('/api/lms/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, sessionId, question: q, mode, studentId, intent }),
        signal: controller.signal,
      })

      if (!res.ok) {
        let reason: string | undefined
        let serverMsg: string | undefined
        let why: string | undefined
        try {
          const errJson = await res.json()
          reason = errJson.reason
          serverMsg = errJson.error
          why = errJson.why
        } catch {
          serverMsg = 'Unable to get answer'
        }
        setErrorMsg({ message: friendlyReasonMessage(reason, serverMsg), reason, why })
        return
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream available')

      const decoder = new TextDecoder()
      let fullText = ''
      let firstChunk = true

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        if (firstChunk && chunk) {
          setIsTyping(false)
          firstChunk = false
        }
        fullText += chunk
        setStreamingContent(fullText)
      }

      const assistantMsg: MessageItem = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `asst-${Date.now()}`,
        role: 'assistant',
        content: fullText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }

      setMessages(prev => [...prev, assistantMsg])
      setStreamingContent('')
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setErrorMsg({ message: err.message || 'Something went wrong. Please try again.' })
      }
    } finally {
      setIsStreaming(false)
      setIsTyping(false)
      abortControllerRef.current = null
    }
  }

  function handleCancelStream() {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setIsStreaming(false)
    setIsTyping(false)
  }

  async function handleEscalateToTeacher(question: string) {
    if (!studentId) {
      setErrorMsg({ message: 'Cannot send to teacher without an active student enrollment.' })
      return
    }
    setIsEscalating(true)
    setErrorMsg(null)
    try {
      const res = await escalateAiQuestionToTeacher({ lessonId, studentId, question })
      if (res?.error) {
        setErrorMsg({ message: res.error })
      } else {
        setEscalatedNotice('Question sent to your teacher in Lesson Q&A! They will review it soon.')
      }
    } catch {
      setErrorMsg({ message: 'Failed to send question to teacher.' })
    } finally {
      setIsEscalating(false)
    }
  }

  // ── Closed state — trigger button ─────────────────────────────────────────
  if (!isOpen) {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-indigo-600 text-white font-medium text-xs shadow-md hover:shadow-lg hover:opacity-95 transition-all transform active:scale-95"
          title={`Ask ${AI_NAME} about this lesson`}
        >
          <LumiAvatar />
          <span>Ask {AI_NAME}</span>
          <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-semibold">
            Tutor
          </span>
        </button>
      </div>
    )
  }

  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant')
  // Show quick buttons only after last answer and not while streaming
  const showQuickButtons = !!lastAssistantMsg && !isStreaming

  return (
    <div
      className={`rounded-2xl border border-primary/20 bg-surface shadow-xl flex flex-col overflow-hidden transition-all ${
        isClassProjectorMode ? 'fixed inset-4 z-50 bg-background text-lg shadow-2xl' : 'w-full'
      } ${className}`}
      style={{ maxHeight: isClassProjectorMode ? 'calc(100vh - 2rem)' : '650px' }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-primary/10 via-surface to-surface border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <LumiAvatar size="lg" />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-text-primary tracking-tight">{AI_NAME}</h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-2 py-0.5 text-[10px] font-semibold text-success-text">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                Notes loaded
              </span>
            </div>
            <p className="text-[11px] text-text-secondary truncate max-w-xs sm:max-w-md">
              {lessonTitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {mode === 'class' && (
            <button
              type="button"
              onClick={() => setIsClassProjectorMode(!isClassProjectorMode)}
              className="text-xs px-2.5 py-1 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:bg-surface-muted transition-colors"
              title="Toggle Projector Class Mode"
            >
              {isClassProjectorMode ? 'Exit Projector' : 'Projector Mode'}
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-muted transition-colors text-sm"
            aria-label="Close tutor panel"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Disclosure bar ── */}
      <div className="px-5 py-1.5 bg-primary/5 border-b border-border/50 text-[11px] text-text-secondary flex items-center justify-between shrink-0">
        <span>{AI_DISCLOSURE}</span>
        {!notesReady && (
          <span className="text-[10px] text-amber-600 font-medium">Notes not ready</span>
        )}
      </div>

      {/* ── Chat scroll area ── */}
      <div
        ref={chatScrollRef}
        onScroll={handleChatScroll}
        className="flex-1 p-5 overflow-y-auto space-y-5 bg-background/50"
      >
        {/* Empty state */}
        {messages.length === 0 && !isTyping && !streamingContent && (
          <div className="py-8 text-center space-y-3 max-w-md mx-auto">
            <LumiAvatar size="lg" />
            <h4 className="font-semibold text-text-primary text-sm mt-2">
              Hi, I'm {AI_NAME}. Ask me anything from this lesson.
            </h4>
            <p className="text-xs text-text-secondary leading-relaxed">
              I can explain topics, give examples, or quiz you — all based on today's notes.
            </p>
            <div className="pt-3 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => handleSendQuestion('What are the main points of this lesson?')}
                className="text-xs border border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary px-3 py-1.5 rounded-xl transition-colors"
              >
                What are the main points?
              </button>
              <button
                type="button"
                onClick={() => handleSendQuestion('Give me an everyday example from this lesson.')}
                className="text-xs border border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary px-3 py-1.5 rounded-xl transition-colors"
              >
                Give me an example
              </button>
              <button
                type="button"
                onClick={() => handleSendQuestion('Quiz me on this lesson.', 'quiz_me')}
                className="text-xs border border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary px-3 py-1.5 rounded-xl transition-colors"
              >
                Test me
              </button>
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map(m => (
          <div
            key={m.id}
            className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {/* Lumi avatar on the left */}
            {m.role === 'assistant' && <LumiAvatar />}

            <div className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} max-w-[85%] ${isClassProjectorMode ? 'max-w-[95%]' : ''}`}>
              {/* Timestamp row */}
              <div className="flex items-center gap-1.5 text-[10px] text-text-secondary mb-1 px-1">
                <span>{m.role === 'user' ? 'You' : AI_NAME}</span>
                <span>&bull;</span>
                <span>{m.timestamp}</span>
                {m.intent && m.intent !== 'ask' && (
                  <span className="bg-primary/10 text-primary uppercase text-[9px] px-1 rounded font-semibold">
                    {m.intent.replace('_', ' ')}
                  </span>
                )}
              </div>

              {/* Bubble */}
              <div
                className={`rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed shadow-sm ${
                  m.role === 'user'
                    ? 'bg-primary text-white rounded-tr-none'
                    : 'bg-surface border border-border text-text-primary rounded-tl-none'
                } ${isClassProjectorMode ? '!text-base p-5' : ''}`}
              >
                <MessageContent text={m.content} />
              </div>

              {/* Actions below Lumi bubble */}
              {m.role === 'assistant' && (
                <div className="flex items-center gap-2 mt-1.5 px-1">
                  <button
                    type="button"
                    onClick={() => handleReadAloud(m.id, m.content)}
                    className="inline-flex items-center gap-1 text-[11px] text-text-secondary hover:text-primary transition-colors py-1 px-2 rounded-lg hover:bg-surface-muted"
                    title={speakingMsgId === m.id ? 'Stop reading' : 'Read aloud'}
                  >
                    {speakingMsgId === m.id ? 'Stop' : 'Read aloud'}
                  </button>

                  {studentId && (
                    <button
                      type="button"
                      onClick={() => handleEscalateToTeacher(m.content)}
                      disabled={isEscalating}
                      className="inline-flex items-center gap-1 text-[11px] text-text-secondary hover:text-primary transition-colors py-1 px-2 rounded-lg hover:bg-surface-muted disabled:opacity-50"
                      title="Send this to teacher Q&A"
                    >
                      Ask teacher
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing / streaming indicator */}
        {isStreaming && (
          <div className="flex gap-2.5 flex-row">
            <LumiAvatar />
            <div className="flex flex-col items-start max-w-[85%]">
              <div className="flex items-center gap-1.5 text-[10px] text-text-secondary mb-1 px-1">
                <span>{AI_NAME}</span>
                <span>&bull;</span>
                <span className="text-primary">typing</span>
              </div>
              <div
                className={`rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed bg-surface border border-border text-text-primary rounded-tl-none shadow-sm ${
                  isClassProjectorMode ? '!text-base p-5' : ''
                }`}
              >
                {streamingContent ? (
                  <MessageContent text={streamingContent} />
                ) : (
                  <TypingDots />
                )}
              </div>
              <button
                type="button"
                onClick={handleCancelStream}
                className="text-[11px] text-text-secondary hover:text-danger-text transition-colors mt-1.5 px-1"
              >
                Stop
              </button>
            </div>
          </div>
        )}

        {/* Escalation notice */}
        {escalatedNotice && (
          <div className="rounded-xl border border-success/30 bg-success-bg p-3 text-xs text-success-text flex items-center justify-between">
            <span>{escalatedNotice}</span>
            <button type="button" onClick={() => setEscalatedNotice(null)} className="font-bold ml-2 text-sm">✕</button>
          </div>
        )}

        {/* Error notice */}
        {errorMsg && (
          <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-700 dark:text-red-300">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <span className="shrink-0 mt-0.5">
                  {errorMsg.reason === 'limit_reached' ? '⏱' :
                   errorMsg.reason === 'no_notes' || errorMsg.reason === 'notes_unreadable' ? '📄' :
                   errorMsg.reason === 'ai_disabled' ? '🔒' :
                   errorMsg.reason === 'provider_unavailable' || errorMsg.reason === 'provider_misconfigured' ? '⚠️' :
                   '❌'}
                </span>
                <div>
                  <span className="font-medium">{errorMsg.message}</span>
                  {errorMsg.why && (
                    <span className="block mt-1 text-[10px] text-red-500 dark:text-red-400 opacity-80">
                      {errorMsg.why}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="font-bold text-sm shrink-0"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Quick reply buttons (student-phrased, after last answer) ── */}
      {showQuickButtons && (
        <div className="px-5 py-2 bg-surface-muted/60 border-t border-border flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => handleSendQuestion("I still don't get it", 'simpler')}
            disabled={isStreaming}
            className="text-xs bg-surface border border-border hover:border-primary/40 px-2.5 py-1 rounded-lg text-text-primary transition-colors disabled:opacity-50"
          >
            I still don't get it
          </button>
          <button
            type="button"
            onClick={() => handleSendQuestion('Show me an example', 'example')}
            disabled={isStreaming}
            className="text-xs bg-surface border border-border hover:border-primary/40 px-2.5 py-1 rounded-lg text-text-primary transition-colors disabled:opacity-50"
          >
            Show me an example
          </button>
          {/* Hide "Test me" while a quiz is in progress */}
          {!quizInProgress && (
            <button
              type="button"
              onClick={() => handleSendQuestion('Test me', 'quiz_me')}
              disabled={isStreaming}
              className="text-xs bg-surface border border-border hover:border-primary/40 px-2.5 py-1 rounded-lg text-text-primary transition-colors disabled:opacity-50"
            >
              Test me
            </button>
          )}
        </div>
      )}

      {/* ── Input bar ── */}
      <div className="p-4 bg-surface border-t border-border space-y-2 shrink-0">
        <form
          onSubmit={e => {
            e.preventDefault()
            handleSendQuestion(inputValue)
          }}
          className="flex items-center gap-2"
        >
          {speechSupported && (
            <button
              type="button"
              onClick={toggleSpeechListening}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                isListening
                  ? 'bg-red-600 text-white animate-pulse shadow-lg ring-2 ring-red-400'
                  : 'bg-surface-muted border border-border text-text-secondary hover:text-text-primary hover:border-primary/40'
              }`}
              title={isListening ? 'Stop listening' : 'Speak your question'}
              aria-label={isListening ? 'Stop voice recognition' : 'Start voice recognition'}
            >
              🎤
            </button>
          )}

          <div className="relative flex-1">
            <input
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder={isListening ? 'Listening… speak clearly' : `Ask ${AI_NAME} about this lesson…`}
              disabled={isStreaming || !aiTutorEnabled || !notesReady}
              maxLength={500}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-xs sm:text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
            {inputValue && (
              <span className="absolute right-3 top-2.5 text-[10px] text-text-secondary">
                {inputValue.length}/500
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={!inputValue.trim() || isStreaming || !aiTutorEnabled || !notesReady}
            className="h-10 px-4 rounded-xl bg-primary text-white font-medium text-xs sm:text-sm hover:bg-primary-hover disabled:opacity-40 transition-colors shrink-0 flex items-center gap-1.5"
          >
            <span>Ask</span>
            <span>&rarr;</span>
          </button>
        </form>

        {!notesReady && (
          <p className="text-[11px] text-amber-600 text-center">
            Lesson notes are being processed. Please check back shortly.
          </p>
        )}
      </div>
    </div>
  )
}
