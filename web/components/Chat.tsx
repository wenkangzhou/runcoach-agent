"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalls?: { tool: string; args: Record<string, unknown> }[];
  iterations?: number;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "🏃 欢迎来到跑蓝 RunCoach！\n\n我是你的 AI 跑步教练，可以帮你：\n• 分析训练状态，给出明日建议\n• 回答跑步知识（心率区间、补给策略、伤病预防）\n• 记录和追踪你的跑步数据\n\n今天跑了多少？感觉怎么样？",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });

      const data = await res.json();

      if (data.success) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.answer,
            toolCalls: data.toolCalls,
            iterations: data.iterations,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `❌ 错误: ${data.error}` },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ 网络错误: ${String(err)}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={styles.container}>
      {/* 消息列表 */}
      <div style={styles.messages}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              ...styles.message,
              ...(msg.role === "user" ? styles.userMessage : styles.assistantMessage),
            }}
          >
            <div style={styles.messageHeader}>
              <span style={styles.roleBadge}>
                {msg.role === "user" ? "👤 你" : "🏃 Coach"}
              </span>
              {msg.iterations && (
                <span style={styles.meta}>迭代 {msg.iterations} 次</span>
              )}
            </div>
            <div style={styles.messageContent}>
              {msg.content.split("\n").map((line, j) => (
                <p key={j} style={styles.line}>{line}</p>
              ))}
            </div>
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div style={styles.toolCalls}>
                {msg.toolCalls.map((tc, k) => (
                  <span key={k} style={styles.toolBadge}>🔧 {tc.tool}</span>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={styles.loading}>
            <span style={styles.loadingDot}>▌</span> Coach 思考中...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 */}
      <div style={styles.inputArea}>
        <textarea
          style={styles.textarea}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入你的跑步问题... (Shift+Enter 换行)"
          rows={2}
          disabled={loading}
        />
        <button
          style={{
            ...styles.sendButton,
            ...(loading || !input.trim() ? styles.sendButtonDisabled : {}),
          }}
          onClick={sendMessage}
          disabled={loading || !input.trim()}
        >
          {loading ? "..." : "➤"}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "var(--bg-primary)",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  message: {
    padding: "12px 16px",
    borderRadius: "8px",
    maxWidth: "85%",
    wordBreak: "break-word",
  },
  userMessage: {
    alignSelf: "flex-end",
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
  },
  assistantMessage: {
    alignSelf: "flex-start",
    background: "var(--bg-secondary)",
    border: "1px solid var(--accent-dim)",
  },
  messageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
    fontSize: "12px",
  },
  roleBadge: {
    color: "var(--accent)",
    fontWeight: "bold",
  },
  meta: {
    color: "var(--text-secondary)",
    fontSize: "11px",
  },
  messageContent: {
    lineHeight: "1.6",
  },
  line: {
    margin: "2px 0",
  },
  toolCalls: {
    marginTop: "8px",
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
  },
  toolBadge: {
    fontSize: "11px",
    padding: "2px 8px",
    background: "var(--bg-tertiary)",
    borderRadius: "4px",
    color: "var(--accent)",
  },
  loading: {
    alignSelf: "flex-start",
    padding: "12px 16px",
    color: "var(--accent)",
    fontSize: "14px",
  },
  loadingDot: {
    animation: "blink 1s infinite",
  },
  inputArea: {
    display: "flex",
    gap: "8px",
    padding: "12px 16px",
    borderTop: "1px solid var(--border)",
    background: "var(--bg-secondary)",
  },
  textarea: {
    flex: 1,
    resize: "none",
    fontSize: "14px",
  },
  sendButton: {
    width: "44px",
    height: "44px",
    background: "var(--accent)",
    color: "var(--bg-primary)",
    borderRadius: "8px",
    fontSize: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "opacity 0.2s",
  },
  sendButtonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
};
