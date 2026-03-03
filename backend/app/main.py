import asyncio
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .db import Base, SessionLocal, engine, get_db
from .kafka_client import TaskProducer
from .models import DlqRecord, Task, TaskStatus
from .schemas import DlqRecordResponse, TaskCreate, TaskResponse

producer = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global producer
    Base.metadata.create_all(bind=engine)
    producer = TaskProducer()
    yield


app = FastAPI(title="Skyron API", version="0.3.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/tasks", response_model=TaskResponse)
def create_task(task_in: TaskCreate, db: Session = Depends(get_db)):
    task = Task(payload=task_in.payload, status=TaskStatus.PENDING)
    db.add(task)
    db.commit()
    db.refresh(task)

    try:
        producer.publish_task(task.id, task.payload, attempt=0)
    except Exception as exc:
        task.status = TaskStatus.FAILED
        task.result = f"Kafka publish failed: {exc}"
        db.commit()
        db.refresh(task)

    return task


@app.get("/tasks/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@app.get("/dlq", response_model=list[DlqRecordResponse])
def list_dlq(limit: int = 50, db: Session = Depends(get_db)):
    safe_limit = min(max(limit, 1), 500)
    rows = db.query(DlqRecord).order_by(DlqRecord.created_at.desc()).limit(safe_limit).all()
    return rows


@app.get("/dlq/{task_id}", response_model=list[DlqRecordResponse])
def get_dlq_by_task(task_id: int, db: Session = Depends(get_db)):
    rows = db.query(DlqRecord).filter(DlqRecord.task_id == task_id).order_by(DlqRecord.created_at.desc()).all()
    return rows


@app.websocket("/ws/tasks/{task_id}")
async def task_status_ws(websocket: WebSocket, task_id: int):
    await websocket.accept()
    last_snapshot = None

    try:
        while True:
            with SessionLocal() as db:
                task = db.get(Task, task_id)
                if not task:
                    await websocket.send_json({"error": "Task not found"})
                    await websocket.close(code=1008)
                    return

                snapshot = {
                    "id": task.id,
                    "payload": task.payload,
                    "status": task.status.value,
                    "result": task.result,
                }
                if snapshot != last_snapshot:
                    await websocket.send_json(snapshot)
                    last_snapshot = snapshot

                if task.status in {TaskStatus.COMPLETED, TaskStatus.FAILED}:
                    await websocket.close()
                    return

            await asyncio.sleep(1)
    except WebSocketDisconnect:
        return
