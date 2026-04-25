import React, { useState, useEffect, useMemo } from "react";

// ── Shared sidebar icons ────────────────────────────────────────────────────
const GridIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);
const DocIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);
const TruckIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
    <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
  </svg>
);
const BellIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const BackIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);
const CalIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

// ── Mock data ────────────────────────────────────────────────────────────────
const ALL_ORDERS = [
  { id: "TRP-2048", date: "Apr 24, 2026", dateObj: new Date("2026-04-24"), supplier: "Pacific Fresh Ltd.", loadedWt: 145, exitWt: 142, delta: -3, qualityScore: 87, qualityLabel: "Warning", qualityColor: "#F59E0B", qualityBg: "#FEF3C7", status: "Delivered" },
  { id: "TRP-2031", date: "Apr 22, 2026", dateObj: new Date("2026-04-22"), supplier: "Pacific Fresh Ltd.", loadedWt: 138, exitWt: 138, delta: 0,  qualityScore: 94, qualityLabel: "Good",    qualityColor: "#10B981", qualityBg: "#D1FAE5", status: "Delivered" },
  { id: "TRP-2018", date: "Apr 19, 2026", dateObj: new Date("2026-04-19"), supplier: "OceanGate Co.",      loadedWt: 210, exitWt: 205, delta: -5, qualityScore: 76, qualityLabel: "Warning", qualityColor: "#F59E0B", qualityBg: "#FEF3C7", status: "Delivered" },
  { id: "TRP-1999", date: "Apr 15, 2026", dateObj: new Date("2026-04-15"), supplier: "Pacific Fresh Ltd.", loadedWt: 160, exitWt: 157, delta: -3, qualityScore: 61, qualityLabel: "Critical",qualityColor: "#EF4444", qualityBg: "#FEE2E2", status: "Delivered" },
  { id: "TRP-1984", date: "Apr 12, 2026", dateObj: new Date("2026-04-12"), supplier: "BlueWave Fisheries", loadedWt: 95,  exitWt: 95,  delta: 0,  qualityScore: 91, qualityLabel: "Good",    qualityColor: "#10B981", qualityBg: "#D1FAE5", status: "Delivered" },
];

const TREND_ORDERS = ["TRP-1984","TRP-1999","TRP-2018","TRP-2031","TRP-2048"];

// ── Bar chart (quality score trend) ─────────────────────────────────────────
function QualityTrendChart({ orders, compareMode, highlightId }) {
  const barColor = (score) => score >= 90 ? "#10B981" : score >= 75 ? "#F59E0B" : "#EF4444";
  const maxH = 90;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 24, height: maxH + 50, paddingTop: 20 }}>
      {orders.map(o => {
        const h = (o.qualityScore / 100) * maxH;
        const isHighlighted = o.id === highlightId;
        return (
          <div key={o.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{o.qualityScore}</span>
            <div style={{
              width: 44,
              height: h,
              background: barColor(o.qualityScore),
              borderRadius: "4px 4px 0 0",
              opacity: isHighlighted ? 1 : 0.85,
              outline: isHighlighted ? "2px solid #4F46E5" : "none",
              outlineOffset: 2,
              transition: "height 0.4s ease",
            }}/>
            <span style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>{o.id.replace("TRP-","TRP-\n")}</span>
          </div>
        );
      })}
    </div>
  );
}
   

// ── Orders Page ──────────────────────────────────────────────────────────────
function OrdersPage() {
  const [time, setTime] = useState("");
  const [selectedDate, setSelectedDate] = useState("2026-04-24");
  const [searchQuery, setSearchQuery] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState("TRP-2048");

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, []);

  const filteredOrders = useMemo(() => {
    return ALL_ORDERS.filter(o => {
      if (searchQuery === "") return true;
      const query = searchQuery.toLowerCase();
      const matchesOrderId = o.id.toLowerCase().includes(query);
      const matchesSupplier = o.supplier.toLowerCase().includes(query);
      return matchesOrderId || matchesSupplier;
    });
  }, [searchQuery]);

  const trendOrders = ALL_ORDERS.filter(o => TREND_ORDERS.includes(o.id));
  const activeOrder = ALL_ORDERS.find(o => o.id === selectedOrder) || ALL_ORDERS[0];
  const prevOrder = ALL_ORDERS[ALL_ORDERS.indexOf(activeOrder) + 1];

  const displayDate = selectedDate
    ? new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "April 24, 2026";

  return (
    <>
      {/* Top Header */}
      <header style={{
        background: "#fff", borderBottom: "1px solid #E5E7EB",
        padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
      }}>
        <div style={{ color: "#6B7280", fontSize: 13 }}>
          Retailer <span style={{ color: "#9CA3AF" }}>/</span> <span style={{ color: "#111827", fontWeight: 500 }}>Orders</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#374151" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981" }}/>
            <strong>Live</strong>&nbsp; Updated {time || "12:48:44 PM"}
          </div>
          <button style={{ border: "1px solid #4F46E5", color: "#4F46E5", background: "transparent", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Real-Time Stream
          </button>
          <button style={{ background: "#4F46E5", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Refresh Data
          </button>
        </div>
      </header>

      {/* Order Banner */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E5E7EB", padding: "8px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Order #{activeOrder.id}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#4F46E5" }}>Fish Quality Score: {activeOrder.qualityScore}</span>
      </div>

      {/* Main Scrollable Content */}
      <div style={{ flex: 1, overflowY: "auto", background: "#F8F8FC", padding: "24px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#111827", marginBottom: 2 }}>Orders</h1>
        <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>Order #{activeOrder.id} · {displayDate}</p>

        {/* Filter Bar */}
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, padding: "14px 16px", display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
          {/* Date picker */}
          <div style={{ position: "relative" }}>
            <div
              onClick={() => setShowDatePicker(v => !v)}
              style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #E5E7EB", borderRadius: 6, padding: "7px 12px", background: "#F9FAFB", cursor: "pointer", fontSize: 13, color: "#374151", minWidth: 160 }}>
              <CalIcon /> {displayDate}
            </div>
            {showDatePicker && (
              <div style={{ position: "absolute", top: "110%", left: 0, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 50, padding: 12 }}>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => { setSelectedDate(e.target.value); setShowDatePicker(false); }}
                  style={{ border: "1px solid #E5E7EB", borderRadius: 6, padding: "6px 10px", fontSize: 13, color: "#374151", outline: "none", cursor: "pointer" }}
                />
              </div>
            )}
          </div>

          {/* Search */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #E5E7EB", borderRadius: 6, padding: "7px 12px", background: "#F9FAFB", flex: 1, minWidth: 200 }}>
            <SearchIcon />
            <input
              type="text"
              placeholder="Search Order ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ border: "none", background: "transparent", fontSize: 13, color: "#374151", outline: "none", width: "100%" }}
            />
            {searchQuery && (
              <span onClick={() => setSearchQuery("")} style={{ color: "#9CA3AF", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</span>
            )}
          </div>

          {/* Compare toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
            <span style={{ fontSize: 13, color: "#374151" }}>Compare with previous order</span>
            <div
              onClick={() => setCompareMode(v => !v)}
              style={{
                width: 44, height: 24, borderRadius: 12,
                background: compareMode ? "#4F46E5" : "#D1D5DB",
                position: "relative", cursor: "pointer", transition: "background 0.25s",
              }}>
              <div style={{
                width: 18, height: 18, borderRadius: "50%", background: "#fff",
                position: "absolute", top: 3, left: compareMode ? 23 : 3,
                transition: "left 0.25s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
              }}/>
            </div>
          </div>
        </div>

        {/* Deliveries Table */}
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, marginBottom: 20, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #F3F4F6" }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Your Deliveries</span>
            <span style={{ fontSize: 13, color: "#9CA3AF" }}>{filteredOrders.length} orders found</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F9FAFB" }}>
                {["ORDER ID","DATE","SUPPLIER","LOADED WT","EXIT WT","QUALITY SCORE","STATUS"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#9CA3AF", letterSpacing: 0.5, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: "32px 16px", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>No orders match your search.</td></tr>
              ) : filteredOrders.map((order, i) => {
                const isSelected = order.id === selectedOrder;
                return (
                  <tr key={order.id} style={{ borderTop: "1px solid #F3F4F6", background: isSelected ? "#F5F3FF" : "#fff", cursor: "pointer" }} onClick={() => setSelectedOrder(order.id)}>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ color: "#4F46E5", fontWeight: 700, fontSize: 13, borderLeft: isSelected ? "3px solid #4F46E5" : "3px solid transparent", paddingLeft: 8 }}>
                        #{order.id}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 13, color: "#374151" }}>{order.date}</td>
                    <td style={{ padding: "14px 16px", fontSize: 13, color: "#374151" }}>{order.supplier}</td>
                    <td style={{ padding: "14px 16px", fontSize: 13, color: "#374151" }}>{order.loadedWt} kg</td>
                    <td style={{ padding: "14px 16px", fontSize: 13, color: "#374151" }}>
                      {order.exitWt} kg{" "}
                      {order.delta < 0 && (
                        <span style={{ background: "#FEF3C7", color: "#B45309", borderRadius: 10, fontSize: 11, fontWeight: 600, padding: "2px 6px", marginLeft: 4 }}>
                          ▼ {Math.abs(order.delta)}kg
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ background: order.qualityBg, color: order.qualityColor, borderRadius: 20, fontSize: 12, fontWeight: 700, padding: "4px 12px", whiteSpace: "nowrap" }}>
                        {order.qualityScore} {order.qualityLabel}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ color: "#10B981", fontSize: 13, fontWeight: 500 }}>{order.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding: "12px 20px", borderTop: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>Showing {filteredOrders.length} of {ALL_ORDERS.length} orders</span>
            <div style={{ display: "flex", gap: 8, fontSize: 13, color: "#9CA3AF" }}>
              <span style={{ cursor: "pointer" }}>← Prev</span>
              <span style={{ color: "#4F46E5", fontWeight: 700 }}>1</span>
              <span style={{ cursor: "pointer" }}>Next →</span>
            </div>
          </div>
        </div>

        {/* Quality Score Trend */}
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, padding: 20 }}>
          <div style={{ marginBottom: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Quality Score Trend — Last 5 Orders</span>
          </div>
          <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 12 }}>Supplier: Pacific Fresh Ltd.</div>
          <QualityTrendChart orders={trendOrders} compareMode={compareMode} highlightId={selectedOrder} />

          {compareMode && prevOrder && (
            <div style={{ marginTop: 20, border: "1px solid #E5E7EB", borderRadius: 8, padding: "14px 16px", background: "#F9FAFB" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 12 }}>Side-by-Side Comparison</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.5 }}>Metric</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#4F46E5", textTransform: "uppercase", letterSpacing: 0.5 }}>#{activeOrder.id}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.5 }}>#{prevOrder.id}</div>
                {[
                  ["Quality Score", activeOrder.qualityScore, prevOrder.qualityScore],
                  ["Loaded Weight", `${activeOrder.loadedWt} kg`, `${prevOrder.loadedWt} kg`],
                  ["Exit Weight", `${activeOrder.exitWt} kg`, `${prevOrder.exitWt} kg`],
                  ["Weight Loss", activeOrder.delta < 0 ? `${activeOrder.delta} kg` : "None", prevOrder.delta < 0 ? `${prevOrder.delta} kg` : "None"],
                  ["Supplier", activeOrder.supplier, prevOrder.supplier],
                ].map(([metric, a, b]) => (
                  <>
                    <div style={{ fontSize: 13, color: "#374151", padding: "8px 0", borderTop: "1px solid #F3F4F6" }}>{metric}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", padding: "8px 0", borderTop: "1px solid #F3F4F6" }}>{a}</div>
                    <div style={{ fontSize: 13, color: "#6B7280", padding: "8px 0", borderTop: "1px solid #F3F4F6" }}>{b}</div>
                  </>
                ))}
              </div>
            </div>
          )}

          {!compareMode && (
            <div style={{ textAlign: "center", marginTop: 12 }}>
              <span style={{ fontSize: 12, color: "#9CA3AF", fontStyle: "italic" }}>
                i Enable 'Compare with previous order' toggle above for side-by-side comparison.
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// AFTER — in Document 1 (RetailerOrders)
export default function RetailerOrders() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #F3F4F6; } ::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 3px; }
      `}</style>
      <OrdersPage />
    </>
  );
}
