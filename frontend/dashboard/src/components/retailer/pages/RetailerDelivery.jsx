import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useChatbot } from '../Retail_Chatbot/Retail_ChatbotContext';

/* ---------------- MOCK DATA ---------------- */
const TEMP_POINTS = [
  { t: "08:00", v: 3.5 },
  { t: "09:00", v: 3.2 },
  { t: "10:24", v: 5.8 },
  { t: "11:00", v: 2.5 },
  { t: "12:00", v: 3.1 },
  { t: "13:00", v: 3.4 },
  { t: "13:30", v: 6.2 },
  { t: "14:00", v: 3.3 },
  { t: "15:00", v: 3.6 },
];

const SHOCK_EVENTS = [
  { t: "09:10", v: 1.2, color: "#10B981" },
  { t: "10:20", v: 4.8, color: "#F59E0B" },
  { t: "12:10", v: 2.2, color: "#10B981" },
  { t: "13:05", v: 6.2, color: "#EF4444" },
  { t: "14:10", v: 2.8, color: "#10B981" },
];

const ANOMALIES = [
  { type: "Critical", time: "10:24 AM", text: "Temperature breach: 5.8°C (limit: 4°C)", color: "#EF4444" },
  { type: "Warning", time: "13:05 PM", text: "High shock event: 6.2G force recorded", color: "#F59E0B" },
  { type: "Warning", time: "13:36 PM", text: "Temperature breach: 6.2°C (limit: 4°C)", color: "#F59E0B" },
];

/* ---------------- TEMPERATURE CHART ---------------- */
function TemperatureChart() {
  const [tooltip, setTooltip] = useState(null);

  const svgWidth = 760;
  const svgHeight = 220;
  const paddingLeft = 48;
  const paddingRight = 80;
  const paddingTop = 16;
  const paddingBottom = 36;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const maxY = 8;
  const minY = 0;

  const getX = (i) => paddingLeft + (i / (TEMP_POINTS.length - 1)) * chartWidth;
  const getY = (v) => paddingTop + chartHeight - ((v - minY) / (maxY - minY)) * chartHeight;

  const points = TEMP_POINTS.map((p, i) => `${getX(i)},${getY(p.v)}`).join(" ");
  const yTicks = [0, 2, 4, 6, 8];
  const limitY = getY(4);
  const safeY = getY(3);

  return (
    <div style={{ position: "relative" }}>
      <div style={{
        position: "absolute",
        left: -2,
        top: "50%",
        transform: "translateY(-50%) rotate(-90deg)",
        fontSize: 10,
        color: "#9CA3AF",
        whiteSpace: "nowrap",
        letterSpacing: "0.05em",
      }}>
        Temp (°C)
      </div>

      <svg width="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ overflow: "visible" }}>
        {yTicks.map((tick) => {
          const y = getY(tick);
          return (
            <g key={tick}>
              <line x1={paddingLeft} x2={svgWidth - paddingRight} y1={y} y2={y} stroke="#F3F4F6" strokeWidth="1" />
              <text x={paddingLeft - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#9CA3AF">{tick}</text>
            </g>
          );
        })}

        <line x1={paddingLeft} x2={svgWidth - paddingRight} y1={limitY} y2={limitY} stroke="#EF4444" strokeDasharray="4" strokeWidth="1.5" />
        <text x={svgWidth - paddingRight + 4} y={limitY + 4} fontSize="9" fill="#EF4444">4°C limit</text>

        <line x1={paddingLeft} x2={svgWidth - paddingRight} y1={safeY} y2={safeY} stroke="#10B981" strokeDasharray="4" strokeWidth="1.5" />
        <text x={svgWidth - paddingRight + 4} y={safeY + 4} fontSize="9" fill="#10B981">3°C</text>

        <line x1={paddingLeft} x2={svgWidth - paddingRight} y1={paddingTop + chartHeight} y2={paddingTop + chartHeight} stroke="#E5E7EB" strokeWidth="1" />
        <line x1={paddingLeft} x2={paddingLeft} y1={paddingTop} y2={paddingTop + chartHeight} stroke="#E5E7EB" strokeWidth="1" />

        <polyline fill="none" stroke="#2563EB" strokeWidth="2" points={points} />

        {TEMP_POINTS.map((p, i) => (
          <text key={i} x={getX(i)} y={paddingTop + chartHeight + 14} textAnchor="middle" fontSize="9" fill="#9CA3AF">
            {p.t}
          </text>
        ))}

        <text x={paddingLeft + chartWidth / 2} y={svgHeight} textAnchor="middle" fontSize="10" fill="#9CA3AF">Time</text>

        {TEMP_POINTS.map((p, i) => {
          const cx = getX(i);
          const cy = getY(p.v);
          const isHot = p.v > 4;
          return (
            <g key={i}>
              <circle
                cx={cx} cy={cy} r="5"
                fill={isHot ? "#EF4444" : "#2563EB"}
                stroke="#fff" strokeWidth="1.5"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setTooltip({ x: cx, y: cy, point: p })}
                onMouseLeave={() => setTooltip(null)}
              />
            </g>
          );
        })}

        {tooltip && (() => {
          const tipW = 110;
          const tipH = 42;
          const tx = Math.min(tooltip.x - tipW / 2, svgWidth - tipW - 4);
          const ty = tooltip.y - tipH - 10;
          return (
            <g>
              <rect x={tx} y={ty} width={tipW} height={tipH} rx="6" fill="#1F2937" opacity="0.92" />
              <text x={tx + tipW / 2} y={ty + 16} textAnchor="middle" fontSize="11" fill="#F9FAFB" fontWeight="600">{tooltip.point.t}</text>
              <text x={tx + tipW / 2} y={ty + 31} textAnchor="middle" fontSize="11" fill={tooltip.point.v > 4 ? "#F87171" : "#34D399"}>
                {tooltip.point.v}°C {tooltip.point.v > 4 ? "⚠ Breach" : "✓ OK"}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

/* ---------------- SHOCK CHART ---------------- */
function ShockChart() {
  const [tooltip, setTooltip] = useState(null);

  const svgWidth = 760;
  const svgHeight = 200;
  const paddingLeft = 48;
  const paddingRight = 16;
  const paddingTop = 16;
  const paddingBottom = 36;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const maxG = 8;
  const barCount = SHOCK_EVENTS.length;
  const barAreaWidth = chartWidth / barCount;
  const barWidth = Math.min(barAreaWidth * 0.35, 48);

  const getBarX = (i) => paddingLeft + i * barAreaWidth + barAreaWidth / 2 - barWidth / 2;
  const getBarHeight = (v) => (v / maxG) * chartHeight;
  const getBarY = (v) => paddingTop + chartHeight - getBarHeight(v);

  const yTicks = [0, 2, 4, 6, 8];

  return (
    <div style={{ position: "relative" }}>
      <div style={{
        position: "absolute",
        left: -2,
        top: "50%",
        transform: "translateY(-50%) rotate(-90deg)",
        fontSize: 10,
        color: "#9CA3AF",
        whiteSpace: "nowrap",
        letterSpacing: "0.05em",
      }}>
        Force (G)
      </div>

      <svg width="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ overflow: "visible" }}>
        {yTicks.map((tick) => {
          const y = paddingTop + chartHeight - (tick / maxG) * chartHeight;
          return (
            <g key={tick}>
              <line x1={paddingLeft} x2={svgWidth - paddingRight} y1={y} y2={y} stroke="#F3F4F6" strokeWidth="1" />
              <text x={paddingLeft - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#9CA3AF">{tick}</text>
            </g>
          );
        })}

        <line x1={paddingLeft} x2={svgWidth - paddingRight} y1={paddingTop + chartHeight} y2={paddingTop + chartHeight} stroke="#E5E7EB" strokeWidth="1" />
        <line x1={paddingLeft} x2={paddingLeft} y1={paddingTop} y2={paddingTop + chartHeight} stroke="#E5E7EB" strokeWidth="1" />

        {SHOCK_EVENTS.map((e, i) => {
          const bx = getBarX(i);
          const bh = getBarHeight(e.v);
          const by = getBarY(e.v);
          const labelX = bx + barWidth / 2;
          return (
            <g key={i}>
              <rect
                x={bx} y={by} width={barWidth} height={bh} rx="3"
                fill={e.color}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setTooltip({ x: labelX, y: by, event: e })}
                onMouseLeave={() => setTooltip(null)}
              />
              <text x={labelX} y={paddingTop + chartHeight + 14} textAnchor="middle" fontSize="9" fill="#9CA3AF">{e.t}</text>
            </g>
          );
        })}

        <text x={paddingLeft + chartWidth / 2} y={svgHeight} textAnchor="middle" fontSize="10" fill="#9CA3AF">Time</text>

        {tooltip && (() => {
          const tipW = 110;
          const tipH = 42;
          const tx = Math.min(tooltip.x - tipW / 2, svgWidth - tipW - 4);
          const ty = Math.max(tooltip.y - tipH - 8, 4);
          const severity = tooltip.event.v >= 5 ? "Critical" : tooltip.event.v >= 3 ? "Warning" : "Normal";
          return (
            <g>
              <rect x={tx} y={ty} width={tipW} height={tipH} rx="6" fill="#1F2937" opacity="0.92" />
              <text x={tx + tipW / 2} y={ty + 16} textAnchor="middle" fontSize="11" fill="#F9FAFB" fontWeight="600">{tooltip.event.t}</text>
              <text x={tx + tipW / 2} y={ty + 31} textAnchor="middle" fontSize="11" fill={tooltip.event.color}>
                {tooltip.event.v}G — {severity}
              </text>
            </g>
          );
        })()}
      </svg>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 4, paddingLeft: paddingLeft }}>
        {[
          { color: "#10B981", label: "Normal (< 3G)" },
          { color: "#F59E0B", label: "Warning (3–5G)" },
          { color: "#EF4444", label: "Critical (≥ 5G)" },
        ].map((l) => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
            <span style={{ fontSize: 10, color: "#6B7280" }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- MAIN COMPONENT ---------------- */
export default function RetailerDelivery() {
  const [time, setTime] = useState("");
  const navigate = useNavigate();
  const { updateSnapshot } = useChatbot();

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-US"));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    updateSnapshot({
      type: 'DELIVERY_PAGE',
      tempData: TEMP_POINTS,
      shockEvents: SHOCK_EVENTS
    });
  }, [updateSnapshot]);

  const s = {
    container: {
      marginLeft: 0,
      padding: 24,
      background: "#F8F8FC",
      minHeight: "100vh",
      overflowY: "auto",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      marginBottom: 20,
    },
    card: {
      background: "#fff",
      border: "1px solid #E5E7EB",
      borderRadius: 10,
      padding: 18,
      marginBottom: 16,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: 600,
      color: "#6B7280",
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      margin: "0 0 12px 0",
    },
    title: { fontSize: 22, fontWeight: 800, color: "#111827" },
    sub: { color: "#6B7280", fontSize: 13 },
    redBtn: {
      background: "#EF4444",
      color: "#fff",
      borderRadius: 6,
      padding: "6px 12px",
      border: "none",
      cursor: "pointer",
      fontWeight: 600,
      fontSize: 12,
    },
    divider: {
      borderTop: "1px solid #F3F4F6",
      margin: "16px 0",
    },
  };

  return (
    <div id="delivery-report-root" style={s.container}>

      {/* HEADER */}
      <div style={s.header}>
        <div>
          <div style={s.title}>Delivery Report</div>
          <div style={s.sub}>Trip #TRP-2024-089 · April 24, 2026</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button style={s.redBtn}>Flag Issue</button>
        </div>
      </div>

      {/* TEMPERATURE CHART */}
      <div style={s.card}>
        <p style={s.sectionLabel}>Temperature Over Time</p>
        <div style={{ paddingLeft: 14 }}>
          <TemperatureChart />
        </div>
      </div>

      {/* SHOCK & VIBRATION CHART */}
      <div style={s.card}>
        <p style={s.sectionLabel}>Shock &amp; Vibration Events</p>
        <div style={{ paddingLeft: 14 }}>
          <ShockChart />
        </div>
      </div>

      {/* SUMMARY GRID */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* WEIGHT */}
        <div style={s.card}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 20px" }}>
            Weight Comparison
          </p>
          <div style={{ display: "flex", gap: 40, alignItems: "flex-end", height: 160, justifyContent: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>142.5 kg</span>
              <span style={{ fontSize: 11, color: "#6B7280" }}>Dispatched</span>
              <div style={{ width: 64, height: 130, background: "#7C3AED", borderRadius: "6px 6px 0 0" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>141.8 kg</span>
              <span style={{ fontSize: 11, color: "#6B7280" }}>Received</span>
              <div style={{ width: 64, height: 123, background: "#10B981", borderRadius: "6px 6px 0 0" }} />
            </div>
          </div>
          <div style={{ borderTop: "2px solid #E5E7EB", marginTop: 0 }} />
          <div style={{ marginTop: 10, color: "#10B981", fontSize: 12, textAlign: "center" }}>
            ✓ 0.5% variance — within acceptable tolerance
          </div>
        </div>

        {/* QUALITY */}
        <div style={s.card}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 14px" }}>
            Quality Breakdown
          </p>
          {[
            { label: "Temperature integrity", value: 68, bar: "#EF9F27", pill: { bg: "#FAEEDA", text: "#854F0B" } },
            { label: "Handling score",        value: 71, bar: "#EF9F27", pill: { bg: "#FAEEDA", text: "#854F0B" } },
            { label: "Weight accuracy",       value: 100, bar: "#1D9E75", pill: { bg: "#E1F5EE", text: "#0F6E56" } },
          ].map((b, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>{b.label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, background: b.pill.bg, color: b.pill.text, padding: "2px 8px", borderRadius: 20 }}>
                  {b.value} / 100
                </span>
              </div>
              <div style={{ height: 8, background: "#F3F4F6", borderRadius: 100, overflow: "hidden" }}>
                <div style={{ width: `${b.value}%`, height: "100%", background: b.bar, borderRadius: 100 }} />
              </div>
            </div>
          ))}
          <div style={s.divider} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 13, color: "#6B7280", fontWeight: 500 }}>Overall score</span>
            <div>
              <span style={{ fontSize: 28, fontWeight: 700, color: "#BA7517" }}>74</span>
              <span style={{ fontSize: 14, color: "#6B7280" }}> / 100</span>
            </div>
          </div>
          <div style={{ marginTop: 8, height: 10, background: "#F3F4F6", borderRadius: 100, overflow: "hidden" }}>
            <div style={{ width: "74%", height: "100%", background: "#EF9F27", borderRadius: 100 }} />
          </div>
          <p style={{ fontSize: 12, color: "#6B7280", margin: "8px 0 0" }}>Moderate — temperature & handling need attention</p>
        </div>

      </div>

      {/* ANOMALIES */}
      <div style={s.card}>
        <h4 style={{ color: "#111827", margin: "0 0 4px" }}>Flagged Anomalies</h4>
        {ANOMALIES.map((a, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 0",
              borderTop: "1px solid #F3F4F6",
            }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 160 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: a.color, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, color: a.color }}>{a.type}</div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>{a.time}</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: "#111827", fontWeight: 500, flex: 1, textAlign: "center", alignSelf: "center" }}>
              {a.text}
            </div>
            <div
              onClick={() => navigate("/retailer/alerts")}
              style={{ color: "#4F46E5", cursor: "pointer", fontWeight: 600, alignSelf: "center" }}
            >
              See full alert →
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}