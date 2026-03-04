import { useMemo, useState } from "react";

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
  stack: ["Frontend: Next.js + TypeScript", "API: FastAPI", "Queue: Kafka", "Database: PostgreSQL", "Orchestration: Kubernetes (EKS)"],
  database: `users(id, email, role, created_at)\ntasks(id, user_id, priority, status, input_ref, output_ref, created_at)\njob_events(id, task_id, event_type, message, created_at)`,
  api: `POST   /api/v1/tasks\nGET    /api/v1/tasks/{id}\nGET    /api/v1/tasks/{id}/events\nPOST   /api/v1/tasks/{id}/cancel\nGET    /api/v1/metrics`,
  deployment: "Deploy on EKS with HPA for API/worker pods, RDS PostgreSQL in private subnets, ALB ingress with TLS, and CI image promotion by environment.",
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState("architecture");
  const [output, setOutput] = useState(DEFAULT_OUTPUT);
  const [versions, setVersions] = useState(["v1 - Initial Draft"]);
  const [toasts, setToasts] = useState([]);
  const [shareOpen, setShareOpen] = useState(false);

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

  const onGenerate = async () => {
    if (!canGenerate) return;
    setIsGenerating(true);
    pushToast("Generating architecture...", "info");

    setTimeout(() => {
      const next = versions.length + 1;
      setVersions((prev) => [`v${next} - Refined ${new Date().toLocaleTimeString()}`, ...prev]);
      setOutput({
        ...DEFAULT_OUTPUT,
        deployment: `Generated for project "${projectName}" with ${files.length} attachment(s). ${DEFAULT_OUTPUT.deployment}`,
      });
      setActiveTab("architecture");
      setIsGenerating(false);
      pushToast("Architecture generated", "success");
    }, 1400);
  };

  const onNewProject = () => {
    setProjectName("New Skyron Project");
    setPrompt("");
    setFiles([]);
    setVersions(["v1 - Initial Draft"]);
    setOutput(DEFAULT_OUTPUT);
    setActiveTab("architecture");
    pushToast("New project started", "info");
  };

  const onFileChange = (event) => {
    const selected = Array.from(event.target.files || []);
    setFiles(selected);
  };

  const downloadPdf = () => {
    pushToast("Export started (mock)", "info");
  };

  const tabContent = {
    architecture: <CopyBlock label="Architecture Diagram (Mermaid)" content={output.architecture} onCopy={copyText} />,
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
              </div>
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
