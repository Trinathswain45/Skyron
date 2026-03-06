import { useEffect, useMemo, useRef, useState } from "react";

const FEATURES = [
  {
    title: "AI Blueprint Generation",
    description: "Turn plain prompts into service maps, deployment plans, and implementation notes.",
  },
  {
    title: "Production Stack Suggestions",
    description: "Get validated recommendations for APIs, databases, queues, and cloud runtime choices.",
  },
  {
    title: "Architecture Workspace",
    description: "Keep versions, compare outputs, and share a direct design link with your team.",
  },
];

const EXAMPLES = [
  "Event-driven ecommerce order processing on Kubernetes",
  "Multi-tenant analytics platform with isolated workloads",
  "AI document extraction pipeline with retry and DLQ strategy",
];

const PROJECT_HISTORY = ["Billing Replatform", "Media Ingestion", "Risk Scoring Service"];
const SAVED_DESIGNS = ["Kafka Retry Pattern", "Zero-Downtime Rollout", "RDS Multi-AZ Plan"];

const DEFAULT_OUTPUT = {
  architecture: `graph TD\n  UI[React Frontend] --> API[FastAPI Gateway]\n  API --> KAFKA[(Kafka Topics)]\n  KAFKA --> WORKER[Task Worker Pool]\n  WORKER --> DB[(PostgreSQL)]\n  WORKER --> OBJ[(S3 Storage)]\n  API --> MON[Prometheus + Grafana]`,
  stack: ["Frontend: React", "API: FastAPI", "Queue: Kafka", "Database: PostgreSQL", "Orchestration: Kubernetes"],
  database: `tasks(id, payload, status, result, created_at, updated_at)\ndlq_records(id, task_id, payload, attempt, error, created_at)`,
  api: `POST   /tasks\nGET    /tasks/{id}\nGET    /dlq\nGET    /dlq/{task_id}\nWS     /ws/tasks/{id}`,
  deployment: "Submit a task to the API, process it asynchronously in workers, and watch status updates in real time.",
};

const DEFAULT_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");

const toWsBaseUrl = (httpBaseUrl) => {
  if (httpBaseUrl.startsWith("https://")) return httpBaseUrl.replace(/^https:\/\//, "wss://");
  if (httpBaseUrl.startsWith("http://")) return httpBaseUrl.replace(/^http:\/\//, "ws://");
  return httpBaseUrl;
};

function Toasts({ items, onClose }) {
  return (
    <div className="toast-wrap">
      {items.map((item) => (
        <div key={item.id} className={`toast toast-${item.type}`}>
          <span>{item.message}</span>
          <button onClick={() => onClose(item.id)} aria-label="Close notification">
            x
          </button>
        </div>
      ))}
    </div>
  );
}

function CopyBlock({ label, content, onCopy }) {
  return (
    <div className="code-card">
      <div className="code-card-head">
        <strong>{label}</strong>
        <button className="ghost-btn" onClick={() => onCopy(content, `${label} copied`)}>
          Copy
        </button>
      </div>
      <pre>{content}</pre>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState("light");
  const [screen, setScreen] = useState("landing");
  const [projectName, setProjectName] = useState("Skyron Production Architecture");
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState([]);
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE_URL);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingDlq, setIsLoadingDlq] = useState(false);
  const [activeTab, setActiveTab] = useState("architecture");
  const [output, setOutput] = useState(DEFAULT_OUTPUT);
  const [versions, setVersions] = useState(["v1 - Initial Draft"]);
  const [toasts, setToasts] = useState([]);
  const [shareOpen, setShareOpen] = useState(false);

  const [currentTaskId, setCurrentTaskId] = useState(null);
  const [currentTaskStatus, setCurrentTaskStatus] = useState("IDLE");
  const [dlqRecords, setDlqRecords] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef(null);
  const pollTimerRef = useRef(null);

  const charCount = prompt.length;
  const maxChars = 2000;
  const canGenerate = prompt.trim().length > 0 && !isGenerating;

  const shareLink = useMemo(() => {
    return `https://skyron.app/design/${projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  }, [projectName]);

  const pushToast = (message, type = "info") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 2800);
  };

  const closeToast = (id) => setToasts((prev) => prev.filter((item) => item.id !== id));

  const copyText = async (text, message = "Copied") => {
    try {
      await navigator.clipboard.writeText(text);
      pushToast(message, "success");
    } catch {
      pushToast("Clipboard access blocked", "error");
    }
  };

  const stopRealtimeTracking = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setWsConnected(false);
  };

  const refreshDlq = async () => {
    setIsLoadingDlq(true);
    try {
      const response = await fetch(`${apiBaseUrl}/dlq?limit=20`);
      if (!response.ok) {
        throw new Error(`DLQ request failed (${response.status})`);
      }
      const records = await response.json();
      setDlqRecords(records);
    } catch (error) {
      pushToast(error.message || "Failed to load DLQ", "error");
    } finally {
      setIsLoadingDlq(false);
    }
  };

  const handleTerminalTaskState = (task) => {
    if (task.status === "COMPLETED") {
      const resultText = task.result || "Task completed";
      setOutput((prev) => ({
        ...prev,
        architecture: resultText,
        deployment: `Task #${task.id} completed successfully for "${projectName}".`,
      }));
      setIsGenerating(false);
      setVersions((prev) => [`v${prev.length + 1} - Task #${task.id} completed`, ...prev]);
      pushToast(`Task #${task.id} completed`, "success");
      stopRealtimeTracking();
      return;
    }

    if (task.status === "FAILED") {
      setOutput((prev) => ({
        ...prev,
        deployment: `Task #${task.id} failed: ${task.result || "Unknown error"}`,
      }));
      setIsGenerating(false);
      setVersions((prev) => [`v${prev.length + 1} - Task #${task.id} failed`, ...prev]);
      pushToast(`Task #${task.id} failed`, "error");
      stopRealtimeTracking();
      refreshDlq();
    }
  };

  const onTaskSnapshot = (task) => {
    if (!task) return;
    setCurrentTaskStatus(task.status || "UNKNOWN");
    if (task.status === "COMPLETED" || task.status === "FAILED") {
      handleTerminalTaskState(task);
    }
  };

  const startPolling = (taskId) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/tasks/${taskId}`);
        if (!response.ok) return;
        const task = await response.json();
        onTaskSnapshot(task);
      } catch {
        // No-op: keep trying while task is running.
      }
    }, 1500);
  };

  const trackTaskRealtime = (taskId) => {
    stopRealtimeTracking();
    const wsUrl = `${toWsBaseUrl(apiBaseUrl)}/ws/tasks/${taskId}`;

    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setWsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onTaskSnapshot(data);
        } catch {
          pushToast("Received invalid status event", "error");
        }
      };

      socket.onerror = () => {
        setWsConnected(false);
        if (isGenerating) startPolling(taskId);
      };

      socket.onclose = () => {
        setWsConnected(false);
        if (isGenerating) startPolling(taskId);
      };
    } catch {
      startPolling(taskId);
    }
  };

  const onGenerate = async () => {
    if (!canGenerate) return;
    setIsGenerating(true);
    setCurrentTaskStatus("PENDING");
    pushToast("Submitting task...", "info");

    try {
      const response = await fetch(`${apiBaseUrl}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: prompt }),
      });

      if (!response.ok) {
        throw new Error(`Task submission failed (${response.status})`);
      }

      const task = await response.json();
      setCurrentTaskId(task.id);
      setCurrentTaskStatus(task.status || "PENDING");
      setOutput((prev) => ({
        ...prev,
        deployment: `Task #${task.id} submitted for "${projectName}" with ${files.length} attachment(s).`,
      }));
      setVersions((prev) => [`v${prev.length + 1} - Task #${task.id} submitted`, ...prev]);
      setActiveTab("architecture");
      pushToast(`Task #${task.id} created`, "success");
      trackTaskRealtime(task.id);
    } catch (error) {
      setIsGenerating(false);
      setCurrentTaskStatus("FAILED");
      pushToast(error.message || "Failed to submit task", "error");
    }
  };

  const onNewProject = () => {
    setProjectName("New Skyron Project");
    setPrompt("");
    setFiles([]);
    setVersions(["v1 - Initial Draft"]);
    setOutput(DEFAULT_OUTPUT);
    setActiveTab("architecture");
    setCurrentTaskId(null);
    setCurrentTaskStatus("IDLE");
    stopRealtimeTracking();
    pushToast("New project started", "info");
  };

  const onFileChange = (event) => {
    const selected = Array.from(event.target.files || []);
    setFiles(selected);
  };

  const downloadPdf = () => {
    pushToast("Export started (mock)", "info");
  };

  useEffect(() => {
    refreshDlq();
  }, []);

  useEffect(() => {
    return () => stopRealtimeTracking();
  }, []);

  const tabContent = {
    architecture: <CopyBlock label="Task Output" content={output.architecture} onCopy={copyText} />,
    stack: (
      <div className="panel-card">
        <h3>Tech Stack Suggestions</h3>
        <ul className="clean-list">
          {output.stack.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    ),
    database: <CopyBlock label="Database Schema" content={output.database} onCopy={copyText} />,
    api: <CopyBlock label="API Structure" content={output.api} onCopy={copyText} />,
    deploy: (
      <div className="panel-card">
        <h3>Deployment Suggestions</h3>
        <p>{output.deployment}</p>
      </div>
    ),
  };

  return (
    <div className={`app theme-${theme}`}>
      <Toasts items={toasts} onClose={closeToast} />

      <header className="top-nav">
        <div className="brand">
          <span className="brand-dot" />
          <div>
            <strong>Skyron</strong>
            <small>Architecture Studio</small>
          </div>
        </div>
        <nav>
          <button className="ghost-btn" onClick={() => setScreen("landing")}>Landing</button>
          <button className="ghost-btn" onClick={() => setScreen("dashboard")}>Dashboard</button>
          <button className="ghost-btn" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
            {theme === "light" ? "Dark" : "Light"}
          </button>
          <button className="profile-btn">HP</button>
          <button className="ghost-btn">Logout</button>
        </nav>
      </header>

      {screen === "landing" ? (
        <main className="landing">
          <section className="hero">
            <p className="pill">Cloud-Native Real-Time Task Processing Platform</p>
            <h1>Design production architecture in minutes.</h1>
            <p>
              Upload context, write your requirements, and generate a complete system blueprint with stack, schema,
              APIs, and deployment strategy.
            </p>
            <div className="hero-actions">
              <button className="primary-btn" onClick={() => setScreen("dashboard")}>Generate Architecture</button>
              <button className="ghost-btn" onClick={() => pushToast("Demo loaded", "info")}>View Demo Output</button>
            </div>
          </section>

          <section className="feature-grid">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="feature-card">
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </section>

          <section className="examples">
            <h2>Example prompts</h2>
            <div className="example-list">
              {EXAMPLES.map((example) => (
                <button key={example} className="example-chip" onClick={() => { setScreen("dashboard"); setPrompt(example); }}>
                  {example}
                </button>
              ))}
            </div>
            <button className="primary-btn" onClick={() => setScreen("dashboard")}>Start Building</button>
          </section>
        </main>
      ) : (
        <main className="dashboard">
          <aside className="sidebar">
            <button className="primary-btn full" onClick={onNewProject}>+ New Project</button>

            <div className="side-block">
              <h4>Project History</h4>
              {PROJECT_HISTORY.map((item) => (
                <button key={item} className="side-item">{item}</button>
              ))}
            </div>

            <div className="side-block">
              <h4>Saved Designs</h4>
              {SAVED_DESIGNS.map((item) => (
                <button key={item} className="side-item">{item}</button>
              ))}
            </div>

            <div className="side-block">
              <h4>Settings</h4>
              <button className="side-item">Workspace</button>
              <button className="side-item">Billing</button>
              <button className="side-item">Team Access</button>
            </div>
          </aside>

          <section className="workarea">
            <div className="panel-card">
              <h2>Project Input</h2>
              <label>
                Project Name
                <input value={projectName} onChange={(e) => setProjectName(e.target.value)} />
              </label>

              <label>
                Backend API URL
                <input value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value.replace(/\/+$/, ""))} />
              </label>

              <label>
                Architecture Prompt
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value.slice(0, maxChars))}
                  placeholder="Describe system goals, scale, SLAs, data flow, security requirements..."
                  rows={6}
                />
                <small>{charCount}/{maxChars}</small>
              </label>

              <label>
                Attach Files (PDF / DOC / ZIP)
                <input type="file" multiple accept=".pdf,.doc,.docx,.zip" onChange={onFileChange} />
              </label>

              {files.length > 0 && (
                <ul className="clean-list">
                  {files.map((file) => (
                    <li key={file.name}>{file.name}</li>
                  ))}
                </ul>
              )}

              <div className="row-actions">
                <button className="primary-btn" disabled={!canGenerate} onClick={onGenerate}>
                  {isGenerating ? <span className="spinner" aria-hidden="true" /> : null}
                  {isGenerating ? "Generating..." : "Generate"}
                </button>
                <button className="ghost-btn" onClick={onGenerate}>Regenerate</button>
                <button className="ghost-btn" onClick={downloadPdf}>Download PDF</button>
                <button className="ghost-btn" onClick={refreshDlq} disabled={isLoadingDlq}>
                  {isLoadingDlq ? "Refreshing DLQ..." : "Refresh DLQ"}
                </button>
              </div>

              <p>
                Task: {currentTaskId ? `#${currentTaskId}` : "N/A"} | Status: {currentTaskStatus}
                {" "} | Transport: {wsConnected ? "WebSocket" : "Polling/Idle"}
              </p>
            </div>

            <div className="panel-card">
              <div className="panel-head">
                <h2>Generated Output</h2>
                <div className="row-actions">
                  <button className="ghost-btn" onClick={() => pushToast("Edit mode coming next", "info")}>Edit</button>
                  <button className="ghost-btn" onClick={() => setShareOpen(true)}>Share</button>
                </div>
              </div>

              <div className="tab-row">
                {[
                  ["architecture", "Architecture"],
                  ["stack", "Tech Stack"],
                  ["database", "Database"],
                  ["api", "APIs"],
                  ["deploy", "Deployment"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    className={activeTab === id ? "tab active" : "tab"}
                    onClick={() => setActiveTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tabContent[activeTab]}
            </div>

            <div className="panel-card">
              <h3>Version History</h3>
              <ul className="clean-list">
                {versions.map((version) => (
                  <li key={version}>{version}</li>
                ))}
              </ul>
            </div>

            <div className="panel-card">
              <h3>Dead Letter Queue</h3>
              {dlqRecords.length === 0 ? (
                <p>No DLQ records.</p>
              ) : (
                <ul className="clean-list">
                  {dlqRecords.map((record) => (
                    <li key={record.id}>
                      #{record.task_id} | attempt {record.attempt} | {record.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </main>
      )}

      {shareOpen && (
        <div className="modal-backdrop" onClick={() => setShareOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>Share Architecture</h3>
            <p>Anyone with this link can view this design snapshot.</p>
            <input value={shareLink} readOnly />
            <div className="row-actions">
              <button className="primary-btn" onClick={() => copyText(shareLink, "Share link copied")}>Copy Link</button>
              <button className="ghost-btn" onClick={() => setShareOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
