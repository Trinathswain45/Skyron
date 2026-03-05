import json
import os
import time
import enum
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Enum, Integer, Text, create_engine
from sqlalchemy.orm import Mapped, Session, declarative_base, mapped_column

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://skyron:skyron@localhost:5432/skyron")
KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
KAFKA_TASKS_TOPIC = os.getenv("KAFKA_TASKS_TOPIC", "skyron.tasks")
KAFKA_RETRY_TOPIC = os.getenv("KAFKA_RETRY_TOPIC", "skyron.tasks.retry")
KAFKA_DLQ_TOPIC = os.getenv("KAFKA_DLQ_TOPIC", "skyron.tasks.dlq")
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))
RETRY_BASE_SECONDS = int(os.getenv("RETRY_BASE_SECONDS", "2"))

Base = declarative_base()


class TaskStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    payload: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[TaskStatus] = mapped_column(Enum(TaskStatus), nullable=False)
    result: Mapped[str | None] = mapped_column(Text, nullable=True)


class DlqRecord(Base):
    __tablename__ = "dlq_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    task_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    payload: Mapped[str] = mapped_column(Text, nullable=False)
    attempt: Mapped[int] = mapped_column(Integer, nullable=False)
    error: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


def process(payload: str) -> str:
    # Demo error path: payloads starting with "fail:" simulate processing failures.
    if payload.startswith("fail:"):
        raise ValueError("Simulated task failure")
    return payload.upper()


def publish(producer: Any, topic: str, data: dict) -> None:
    producer.send(topic, data)
    producer.flush()


def main():
    from kafka import KafkaConsumer, KafkaProducer

    engine = create_engine(DATABASE_URL, pool_pre_ping=True)

    consumer = KafkaConsumer(
        KAFKA_TASKS_TOPIC,
        KAFKA_RETRY_TOPIC,
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        auto_offset_reset="earliest",
        enable_auto_commit=True,
        group_id="skyron-workers",
        value_deserializer=lambda m: json.loads(m.decode("utf-8")),
    )

    producer = KafkaProducer(
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        value_serializer=lambda v: json.dumps(v).encode("utf-8"),
    )

    print("Worker started. Listening for tasks and retries...")

    for message in consumer:
        data = message.value
        task_id = data.get("task_id")
        payload = data.get("payload", "")
        attempt = int(data.get("attempt", 0))

        with Session(engine) as db:
            task = db.get(Task, task_id)
            if not task:
                continue

            try:
                task.status = TaskStatus.PROCESSING
                db.commit()

                time.sleep(2)
                output = process(payload)

                task.status = TaskStatus.COMPLETED
                task.result = output
                db.commit()
            except Exception as exc:
                if attempt < MAX_RETRIES:
                    next_attempt = attempt + 1
                    backoff_seconds = RETRY_BASE_SECONDS ** next_attempt
                    task.status = TaskStatus.PENDING
                    task.result = (
                        f"Retry scheduled ({next_attempt}/{MAX_RETRIES}) in {backoff_seconds}s after error: {exc}"
                    )
                    db.commit()
                    time.sleep(backoff_seconds)
                    publish(
                        producer,
                        KAFKA_RETRY_TOPIC,
                        {"task_id": task_id, "payload": payload, "attempt": next_attempt},
                    )
                else:
                    task.status = TaskStatus.FAILED
                    task.result = f"Max retries exceeded: {exc}"
                    db.add(
                        DlqRecord(
                            task_id=task_id,
                            payload=payload,
                            attempt=attempt,
                            error=str(exc),
                        )
                    )
                    db.commit()
                    publish(
                        producer,
                        KAFKA_DLQ_TOPIC,
                        {
                            "task_id": task_id,
                            "payload": payload,
                            "attempt": attempt,
                            "error": str(exc),
                        },
                    )


if __name__ == "__main__":
    main()
