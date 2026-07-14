"use client";

/**
 * Principal chat box — multi-turn, streaming.
 *
 * Holds the full conversation in component state so each new question lands
 * with prior context attached. Posts to /api/chat which streams SSE deltas;
 * the assistant message renders token-by-token as it arrives.
 *
 * State machine:
 *   - idle              → input enabled
 *   - streaming         → input disabled, last assistant msg fills in live
 *   - error inline shown until next send
 *
 * Conversation history is in-memory only. Refreshing the page clears it.
 * (Persisted history is a follow-up — could go into localStorage like the
 * parent draft, or into a `chat_threads` table if we want cross-device.)
 */

import { useEffect, useRef, useState } from "react";

type Turn = { role: "user" | "assistant"; content: string };
type Meta = {
  elapsed_ms?: number;
  cache_hit?: boolean;
  input_tokens?: number;
  output_tokens?: number;
};

const QUICK_PROMPTS = [
  "Who's over capacity in the Math department?",
  "Which sections still need confirming?",
  "Which teachers have the most slack to absorb new periods?",
];

export default function AskManhaj() {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMeta, setLastMeta] = useState<Meta | null>(null);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, streaming]);

  async function send(text?: string) {
    if (streaming) return;
    const message = (text ?? input).trim();
    if (!message) return;

    setError(null);
    setInput("");
    setLastMeta(null);

    // Append the user turn AND an empty assistant turn that we'll fill in via stream.
    const nextTurns: Turn[] = [...turns, { role: "user", content: message }, { role: "assistant", content: "" }];
    setTurns(nextTurns);
    setStreaming(true);

    try {
      // Send the full conversation EXCEPT the placeholder assistant we just added.
      const payloadMessages = nextTurns.slice(0, -1);

      const res = await fetch("/admin/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payloadMessages }),
      });

      if (!res.ok || !res.body) {
        // Non-streaming error path — API returned JSON
        let errMsg = `Request failed (HTTP ${res.status})`;
        try {
          const j = await res.json();
          if (j?.error) errMsg = j.error;
        } catch { /* noop */ }
        throw new Error(errMsg);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by \n\n.
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 2);
          if (!frame.startsWith("data:")) continue;
          const json = frame.slice(5).trim();
          if (!json) continue;
          let evt: { type?: string; text?: string; message?: string; meta?: Meta } = {};
          try { evt = JSON.parse(json); } catch { continue; }
          if (evt.type === "delta" && typeof evt.text === "string") {
            setTurns(prev => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last && last.role === "assistant") {
                copy[copy.length - 1] = { role: "assistant", content: last.content + evt.text };
              }
              return copy;
            });
          } else if (evt.type === "done") {
            setLastMeta(evt.meta ?? null);
          } else if (evt.type === "error" && evt.message) {
            throw new Error(evt.message);
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't reach the chat service.";
      setError(msg);
      // Strip the trailing empty assistant turn if Claude never started speaking.
      setTurns(prev => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant" && last.content === "") copy.pop();
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  function clearChat() {
    if (streaming) return;
    setTurns([]);
    setError(null);
    setLastMeta(null);
  }

  const hasTurns = turns.length > 0;

  return (
    <div className="ai-chat" style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}>
      {/* Conversation scroller */}
      {hasTurns && (
        <div
          ref={scrollerRef}
          role="log"
          aria-live="polite"
          aria-atomic="false"
          aria-label="Chat with Manhaj"
          style={{
            background: "#FAFCFE", border: "1px solid var(--border)", borderRadius: 10,
            padding: 10, maxHeight: 360, overflowY: "auto",
            display: "flex", flexDirection: "column", gap: 10,
          }}
        >
          {turns.map((t, i) => (
            <ChatBubble key={i} role={t.role} content={t.content} streaming={streaming && i === turns.length - 1} />
          ))}
          {lastMeta && !streaming && (
            <div style={{ fontSize: 10.5, color: "var(--muted)", fontStyle: "italic", marginTop: 4 }}>
              Manhaj &middot;{" "}
              {lastMeta.cache_hit ? "cached context · " : ""}
              {lastMeta.elapsed_ms != null ? `${(lastMeta.elapsed_ms / 1000).toFixed(1)}s` : "—"}
              {" "}&middot; verify before acting
            </div>
          )}
        </div>
      )}

      {error && (
        <div role="alert" aria-live="polite" style={{
          background: "#FED7D7", color: "#742A2A", padding: "10px 14px",
          borderRadius: 8, fontSize: 12,
        }}>
          {error}
        </div>
      )}

      {/* Input row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className="ai-icon">M</div>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={hasTurns ? "Ask a follow-up…" : "Ask Manhaj — try one of the suggestions below…"}
          disabled={streaming}
          aria-label="Ask Manhaj"
          style={{
            flex: 1, padding: "8px 12px", border: "1px solid var(--border)",
            borderRadius: 8, fontSize: 12.5, fontFamily: "inherit", background: "#fff",
          }}
        />
        <button
          className="btn primary"
          onClick={() => send()}
          disabled={streaming || !input.trim()}
          aria-busy={streaming}
          style={{ padding: "8px 18px", fontSize: 12 }}
        >
          {streaming ? "…" : "Ask"}
        </button>
        {hasTurns && (
          <button
            type="button"
            className="btn ghost"
            onClick={clearChat}
            disabled={streaming}
            style={{ padding: "8px 14px", fontSize: 12 }}
            title="Start a new conversation"
          >
            New chat
          </button>
        )}
      </div>

      {/* Quick prompts — only shown when conversation is empty */}
      {!hasTurns && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {QUICK_PROMPTS.map(p => (
            <button
              key={p}
              type="button"
              className="pill"
              onClick={() => send(p)}
              disabled={streaming}
              style={{ border: "1px solid var(--border)" }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatBubble({ role, content, streaming }: { role: "user" | "assistant"; content: string; streaming: boolean }) {
  const isUser = role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <div style={{
        background: isUser ? "var(--primary)" : "#fff",
        color: isUser ? "#fff" : "var(--ink)",
        border: isUser ? "none" : "1px solid var(--border)",
        borderRadius: 12, padding: "10px 14px", fontSize: 12.5, lineHeight: 1.55,
        maxWidth: "85%", whiteSpace: "pre-wrap", wordBreak: "break-word",
      }}>
        {content || (streaming ? <span style={{ opacity: 0.6, fontStyle: "italic" }}>Manhaj is thinking…</span> : "")}
        {streaming && content && <span style={{ opacity: 0.6, marginLeft: 2 }}>▍</span>}
      </div>
    </div>
  );
}
