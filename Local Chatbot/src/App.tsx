import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import logo from "./assets/ChucksGPTnoText.png";
import {
  Pencil,
  Trash,
  SquarePen,
  Cpu,
  ChevronDown,
  Sparkles,
  Lock,
} from "lucide-react";

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
    <img
      src={logo}
      alt="ChucksGPT"
      className="w-8 h-8 rounded-full object-cover shadow-md"
    />
  );
}

// const function ----------------------------------------------------------------------------------------------
export default function App() {
  const [modelOpenId, setModelOpenId] = useState<number | null>(null);
  const [renameModalId, setRenameModalId] = useState<number | null>(null);
  const [deleteModalId, setDeleteModalId] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
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

  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
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
      }, 10);
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
      id: Date.now() + Math.random(),
      timestamp: new Date(msg.timestamp),
    }));

    setMessages(formatted);
    setConversationId(id);
  };

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
          <img src={logo} alt="ChucksGPT Logo" className="w-10 h-10" />
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
            <div className="flex items-center gap-2">
              {<SquarePen className="w-4 h-4" />} New Chat
            </div>
          </button>
        </div>

        {/* Recent chats placeholder */}
        <div className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          <p className="px-3 py-1 text-xs text-gray-600 uppercase tracking-widest font-medium">
            Recent
          </p>
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`group relative flex items-center justify-between px-3 py-2 rounded-lg transition
                ${
                  conversationId === conv.id
                    ? "bg-white/10 text-white"
                    : "hover:bg-white/5"
                }
              `}
            >
              {/* Conversation title */}
              <button
                onClick={() => loadMessages(conv.id)}
                className="flex-1 text-left text-sm text-gray-400 group-hover:text-white truncate"
              >
                {conv.title}
              </button>

              {/* 3 dots (hidden until hover) */}
              <button
                onClick={() =>
                  setMenuOpenId(menuOpenId === conv.id ? null : conv.id)
                }
                className="opacity-0 group-hover:opacity-100 transition duration-150 text-gray-500 hover:text-white px-1"
              >
                ⋮
              </button>

              {/* Dropdown menu */}
              {menuOpenId === conv.id && (
                <div
                  ref={menuRef}
                  className="absolute right-2 top-10 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-lg z-50 w-32 transition-all duration-150 opacity-100 scale-100"
                >
                  {/* Rename */}
                  <button
                    onClick={() => {
                      setRenameModalId(conv.id);
                      setNewTitle(conv.title);
                      setMenuOpenId(null);
                    }}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-white/10"
                  >
                    <div className="flex items-center gap-2">
                      {<Pencil className="w-4 h-4" />} Rename
                    </div>
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => {
                      setDeleteModalId(conv.id);
                      setMenuOpenId(null);
                    }}
                    className="block w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-white/10"
                  >
                    <div className="flex items-center gap-2">
                      {<Trash className="w-5 h-5" />} Delete
                    </div>
                  </button>
                </div>
              )}
            </div>
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
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#0d0d0d]/80 backdrop-blur-md shrink-0 overflow-visible">
          {/* LEFT SIDE */}
          <div className="flex items-center gap-3">
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
            {/* Available para sa mga new feature */}
            <span className="text-sm font-medium text-white"> </span>
          </div>

          {/* RIGHT SIDE */}
          <div className="relative px-3 py-2">
            {/* Trigger */}
            <button
              onClick={() => setModelOpenId(modelOpenId ? null : 1)}
              className="w-full flex items-center justify-between text-sm text-gray-300 hover:text-white"
            >
              <div className="flex items-center gap-3">
                <Cpu className="w-4 h-4" />
                <span>ChucksGPT 1.0</span>
              </div>

              <ChevronDown
                className={`w-4 h-4 transition ${
                  modelOpenId ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Dropdown */}
            {modelOpenId && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-[#0f0f0f]/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl z-[999] transition-all duration-150">
                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  ChucksGPT 1.0
                </button>

                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10">
                  <Cpu className="w-4 h-4 text-blue-400" />
                  ChucksGPT Pro
                </button>

                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 cursor-not-allowed">
                  <Lock className="w-4 h-4" />
                  ChucksGPT Ultra
                </button>

                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10 text-gray-500 cursor-not-allowed">
                  <Cpu className="w-4 h-4 text-purple-400" />
                  Code Assistant
                </button>

                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10 text-gray-500 cursor-not-allowed">
                  <Cpu className="w-4 h-4 text-yellow-400" />
                  Instructor Mode
                </button>
              </div>
            )}
          </div>
        </header>

        {/* ── Messages ── */}
        <main className="flex-1 overflow-y-auto">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full px-4 py-12 text-center">
              <img src={logo} alt="ChucksGPT Logo" className="w-20 h-20" />
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
                    className={`flex flex-col gap-1 max-w-[80%] ${msg.sender === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`
                        px-4 py-2 text-sm leading-relaxed
                        ${
                          msg.sender === "user"
                            ? "bg-white/10 text-white rounded-2xl rounded-tr-sm"
                            : "text-gray-300"
                        }
                      `}
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                    <span className="text-xs text-gray-600 px-1">
                      {/* {formatTime(msg.timestamp)} */}
                    </span>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-3 flex-row">
                  <Avatar sender="bot" />
                  <TypingIndicator />
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
      {/* Rename Modal */}
      {renameModalId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-[#1a1a1a] p-5 rounded-xl w-80 border border-white/10 shadow-xl">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              {<Pencil className="w-5 h-5" />}
              Rename Chat
            </h2>

            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white outline-none mb-4"
              placeholder="Enter new title"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRenameModalId(null)}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-white"
              >
                Cancel
              </button>

              <button
                onClick={async () => {
                  await fetch(`/api/conversation/${renameModalId}/rename/`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title: newTitle }),
                  });

                  fetchConversations();
                  setRenameModalId(null);
                }}
                className="px-3 py-1.5 text-sm bg-emerald-500 hover:bg-emerald-400 rounded-lg text-black font-medium"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Modal */}
      {deleteModalId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-[#1a1a1a] p-5 rounded-xl w-80 border border-white/10 shadow-xl">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-red-400">
              {<Trash className="w-5 h-5" />}
              Delete Chat
            </h2>

            <p className="text-sm text-gray-400 mb-4">
              Are you sure you want to delete this conversation?
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteModalId(null)}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-white"
              >
                Cancel
              </button>

              <button
                onClick={async () => {
                  await fetch(`/api/conversation/${deleteModalId}/delete/`, {
                    method: "DELETE",
                  });

                  fetchConversations();

                  if (conversationId === deleteModalId) {
                    setMessages([]);
                    setConversationId(null);
                  }

                  setDeleteModalId(null);
                }}
                className="px-3 py-1.5 text-sm bg-red-500 hover:bg-red-400 rounded-lg text-white font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
