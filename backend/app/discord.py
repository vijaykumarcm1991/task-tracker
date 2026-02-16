import os
import requests
from datetime import datetime

WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL")

# Priority → Discord Color Mapping
PRIORITY_COLORS = {
    "HIGH": 15158332,      # Red
    "MEDIUM": 16776960,    # Yellow
    "LOW": 3066993         # Green
}

STATUS_COLORS = {
    "OPEN": 3447003,        # Blue
    "IN_PROGRESS": 16776960,
    "BLOCKED": 15158332,
    "CLOSED": 3066993
}

def send_task_created(task):
    if not WEBHOOK_URL:
        return

    payload = {
        "embeds": [
            {
                "title": "🆕 Task Created",
                "color": PRIORITY_COLORS.get(task.priority.value, 3447003),
                "fields": [
                    {"name": "Title", "value": task.title, "inline": False},
                    {"name": "Priority", "value": task.priority.value, "inline": False},
                    {"name": "Due Date", "value": str(task.due_date) if task.due_date else "Not Set", "inline": False}
                ],
                "timestamp": datetime.utcnow().isoformat()
            }
        ]
    }

    requests.post(WEBHOOK_URL, json=payload)


def send_status_update(task):
    if not WEBHOOK_URL:
        return

    payload = {
        "embeds": [
            {
                "title": "🔄 Task Status Updated",
                "color": STATUS_COLORS.get(task.status.value, 3447003),
                "fields": [
                    {"name": "Title", "value": task.title, "inline": False},
                    {"name": "New Status", "value": task.status.value, "inline": True}
                ],
                "timestamp": datetime.utcnow().isoformat()
            }
        ]
    }

    requests.post(WEBHOOK_URL, json=payload)


def send_task_deleted(title):
    if not WEBHOOK_URL:
        return

    payload = {
        "embeds": [
            {
                "title": "🗑️ Task Deleted",
                "color": 9807270,  # Gray
                "fields": [
                    {"name": "Title", "value": title, "inline": False}
                ],
                "timestamp": datetime.utcnow().isoformat()
            }
        ]
    }

    requests.post(WEBHOOK_URL, json=payload)