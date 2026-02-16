import os
import requests

WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL")

def send_discord_message(message: str):
    if not WEBHOOK_URL:
        return

    payload = {
        "content": message
    }

    try:
        requests.post(WEBHOOK_URL, json=payload)
    except Exception as e:
        print("Discord notification failed:", e)