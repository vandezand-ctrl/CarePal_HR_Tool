import { useState } from "react";
import AppSidebar from "./App.jsx";
import AppKanban from "./AppKanban.jsx";
import AppDashboard from "./AppDashboard.jsx";
import AppTimeline from "./AppTimeline.jsx";
import AppWizard from "./AppWizard.jsx";

const PROTOTYPES = [
  { id: "sidebar", label: "A · Sidebar", component: AppSidebar },
  { id: "kanban", label: "B · Kanban", component: AppKanban },
  { id: "dashboard", label: "C · Dashboard", component: AppDashboard },
  { id: "timeline", label: "D · Activity Feed", component: AppTimeline },
  { id: "wizard", label: "E · Wizard", component: AppWizard },
];

export default function AppSwitcher() {
  const [active, setActive] = useState("sidebar");
  const ActiveApp = PROTOTYPES.find(p => p.id === active).component;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Switcher bar */}
      <div style={{
        height: 38, background: "#1e293b", display: "flex", alignItems: "center",
        justifyContent: "center", gap: 6, flexShrink: 0, zIndex: 100,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}>
        <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginRight: 8 }}>
          Prototype:
        </span>
        {PROTOTYPES.map(p => (
          <button
            key={p.id}
            onClick={() => setActive(p.id)}
            style={{
              padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer",
              background: active === p.id ? "#0d9488" : "#334155",
              color: active === p.id ? "#fff" : "#94a3b8",
              fontSize: 11, fontWeight: 600,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              transition: "all 0.15s",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Active prototype */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <ActiveApp />
      </div>
    </div>
  );
}
