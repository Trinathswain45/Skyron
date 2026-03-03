import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://skyron:skyron@localhost:5432/skyron")
KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
KAFKA_TASKS_TOPIC = os.getenv("KAFKA_TASKS_TOPIC", "skyron.tasks")
KAFKA_RETRY_TOPIC = os.getenv("KAFKA_RETRY_TOPIC", "skyron.tasks.retry")
KAFKA_DLQ_TOPIC = os.getenv("KAFKA_DLQ_TOPIC", "skyron.tasks.dlq")
