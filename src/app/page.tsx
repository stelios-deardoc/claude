"use client";

import { useState } from "react";

// ── Types ──────────────────────────────────────────────────────────

interface PendingAccount {
  id: string;
  practice: string;
  contact: string;
  status: "New" | "In-Progress" | "Scheduled" | "Ride Out";
  saveType: string;
  cancelReason: string;
  monthlySales: number;
  contractTerm: string;
  paymentProcessor: string;
  saveDate: string;
  paymentStanding: "Good Standing" | "Bad Standing";
  notes: string;
  daysSinceActivity: number;
}

interface CalendarEvent {
  id: string;
  title: string;
  time: string;
  type: "save-call" | "exit-interview" | "internal" | "other";
  account?: string;
}

interface EmailItem {
  id: string;
  from: string;
  subject: string;
  preview: string;
  time: string;
  isUrgent: boolean;
  account?: string;
}

// ── Mock Data (to be replaced with live API calls) ─────────────────

const mockAccounts: PendingAccount[] = [
  {
    id: "1",
    practice: "Prestige Physicians",
    contact: "Kira Fenton",
    status: "In-Progress",
    saveType: "Retention",
    cancelReason: "Performance",
    monthlySales: 1200,
    contractTerm: "Annual",
    paymentProcessor: "Stripe",
    saveDate: "2026-02-18",
    paymentStanding: "Good Standing",
    notes: "Call completed 3/3. Pausing social postings, investigating $6000 charge.",
    daysSinceActivity: 7,
  },
  {
    id: "2",
    practice: "Oakland Park Dental",
    contact: "Dr. Ramirez",
    status: "Scheduled",
    saveType: "Retention",
    cancelReason: "Budget",
    monthlySales: 800,
    contractTerm: "Annual",
    paymentProcessor: "Braintree",
    saveDate: "2026-03-05",
    paymentStanding: "Good Standing",
    notes: "Call scheduled for 3/11. Claims budget constraints after expansion.",
    daysSinceActivity: 5,
  },
  {
    id: "3",
    practice: "Advanced Dental Arts",
    contact: "Dr. Patel",
    status: "New",
    saveType: "Cancellation",
    cancelReason: "Competitor",
    monthlySales: 1500,
    contractTerm: "Biennial",
    paymentProcessor: "Stripe",
    saveDate: "2026-03-08",
    paymentStanding: "Good Standing",
    notes: "New cancel request. Says competitor offered lower rate with similar features.",
    daysSinceActivity: 2,
  },
  {
    id: "4",
    practice: "Bright Smiles Family",
    contact: "Dr. Johnson",
    status: "In-Progress",
    saveType: "Retention",
    cancelReason: "CSM Neglect",
    monthlySales: 950,
    contractTerm: "Annual",
    paymentProcessor: "Ratio-Unclear",
    saveDate: "2026-02-25",
    paymentStanding: "Good Standing",
    notes: "Frustrated with lack of CSM support. Two unanswered emails to CSM team.",
    daysSinceActivity: 13,
  },
  {
    id: "5",
    practice: "Harmony Health Clinic",
    contact: "Dr. Williams",
    status: "Ride Out",
    saveType: "Cancellation",
    cancelReason: "Retired",
    monthlySales: 600,
    contractTerm: "Annual",
    paymentProcessor: "Capchase",
    saveDate: "2026-02-10",
    paymentStanding: "Good Standing",
    notes: "Retiring end of April. Riding out contract. No save opportunity.",
    daysSinceActivity: 28,
  },
  {
    id: "6",
    practice: "Summit Orthopedics",
    contact: "Raji Anup",
    status: "In-Progress",
    saveType: "Retention",
    cancelReason: "Performance",
    monthlySales: 2200,
    contractTerm: "Biennial",
    paymentProcessor: "Stripe",
    saveDate: "2026-03-01",
    paymentStanding: "Bad Standing",
    notes: "High-value account. Disputing charges, claims AI chat not working properly.",
    daysSinceActivity: 9,
  },
  {
    id: "7",
    practice: "Coastal Dermatology",
    contact: "Dr. Chen",
    status: "New",
    saveType: "Cancellation",
    cancelReason: "Budget",
    monthlySales: 750,
    contractTerm: "Annual",
    paymentProcessor: "Braintree",
    saveDate: "2026-03-09",
    paymentStanding: "Good Standing",
    notes: "Just came in. No outreach yet.",
    daysSinceActivity: 1,
  },
  {
    id: "8",
    practice: "Premier Family Practice",
    contact: "Dr. Thompson",
    status: "Scheduled",
    saveType: "Retention",
    cancelReason: "None",
    monthlySales: 1100,
    contractTerm: "Biennial",
    paymentProcessor: "Stripe",
    saveDate: "2026-03-04",
    paymentStanding: "Good Standing",
    notes: "Wants to discuss contract terms. Exit interview scheduled 3/12.",
    daysSinceActivity: 6,
  },
];

const mockCalendar: CalendarEvent[] = [
  { id: "c1", title: "Oakland Park Dental -- Save Call", time: "10:00 AM", type: "save-call", account: "Oakland Park Dental" },
  { id: "c2", title: "Team Standup", time: "11:30 AM", type: "internal" },
  { id: "c3", title: "Premier Family -- Exit Interview", time: "2:00 PM", type: "exit-interview", account: "Premier Family Practice" },
  { id: "c4", title: "Coastal Dermatology -- Intro Call", time: "3:30 PM", type: "save-call", account: "Coastal Dermatology" },
];

const mockEmails: EmailItem[] = [
  {
    id: "e1",
    from: "Kira Fenton",
    subject: "RE: Social Media Pause Confirmation",
    preview: "Hi Stelios, I still haven't seen the $6000 credit reflected on our account...",
    time: "9:15 AM",
    isUrgent: true,
    account: "Prestige Physicians",
  },
  {
    id: "e2",
    from: "Dr. Patel",
    subject: "Cancellation Request -- Advanced Dental Arts",
    preview: "We've decided to move forward with our cancellation. Please process...",
    time: "8:42 AM",
    isUrgent: true,
    account: "Advanced Dental Arts",
  },
  {
    id: "e3",
    from: "Raji Anup",
    subject: "RE: Summit Orthopedics Account Review",
    preview: "Thanks for looking into this. When can we schedule a call to discuss...",
    time: "Yesterday",
    isUrgent: false,
    account: "Summit Orthopedics",
  },
];

// ── Utility Components ─────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    New: { bg: "#3b82f620", text: "#60a5fa" },
    "In-Progress": { bg: "#f59e0b20", text: "#fbbf24" },
    Scheduled: { bg: "#22c55e20", text: "#4ade80" },
    "Ride Out": { bg: "#64748b20", text: "#94a3b8" },
    "Closed Lost": { bg: "#ef444420", text: "#f87171" },
  };
  const c = colors[status] || colors["New"];
  return (
    <span
      style={{
        background: c.bg,
        color: c.text,
        padding: "2px 10px",
        borderRadius: "9999px",
        fontSize: "12px",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

function PaymentBadge({ standing }: { standing: string }) {
  const isBad = standing === "Bad Standing";
  return (
    <span
      style={{
        color: isBad ? "#f87171" : "#4ade80",
        fontSize: "12px",
        fontWeight: 500,
      }}
    >
      {isBad ? "Bad" : "Good"}
    </span>
  );
}

function MetricCard({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div
      style={{
        background: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        borderRadius: "12px",
        padding: "20px",
        flex: 1,
        minWidth: "160px",
      }}
    >
      <div style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "8px" }}>{label}</div>
      <div style={{ fontSize: "28px", fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "6px" }}>{sub}</div>}
    </div>
  );
}

function EventTypeDot({ type }: { type: string }) {
  const colors: Record<string, string> = {
    "save-call": "#3b82f6",
    "exit-interview": "#f59e0b",
    internal: "#64748b",
    other: "#64748b",
  };
  return (
    <span
      style={{
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        background: colors[type] || "#64748b",
        display: "inline-block",
        marginRight: "8px",
        flexShrink: 0,
      }}
    />
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────

export default function Dashboard() {
  const [filter, setFilter] = useState<"all" | "active" | "stale" | "new">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Derived metrics
  const activeAccounts = mockAccounts.filter((a) => a.status !== "Ride Out");
  const mrrAtRisk = mockAccounts.reduce((sum, a) => sum + a.monthlySales, 0);
  const todaysCalls = mockCalendar.filter((e) => e.type === "save-call" || e.type === "exit-interview").length;
  const staleAccounts = mockAccounts.filter((a) => a.daysSinceActivity > 7 && a.status !== "Ride Out");
  const urgentEmails = mockEmails.filter((e) => e.isUrgent).length;

  // Filtered accounts
  const filteredAccounts = mockAccounts.filter((a) => {
    if (filter === "active") return a.status !== "Ride Out";
    if (filter === "stale") return a.daysSinceActivity > 7 && a.status !== "Ride Out";
    if (filter === "new") return a.status === "New";
    return true;
  });

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)", padding: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, margin: 0 }}>DearDoc Command Center</h1>
          <p style={{ fontSize: "13px", color: "var(--muted)", margin: "4px 0 0" }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              color: "#4ade80",
              background: "#22c55e15",
              padding: "4px 12px",
              borderRadius: "9999px",
            }}
          >
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4ade80" }} />
            Agents Active
          </span>
          <span style={{ fontSize: "13px", color: "var(--muted)" }}>Stelios Anastasiades</span>
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "24px", flexWrap: "wrap" }}>
        <MetricCard label="Active Saves" value={activeAccounts.length} color="var(--accent)" sub="pending accounts" />
        <MetricCard label="MRR at Risk" value={`$${mrrAtRisk.toLocaleString()}`} color="var(--danger)" sub="monthly revenue" />
        <MetricCard label="Today's Calls" value={todaysCalls} color="var(--success)" sub="save calls + exits" />
        <MetricCard label="Stale Accounts" value={staleAccounts.length} color="var(--warning)" sub="> 7 days no activity" />
        <MetricCard label="Urgent Emails" value={urgentEmails} color={urgentEmails > 0 ? "var(--danger)" : "var(--success)"} sub="need response" />
      </div>

      {/* Main Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "20px" }}>
        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Today's Schedule */}
          <div
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
              borderRadius: "12px",
              padding: "20px",
            }}
          >
            <h2 style={{ fontSize: "15px", fontWeight: 600, margin: "0 0 16px" }}>Today&apos;s Schedule</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {mockCalendar.map((event) => (
                <div
                  key={event.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "10px 12px",
                    background: "#0f172a",
                    borderRadius: "8px",
                    gap: "4px",
                  }}
                >
                  <EventTypeDot type={event.type} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {event.title}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--muted)" }}>{event.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Client Emails */}
          <div
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
              borderRadius: "12px",
              padding: "20px",
            }}
          >
            <h2 style={{ fontSize: "15px", fontWeight: 600, margin: "0 0 16px" }}>Client Emails</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {mockEmails.map((email) => (
                <div
                  key={email.id}
                  style={{
                    padding: "10px 12px",
                    background: "#0f172a",
                    borderRadius: "8px",
                    borderLeft: email.isUrgent ? "3px solid var(--danger)" : "3px solid transparent",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600 }}>{email.from}</span>
                    <span style={{ fontSize: "11px", color: "var(--muted)" }}>{email.time}</span>
                  </div>
                  <div style={{ fontSize: "12px", fontWeight: 500, marginBottom: "2px" }}>{email.subject}</div>
                  <div style={{ fontSize: "11px", color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {email.preview}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
              borderRadius: "12px",
              padding: "20px",
            }}
          >
            <h2 style={{ fontSize: "15px", fontWeight: 600, margin: "0 0 16px" }}>Quick Actions</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[
                { label: "Run Morning Briefing", icon: "📋" },
                { label: "Batch Follow-ups", icon: "📧" },
                { label: "Check Emails Now", icon: "📥" },
                { label: "Prep Today's Calls", icon: "📞" },
              ].map((action) => (
                <button
                  key={action.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    width: "100%",
                    padding: "10px 14px",
                    background: "#0f172a",
                    border: "1px solid var(--card-border)",
                    borderRadius: "8px",
                    color: "var(--foreground)",
                    fontSize: "13px",
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "border-color 0.15s",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--card-border)")}
                >
                  <span>{action.icon}</span>
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column -- Pending Accounts */}
        <div
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--card-border)",
            borderRadius: "12px",
            padding: "20px",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 600, margin: 0 }}>
              Pending Accounts{" "}
              <span style={{ color: "var(--muted)", fontWeight: 400 }}>({filteredAccounts.length})</span>
            </h2>
            <div style={{ display: "flex", gap: "4px" }}>
              {(["all", "active", "stale", "new"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: "6px",
                    border: "none",
                    background: filter === f ? "var(--accent)" : "transparent",
                    color: filter === f ? "#fff" : "var(--muted)",
                    fontSize: "12px",
                    fontWeight: 500,
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Table Header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1.2fr 0.8fr 1fr 0.8fr 0.7fr",
              padding: "8px 12px",
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              borderBottom: "1px solid var(--card-border)",
            }}
          >
            <span>Practice</span>
            <span>Contact</span>
            <span>Status</span>
            <span>MRR</span>
            <span>Payment</span>
            <span>Days</span>
          </div>

          {/* Table Rows */}
          <div style={{ maxHeight: "calc(100vh - 340px)", overflowY: "auto" }}>
            {filteredAccounts.map((account) => (
              <div key={account.id}>
                <div
                  onClick={() => setExpandedId(expandedId === account.id ? null : account.id)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1.2fr 0.8fr 1fr 0.8fr 0.7fr",
                    padding: "12px",
                    fontSize: "13px",
                    borderBottom: "1px solid #1e293b50",
                    cursor: "pointer",
                    background: expandedId === account.id ? "#1e293b80" : "transparent",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (expandedId !== account.id) e.currentTarget.style.background = "#1e293b40";
                  }}
                  onMouseLeave={(e) => {
                    if (expandedId !== account.id) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {account.practice}
                  </span>
                  <span style={{ color: "var(--muted)" }}>{account.contact}</span>
                  <span>
                    <StatusBadge status={account.status} />
                  </span>
                  <span style={{ fontWeight: 600 }}>${account.monthlySales.toLocaleString()}</span>
                  <span>
                    <PaymentBadge standing={account.paymentStanding} />
                  </span>
                  <span
                    style={{
                      color: account.daysSinceActivity > 7 ? "var(--warning)" : "var(--muted)",
                      fontWeight: account.daysSinceActivity > 7 ? 600 : 400,
                    }}
                  >
                    {account.daysSinceActivity}d
                  </span>
                </div>

                {/* Expanded Detail Panel */}
                {expandedId === account.id && (
                  <div
                    style={{
                      padding: "16px 20px",
                      background: "#0f172a",
                      borderBottom: "1px solid var(--card-border)",
                    }}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "12px" }}>
                      <div>
                        <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>Cancel Reason</div>
                        <div style={{ fontSize: "13px", fontWeight: 500 }}>{account.cancelReason}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>Contract</div>
                        <div style={{ fontSize: "13px", fontWeight: 500 }}>{account.contractTerm}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>Processor</div>
                        <div style={{ fontSize: "13px", fontWeight: 500 }}>{account.paymentProcessor}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>Save Type</div>
                        <div style={{ fontSize: "13px", fontWeight: 500 }}>{account.saveType}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>Save Date</div>
                        <div style={{ fontSize: "13px", fontWeight: 500 }}>{account.saveDate}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>Payment</div>
                        <div style={{ fontSize: "13px", fontWeight: 500 }}>{account.paymentStanding}</div>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>Notes</div>
                      <div style={{ fontSize: "13px", lineHeight: "1.5" }}>{account.notes}</div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                      <button
                        style={{
                          padding: "6px 14px",
                          background: "var(--accent)",
                          color: "#fff",
                          border: "none",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        Get Intel
                      </button>
                      <button
                        style={{
                          padding: "6px 14px",
                          background: "transparent",
                          color: "var(--foreground)",
                          border: "1px solid var(--card-border)",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        Draft Follow-up
                      </button>
                      <button
                        style={{
                          padding: "6px 14px",
                          background: "transparent",
                          color: "var(--foreground)",
                          border: "1px solid var(--card-border)",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        View Emails
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
