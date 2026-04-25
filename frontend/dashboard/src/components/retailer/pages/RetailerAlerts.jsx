import React, { useEffect, useState, useRef } from "react";
import { useChatbot } from '../Retail_Chatbot/Retail_ChatbotContext';

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
      detail: "Vibration exceeded 12G threshold during transit",
      icon: "vibration",
    },
    {
      type: "Warning",
      color: "#F59E0B",
      title: "Weight discrepancy at exit gate",
      time: "16:05 PM",
      sensor: "Exit Gate Scale",
      detail: "Recorded weight differs from manifest by 3.2 kg",
      icon: "scale",
    },
  ],
};

/* ---------------- TEMP GRAPH ---------------- */
const GRAPH_POINTS = [
  { time: "12:00", temp: 2.1 },
  { time: "12:30", temp: 2.4 },
  { time: "13:00", temp: 2.8 },
  { time: "13:30", temp: 3.2 },
  { time: "14:00", temp: 4.5 },
  { time: "14:32", temp: 6.8 },
  { time: "15:00", temp: 5.9 },
  { time: "15:30", temp: 4.1 },
  { time: "16:00", temp: 3.3 },
  { time: "16:30", temp: 2.7 },
  { time: "17:00", temp: 2.2 },
];

function TempGraph() {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [animated, setAnimated] = useState(false);
  const svgRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const W = 640;
  const H = 180;
  const PAD_LEFT = 48;
  const PAD_RIGHT = 20;
  const PAD_TOP = 20;
  const PAD_BOTTOM = 36;

  const minTemp = 0;
  const maxTemp = 8;
  const safeMax = 4;
  const criticalLine = 4;

  const xScale = (i) =>
    PAD_LEFT + (i / (GRAPH_POINTS.length - 1)) * (W - PAD_LEFT - PAD_RIGHT);
  const yScale = (t) =>
    PAD_TOP + ((maxTemp - t) / (maxTemp - minTemp)) * (H - PAD_TOP - PAD_BOTTOM);

  const points = GRAPH_POINTS.map((p, i) => ({ x: xScale(i), y: yScale(p.temp), ...p }));

  // Smooth cubic bezier path
  const buildPath = (pts) => {
    if (pts.length < 2) return "";
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const cp1x = pts[i].x + (pts[i + 1].x - pts[i].x) / 3;
      const cp1y = pts[i].y;
      const cp2x = pts[i + 1].x - (pts[i + 1].x - pts[i].x) / 3;
      const cp2y = pts[i + 1].y;
      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${pts[i + 1].x},${pts[i + 1].y}`;
    }
    return d;
  };

  // Area fill path (close at bottom)
  const buildArea = (pts) => {
    const linePath = buildPath(pts);
    const lastX = pts[pts.length - 1].x;
    const firstX = pts[0].x;
    const bottom = H - PAD_BOTTOM;
    return `${linePath} L ${lastX},${bottom} L ${firstX},${bottom} Z`;
  };

  const linePath = buildPath(points);
  const areaPath = buildArea(points);

  const ySafe = yScale(safeMax);
  const yCritical = yScale(criticalLine);

  // Y-axis labels
  const yTicks = [0, 2, 4, 6, 8];
  // X-axis labels (every other)
  const xTickIdxs = [0, 2, 4, 5, 7, 9, 10];

  const handleMouseMove = (e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mx = (e.clientX - rect.left) * scaleX;
    let closest = 0;
    let minDist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.x - mx);
      if (d < minDist) { minDist = d; closest = i; }
    });
    setHoveredIdx(closest);
  };

  const hovered = hoveredIdx !== null ? points[hoveredIdx] : null;
  const isCriticalHover = hovered && hovered.temp > safeMax;

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginBottom: 10, fontSize: 11, color: "#6B7280", alignItems: "center" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width="24" height="4"><line x1="0" y1="2" x2="24" y2="2" stroke="#EF4444" strokeWidth="2.5" /></svg>
          Temperature
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width="24" height="4"><line x1="0" y1="2" x2="24" y2="2" stroke="#10B981" strokeWidth="1.5" strokeDasharray="4" /></svg>
          Safe limit (4°C)
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width="24" height="4"><line x1="0" y1="2" x2="24" y2="2" stroke="#F87171" strokeWidth="1.5" strokeDasharray="4" /></svg>
          Critical zone
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="180"
        style={{ display: "block", cursor: "crosshair", overflow: "visible" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EF4444" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#EF4444" stopOpacity="0.01" />
          </linearGradient>
          <linearGradient id="criticalGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FEF2F2" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#FEF2F2" stopOpacity="0" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <clipPath id="graphClip">
            <rect x={PAD_LEFT} y={PAD_TOP} width={W - PAD_LEFT - PAD_RIGHT} height={H - PAD_TOP - PAD_BOTTOM} />
          </clipPath>
        </defs>

        {/* Critical zone shading above safe line */}
        <rect
          x={PAD_LEFT}
          y={PAD_TOP}
          width={W - PAD_LEFT - PAD_RIGHT}
          height={yCritical - PAD_TOP}
          fill="#FEF2F2"
          opacity="0.5"
        />

        {/* Grid lines */}
        {yTicks.map((t) => (
          <line
            key={t}
            x1={PAD_LEFT}
            x2={W - PAD_RIGHT}
            y1={yScale(t)}
            y2={yScale(t)}
            stroke="#E5E7EB"
            strokeWidth="0.8"
          />
        ))}

        {/* Y axis labels */}
        {yTicks.map((t) => (
          <text
            key={t}
            x={PAD_LEFT - 6}
            y={yScale(t) + 4}
            textAnchor="end"
            fontSize="9"
            fill="#9CA3AF"
            fontFamily="Inter, sans-serif"
          >
            {t}°C
          </text>
        ))}

        {/* X axis labels */}
        {xTickIdxs.map((i) => (
          <text
            key={i}
            x={points[i].x}
            y={H - 6}
            textAnchor="middle"
            fontSize="9"
            fill="#9CA3AF"
            fontFamily="Inter, sans-serif"
          >
            {GRAPH_POINTS[i].time}
          </text>
        ))}

        {/* Safe limit line */}
        <line
          x1={PAD_LEFT} x2={W - PAD_RIGHT}
          y1={ySafe} y2={ySafe}
          stroke="#10B981" strokeWidth="1.5" strokeDasharray="5,4"
          opacity="0.8"
        />
        <text x={W - PAD_RIGHT + 2} y={ySafe + 4} fontSize="9" fill="#10B981" fontFamily="Inter, sans-serif">4°C</text>

        {/* Critical line */}
        <line
          x1={PAD_LEFT} x2={W - PAD_RIGHT}
          y1={yCritical} y2={yCritical}
          stroke="#F87171" strokeWidth="1.5" strokeDasharray="5,4"
          opacity="0.7"
        />

        {/* Area fill */}
        <path d={areaPath} fill="url(#areaGradient)" clipPath="url(#graphClip)" />

        {/* Main line */}
        <path
          d={linePath}
          fill="none"
          stroke="#EF4444"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#glow)"
          clipPath="url(#graphClip)"
          style={{
            strokeDasharray: 900,
            strokeDashoffset: animated ? 0 : 900,
            transition: "stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1)",
          }}
        />

        {/* Data dots */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoveredIdx === i ? 5 : (p.temp > safeMax ? 3.5 : 2.5)}
            fill={p.temp > safeMax ? "#EF4444" : "#F87171"}
            stroke="#fff"
            strokeWidth="1.5"
            style={{ transition: "r 0.15s" }}
          />
        ))}

        {/* Hover crosshair + tooltip */}
        {hovered && (
          <>
            <line
              x1={hovered.x} x2={hovered.x}
              y1={PAD_TOP} y2={H - PAD_BOTTOM}
              stroke={isCriticalHover ? "#EF4444" : "#9CA3AF"}
              strokeWidth="1"
              strokeDasharray="3,3"
              opacity="0.6"
            />

            {/* Tooltip box */}
            {(() => {
              const tw = 105;
              const th = 52;
              const tx = Math.min(Math.max(hovered.x - tw / 2, PAD_LEFT), W - PAD_RIGHT - tw);
              const ty = hovered.y - th - 10 < PAD_TOP ? hovered.y + 10 : hovered.y - th - 10;
              return (
                <g>
                  <rect
                    x={tx} y={ty} width={tw} height={th} rx="7"
                    fill={isCriticalHover ? "#FEF2F2" : "#1F2937"}
                    stroke={isCriticalHover ? "#EF4444" : "#374151"}
                    strokeWidth="1"
                    filter="url(#glow)"
                  />
                  <text x={tx + tw / 2} y={ty + 17} textAnchor="middle" fontSize="10" fill={isCriticalHover ? "#B91C1C" : "#9CA3AF"} fontFamily="Inter, sans-serif">
                    {hovered.time}
                  </text>
                  <text x={tx + tw / 2} y={ty + 36} textAnchor="middle" fontSize="15" fontWeight="700" fill={isCriticalHover ? "#EF4444" : "#F9FAFB"} fontFamily="Inter, sans-serif">
                    {hovered.temp.toFixed(1)}°C
                  </text>
                  {isCriticalHover && (
                    <text x={tx + tw / 2} y={ty + 48} textAnchor="middle" fontSize="8.5" fill="#EF4444" fontFamily="Inter, sans-serif">
                      ▲ ABOVE SAFE ZONE
                    </text>
                  )}
                </g>
              );
            })()}
          </>
        )}
      </svg>
    </div>
  );
}

/* ---------------- WARNING ICON ---------------- */
function WarningIcon({ type }) {
  if (type === "vibration") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M8.5 3v18M4 7v10M2 9v6M12 3v18M16 3v18M20 7v10M22 9v6"
          stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M3 6h18M6 6v12a2 2 0 002 2h8a2 2 0 002-2V6M9 6V4h6v2"
        stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 11v4M12 17h.01" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ---------------- MAIN COMPONENT ---------------- */
export default function RetailerAlerts() {
  const [time, setTime] = useState("");
  const { updateSnapshot } = useChatbot();

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

  useEffect(() => {
    updateSnapshot({
      type: 'ALERTS_PAGE',
      criticalAlerts: ALERT_DATA.summary.critical,
      warningAlerts: ALERT_DATA.summary.warning,
      safeAlerts: ALERT_DATA.summary.safe,
      qualityScore: ALERT_DATA.qualityScore,
      anomalies: ALERT_DATA.anomalies
    });
  }, [updateSnapshot]);

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
    summaryCard: (bg, border) => ({
      background: bg,
      border: `1.5px solid ${border}`,
      borderRadius: 10,
      padding: "12px 16px",
      display: "flex",
      alignItems: "center",
      gap: 12,
    }),
    dot: (c) => ({
      width: 10,
      height: 10,
      borderRadius: "50%",
      background: c,
      flexShrink: 0,
      marginTop: 3,
    }),
    severity: (c) => ({
      border: `1px solid ${c}`,
      color: c,
      borderRadius: 6,
      padding: "3px 10px",
      fontSize: 11,
      fontWeight: 600,
      whiteSpace: "nowrap",
      alignSelf: "flex-start",
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
  const warnings = ALERT_DATA.anomalies.slice(1);

  const handleExportCSV = () => {
    const headers = ["Type", "Title", "Time", "Sensor", "Temperature", "Safe Limit", "Deviation"];
    const rows = ALERT_DATA.anomalies.map((a) => [
      a.type, a.title, a.time, a.sensor,
      a.temp || "", a.safe || "", a.deviation || "",
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `anomaly-log-${ALERT_DATA.order}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={s.container}>
      {/* HEADER */}
      <div style={s.headerRow}>
        <div>
          <div style={s.title}>Alerts</div>
          <div style={s.sub}>Order #{ALERT_DATA.order} · {ALERT_DATA.date}</div>
        </div>
        <div style={s.badge}>Fish Quality Score: {ALERT_DATA.qualityScore}</div>
      </div>

      {/* SUMMARY */}
      <div style={s.card}>
        <div style={s.summaryRow}>
          <div style={s.summaryCard("#FEF2F2", "#FECACA")}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#EF4444", lineHeight: 1 }}>{ALERT_DATA.summary.critical}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#B91C1C", marginTop: 2 }}>Critical</div>
              <div style={{ fontSize: 11, color: "#6B7280", marginTop: 1 }}>Immediate action</div>
            </div>
          </div>

          <div style={s.summaryCard("#FFFBEB", "#FDE68A")}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#F59E0B" strokeWidth="2" />
                <path d="M12 8v4m0 4h.01" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#F59E0B", lineHeight: 1 }}>{ALERT_DATA.summary.warning}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#B45309", marginTop: 2 }}>Warnings</div>
              <div style={{ fontSize: 11, color: "#6B7280", marginTop: 1 }}>Monitor closely</div>
            </div>
          </div>

          <div style={s.summaryCard("#ECFDF5", "#A7F3D0")}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#D1FAE5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#10B981", lineHeight: 1 }}>{ALERT_DATA.summary.safe}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#065F46", marginTop: 2 }}>Safe</div>
              <div style={{ fontSize: 11, color: "#6B7280", marginTop: 1 }}>No issues</div>
            </div>
          </div>
        </div>

        {/* FILTER ROW */}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div style={{ fontSize: 13, color: "#6B7280" }}>Anomaly Log</div>
          <div style={{ fontSize: 12, color: "#4F46E5", cursor: "pointer" }} onClick={handleExportCSV}>
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
              <div style={{ fontWeight: 700, color: "#111827" }}>{critical.title}</div>
              <div style={{ fontSize: 12, color: "#6B7280" }}>{critical.time} — {critical.sensor}</div>
            </div>
          </div>
          <div style={s.severity("#EF4444")}>CRITICAL</div>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
          <div style={s.statBox}>
            <div style={s.statTitle}>TEMPERATURE</div>
            <div style={s.statValue}>{critical.temp}</div>
          </div>
          <div style={s.statBox}>
            <div style={s.statTitle}>SAFE LIMIT</div>
            <div style={{ ...s.statValue, color: "#10B981" }}>{critical.safe}</div>
          </div>
          <div style={s.statBox}>
            <div style={s.statTitle}>DEVIATION</div>
            <div style={{ ...s.statValue, color: "#EF4444" }}>{critical.deviation}</div>
          </div>
        </div>

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

      {/* ── WARNING CARDS (replaces the old thin anomalyItem rows) ── */}
      {warnings.map((a, i) => (
        <div
          key={i}
          style={{
            background: "#fff",
            border: "1px solid #FDE68A",
            borderLeft: "4px solid #F59E0B",
            borderRadius: 10,
            padding: "14px 16px",
            marginBottom: 16,
            display: "flex",
            gap: 14,
            alignItems: "flex-start",
          }}
        >
          {/* Icon bubble */}
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "#FEF3C7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <WarningIcon type={a.icon} />
          </div>

          {/* Text body */}
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                {/* ← TITLE: dark + bold so it's always visible */}
                <div style={{ fontWeight: 700, fontSize: 14, color: "#92400E" }}>
                  {a.title}
                </div>
                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                  {a.time} — {a.sensor}
                </div>
              </div>
              <div style={s.severity("#F59E0B")}>WARNING</div>
            </div>

            {/* Detail line */}
            <div
              style={{
                marginTop: 10,
                background: "#FFFBEB",
                border: "1px solid #FDE68A",
                borderRadius: 6,
                padding: "8px 12px",
                fontSize: 12,
                color: "#78350F",
                lineHeight: 1.5,
              }}
            >
              {a.detail}
            </div>

                
          </div>
        </div>
      ))}

      
    </div>
  );
}