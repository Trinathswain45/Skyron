import { useEffect, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function isTerminal(status) {
  return status === "COMPLETED" || status === "FAILED";
}

export default function App() {
  const [payload, setPayload] = useState("");
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const wsRef = useRef(null);

  const submitTask = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      const data = await res.json();
      setTask(data);
      setPayload("");
    } finally {
      setLoading(false);
    }
  };

  const refreshTask = async (taskId) => {
    if (!taskId) return;
    const res = await fetch(`${API_BASE}/tasks/${taskId}`);
    const data = await res.json();
    setTask(data);
  };

  useEffect(() => {
    if (!task?.id || isTerminal(task.status)) {
      return;
    }

    const wsUrl = `${API_BASE.replace("http", "ws")}/ws/tasks/${task.id}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setSocketConnected(true);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (!data.error) {
        setTask((current) => (current?.id === data.id ? { ...current, ...data } : current));
      }
    };
    ws.onerror = () => setSocketConnected(false);
    ws.onclose = () => setSocketConnected(false);

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [task?.id]);

  useEffect(() => {
    if (!task?.id || isTerminal(task.status) || socketConnected) {
      return;
    }

    const interval = setInterval(() => {
      refreshTask(task.id);
    }, 2000);

    return () => clearInterval(interval);
  }, [task?.id, task?.status, socketConnected]);

  return (
    <main style={{ fontFamily: "sans-serif", margin: "2rem", maxWidth: 720 }}>
      <h1>Skyron</h1>
      <p>Submit a task and track status in real time.</p>

      <form onSubmit={submitTask} style={{ display: "grid", gap: "0.5rem" }}>
        <input
          placeholder="Enter task payload"
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Submitting..." : "Submit Task"}
        </button>
      </form>

      {task && (
        <section style={{ marginTop: "1.5rem" }}>
          <h2>Task #{task.id}</h2>
          <p>Status: {task.status}</p>
          <p>Result: {task.result ?? "-"}</p>
          <p>Realtime channel: {socketConnected ? "WebSocket" : "Polling fallback"}</p>
          <button onClick={() => refreshTask(task.id)}>Refresh Now</button>
        </section>
      )}
    </main>
  );
}
