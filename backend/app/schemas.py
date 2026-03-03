from datetime import datetime

from pydantic import BaseModel


class TaskCreate(BaseModel):
    payload: str


class TaskResponse(BaseModel):
    id: int
    payload: str
    status: str
    result: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DlqRecordResponse(BaseModel):
    id: int
    task_id: int
    payload: str
    attempt: int
    error: str
    created_at: datetime

    class Config:
        from_attributes = True
