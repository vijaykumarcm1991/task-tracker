from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from .database import engine, SessionLocal
from . import models
import time
from sqlalchemy.exc import OperationalError
from datetime import date
from .discord import send_task_created, send_status_update, send_task_deleted
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
from .discord import send_overdue_alert

app = FastAPI()

scheduler = BackgroundScheduler(timezone="Asia/Kolkata")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Schemas
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    priority: Optional[str] = "MEDIUM"
    due_date: Optional[date] = None

class TaskUpdateStatus(BaseModel):
    status: str

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[date] = None
    status: Optional[str] = None

# Routes

@app.on_event("startup")
def startup():
    for i in range(10):
        try:
            models.Base.metadata.create_all(bind=engine)
            print("✅ Database ready & tables created")
            break
        except OperationalError:
            print("⏳ Waiting for MySQL to finish full startup...")
            time.sleep(5)
    else:
        raise Exception("❌ Database not ready after retries")

    if not scheduler.running:
        scheduler.add_job(check_overdue_tasks, "interval", minutes=5)

        scheduler.add_job(
            send_daily_summary,
            trigger="cron",
            hour=9,
            minute=0
        )

        scheduler.start()
        print("⏰ Scheduler started (overdue + daily summary)")

@app.get("/tasks")
def get_tasks(db: Session = Depends(get_db)):
    return db.query(models.Task).all()

@app.post("/tasks")
def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    new_task = models.Task(
        title=task.title,
        description=task.description,
        priority=task.priority,
        due_date=task.due_date
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    send_task_created(new_task)
    return new_task

@app.put("/tasks/{task_id}/status")
def update_status(task_id: int, data: TaskUpdateStatus, db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.status = data.status
    db.commit()
    send_status_update(task)
    return {"message": "Status updated"}

@app.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task_title = task.title
    db.delete(task)
    db.commit()
    send_task_deleted(task_title)
    return {"message": "Task deleted"}

@app.put("/tasks/{task_id}")
def update_task(task_id: int, data: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    for key, value in data.dict(exclude_unset=True).items():
        setattr(task, key, value)

    # 🔥 Reset overdue flag if due_date changed
    if "due_date" in data.dict(exclude_unset=True):
        task.overdue_notified = False

    db.commit()
    db.refresh(task)
    return task

def check_overdue_tasks():
    db = SessionLocal()
    try:
        today = datetime.utcnow().date()

        overdue_tasks = db.query(models.Task).filter(
            models.Task.due_date != None,
            models.Task.due_date < today,
            models.Task.status != models.StatusEnum.CLOSED,
            models.Task.overdue_notified == False
        ).all()

        for task in overdue_tasks:
            send_overdue_alert(task)
            task.overdue_notified = True

        db.commit()

    finally:
        db.close()

def send_daily_summary():
    db = SessionLocal()
    try:
        open_count = db.query(models.Task).filter(
            models.Task.status == models.StatusEnum.OPEN
        ).count()

        in_progress_count = db.query(models.Task).filter(
            models.Task.status == models.StatusEnum.IN_PROGRESS
        ).count()

        blocked_count = db.query(models.Task).filter(
            models.Task.status == models.StatusEnum.BLOCKED
        ).count()

        closed_count = db.query(models.Task).filter(
            models.Task.status == models.StatusEnum.CLOSED
        ).count()

        today = datetime.utcnow().date()

        overdue_count = db.query(models.Task).filter(
            models.Task.due_date != None,
            models.Task.due_date < today,
            models.Task.status != models.StatusEnum.CLOSED
        ).count()

        from .discord import WEBHOOK_URL
        import requests

        payload = {
            "embeds": [
                {
                    "title": "📊 Daily Task Summary",
                    "color": 3447003,
                    "fields": [
                        {"name": "Open", "value": str(open_count), "inline": True},
                        {"name": "In Progress", "value": str(in_progress_count), "inline": True},
                        {"name": "Blocked", "value": str(blocked_count), "inline": True},
                        {"name": "Closed", "value": str(closed_count), "inline": True},
                        {"name": "Overdue", "value": str(overdue_count), "inline": True}
                    ],
                    "timestamp": datetime.utcnow().isoformat()
                }
            ]
        }

        if WEBHOOK_URL:
            requests.post(WEBHOOK_URL, json=payload)

        print("📊 Daily summary sent")

    finally:
        db.close()

# Serve Frontend
app.mount("/", StaticFiles(directory="app/static", html=True), name="static")

