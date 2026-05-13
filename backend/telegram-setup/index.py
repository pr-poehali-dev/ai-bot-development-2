"""
Настройка Telegram-бота: регистрация webhook и установка кнопки мини-приложения. v2
Вызывается один раз после деплоя.
"""
import os
import json
import urllib.request


BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
TG_API = f"https://api.telegram.org/bot{BOT_TOKEN}"


def tg_call(method: str, payload: dict) -> dict:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{TG_API}/{method}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


def handler(event: dict, context) -> dict:
    cors = {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": {**cors, "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type"}, "body": ""}

    body = {}
    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        pass

    webhook_url = body.get("webhook_url", "")
    webapp_url = body.get("webapp_url", "")

    results = {}

    # Регистрируем webhook
    if webhook_url:
        res = tg_call("setWebhook", {
            "url": webhook_url,
            "allowed_updates": ["message", "edited_message", "callback_query"],
            "drop_pending_updates": True,
        })
        results["webhook"] = res

    # Устанавливаем кнопку меню с мини-приложением
    if webapp_url:
        res = tg_call("setChatMenuButton", {
            "menu_button": {
                "type": "web_app",
                "text": "🤖 Открыть Юру",
                "web_app": {"url": webapp_url},
            }
        })
        results["menu_button"] = res

    # Устанавливаем команды бота
    res = tg_call("setMyCommands", {
        "commands": [
            {"command": "start", "description": "Запустить бота"},
            {"command": "help", "description": "Справка по командам"},
            {"command": "status", "description": "Статус ИИ"},
            {"command": "about", "description": "О боте"},
        ]
    })
    results["commands"] = res

    # Получаем инфо о боте
    try:
        me = tg_call("getMe", {})
        results["bot_info"] = me.get("result", {})
    except Exception as e:
        results["bot_info"] = {"error": str(e)}

    return {
        "statusCode": 200,
        "headers": cors,
        "body": json.dumps({"ok": True, "results": results}),
    }