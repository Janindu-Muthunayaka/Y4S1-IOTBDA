import React, { useEffect, useState } from "react";

/* ---------------- MOCK ALERT DATA ---------------- */
const ALERT_DATA = {
  order: "TRP-2048",
  date: "April 24, 2026",
  qualityScore: 87,

  summary: {
    critical: 1,
    warning: 2,
    safe: 0,
  },

  anomalies: [
    {
      type: "Critical",
      color: "#EF4444",
      title: "Temperature exceeded safe zone",
      time: "14:32 PM",
      sensor: "Sensor T-04",
      temp: "6.8°C",
      safe: "0–4°C",
      deviation: "+2.8°C",
    },
    {
      type: "Warning",
      color: "#F59E0B",
      title: "High vibration spike detected",
      time: "15:10 PM",
      sensor: "Shock Sensor S-01",
    },
    {
      type: "Warning",
      color: "#F59E0B",
      title: "Weight discrepancy at exit gate",
      time: "16:05 PM",
      sensor: "Exit Gate Scale",
    },
  ],
};

/* ---------------- TEMP GRAPH ---------------- */
function TempGraph() {
  return (
    <svg width="100%" height="120">
      <line x1="0" x2="100%" y1="60" y2="60" stroke="#10B981" strokeDasharray="4" />
      <line x1="0" x2="100%" y1="30" y2="30" stroke="#EF4444" strokeDasharray="4" />

      <polyline
        fill="none"
        stroke="#EF4444"
        strokeWidth="2"
        points="0,80 80,80 160,70 240,30 320,35 400,30 480,70 560,80 640,80"
      />
    </svg>
  );
}

/* ---------------- MAIN COMPONENT ---------------- */
export default function RetailerAlerts() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const s = {
    container: {
      marginLeft: 0,
      background: "#F8F8FC",
      height: "100vh",
      overflowY: "auto",
      padding: 24,
      fontFamily: "Inter, sans-serif",
    },

    headerRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },

    title: {
      fontSize: 24,
      fontWeight: 800,
      color: "#111827",
    },

    sub: {
      fontSize: 13,
      color: "#6B7280",
    },

    badge: {
      fontSize: 13,
      fontWeight: 700,
      color: "#4F46E5",
    },

    card: {
      background: "#fff",
      border: "1px solid #E5E7EB",
      borderRadius: 10,
      padding: 16,
      marginBottom: 16,
    },

    summaryRow: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 12,
      marginBottom: 16,
    },

    summaryCard: (bg) => ({
      background: bg,
      borderRadius: 8,
      padding: 14,
      fontSize: 13,
      fontWeight: 600,
    }),

    anomalyItem: {
      borderTop: "1px solid #F3F4F6",
      padding: "14px 0",
    },

    dot: (c) => ({
      width: 10,
      height: 10,
      borderRadius: "50%",
      background: c,
    }),

    severity: (c) => ({
      border: `1px solid ${c}`,
      color: c,
      borderRadius: 6,
      padding: "3px 10px",
      fontSize: 11,
      fontWeight: 600,
    }),

    statBox: {
      background: "#F9FAFB",
      border: "1px solid #E5E7EB",
      borderRadius: 8,
      padding: 12,
      flex: 1,
    },

    statTitle: {
      fontSize: 11,
      color: "#9CA3AF",
      marginBottom: 6,
      fontWeight: 600,
    },

    statValue: {
      fontSize: 18,
      fontWeight: 800,
      color: "#111827",
    },
  };

  const critical = ALERT_DATA.anomalies[0];

  return (
    <div style={s.container}>
      {/* HEADER */}
      <div style={s.headerRow}>
        <div>
          <div style={s.title}>Alerts</div>
          <div style={s.sub}>
            Order #{ALERT_DATA.order} · {ALERT_DATA.date}
          </div>
        </div>

        <div style={s.badge}>
          Fish Quality Score: {ALERT_DATA.qualityScore}
        </div>
      </div>

      {/* SUMMARY */}
      <div style={s.card}>
        <div style={s.summaryRow}>
          <div style={s.summaryCard("#FEF2F2")}>
            <span style={{ color: "#EF4444" }}>
              {ALERT_DATA.summary.critical} Critical
            </span>
            <div style={{ fontSize: 11, color: "#6B7280" }}>
              Immediate action needed
            </div>
          </div>

          <div style={s.summaryCard("#FFFBEB")}>
            <span style={{ color: "#F59E0B" }}>
              {ALERT_DATA.summary.warning} Warnings
            </span>
            <div style={{ fontSize: 11, color: "#6B7280" }}>
              Monitor closely
            </div>
          </div>

          <div style={s.summaryCard("#ECFDF5")}>
            <span style={{ color: "#10B981" }}>
              {ALERT_DATA.summary.safe} Safe
            </span>
            <div style={{ fontSize: 11, color: "#6B7280" }}>
              No issues
            </div>
          </div>
        </div>

        {/* FILTER ROW */}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div style={{ fontSize: 13, color: "#6B7280" }}>
            Anomaly Log
          </div>
          <div style={{ fontSize: 12, color: "#4F46E5", cursor: "pointer" }}>
            Export CSV
          </div>
        </div>
      </div>

      {/* CRITICAL BLOCK */}
      <div style={s.card}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={s.dot("#EF4444")} />
            <div>
              <div style={{ fontWeight: 700 }}>
                {critical.title}
              </div>
              <div style={{ fontSize: 12, color: "#6B7280" }}>
                {critical.time} — {critical.sensor}
              </div>
            </div>
          </div>

          <div style={s.severity("#EF4444")}>CRITICAL</div>
        </div>

        {/* STATS */}
        <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
          <div style={s.statBox}>
            <div style={s.statTitle}>TEMPERATURE</div>
            <div style={s.statValue}>{critical.temp}</div>
          </div>

          <div style={s.statBox}>
            <div style={s.statTitle}>SAFE LIMIT</div>
            <div style={{ ...s.statValue, color: "#10B981" }}>
              {critical.safe}
            </div>
          </div>

          <div style={s.statBox}>
            <div style={s.statTitle}>DEVIATION</div>
            <div style={{ ...s.statValue, color: "#EF4444" }}>
              {critical.deviation}
            </div>
          </div>
        </div>

        {/* GRAPH */}
        <div style={{ marginTop: 16 }}>
          <TempGraph />
        </div>

        <button
          style={{
            marginTop: 12,
            border: "1px solid #EF4444",
            color: "#EF4444",
            background: "transparent",
            padding: "6px 12px",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Flag for Supplier
        </button>
      </div>

      {/* OTHER ALERTS */}
      <div style={s.card}>
        {ALERT_DATA.anomalies.slice(1).map((a, i) => (
          <div key={i} style={s.anomalyItem}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={s.dot(a.color)} />
                <div>
                  <div style={{ fontWeight: 600 }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: "#6B7280" }}>
                    {a.time} — {a.sensor}
                  </div>
                </div>
              </div>

              <div style={s.severity(a.color)}>{a.type}</div>
            </div>
          </div>
        ))}
      </div>

      {/* EMPTY STATE */}
      <div
        style={{
          border: "1px dashed #D1D5DB",
          borderRadius: 10,
          padding: 30,
          textAlign: "center",
          color: "#6B7280",
        }}
      >
        ✓ No anomalies detected
        <div style={{ fontSize: 12, marginTop: 6 }}>
          This delivery met all quality thresholds
        </div>
      </div>
    </div>
  );
}