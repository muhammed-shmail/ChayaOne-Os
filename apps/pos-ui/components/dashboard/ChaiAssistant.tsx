'use client';

import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { ChaiIcon, type ChaiState } from './ChaiIcon';
import { ASSISTANT, ASSISTANT_PROMPTS, LANGUAGES, type AssistantModule } from '@/lib/assistant-config';

type Msg = { who: 'ai' | 'me'; html: string };

/**
 * Chai — the ChayaOne AI assistant. A single floating launcher button, mounted
 * once at the dashboard root, that opens a chat widget panel. The `module`
 * prop (home / finance / inventory) tracks whichever tab is currently active,
 * driving contextual suggestions and server-side grounding. The Google/Gemini
 * provider lives entirely behind /api/dashboard/assistant — this component
 * never references it.
 */
export function ChaiAssistant({ module }: { module: AssistantModule }) {
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [langIdx, setLangIdx] = useState(0);
  const [speakOn, setSpeakOn] = useState(true);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [errored, setErrored] = useState(false);
  const [voiceOk, setVoiceOk] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<any>(null);

  const lang = (LANGUAGES[langIdx] ?? LANGUAGES[0]!).code;
  const isLanding = msgs.length === 0;
  const aiState: ChaiState = errored ? 'error' : listening ? 'listening' : busy ? 'thinking' : speaking ? 'responding' : 'idle';
  const statusText = listening
    ? (lang === 'ml' ? 'കേൾക്കുന്നു…' : 'Listening…')
    : busy
      ? (lang === 'ml' ? 'ചിന്തിക്കുന്നു…' : 'Thinking…')
      : speaking
        ? (lang === 'ml' ? `${ASSISTANT.name} സംസാരിക്കുന്നു…` : `${ASSISTANT.name} is speaking…`)
        : null;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, busy, open, fullscreen]);

  // feature-detect the Web Speech API on the client (avoids SSR hydration mismatch)
  useEffect(() => {
    setVoiceOk(typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window));
    return () => { try { window.speechSynthesis?.cancel(); } catch {} };
  }, []);

  // close the panel on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  }

  // read an AI reply aloud in the language the server answered in
  function speak(html: string, replyLang: 'en' | 'ml') {
    if (!speakOn || typeof window === 'undefined' || !window.speechSynthesis) return;
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = replyLang === 'ml' ? 'ml-IN' : 'en-IN';
    const match = window.speechSynthesis.getVoices().find((v) => v.lang === u.lang);
    if (match) u.voice = match;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  async function ask(q: string) {
    if (!q.trim() || busy) return;
    setMsgs((m) => [...m, { who: 'me', html: q }]);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setBusy(true);
    setErrored(false);
    try {
      const res = await fetch('/api/dashboard/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ q, module }),
      });
      const data = await res.json().catch(() => ({}));
      // Surface the real reason instead of a generic "couldn't read that" — the
      // gate (402) and auth (401/403) return an `error`, not a `reply`.
      if (!res.ok) {
        const html =
          res.status === 402
            ? `<b>${ASSISTANT.name}</b> isn’t included in your current plan. <span class="msg-act">Upgrade to Pro to switch it on.</span>`
            : res.status === 401 || res.status === 403
              ? `You don’t have access to ${ASSISTANT.name} — sign in as an owner or manager.`
              : `${ASSISTANT.name} is unavailable right now — please try again in a moment.`;
        setMsgs((m) => [...m, { who: 'ai', html }]);
        setErrored(true);
        return;
      }
      const { reply, lang: replyLang } = data;
      const safe = reply ?? 'Sorry, I couldn’t read that.';
      setMsgs((m) => [...m, { who: 'ai', html: safe }]);
      speak(safe, replyLang === 'ml' ? 'ml' : 'en');
    } catch {
      setMsgs((m) => [...m, { who: 'ai', html: 'Network hiccup — try again in a moment.' }]);
      setErrored(true);
    } finally {
      setBusy(false);
    }
  }

  // mic: dictate the question (Malayalam or English per the language toggle)
  function toggleMic() {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (listening) { recRef.current?.stop(); return; }
    const rec = new SR();
    rec.lang = lang === 'ml' ? 'ml-IN' : 'en-IN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const said = e.results?.[0]?.[0]?.transcript ?? '';
      if (said) ask(said);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try { rec.start(); } catch { setListening(false); }
  }

  function cycleLang() {
    setLangIdx((i) => (i + 1) % LANGUAGES.length);
  }

  return (
    <>
      {/* floating launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed z-[9997] rounded-full flex items-center justify-center transition hover:-translate-y-0.5"
        style={{
          bottom: 20, right: 20, width: 56, height: 56,
          background: 'var(--paper)', border: '1px solid var(--line)', boxShadow: 'var(--sh-3)',
        }}
        aria-label={open ? `Close ${ASSISTANT.name}` : `Open ${ASSISTANT.name}`}
        title={ASSISTANT.name}
      >
        {open ? <X size={20} style={{ color: 'var(--ink-2)' }} /> : <ChaiIcon state={aiState} size={30} />}
      </button>

      {/* panel */}
      {open && (
        <>
          <div
            role="presentation"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[9998]"
            style={fullscreen ? { background: 'var(--scrim)', backdropFilter: 'blur(4px)' } : undefined}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${ASSISTANT.name} assistant`}
            onClick={(e) => e.stopPropagation()}
            className={
              fullscreen
                ? 'fixed inset-4 sm:inset-10 md:inset-20 z-[9999] flex flex-col rounded-2xl p-5'
                : 'fixed inset-x-3 bottom-[88px] top-16 sm:inset-x-auto sm:top-auto sm:bottom-24 sm:right-5 sm:w-96 sm:h-[600px] z-[9999] flex flex-col rounded-2xl p-5'
            }
            style={{ background: 'var(--paper)', border: '1px solid var(--line)', boxShadow: 'var(--sh-3)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ChaiIcon state={aiState} size={fullscreen ? 30 : 22} />
                <div>
                  <div className="font-bold text-xs leading-tight" style={{ color: 'var(--berry)' }}>{ASSISTANT.name}</div>
                  {statusText && <div className="text-[10px] leading-tight" style={{ color: 'var(--ink-3)' }}>{statusText}</div>}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={cycleLang}
                  className="text-[10px] font-bold px-2 py-1 rounded-full"
                  style={{ background: 'var(--paper-3)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}
                  title="Question language for the mic"
                >{(LANGUAGES[langIdx] ?? LANGUAGES[0]!).label}</button>
                <button
                  onClick={() => { setSpeakOn((s) => { if (s) window.speechSynthesis?.cancel(); return !s; }); }}
                  className="text-[12px] px-2 py-1 rounded-full"
                  style={{ background: speakOn ? 'color-mix(in srgb, var(--berry) 16%, var(--paper-3))' : 'var(--paper-3)', border: '1px solid var(--line)' }}
                  title={speakOn ? 'Voice replies on' : 'Voice replies off'}
                >{speakOn ? '🔊' : '🔇'}</button>
                <button
                  onClick={() => setFullscreen((f) => !f)}
                  className="hidden sm:flex text-[12px] px-2 py-1.5 rounded-full"
                  style={{ background: 'var(--paper-3)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}
                  title={fullscreen ? 'Dock' : 'Expand'}
                >{fullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}</button>
                <button
                  onClick={() => setOpen(false)}
                  className="text-[12px] px-2 py-1.5 rounded-full"
                  style={{ background: 'var(--paper-3)', border: '1px solid var(--line)', color: 'var(--ink-2)' }}
                  title="Close"
                >
                  <X size={12} />
                </button>
              </div>
            </div>

            {isLanding ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 px-2">
                <ChaiIcon state="idle" size={fullscreen ? 72 : 56} />
                <div className="font-display text-lg font-bold" style={{ color: 'var(--ink)' }}>{ASSISTANT.name}</div>
                <div className="text-xs" style={{ color: 'var(--ink-3)' }}>{ASSISTANT.tagline}</div>
                <p className="text-xs italic mt-1" style={{ color: 'var(--ink-3)' }}>
                  {lang === 'ml' ? 'നിങ്ങളുടെ ബിസിനസിനെ കുറിച്ച് ചോദിക്കൂ…' : 'Ask me about your business…'}
                </p>
              </div>
            ) : (
              <div ref={scrollRef} className="flex-1 overflow-y-auto flex flex-col gap-2.5 mb-3 pr-1">
                {msgs.map((m, i) => (
                  <div
                    key={i}
                    className="flex items-end gap-1.5"
                    style={{ alignSelf: m.who === 'me' ? 'flex-end' : 'flex-start', flexDirection: m.who === 'me' ? 'row-reverse' : 'row', maxWidth: '92%' }}
                  >
                    {m.who === 'ai' && <ChaiIcon state="idle" size={18} />}
                    <div
                      className="text-sm px-3 py-2 rounded-2xl"
                      style={m.who === 'me'
                        ? { background: 'var(--turmeric)', color: '#2A1607', fontWeight: 600 }
                        : { background: 'var(--paper-3)', color: 'var(--ink-2)', border: '1px solid var(--line)' }}
                      dangerouslySetInnerHTML={{ __html: m.html }}
                    />
                  </div>
                ))}
                {busy && (
                  <div className="flex items-center gap-2 self-start">
                    <ChaiIcon state="thinking" size={18} />
                    <span className="text-xs" style={{ color: 'var(--ink-3)' }}>
                      {lang === 'ml' ? `${ASSISTANT.name} ചിന്തിക്കുന്നു…` : `${ASSISTANT.name} is thinking…`}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {ASSISTANT_PROMPTS[module][lang].map((q) => (
                <button key={q} onClick={() => ask(q)} disabled={busy} className="pill text-xs disabled:opacity-50 hover:-translate-y-0.5 transition">{q}</button>
              ))}
            </div>

            <div className="flex gap-2 items-end">
              {voiceOk && (
                <button
                  onClick={toggleMic}
                  disabled={busy}
                  className="btn"
                  style={{ padding: '0 14px', background: listening ? 'var(--clay)' : 'var(--paper-3)', color: listening ? '#fff' : 'var(--ink)', border: '1px solid var(--line-2)' }}
                  title={listening ? 'Listening… tap to stop' : `Speak (${lang === 'ml' ? 'മലയാളം' : 'English'})`}
                >{listening ? '⏺' : '🎙️'}</button>
              )}
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => { setInput(e.target.value); autoGrow(e.target); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input); } }}
                placeholder={lang === 'ml' ? `${ASSISTANT.name}-യോട് ചോദിക്കൂ…` : `Ask ${ASSISTANT.name} anything…`}
                className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none resize-none max-h-28"
                style={{ background: 'var(--paper-3)', border: '1px solid var(--line-2)', color: 'var(--ink)' }}
              />
              <button onClick={() => ask(input)} disabled={busy || !input.trim()} className="btn btn-dark" style={{ padding: '0 16px' }}>↑</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
