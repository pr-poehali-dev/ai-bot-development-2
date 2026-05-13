import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        initDataUnsafe?: { user?: { first_name?: string; username?: string } };
        colorScheme?: string;
        close: () => void;
        MainButton: { setText: (t: string) => void; show: () => void; hide: () => void };
      };
    };
  }
}

const WEBHOOK_URL = "https://functions.poehali.dev/e50920df-f4f3-47f3-a9e5-1527f4e77f61";
const SETUP_URL = "https://functions.poehali.dev/91679f6e-fc87-4193-ac05-dc57dec6c884";

type Section = "chat" | "help" | "status" | "about" | "settings" | "history" | "feedback";

interface Message {
  id: number;
  role: "user" | "bot";
  text: string;
  time: string;
}

interface HistoryItem {
  id: number;
  question: string;
  answer: string;
  time: string;
}

const WELCOME_MSG = `Привет! Я Юра — твой персональный ИИ-ассистент 🤖

Что я умею:
• Отвечаю на любые вопросы
• Работаю в группах — напиши «Юра, [твой вопрос]»
• Помогаю с задачами, идеями, текстами

Выбери раздел в меню или просто напиши мне!`;

const formatTime = () =>
  new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

async function askAI(question: string): Promise<string> {
  try {
    const prompt = encodeURIComponent(
      `Ты — умный русскоязычный ИИ-ассистент по имени Юра. Отвечай на русском языке, дружелюбно и по делу. Вопрос: ${question}`
    );
    const res = await fetch(`https://text.pollinations.ai/${prompt}`, {
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error("net");
    const text = await res.text();
    return text.trim() || "Не смог получить ответ. Попробуй ещё раз.";
  } catch {
    return "Временно не могу ответить — ИИ перегружен. Попробуй через несколько секунд.";
  }
}

export default function Index() {
  const [section, setSection] = useState<Section>("chat");
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: "bot", text: WELCOME_MSG, time: formatTime() },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [feedback, setFeedback] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [groupMode, setGroupMode] = useState(false);
  const [botName, setBotName] = useState("Юра");
  const [autoScroll, setAutoScroll] = useState(true);
  const [tgUser, setTgUser] = useState<{ name: string; username: string } | null>(null);
  const [setupStatus, setSetupStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [setupLog, setSetupLog] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Инициализация Telegram Web App
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      const user = tg.initDataUnsafe?.user;
      if (user) {
        setTgUser({ name: user.first_name || "Пользователь", username: user.username || "" });
        setMessages([{
          id: 1, role: "bot",
          text: `Привет, ${user.first_name || "друг"}! Я Юра — твой ИИ-ассистент 🤖\n\nПросто напиши мне вопрос!`,
          time: formatTime()
        }]);
      }
    }
  }, []);

  useEffect(() => {
    if (autoScroll) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, autoScroll]);

  const runSetup = async () => {
    setSetupStatus("loading");
    setSetupLog("Подключаю webhook...");
    try {
      const appUrl = window.location.origin;
      const res = await fetch(SETUP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhook_url: WEBHOOK_URL, webapp_url: appUrl }),
      });
      const data = await res.json();
      if (data.ok) {
        setSetupStatus("done");
        setSetupLog("✅ Webhook зарегистрирован!\n✅ Кнопка мини-приложения установлена!\n✅ Команды бота обновлены!");
      } else {
        setSetupStatus("error");
        setSetupLog("Ошибка: " + JSON.stringify(data));
      }
    } catch (e) {
      setSetupStatus("error");
      setSetupLog("Ошибка соединения: " + String(e));
    }
  };

  const sendMessage = async (text?: string) => {
    const raw = (text ?? input).trim();
    if (!raw || loading) return;

    if (groupMode) {
      const pattern = new RegExp(`^${botName}[,\\s]`, "i");
      if (!pattern.test(raw)) {
        setInput("");
        return;
      }
    }

    const question = groupMode
      ? raw.replace(new RegExp(`^${botName}[,\\s]+`, "i"), "")
      : raw;

    const userMsg: Message = { id: Date.now(), role: "user", text: raw, time: formatTime() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const answer = await askAI(question);

    const botMsg: Message = { id: Date.now() + 1, role: "bot", text: answer, time: formatTime() };
    setMessages((prev) => [...prev, botMsg]);
    setLoading(false);

    setHistory((prev) => [
      { id: Date.now(), question, answer, time: formatTime() },
      ...prev.slice(0, 49),
    ]);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickQ = (q: string) => {
    setSection("chat");
    setTimeout(() => sendMessage(q), 50);
  };

  const navItems: { id: Section; icon: string; label: string }[] = [
    { id: "chat", icon: "MessageCircle", label: "Чат" },
    { id: "help", icon: "HelpCircle", label: "Справка" },
    { id: "status", icon: "Activity", label: "Статус" },
    { id: "about", icon: "Info", label: "О боте" },
    { id: "settings", icon: "Settings", label: "Настройки" },
    { id: "history", icon: "Clock", label: "История" },
    { id: "feedback", icon: "MessageSquare", label: "Отзыв" },
  ];

  return (
    <div
      className="min-h-screen grid-bg font-golos flex flex-col"
      style={{ background: "var(--dark-bg)" }}
    >
      {/* Header */}
      <header
        className="cyber-card scan-line sticky top-0 z-50 px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--dark-border)" }}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
              style={{
                background:
                  "linear-gradient(135deg, rgba(0,255,204,0.2), rgba(168,85,247,0.2))",
                border: "1px solid var(--neon-cyan)",
              }}
            >
              🤖
            </div>
            <div
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2"
              style={{ borderColor: "var(--dark-bg)", boxShadow: "0 0 6px #4ade80" }}
            />
          </div>
          <div>
            <h1
              className="font-oswald text-lg font-bold glitch neon-text"
              data-text="ЮРА"
            >
              ЮРА
            </h1>
            <p className="text-xs status-online font-oswald tracking-widest">● ONLINE</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {groupMode && (
            <span
              className="text-xs px-2 py-0.5 rounded font-oswald tracking-wide"
              style={{
                background: "rgba(168,85,247,0.15)",
                border: "1px solid var(--neon-purple)",
                color: "var(--neon-purple)",
              }}
            >
              ГРУППА
            </span>
          )}
          {tgUser ? (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded"
              style={{ background: "rgba(0,255,204,0.08)", border: "1px solid rgba(0,255,204,0.2)" }}>
              <span className="text-xs neon-text font-oswald">TG</span>
              <span className="text-xs opacity-70">{tgUser.name}</span>
            </div>
          ) : (
            <span className="text-xs opacity-40 font-oswald">@iris_cm_botat</span>
          )}
        </div>
      </header>

      {/* Nav */}
      <nav
        className="flex overflow-x-auto gap-1 px-3 py-2 scrollbar-none"
        style={{
          borderBottom: "1px solid var(--dark-border)",
          background: "rgba(13,20,32,0.8)",
        }}
      >
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setSection(item.id)}
            className={`cyber-btn flex items-center gap-1.5 px-3 py-1.5 rounded text-xs whitespace-nowrap ${
              section === item.id ? "cyber-btn-active" : ""
            }`}
          >
            <Icon name={item.icon} size={13} />
            {item.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-hidden flex flex-col max-w-2xl w-full mx-auto w-full">
        {/* CHAT */}
        {section === "chat" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.map((msg, i) => (
                <div
                  key={msg.id}
                  className={`flex animate-fade-in-up ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                  style={{ animationDelay: `${i * 0.02}s` }}
                >
                  <div
                    className={`max-w-[85%] ${
                      msg.role === "user" ? "msg-user" : "msg-bot"
                    } px-4 py-2.5`}
                  >
                    {msg.role === "bot" && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-xs font-oswald tracking-wider neon-text">
                          ЮРА
                        </span>
                      </div>
                    )}
                    <p
                      className="text-sm leading-relaxed whitespace-pre-wrap"
                      style={{
                        color:
                          msg.role === "user"
                            ? "rgba(0,255,204,0.9)"
                            : "rgba(220,200,255,0.9)",
                      }}
                    >
                      {msg.text}
                    </p>
                    <p className="text-right text-xs mt-1 opacity-30">{msg.time}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start animate-fade-in-up">
                  <div className="msg-bot px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-xs font-oswald tracking-wider neon-text">ЮРА</span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="text-xs opacity-40 ml-1">думаю...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {messages.length <= 2 && (
              <div className="px-4 pb-2 flex flex-wrap gap-2">
                {["Что ты умеешь?", "Расскажи анекдот", "Помоги с идеей для бизнеса"].map(
                  (q) => (
                    <button
                      key={q}
                      onClick={() => quickQ(q)}
                      className="cyber-btn text-xs px-3 py-1.5 rounded-full"
                    >
                      {q}
                    </button>
                  )
                )}
              </div>
            )}

            <div className="px-4 pb-4 pt-2">
              {groupMode && (
                <p className="text-xs mb-2 opacity-50 font-oswald tracking-wide">
                  Режим группы — начни с:{" "}
                  <span style={{ color: "var(--neon-cyan)" }}>{botName}, [вопрос]</span>
                </p>
              )}
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder={
                    groupMode ? `${botName}, напиши вопрос...` : "Напиши сообщение..."
                  }
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                  style={{
                    background: "var(--dark-card)",
                    border: "1px solid var(--dark-border)",
                    color: "rgba(0,255,204,0.85)",
                    caretColor: "var(--neon-cyan)",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--neon-cyan)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--dark-border)")}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={loading || !input.trim()}
                  className="cyber-btn px-4 py-2.5 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Icon name="Send" size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* HELP */}
        {section === "help" && (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 animate-fade-in-up">
            <div className="cyber-card rounded-xl p-4 neon-border border">
              <h2 className="font-oswald text-lg neon-text tracking-wide mb-3">
                СПРАВКА ПО КОМАНДАМ
              </h2>
              <div className="space-y-3">
                {[
                  { cmd: "/start", desc: "Запустить бота и получить приветствие" },
                  { cmd: "/help", desc: "Показать список всех команд" },
                  { cmd: "/status", desc: "Проверить состояние ИИ-сервера" },
                  { cmd: "/about", desc: "Информация о боте и разработчике" },
                  { cmd: "/settings", desc: "Открыть настройки бота" },
                  { cmd: "/history", desc: "История последних вопросов" },
                  { cmd: "/feedback", desc: "Отправить отзыв разработчику" },
                  { cmd: "/clear", desc: "Очистить историю диалога" },
                ].map((item) => (
                  <div
                    key={item.cmd}
                    className="flex items-start gap-3 py-2"
                    style={{ borderBottom: "1px solid var(--dark-border)" }}
                  >
                    <code
                      className="font-oswald text-sm shrink-0"
                      style={{ color: "var(--neon-cyan)" }}
                    >
                      {item.cmd}
                    </code>
                    <span className="text-sm opacity-70">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="cyber-card rounded-xl p-4 neon-border-purple border">
              <h3
                className="font-oswald tracking-wide mb-3"
                style={{ color: "var(--neon-purple)" }}
              >
                ГРУППОВОЙ РЕЖИМ
              </h3>
              <p className="text-sm opacity-70 mb-2">
                Чтобы бот отвечал в группе, включи режим в настройках и пиши:
              </p>
              <div
                className="rounded-lg p-3 font-oswald text-sm"
                style={{
                  background: "rgba(168,85,247,0.1)",
                  color: "var(--neon-purple)",
                }}
              >
                Юра, как дела?
              </div>
              <p className="text-xs mt-2 opacity-50">
                Бот реагирует только на сообщения со своим именем в начале
              </p>
            </div>

            <div className="cyber-card rounded-xl p-4">
              <h3 className="font-oswald tracking-wide mb-3 neon-text">ЧТО МОЖЕТ ЮРА</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  "Отвечает на вопросы",
                  "Пишет тексты",
                  "Помогает с идеями",
                  "Даёт советы",
                  "Объясняет сложное",
                  "Работает в группах",
                ].map((feat) => (
                  <div
                    key={feat}
                    className="flex items-center gap-2 text-sm py-1.5 px-2 rounded"
                    style={{
                      background: "rgba(0,255,204,0.05)",
                      border: "1px solid rgba(0,255,204,0.1)",
                    }}
                  >
                    <span style={{ color: "var(--neon-cyan)" }}>✦</span>
                    <span className="opacity-75">{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="cyber-card rounded-xl p-4"
              style={{ borderColor: "rgba(255,0,0,0.2)", border: "1px solid" }}
            >
              <h3
                className="font-oswald tracking-wide mb-3"
                style={{ color: "#ff6b6b" }}
              >
                ЧТО НЕЛЬЗЯ
              </h3>
              <div className="space-y-2">
                {[
                  "Запрещённый или вредоносный контент",
                  "Спам и флуд",
                  "Личные данные других людей",
                  "Мошеннические схемы",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 text-sm opacity-70"
                  >
                    <span style={{ color: "#ff6b6b" }}>✕</span> {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STATUS */}
        {section === "status" && (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 animate-fade-in-up">
            <div className="cyber-card rounded-xl p-5 neon-border border text-center">
              <div className="text-5xl mb-3">🟢</div>
              <h2 className="font-oswald text-2xl neon-text tracking-widest">
                СИСТЕМА АКТИВНА
              </h2>
              <p className="text-sm opacity-50 mt-1">Все системы работают штатно</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "ИИ-ядро", value: "Pollinations AI", icon: "Cpu" },
                { label: "Модель", value: "OpenAI GPT", icon: "Brain" },
                { label: "Пинг", value: "~300ms", icon: "Zap" },
                { label: "Аптайм", value: "99.9%", icon: "Shield" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="cyber-card rounded-xl p-4 neon-border border"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name={item.icon} size={14} />
                    <span className="text-xs font-oswald tracking-wide opacity-60">
                      {item.label}
                    </span>
                  </div>
                  <div className="font-oswald text-sm neon-text">{item.value}</div>
                  <div className="text-xs mt-1 status-online">● ONLINE</div>
                </div>
              ))}
            </div>

            <div className="cyber-card rounded-xl p-4">
              <h3 className="font-oswald tracking-wide mb-3 neon-text text-sm">
                АКТИВНОСТЬ ЗА СЕССИЮ
              </h3>
              <div className="flex items-end gap-1 h-16">
                {Array.from({ length: 20 }, (_, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t"
                    style={{
                      height: `${20 + ((i * 37 + 13) % 80)}%`,
                      background: `rgba(0,255,204,${0.2 + ((i * 17) % 60) / 100})`,
                    }}
                  />
                ))}
              </div>
              <p className="text-xs opacity-40 mt-2 font-oswald">
                Сообщений отправлено: {messages.filter((m) => m.role === "user").length}
              </p>
            </div>

            <div className="cyber-card rounded-xl p-4">
              <h3 className="font-oswald tracking-wide mb-3 neon-text text-sm">
                ИНФОРМАЦИЯ О ВЕРСИИ
              </h3>
              <div className="space-y-2 text-sm">
                {[
                  ["Версия бота", "v1.0.0"],
                  ["Последнее обновление", "2026-05-13"],
                  ["ИИ-провайдер", "Pollinations.ai"],
                  ["Лицензия", "Free / Open"],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between"
                    style={{
                      borderBottom: "1px solid var(--dark-border)",
                      paddingBottom: "6px",
                    }}
                  >
                    <span className="opacity-60">{k}</span>
                    <span style={{ color: "var(--neon-cyan)" }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ABOUT */}
        {section === "about" && (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 animate-fade-in-up">
            <div className="cyber-card rounded-xl p-5 neon-border border text-center">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-3"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(0,255,204,0.2), rgba(168,85,247,0.3))",
                  border: "2px solid var(--neon-cyan)",
                  boxShadow: "0 0 30px rgba(0,255,204,0.3)",
                }}
              >
                🤖
              </div>
              <h2 className="font-oswald text-2xl neon-text tracking-wide">ЮРА</h2>
              <p className="text-sm opacity-50 mt-1">Персональный ИИ-ассистент</p>
              <div
                className="mt-3 py-2 px-4 inline-block rounded-full font-oswald text-sm"
                style={{
                  background: "rgba(168,85,247,0.15)",
                  border: "1px solid var(--neon-purple)",
                  color: "var(--neon-purple)",
                }}
              >
                @iris_cm_botat
              </div>
            </div>

            <div className="cyber-card rounded-xl p-4">
              <h3 className="font-oswald tracking-wide mb-3 neon-text text-sm">О ПРОЕКТЕ</h3>
              <p className="text-sm opacity-70 leading-relaxed">
                Юра — умный ИИ-бот нового поколения, созданный для помощи пользователям в
                решении любых задач. Работает на базе передовых языковых моделей и доступен
                24/7.
              </p>
            </div>

            <div className="cyber-card rounded-xl p-4">
              <h3
                className="font-oswald tracking-wide mb-3 text-sm"
                style={{ color: "var(--neon-purple)" }}
              >
                РАЗРАБОТЧИК
              </h3>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                  style={{
                    background: "rgba(168,85,247,0.2)",
                    border: "1px solid var(--neon-purple)",
                  }}
                >
                  👤
                </div>
                <div>
                  <div
                    className="font-oswald text-sm"
                    style={{ color: "var(--neon-purple)" }}
                  >
                    @iris_cm_botat
                  </div>
                  <div className="text-xs opacity-50">Создатель и разработчик</div>
                </div>
              </div>
              <div className="text-sm opacity-60 leading-relaxed">
                По вопросам сотрудничества, ошибкам и предложениям — пишите напрямую
                разработчику.
              </div>
            </div>

            <div className="cyber-card rounded-xl p-4">
              <h3 className="font-oswald tracking-wide mb-3 neon-text text-sm">ВОЗМОЖНОСТИ</h3>
              <div className="space-y-2">
                {[
                  { icon: "MessageCircle", text: "Диалоговый ИИ-чат" },
                  { icon: "Users", text: "Работа в групповых чатах" },
                  { icon: "Zap", text: "Мгновенные ответы" },
                  { icon: "Globe", text: "Бесплатный доступ без API" },
                  { icon: "Clock", text: "История диалогов" },
                  { icon: "Shield", text: "Безопасный контент" },
                ].map((f) => (
                  <div
                    key={f.text}
                    className="flex items-center gap-3 text-sm py-1.5 opacity-75"
                  >
                    <Icon name={f.icon} size={14} className="neon-text shrink-0" />
                    {f.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {section === "settings" && (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 animate-fade-in-up">
            <div className="cyber-card rounded-xl p-4 neon-border border">
              <h2 className="font-oswald tracking-wide neon-text mb-4">НАСТРОЙКИ</h2>

              <div className="space-y-4">
                <div
                  className="flex items-center justify-between py-3"
                  style={{ borderBottom: "1px solid var(--dark-border)" }}
                >
                  <div>
                    <div className="text-sm font-medium">Групповой режим</div>
                    <div className="text-xs opacity-50 mt-0.5">
                      Бот отвечает только на «{botName}, ...»
                    </div>
                  </div>
                  <button
                    onClick={() => setGroupMode((v) => !v)}
                    className="w-12 h-6 rounded-full transition-all relative"
                    style={{ background: groupMode ? "var(--neon-cyan)" : "var(--dark-border)" }}
                  >
                    <div
                      className={`absolute top-0.5 w-5 h-5 rounded-full transition-all bg-white ${
                        groupMode ? "left-6" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>

                <div
                  className="py-3"
                  style={{ borderBottom: "1px solid var(--dark-border)" }}
                >
                  <div className="text-sm font-medium mb-2">Имя бота в группе</div>
                  <input
                    value={botName}
                    onChange={(e) => setBotName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{
                      background: "var(--dark-card)",
                      border: "1px solid var(--dark-border)",
                      color: "var(--neon-cyan)",
                    }}
                  />
                  <p className="text-xs opacity-40 mt-1">Пишите в группе: «{botName}, вопрос»</p>
                </div>

                <div
                  className="flex items-center justify-between py-3"
                  style={{ borderBottom: "1px solid var(--dark-border)" }}
                >
                  <div>
                    <div className="text-sm font-medium">Автопрокрутка чата</div>
                    <div className="text-xs opacity-50 mt-0.5">
                      Прокручивать к новым сообщениям
                    </div>
                  </div>
                  <button
                    onClick={() => setAutoScroll((v) => !v)}
                    className="w-12 h-6 rounded-full transition-all relative"
                    style={{
                      background: autoScroll ? "var(--neon-cyan)" : "var(--dark-border)",
                    }}
                  >
                    <div
                      className={`absolute top-0.5 w-5 h-5 rounded-full transition-all bg-white ${
                        autoScroll ? "left-6" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() =>
                      setMessages([{ id: 1, role: "bot", text: WELCOME_MSG, time: formatTime() }])
                    }
                    className="cyber-btn w-full py-2.5 rounded-lg text-sm"
                    style={{ borderColor: "#ff6b6b", color: "#ff6b6b" }}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Icon name="Trash2" size={14} /> Очистить историю чата
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Telegram Setup */}
            <div className="cyber-card rounded-xl p-4 neon-border-purple border">
              <h3 className="font-oswald tracking-wide mb-1 text-sm" style={{ color: "var(--neon-purple)" }}>
                TELEGRAM ИНТЕГРАЦИЯ
              </h3>
              <p className="text-xs opacity-50 mb-3">Зарегистрировать webhook и подключить мини-приложение</p>
              <div className="text-xs mb-3 space-y-1 opacity-60">
                <div>Webhook URL: <code className="neon-text text-xs">{WEBHOOK_URL.slice(0, 40)}...</code></div>
                <div>Mini App: <code className="neon-text text-xs">{window.location.origin}</code></div>
              </div>
              {setupLog && (
                <pre className="text-xs p-3 rounded-lg mb-3 whitespace-pre-wrap leading-relaxed"
                  style={{ background: "rgba(0,255,204,0.05)", border: "1px solid rgba(0,255,204,0.15)", color: setupStatus === "error" ? "#ff6b6b" : "var(--neon-cyan)" }}>
                  {setupLog}
                </pre>
              )}
              <button onClick={runSetup} disabled={setupStatus === "loading"}
                className="cyber-btn-purple cyber-btn w-full py-2.5 rounded-lg text-sm disabled:opacity-40">
                <span className="flex items-center justify-center gap-2">
                  <Icon name={setupStatus === "done" ? "CheckCircle" : "Zap"} size={14} />
                  {setupStatus === "loading" ? "Подключаю..." : setupStatus === "done" ? "Подключено!" : "Подключить к Telegram"}
                </span>
              </button>
            </div>

            <div className="cyber-card rounded-xl p-4 text-xs opacity-40 text-center">
              <p>Юра v1.0 · @iris_cm_botat · 2026</p>
            </div>
          </div>
        )}

        {/* HISTORY */}
        {section === "history" && (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 animate-fade-in-up">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-oswald tracking-wide neon-text">ИСТОРИЯ</h2>
              {history.length > 0 && (
                <button
                  onClick={() => setHistory([])}
                  className="text-xs opacity-50 hover:opacity-80 transition-opacity"
                >
                  Очистить
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="cyber-card rounded-xl p-8 text-center">
                <div className="text-4xl mb-3 opacity-30">📭</div>
                <p className="text-sm opacity-40 font-oswald tracking-wide">ИСТОРИЯ ПУСТА</p>
                <p className="text-xs opacity-30 mt-1">
                  Задайте вопрос в чате — он появится здесь
                </p>
              </div>
            ) : (
              history.map((item) => (
                <div key={item.id} className="cyber-card rounded-xl p-4 neon-border border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-oswald tracking-wide opacity-40">
                      {item.time}
                    </span>
                    <button
                      onClick={() => quickQ(item.question)}
                      className="text-xs cyber-btn px-2 py-0.5 rounded"
                    >
                      Повторить
                    </button>
                  </div>
                  <p className="text-sm mb-2" style={{ color: "rgba(0,255,204,0.8)" }}>
                    ❓ {item.question}
                  </p>
                  <p className="text-xs opacity-60 line-clamp-2">💬 {item.answer}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* FEEDBACK */}
        {section === "feedback" && (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 animate-fade-in-up">
            <div className="cyber-card rounded-xl p-4 neon-border border">
              <h2 className="font-oswald tracking-wide neon-text mb-1">ОТЗЫВ РАЗРАБОТЧИКУ</h2>
              <p className="text-xs opacity-50 mb-4">
                Ваши пожелания помогают улучшить бота
              </p>

              {feedbackSent ? (
                <div className="text-center py-8">
                  <div className="text-5xl mb-3">✅</div>
                  <h3 className="font-oswald text-lg neon-text tracking-wide">ОТПРАВЛЕНО!</h3>
                  <p className="text-sm opacity-60 mt-2">Спасибо за ваш отзыв</p>
                  <button
                    onClick={() => {
                      setFeedbackSent(false);
                      setFeedback("");
                    }}
                    className="cyber-btn mt-4 px-4 py-2 rounded-lg text-sm"
                  >
                    Написать ещё
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-oswald tracking-wide opacity-60 block mb-1.5">
                      ВАШЕ СООБЩЕНИЕ
                    </label>
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      rows={5}
                      placeholder="Расскажите, что понравилось или что стоит улучшить..."
                      className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
                      style={{
                        background: "var(--dark-card)",
                        border: "1px solid var(--dark-border)",
                        color: "rgba(0,255,204,0.85)",
                        caretColor: "var(--neon-cyan)",
                      }}
                      onFocus={(e) => (e.target.style.borderColor = "var(--neon-cyan)")}
                      onBlur={(e) => (e.target.style.borderColor = "var(--dark-border)")}
                    />
                  </div>

                  <button
                    disabled={!feedback.trim()}
                    onClick={() => setFeedbackSent(true)}
                    className="cyber-btn w-full py-2.5 rounded-lg text-sm disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Icon name="Send" size={14} /> Отправить отзыв
                    </span>
                  </button>

                  <p className="text-center text-xs opacity-40">
                    Или напишите напрямую:{" "}
                    <span style={{ color: "var(--neon-purple)" }}>@iris_cm_botat</span>
                  </p>
                </div>
              )}
            </div>

            <div className="cyber-card rounded-xl p-4">
              <h3
                className="font-oswald tracking-wide text-sm mb-3"
                style={{ color: "var(--neon-purple)" }}
              >
                БЫСТРЫЕ ОЦЕНКИ
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {["🔥 Огонь", "👍 Хорошо", "😐 Норм", "👎 Плохо"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setFeedback(r)}
                    className="cyber-btn-purple cyber-btn py-2 rounded-lg text-xs text-center"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        className="text-center py-2 text-xs opacity-20 font-oswald tracking-widest"
        style={{ borderTop: "1px solid var(--dark-border)" }}
      >
        ЮРА · @iris_cm_botat · {new Date().getFullYear()}
      </footer>
    </div>
  );
}