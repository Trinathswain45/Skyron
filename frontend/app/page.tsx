const stats = [
  { label: "Users", value: "1,240" },
  { label: "Projects", value: "86" },
  { label: "Tasks", value: "432" }
];

export default function Home() {
  return (
    <main className="page">
      <section className="card">
        <h1>Dashboard</h1>
        <p className="subtitle">Basic UI built with Next.js and TypeScript.</p>

        <div className="stats">
          {stats.map((item) => (
            <article key={item.label} className="stat">
              <p className="stat-label">{item.label}</p>
              <p className="stat-value">{item.value}</p>
            </article>
          ))}
        </div>

        <button type="button" className="button">
          Get Started
        </button>
      </section>
    </main>
  );
}
