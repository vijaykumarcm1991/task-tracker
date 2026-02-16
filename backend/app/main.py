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
from .discord import send_discord_message

app = FastAPI()

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
    send_discord_message(
        f"🆕 Task Created\n📌 Title: {new_task.title}\n⚡ Priority: {new_task.priority.value}"
    )
    return new_task

@app.put("/tasks/{task_id}/status")
def update_status(task_id: int, data: TaskUpdateStatus, db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.status = data.status
    db.commit()
    send_discord_message(
        f"🔄 Task Updated: **{task.title}** → Status changed to **{task.status.value}**"
    )
    return {"message": "Status updated"}

@app.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task_title = task.title
    db.delete(task)
    db.commit()
    send_discord_message(
        f"🗑️ Task Deleted: **{task_title}**"
    )
    return {"message": "Task deleted"}

@app.put("/tasks/{task_id}")
def update_task(task_id: int, data: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    for key, value in data.dict(exclude_unset=True).items():
        setattr(task, key, value)

    db.commit()
    db.refresh(task)
    return task

# Serve Frontend
app.mount("/", StaticFiles(directory="app/static", html=True), name="static")

