import json

from kafka import KafkaProducer

from .config import KAFKA_BOOTSTRAP_SERVERS, KAFKA_TASKS_TOPIC


class TaskProducer:
    def __init__(self):
        self.topic = KAFKA_TASKS_TOPIC
        self._producer = KafkaProducer(
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
        )

    def publish_task(self, task_id: int, payload: str, attempt: int = 0) -> None:
        self._producer.send(self.topic, {"task_id": task_id, "payload": payload, "attempt": attempt})
        self._producer.flush()
