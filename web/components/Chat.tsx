"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";

interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalls?: { tool: string; args: Record<string, unknown> }[];
  iterations?: number;
}

const STORAGE_KEY = "runcoach_chat_history";

export default function Chat() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "🏃 欢迎来到跑蓝 RunCoach！\n\n我是你的 AI 跑步教练，可以帮你：\n• 分析训练状态，给出明日建议\n• 回答跑步知识（心率区间、补给策略、伤病预防）\n• 记录和追踪你的跑步数据\n\n今天跑了多少？感觉怎么样？",
    },
  ]);

  // 客户端 mount 后从 localStorage 加载聊天记录
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      } catch {
        // 忽略解析失败
      }
    }
  }, []);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 保存聊天记录到 localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

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
    const newMessages: Message[] = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setLoading(true);
    console.log("[Chat] 发送消息:", userMessage);

    try {
      // 构建历史消息上下文（最近 10 条）
      const history = newMessages.slice(-10).map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          history,
        }),
      });
      console.log("[Chat] API 响应状态:", res.status);

      const data = await res.json();
      console.log("[Chat] API 数据:", data);

      if (data.success) {
        const assistantMsg: Message = {
          role: "assistant",
          content: data.answer || "未能生成回答。",
          toolCalls: data.toolCalls || [],
          iterations: data.iterations,
        };
        const finalMessages = [...newMessages, assistantMsg];
        setMessages(finalMessages);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `❌ 错误: ${data.error || "未知错误"}` },
        ]);
      }
    } catch (err) {
      console.error("[Chat] 请求失败:", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ 网络错误: ${String(err)}` },
      ]);
    } finally {
      console.log("[Chat] 请求结束，loading=false");
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearHistory = () => {
    if (confirm("确定要清空聊天记录吗？")) {
      const welcome: Message = {
        role: "assistant",
        content: "🏃 欢迎来到跑蓝 RunCoach！\n\n我是你的 AI 跑步教练，可以帮你：\n• 分析训练状态，给出明日建议\n• 回答跑步知识（心率区间、补给策略、伤病预防）\n• 记录和追踪你的跑步数据\n\n今天跑了多少？感觉怎么样？",
      };
      setMessages([welcome]);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([welcome]));
    }
  };

  return (
    <div style={styles.container}>
      {/* 消息列表 - 全屏滚动 */}
      <div style={styles.messages}>
        {messages.length > 1 && (
          <div style={styles.clearBtnRow}>
            <button style={styles.clearBtn} onClick={clearHistory}>
              🗑️ 清空记录
            </button>
          </div>
        )}
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

      {/* 输入框 - 固定在底部 */}
      <div style={styles.inputArea}>
        <textarea
          style={styles.textarea}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入你的跑步问题... (Shift+Enter 换行)"
          rows={1}
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
    WebkitOverflowScrolling: "touch",
  },
  clearBtnRow: {
    display: "flex",
    justifyContent: "flex-end",
    paddingBottom: "4px",
  },
  clearBtn: {
    fontSize: "11px",
    padding: "4px 10px",
    background: "transparent",
    color: "var(--text-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    cursor: "pointer",
  },
  message: {
    padding: "12px 16px",
    borderRadius: "8px",
    maxWidth: "85%",
    wordBreak: "break-word",
    fontSize: "14px",
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
    position: "sticky",
    bottom: 0,
    zIndex: 10,
  },
  textarea: {
    flex: 1,
    resize: "none",
    fontSize: "14px",
    minHeight: "44px",
    maxHeight: "120px",
    padding: "10px 12px",
  },
  sendButton: {
    width: "44px",
    minWidth: "44px",
    height: "44px",
    background: "var(--accent)",
    color: "var(--bg-primary)",
    borderRadius: "8px",
    fontSize: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "opacity 0.2s",
    flexShrink: 0,
  },
  sendButtonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
};
