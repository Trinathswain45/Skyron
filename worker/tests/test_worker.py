import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[2] / "worker"))

from worker import process


def test_worker_process_uppercases_payload():
    assert process("hello") == "HELLO"


def test_worker_process_simulated_failure():
    try:
        process("fail:test")
        assert False, "Expected ValueError"
    except ValueError as exc:
        assert "Simulated task failure" in str(exc)
