import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = {
  id: number;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
};

const SUGGESTIONS = [
  "✨ Write me a short poem",
  "🧠 Explain quantum computing",
  "💡 Give me a business idea",
  "🎨 Describe a surreal painting",
];

// let messageIdCounter = 0;

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

function Avatar({ sender }: { sender: "user" | "bot" }) {
  if (sender === "user") {
    return (
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-md">
        C
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white text-sm shrink-0 shadow-md">
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
        <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M9 9a1 1 0 0 0-1 1v1a1 1 0 0 0 2 0v-1a1 1 0 0 0-1-1m6 0a1 1 0 0 0-1 1v1a1 1 0 0 0 2 0v-1a1 1 0 0 0-1-1Z" />
      </svg>
    </div>
  );
}
// const function ----------------------------------------------------------------------------------------------
export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    fetchConversations();
  }, []);

  const sendMessage = async (text?: string) => {
    const messageText = text || input;
    if (!messageText.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now(),
      text: messageText,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/chat/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: messageText,
          conversation_id: conversationId,
        }),
      });

      const data = await res.json();
      // save conversation id -------------------------------------------------------------------------------
      setConversationId(data.conversation_id);
      fetchConversations();
      const fullText = data.response;

      setIsTyping(false);

      let currentText = "";
      const botMessageId = Date.now();

      setMessages((prev) => [
        ...prev,
        {
          id: botMessageId,
          text: "",
          sender: "bot",
          timestamp: new Date(),
        },
      ]);

      let i = 0;

      const interval = setInterval(() => {
        currentText += fullText[i];

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMessageId ? { ...msg, text: currentText } : msg,
          ),
        );

        i++;

        if (i >= fullText.length) {
          clearInterval(interval);
        }
      }, 10); // speed (lower = faster)
    } catch (error) {
      console.error(error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const isEmpty = messages.length === 0;

  const loadMessages = async (id: number) => {
    const res = await fetch(`/api/messages/${id}/`);
    const data = await res.json();

    const formatted = data.map((msg: any) => ({
      ...msg,
      id: Date.now() + Math.random(), // unique id
      timestamp: new Date(msg.timestamp),
    }));

    setMessages(formatted);
    setConversationId(id);
  };

  setTimeout(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, 100);

  const fetchConversations = () => {
    fetch("/api/conversations/")
      .then((res) => res.json())
      .then((data) => setConversations(data));
  };

  // UI---------------------------------------------------------------------------------
  return (
    <div className="flex h-screen bg-[#0d0d0d] text-white font-sans overflow-hidden">
      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-[#111111] border-r border-white/5
          flex flex-col transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          md:relative md:translate-x-0 md:flex
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-900/30">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
              <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M9 9a1 1 0 0 0-1 1v1a1 1 0 0 0 2 0v-1a1 1 0 0 0-1-1m6 0a1 1 0 0 0-1 1v1a1 1 0 0 0 2 0v-1a1 1 0 0 0-1-1Z" />
            </svg>
          </div>
          <span className="font-semibold text-white tracking-tight">
            ChucksGPT
          </span>
        </div>

        {/* New Chat button */}
        <div className="px-3 py-3">
          <button
            onClick={() => {
              setMessages([]);
              setConversationId(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors group"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4 stroke-current fill-none stroke-2"
            >
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            New Chat
          </button>
        </div>

        {/* Recent chats placeholder */}
        <div className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          <p className="px-3 py-1 text-xs text-gray-600 uppercase tracking-widest font-medium">
            Recent
          </p>
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => loadMessages(conv.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm
  ${conversationId === conv.id ? "bg-white/10 text-white" : "text-gray-400 hover:bg-white/5"}
`}
            >
              {conv.title}
            </button>
          ))}
        </div>

        {/* User profile footer */}
        <div className="px-4 py-4 border-t border-white/5">
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-sm font-bold">
              C
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">
                Clark N.
              </p>
              <p className="text-xs text-gray-500">Premium Plan</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main Area ── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-[#0d0d0d]/80 backdrop-blur-md shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-5 h-5 stroke-current fill-none stroke-2"
            >
              <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
            </svg>
          </button>

          {/* <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">ChucksGPT</span>
            <span className="text-xs bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
              Online
            </span>
          </div> */}

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => {
                setMessages([]);
                setConversationId(null);
              }}
              className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-colors"
              title="Clear chat"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4 stroke-current fill-none stroke-2"
              >
                <path
                  d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </header>

        {/* ── Messages ── */}
        <main className="flex-1 overflow-y-auto">
          {isEmpty ? (
            /* Empty state / welcome screen */
            <div className="flex flex-col items-center justify-center h-full px-4 py-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center mb-6 shadow-xl shadow-emerald-900/30">
                <svg viewBox="0 0 24 24" className="w-8 h-8 fill-white">
                  <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M9 9a1 1 0 0 0-1 1v1a1 1 0 0 0 2 0v-1a1 1 0 0 0-1-1m6 0a1 1 0 0 0-1 1v1a1 1 0 0 0 2 0v-1a1 1 0 0 0-1-1Z" />
                </svg>
              </div>
              <h1 className="text-2xl font-semibold text-white mb-2 tracking-tight">
                How can I help you today, Sir Clark?
              </h1>
              {/* <p className="text-gray-500 text-sm mb-10 max-w-xs">
                Ask me anything — I'm here to assist, explain, and explore with
                you.
              </p> */}

              {/* Suggestion pills */}
              <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s.replace(/^.{2}\s/, ""))}
                    className="text-left px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-sm text-gray-300 hover:bg-white/10 hover:text-white hover:border-white/15 transition-all duration-150"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.sender === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  <Avatar sender={msg.sender} />
                  <div
                    className={`flex flex-col gap-1 max-w-[78%] ${msg.sender === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`
                        px-4 py-3 rounded-2xl text-sm leading-relaxed
                        ${
                          msg.sender === "user"
                            ? "bg-indigo-600 text-white rounded-tr-sm shadow-lg shadow-indigo-900/20"
                            : "bg-[#1a1a1a] text-gray-100 border border-white/5 rounded-tl-sm"
                        }
                      `}
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                    <span className="text-xs text-gray-600 px-1">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-3 flex-row">
                  <Avatar sender="bot" />
                  <div className="px-4 py-2 rounded-2xl rounded-tl-sm bg-[#1a1a1a] border border-white/5">
                    <TypingIndicator />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        {/* ── Input area ── */}
        <footer className="shrink-0 px-4 pb-5 pt-3">
          <div className="max-w-2xl mx-auto">
            <div className="relative flex items-end gap-2 bg-[#1a1a1a] border border-white/8 rounded-2xl px-4 py-3 focus-within:border-white/20 focus-within:bg-[#1f1f1f] transition-all duration-200 shadow-xl shadow-black/30">
              <textarea
                ref={inputRef}
                className="flex-1 bg-transparent resize-none outline-none text-sm text-white placeholder-gray-600 max-h-36 leading-relaxed pt-0.5"
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height =
                    Math.min(e.target.scrollHeight, 144) + "px";
                }}
                onKeyDown={handleKeyDown}
                placeholder="Message ChucksGPT…"
                disabled={isTyping}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isTyping}
                className={`
                  shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150
                  ${
                    input.trim() && !isTyping
                      ? "bg-white text-black hover:bg-gray-200 shadow-sm"
                      : "bg-white/10 text-gray-600 cursor-not-allowed"
                  }
                `}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-4 h-4 fill-none stroke-current stroke-2"
                >
                  <path
                    d="M12 19V5M5 12l7-7 7 7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <p className="text-center text-xs text-gray-700 mt-2">
              Press{" "}
              <kbd className="bg-white/5 px-1.5 py-0.5 rounded text-gray-500 text-[10px] font-mono">
                Enter
              </kbd>{" "}
              to send ·{" "}
              <kbd className="bg-white/5 px-1.5 py-0.5 rounded text-gray-500 text-[10px] font-mono">
                Shift+Enter
              </kbd>{" "}
              for newline
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
