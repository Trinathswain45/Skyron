from app.models import TaskStatus


def test_task_status_enum_values():
    assert TaskStatus.PENDING.value == "PENDING"
    assert TaskStatus.PROCESSING.value == "PROCESSING"
    assert TaskStatus.COMPLETED.value == "COMPLETED"
    assert TaskStatus.FAILED.value == "FAILED"
