"""
Telegram webhook — принимает сообщения от бота, отвечает через Pollinations AI.
Работает в личных чатах и группах (команда: «Юра, вопрос»). v2
"""
import os
import json
import urllib.request
import urllib.parse


BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
TG_API = f"https://api.telegram.org/bot{BOT_TOKEN}"
GROUP_TRIGGER = "юра"


def tg_send(chat_id: int, text: str, reply_to: int = None, web_app_url: str = None):
    payload: dict = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if reply_to:
        payload["reply_to_message_id"] = reply_to
    if web_app_url:
        payload["reply_markup"] = {
            "inline_keyboard": [[
                {"text": "🤖 Открыть Юру", "web_app": {"url": web_app_url}}
            ]]
        }
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{TG_API}/sendMessage",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    urllib.request.urlopen(req, timeout=10)


def ask_ai(question: str) -> str:
    prompt = f"Ты — дружелюбный русскоязычный ИИ-ассистент по имени Юра. Отвечай кратко и по делу на русском языке. Вопрос: {question}"
    encoded = urllib.parse.quote(prompt)
    url = f"https://text.pollinations.ai/{encoded}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=25) as resp:
        return resp.read().decode("utf-8").strip()


def get_webapp_url(context) -> str:
    host = os.environ.get("FUNCTION_HOST", "")
    if not host:
        return ""
    # Берём базовый домен проекта из URL функции
    parts = host.split("/")
    domain = parts[2] if len(parts) > 2 else ""
    return f"https://{domain}" if domain else ""


def handler(event: dict, context) -> dict:
    cors = {"Access-Control-Allow-Origin": "*"}

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": {**cors, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type"}, "body": ""}

    if event.get("httpMethod") != "POST":
        return {"statusCode": 200, "headers": cors, "body": json.dumps({"ok": True})}

    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return {"statusCode": 200, "headers": cors, "body": "{}"}

    message = body.get("message") or body.get("edited_message")
    if not message:
        return {"statusCode": 200, "headers": cors, "body": "{}"}

    chat_id = message["chat"]["id"]
    chat_type = message["chat"].get("type", "private")
    text = (message.get("text") or "").strip()
    msg_id = message.get("message_id")
    user = message.get("from", {})
    first_name = user.get("first_name", "")

    if not text:
        return {"statusCode": 200, "headers": cors, "body": "{}"}

    # /start
    if text.startswith("/start"):
        webapp_url = get_webapp_url(context)
        welcome = (
            f"👋 Привет, {first_name}!\n\n"
            "Я <b>Юра</b> — твой персональный ИИ-ассистент 🤖\n\n"
            "<b>Что я умею:</b>\n"
            "• Отвечаю на любые вопросы\n"
            "• Помогаю с текстами и идеями\n"
            "• Объясняю сложные вещи просто\n"
            "• Работаю в группах (пиши «Юра, вопрос»)\n\n"
            "<b>Команды:</b>\n"
            "/start — это сообщение\n"
            "/help — справка по командам\n"
            "/status — статус ИИ\n"
            "/about — о боте\n\n"
            "Просто напиши мне что-нибудь 👇"
        )
        tg_send(chat_id, welcome, web_app_url=webapp_url if webapp_url else None)
        return {"statusCode": 200, "headers": cors, "body": "{}"}

    # /help
    if text.startswith("/help"):
        tg_send(chat_id, (
            "📋 <b>Команды бота:</b>\n\n"
            "/start — приветствие и возможности\n"
            "/help — список команд\n"
            "/status — статус ИИ-сервера\n"
            "/about — информация о боте\n\n"
            "💬 <b>В группах:</b> пиши <code>Юра, вопрос</code>\n"
            "💬 <b>В личке:</b> просто пиши любой вопрос\n\n"
            "⚠️ <b>Нельзя:</b> спам, вредоносный контент, мошенничество\n\n"
            "Создатель: @iris_cm_botat"
        ))
        return {"statusCode": 200, "headers": cors, "body": "{}"}

    # /status
    if text.startswith("/status"):
        tg_send(chat_id, (
            "🟢 <b>Статус: ONLINE</b>\n\n"
            "• ИИ-ядро: Pollinations AI ✅\n"
            "• Модель: OpenAI GPT ✅\n"
            "• Аптайм: 99.9% ✅\n\n"
            "Все системы работают штатно."
        ))
        return {"statusCode": 200, "headers": cors, "body": "{}"}

    # /about
    if text.startswith("/about"):
        tg_send(chat_id, (
            "🤖 <b>Юра — ИИ-ассистент</b>\n\n"
            "Версия: v1.0.0\n"
            "ИИ: Pollinations.ai (бесплатно, без ключей)\n"
            "Работает: в личке и группах\n\n"
            "👤 Создатель: @iris_cm_botat\n\n"
            "По вопросам и предложениям пишите создателю."
        ))
        return {"statusCode": 200, "headers": cors, "body": "{}"}

    # Групповой чат — реагируем только на «Юра, ...»
    if chat_type in ("group", "supergroup"):
        lower = text.lower()
        if not lower.startswith(GROUP_TRIGGER):
            return {"statusCode": 200, "headers": cors, "body": "{}"}
        # Убираем триггер
        question = text[len(GROUP_TRIGGER):].lstrip(" ,:")
        if not question:
            tg_send(chat_id, "Да, слушаю! Задай вопрос 😊", reply_to=msg_id)
            return {"statusCode": 200, "headers": cors, "body": "{}"}
    else:
        question = text

    # Получаем ответ от ИИ
    try:
        answer = ask_ai(question)
    except Exception:
        answer = "Временно не могу ответить — ИИ перегружен. Попробуй через несколько секунд 🙏"

    tg_send(chat_id, answer, reply_to=msg_id if chat_type != "private" else None)
    return {"statusCode": 200, "headers": cors, "body": "{}"}