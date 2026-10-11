
import { useCallback, useEffect, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./App.css";

const API = "http://127.0.0.1:5000/api";

const COLORS = {
  infected: "#ff4d5e",
  vulnerable: "#ffb547",
  patched: "#34d399",
  isolated: "#94a3b8",
};

const EVENT_COLORS = {
  infection: COLORS.infected,
  patch: COLORS.patched,
  isolation: COLORS.isolated,
  system: "#7c9cff",
  simulation: "#ffb547",
};

function computerName(id) {
  return `PC-${Number(id) + 1}`;
}

async function apiRequest(path, method = "GET", body = null) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "The request failed.");
  }

  return data;
}

function StatCard({ label, value, color, detail }) {
  return (
    <article className="stat">
      <div className="stat-top">
        <span className="stat-dot" style={{ background: color }} />
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

export default function App() {
  const graphRef = useRef(null);
  const networkRef = useRef(null);
  const busyRef = useRef(false);

  const [network, setNetwork] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [patchPercent, setPatchPercent] = useState(20);
  const [infectionChance, setInfectionChance] = useState(35);

  const applyNetworkUpdate = useCallback((data) => {
    const current = networkRef.current;

    if (!current || data.nodes.length !== current.nodes.length) {
      networkRef.current = data;
      setNetwork(data);
    } else {
      const statuses = new Map(
        data.nodes.map((node) => [node.id, node.status])
      );

      current.nodes.forEach((node) => {
        if (statuses.has(node.id)) {
          node.status = statuses.get(node.id);
        }
      });

      const updated = {
        ...current,
        counts: data.counts,
        step: data.step,
        total: data.total ?? current.total,
        patch_coverage: data.patch_coverage ?? current.patch_coverage,
        infection_chance: data.infection_chance ?? current.infection_chance,
        history: data.history ?? current.history,
        events: data.events ?? current.events ?? [],
      };

      networkRef.current = updated;
      setNetwork(updated);
    }

    if (data.patch_coverage !== undefined) {
      setPatchPercent(data.patch_coverage);
    }

    if (data.infection_chance !== undefined) {
      setInfectionChance(Math.round(data.infection_chance * 100));
    }
  }, []);

  const loadNetwork = useCallback(async () => {
    try {
      const data = await apiRequest("/network");
      applyNetworkUpdate(data);
      setError("");
    } catch (err) {
      setError(err.message || "Cannot connect to Flask on port 5000.");
    }
  }, [applyNetworkUpdate]);

  useEffect(() => {
    loadNetwork();
  }, [loadNetwork]);

  useEffect(() => {
    if (!network || !graphRef.current) return;

    graphRef.current.d3Force("charge")?.strength(-260);
    graphRef.current.d3Force("link")?.distance(75);
    graphRef.current.d3Force("center")?.strength(0.12);
  }, [Boolean(network)]);

  const performAction = useCallback(
    async (path, method = "POST", body = null) => {
      if (busyRef.current) return null;

      busyRef.current = true;
      setBusy(true);
      setError("");
      setNotice("");

      try {
        const data = await apiRequest(path, method, body);
        const updatedNetwork = data.network || data;

        if (updatedNetwork.nodes) {
          applyNetworkUpdate(updatedNetwork);
        }

        if (data.message) {
          setNotice(data.message);
        }

        return data;
      } catch (err) {
        setError(err.message || "The action failed.");
        return null;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [applyNetworkUpdate]
  );

  const advanceSimulation = useCallback(() => {
    return performAction("/step");
  }, [performAction]);

  useEffect(() => {
    if (!running || !network || busy) return;

    const timer = setTimeout(() => {
      advanceSimulation();
    }, 1000);

    return () => clearTimeout(timer);
  }, [running, network, busy, advanceSimulation]);

  const handleReset = async () => {
    setRunning(false);
    setSelectedNodeId(null);
    setHoveredNodeId(null);
    await performAction("/reset");
  };

  const selectComputer = useCallback((node) => {
    if (!node) return;

    setSelectedNodeId(node.id);
    setHoveredNodeId(null);

    const graph = graphRef.current;

    if (graph && Number.isFinite(node.x) && Number.isFinite(node.y)) {
      graph.centerAt(node.x, node.y, 400);
      graph.zoom(2, 400);
    }
  }, []);

  const handleConfiguration = async (event) => {
    event.preventDefault();
    setRunning(false);

    const data = await performAction("/config", "POST", {
      patch_percent: Number(patchPercent),
      infection_chance: Number(infectionChance) / 100,
    });

    if (data) {
      setSelectedNodeId(null);
      setHoveredNodeId(null);
      setNotice("Configuration applied. A fresh simulation has started.");
    }
  };

  const handleExport = () => {
    window.open(`${API}/report`, "_blank", "noopener,noreferrer");
  };

  if (!network) {
    return (
      <main className="dashboard">
        <div className="loading-card">
          <div className="loading-dot" />
          <h2>WannaCry Simulator</h2>
          <p>{error || "Connecting to the simulation engine..."}</p>
          {error && (
            <button className="primary-button" onClick={loadNetwork}>
              Retry connection
            </button>
          )}
        </div>
      </main>
    );
  }

  const displayedNode =
    network.nodes.find((node) => node.id === hoveredNodeId) ||
    network.nodes.find((node) => node.id === selectedNodeId) ||
    null;

  const orderedNodes = [...network.nodes].sort(
    (a, b) => Number(a.id) - Number(b.id)
  );

  const history = network.history || [];
  const events = network.events || [];

  const infectedPercent = network.total
    ? Math.round((network.counts.infected / network.total) * 100)
    : 0;

  const selectedCanPatch = displayedNode?.status === "vulnerable";
  const selectedCanIsolate =
    displayedNode && displayedNode.status !== "isolated";

  return (
    <main className="dashboard">
      <header className="header">
        <div className="brand-row">
          <div className="brand-icon">N</div>
          <span>NETWORK SECURITY LAB</span>
          <span className="environment-badge">
            <span className="status-indicator" />
            LOCAL SIMULATION
          </span>
        </div>

        <p className="eyebrow">CYBERSECURITY / THREAT ANALYSIS</p>
        <h1>
          WannaCry Attack
          <span> Propagation Simulator</span>
        </h1>
        <p className="subtitle">
          Simulate ransomware-style propagation, monitor infection trends,
          and test basic network defense strategies.
        </p>
      </header>

      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="notice-banner">{notice}</div>}

      <section className="stats">
        <StatCard
          label="Infected systems"
          value={network.counts.infected}
          color={COLORS.infected}
          detail={`${infectedPercent}% of network`}
        />
        <StatCard
          label="Vulnerable"
          value={network.counts.vulnerable}
          color={COLORS.vulnerable}
          detail="Exposed to propagation"
        />
        <StatCard
          label="Patched systems"
          value={network.counts.patched}
          color={COLORS.patched}
          detail="Protected computers"
        />
        <StatCard
          label="Isolated systems"
          value={network.counts.isolated}
          color={COLORS.isolated}
          detail="Removed from propagation"
        />
        <StatCard
          label="Simulation step"
          value={network.step}
          color="#7c9cff"
          detail="Propagation rounds"
        />
      </section>

      <section className="network-panel">
        <div className="panel-heading">
          <div>
            <div className="section-kicker">LIVE VISUALIZATION</div>
            <h2>Network topology</h2>
            <p>Connections remain fixed as computer statuses change.</p>
          </div>
          <div className="connection-status">
            <span className="status-indicator" />
            API CONNECTED
          </div>
        </div>

        <div className="toolbar">
          <div className="toolbar-left">
            <button
              className="primary-button"
              onClick={() => setRunning((value) => !value)}
              disabled={busy}
            >
              {running ? "Ⅱ Pause simulation" : "▶ Start simulation"}
            </button>

            <button
              className="secondary-button"
              onClick={advanceSimulation}
              disabled={busy || running}
            >
              Next step →
            </button>

            <button
              className="secondary-button"
              onClick={handleReset}
              disabled={busy}
            >
              ↻ Reset
            </button>

            <button className="secondary-button" onClick={handleExport}>
              ↓ Export report
            </button>
          </div>

          <div className="step-counter">
            ROUND <strong>{network.step}</strong>
          </div>
        </div>

        <div className="graph">
          <div className="graph-label graph-label-top">
            FIXED TOPOLOGY / {network.nodes.length} HOSTS
          </div>

          <ForceGraph2D
            ref={graphRef}
            graphData={network}
            backgroundColor="#080e1b"
            nodeRelSize={6}
            nodeVal={3}
            nodeColor={(node) => COLORS[node.status] || "#94a3b8"}
            nodeLabel={(node) =>
              `${computerName(node.id)} · ${node.status.toUpperCase()}`
            }
            onNodeHover={(node) => setHoveredNodeId(node ? node.id : null)}
            onNodeClick={selectComputer}
            nodePointerAreaPaint={(node, color, ctx) => {
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(node.x, node.y, 14, 0, Math.PI * 2);
              ctx.fill();
            }}
            nodeCanvasObject={(node, ctx, globalScale) => {
              const color = COLORS[node.status] || "#94a3b8";
              const radius = 5.5;
              const active =
                node.id === selectedNodeId || node.id === hoveredNodeId;

              ctx.save();

              if (active) {
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius + 5, 0, Math.PI * 2);
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 1.5 / globalScale;
                ctx.stroke();
              }

              ctx.shadowColor = color;
              ctx.shadowBlur = 8;
              ctx.beginPath();
              ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
              ctx.fillStyle = color;
              ctx.fill();
              ctx.shadowBlur = 0;

              ctx.beginPath();
              ctx.arc(node.x, node.y, radius * 0.4, 0, Math.PI * 2);
              ctx.fillStyle = "#ffffff";
              ctx.fill();
              ctx.restore();

              if (globalScale >= 1.4 || active) {
                ctx.save();
                ctx.font = `bold ${12 / globalScale}px Arial`;
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                ctx.fillStyle = "#e2e8f0";
                ctx.fillText(
                  computerName(node.id),
                  node.x,
                  node.y + radius + 5
                );
                ctx.restore();
              }
            }}
            linkColor={() => "#293951"}
            linkWidth={0.8}
            linkDirectionalParticles={0}
            cooldownTicks={180}
            warmupTicks={50}
            enableNodeDrag
            enableZoomInteraction
            enablePanInteraction
          />
        </div>

        <div className="legend">
          {Object.entries(COLORS).map(([status, color]) => (
            <div className="legend-item" key={status}>
              <span style={{ background: color }} />
              {status}
            </div>
          ))}
        </div>

        <div className="node-details">
          <div className="details-copy">
            <div className="section-kicker">
              {hoveredNodeId !== null ? "HOVER INSPECTOR" : "COMPUTER INSPECTOR"}
            </div>
            <h3>
              {displayedNode
                ? computerName(displayedNode.id)
                : "Select a computer"}
            </h3>
            <p>
              {displayedNode
                ? "Inspect this computer or apply an available defense action."
                : "Click a computer in the graph or directory below."}
            </p>
          </div>

          {displayedNode && (
            <div className="inspector-actions">
              <span
                className="detail-status"
                style={{
                  color: COLORS[displayedNode.status],
                  borderColor: `${COLORS[displayedNode.status]}55`,
                  background: `${COLORS[displayedNode.status]}12`,
                }}
              >
                <span
                  className="stat-dot"
                  style={{ background: COLORS[displayedNode.status] }}
                />
                {displayedNode.status.toUpperCase()}
              </span>

              <button
                className="defense-button patch-button"
                disabled={busy || !selectedCanPatch}
                onClick={() => performAction(`/patch/${displayedNode.id}`)}
              >
                Patch computer
              </button>

              <button
                className="defense-button isolate-button"
                disabled={busy || !selectedCanIsolate}
                onClick={() => performAction(`/isolate/${displayedNode.id}`)}
              >
                Isolate computer
              </button>
            </div>
          )}
        </div>

        <div className="computer-directory">
          <div className="directory-heading">
            <div>
              <div className="section-kicker">HOST DIRECTORY</div>
              <h3>Computer list</h3>
            </div>
            <span className="directory-count">
              {orderedNodes.length} systems
            </span>
          </div>

          <div className="computer-list">
            {orderedNodes.map((node, index) => {
              const selected = selectedNodeId === node.id;

              return (
                <button
                  key={node.id}
                  type="button"
                  className={`computer-item ${selected ? "selected" : ""}`}
                  onClick={() => selectComputer(node)}
                  aria-pressed={selected}
                >
                  <span className="computer-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span
                    className="computer-status-dot"
                    style={{ background: COLORS[node.status] }}
                  />
                  <span className="computer-name">
                    {computerName(node.id)}
                  </span>
                  <span
                    className="computer-status"
                    style={{ color: COLORS[node.status] }}
                  >
                    {node.status}
                  </span>
                  <span className="computer-arrow">
                    {selected ? "✓" : "›"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="lower-grid">
        <article className="content-panel chart-panel">
          <div className="section-kicker">HISTORICAL ANALYSIS</div>
          <h2>Infection growth</h2>
          <p className="panel-description">
            Recorded system counts after simulation rounds and defense actions.
          </p>

          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={history}
                margin={{ top: 12, right: 12, left: -16, bottom: 4 }}
              >
                <CartesianGrid stroke="#263449" strokeDasharray="3 3" />
                <XAxis
                  dataKey="step"
                  stroke="#8291a8"
                  tick={{ fill: "#8291a8", fontSize: 11 }}
                />
                <YAxis
                  domain={[0, network.total]}
                  allowDecimals={false}
                  stroke="#8291a8"
                  tick={{ fill: "#8291a8", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#111a2b",
                    border: "1px solid #263449",
                    borderRadius: 8,
                    color: "#f1f5f9",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="infected"
                  name="Infected"
                  stroke={COLORS.infected}
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="vulnerable"
                  name="Vulnerable"
                  stroke={COLORS.vulnerable}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="patched"
                  name="Patched"
                  stroke={COLORS.patched}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="isolated"
                  name="Isolated"
                  stroke={COLORS.isolated}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="chart-note">
            Educational simulation data, not real-world incident measurements.
          </p>
        </article>

        <article className="content-panel config-panel">
          <div className="section-kicker">EXPERIMENT CONTROLS</div>
          <h2>Simulation settings</h2>
          <p className="panel-description">
            Adjust protection and propagation probability for a new experiment.
          </p>

          <form
            onSubmit={handleConfiguration}
            className="config-form"
          >
            <div className="range-heading">
              <label htmlFor="patchPercent">Initial patch coverage</label>
              <strong>{patchPercent}%</strong>
            </div>

            <input
              id="patchPercent"
              type="range"
              min="0"
              max="100"
              step="5"
              value={patchPercent}
              onChange={(event) => setPatchPercent(Number(event.target.value))}
              disabled={busy}
            />

            <div className="range-scale">
              <span>0% protected</span>
              <span>100% protected</span>
            </div>

            <div className="range-heading">
              <label htmlFor="infectionChance">Infection probability</label>
              <strong>{infectionChance}%</strong>
            </div>

            <input
              id="infectionChance"
              type="range"
              min="0"
              max="100"
              step="5"
              value={infectionChance}
              onChange={(event) =>
                setInfectionChance(Number(event.target.value))
              }
              disabled={busy}
            />

            <div className="range-scale">
              <span>0% chance</span>
              <span>100% chance</span>
            </div>

            <div className="config-warning">
              Applying settings resets the current simulation and its history.
            </div>

            <button
              type="submit"
              className="primary-button apply-button"
              disabled={busy}
            >
              {busy ? "Applying..." : "Apply settings & restart"}
            </button>
          </form>

          <div className="defense-summary">
            <div>
              <span>Current infection probability</span>
              <strong>
                {Math.round((network.infection_chance ?? 0.35) * 100)}%
              </strong>
            </div>
            <div>
              <span>Current patch coverage setting</span>
              <strong>{network.patch_coverage}%</strong>
            </div>
            <div>
              <span>Network still vulnerable</span>
              <strong>
                {Math.round(
                  (network.counts.vulnerable / network.total) * 100
                )}%
              </strong>
            </div>
          </div>
        </article>
      </section>

      <section className="content-panel event-panel">
        <div className="event-header">
          <div>
            <div className="section-kicker">SECURITY MONITORING</div>
            <h2>Security event log</h2>
            <p className="panel-description">
              Recent infections, patch actions, isolation events, and system activity.
            </p>
          </div>
          <span className="directory-count">{events.length} events</span>
        </div>

        <div className="event-list">
          {events.length === 0 ? (
            <p className="panel-description">No events recorded yet.</p>
          ) : (
            events.map((event, index) => (
              <div className="event-item" key={`${event.step}-${event.id}-${index}`}>
                <span
                  className="event-dot"
                  style={{
                    background: EVENT_COLORS[event.type] || "#7c9cff",
                  }}
                />
                <div className="event-message">
                  <div className="event-meta">
                    <span>{event.type.toUpperCase()}</span>
                    <span>ROUND {event.step}</span>
                    <span>{event.computer}</span>
                  </div>
                  <p>{event.message}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <footer className="footer">
        <span>WANNACRY SIMULATION ENVIRONMENT</span>
        <span>Educational model · No real malware executed</span>
      </footer>
    </main>
  );
}
