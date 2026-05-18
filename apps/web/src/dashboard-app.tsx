import {
  Activity,
  Bell,
  Bot,
  Boxes,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronsLeft,
  Circle,
  CircleHelp,
  Database,
  FileCode2,
  Folder,
  GitBranch,
  GitFork,
  GitPullRequest,
  HardDrive,
  Home,
  KeyRound,
  LayoutGrid,
  ListChecks,
  Lock,
  Menu,
  Network,
  RefreshCw,
  Server,
  Settings,
  ShieldCheck,
  Users,
  Workflow
} from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { LucideIcon } from "lucide-react";

type SessionStatus = "진행 중" | "대기 중" | "완료" | "검토 필요";

type SessionRow = {
  accent: string;
  name: string;
  ownerInitial: string;
  owner: string;
  tasks: number;
  branch: string;
  status: SessionStatus;
  lastActive: string;
};

type Metric = {
  title: string;
  value: string;
  delta: string;
  caption: string;
  icon: LucideIcon;
  tone: "green" | "blue" | "violet" | "amber";
};

type AgentRow = {
  name: string;
  work: string;
  status: "작업 중" | "대기 중" | "유휴";
};

type SystemRow = {
  icon: LucideIcon;
  name: string;
  status: "정상" | "주의";
};

type NavItem = {
  icon: LucideIcon;
  label: string;
  active?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const metrics: Metric[] = [
  {
    title: "활성 세션",
    value: "12",
    delta: "20%",
    caption: "전체 28개 세션 중",
    icon: Users,
    tone: "green"
  },
  {
    title: "병렬 작업",
    value: "24",
    delta: "18%",
    caption: "진행 중인 작업",
    icon: GitFork,
    tone: "blue"
  },
  {
    title: "모의 병합 준비율",
    value: "98.6%",
    delta: "2.1%",
    caption: "최근 7일 기준",
    icon: ShieldCheck,
    tone: "violet"
  },
  {
    title: "에이전트",
    value: "8",
    delta: "정상",
    caption: "전체 10개 중",
    icon: Bot,
    tone: "amber"
  }
];

const sessionRows: SessionRow[] = [
  {
    accent: "#b77cff",
    name: "feat/user-auth-flow",
    ownerInitial: "J",
    owner: "james.kim",
    tasks: 3,
    branch: "feature/user-auth",
    status: "진행 중",
    lastActive: "1분 전"
  },
  {
    accent: "#63c17a",
    name: "fix/payment-timeout",
    ownerInitial: "S",
    owner: "sarah.lee",
    tasks: 2,
    branch: "bugfix/payment-timeout",
    status: "진행 중",
    lastActive: "3분 전"
  },
  {
    accent: "#6aa7de",
    name: "refactor/order-service",
    ownerInitial: "M",
    owner: "min.han",
    tasks: 4,
    branch: "refactor/order-service",
    status: "진행 중",
    lastActive: "5분 전"
  },
  {
    accent: "#f0d55d",
    name: "chore/update-deps",
    ownerInitial: "J",
    owner: "james.kim",
    tasks: 1,
    branch: "chore/update-deps",
    status: "대기 중",
    lastActive: "12분 전"
  },
  {
    accent: "#98a1ad",
    name: "docs/update-readme",
    ownerInitial: "Y",
    owner: "you",
    tasks: 1,
    branch: "docs/update-readme",
    status: "완료",
    lastActive: "30분 전"
  }
];

const mergeData = [
  { name: "병합 성공", value: 29, color: "#65bd78" },
  { name: "병합 대기", value: 2, color: "#f0d55d" },
  { name: "충돌 해결 중", value: 1, color: "#ef9d5a" },
  { name: "실패", value: 0, color: "#f36f62" }
];

const commitActivity = [
  { day: "5/10", commits: 14 },
  { day: "5/11", commits: 18 },
  { day: "5/12", commits: 16 },
  { day: "5/13", commits: 22 },
  { day: "5/14", commits: 21 },
  { day: "5/15", commits: 17 },
  { day: "5/16", commits: 20 }
];

const agentRows: AgentRow[] = [
  { name: "CodeAgent-01", work: "코드 생성", status: "작업 중" },
  { name: "ReviewAgent-02", work: "코드 리뷰", status: "대기 중" },
  { name: "MergeAgent-01", work: "병합 관리", status: "작업 중" },
  { name: "DBAgent-01", work: "DB 분석", status: "유휴" },
  { name: "PolicyAgent-01", work: "정책 검증", status: "유휴" }
];

const systemRows: SystemRow[] = [
  { icon: BrainCircuit, name: "LLM / Provider", status: "정상" },
  { icon: Network, name: "MCP", status: "정상" },
  { icon: Lock, name: "Auth / Scope / Policy", status: "정상" },
  { icon: Database, name: "Database", status: "정상" },
  { icon: HardDrive, name: "스토리지", status: "정상" }
];

const navGroups: NavGroup[] = [
  {
    label: "",
    items: [{ icon: Home, label: "대시보드", active: true }]
  },
  {
    label: "작업",
    items: [
      { icon: FileCode2, label: "세션" },
      { icon: LayoutGrid, label: "세션 보드" },
      { icon: ListChecks, label: "작업 큐" },
      { icon: Workflow, label: "병합 관리" }
    ]
  },
  {
    label: "소스 & 저장소",
    items: [
      { icon: Folder, label: "저장소" },
      { icon: Boxes, label: "파일 브라우저" },
      { icon: GitBranch, label: "Git 상태" }
    ]
  },
  {
    label: "에이전트",
    items: [
      { icon: Bot, label: "에이전트 목록" },
      { icon: Server, label: "에이전트 상태" }
    ]
  },
  {
    label: "관리",
    items: [
      { icon: BrainCircuit, label: "LLM / MCP / Provider" },
      { icon: KeyRound, label: "Auth / Scope / Policy" },
      { icon: Database, label: "데이터베이스" }
    ]
  },
  {
    label: "시스템",
    items: [
      { icon: Activity, label: "감사 로그" },
      { icon: Settings, label: "시스템 설정" }
    ]
  }
];

const statusClass: Record<SessionStatus | AgentRow["status"] | SystemRow["status"], string> = {
  "진행 중": "status-green",
  "대기 중": "status-yellow",
  "완료": "status-blue",
  "검토 필요": "status-red",
  "작업 중": "status-green",
  "유휴": "status-muted",
  "정상": "status-green",
  "주의": "status-yellow"
};

const columnHelper = createColumnHelper<SessionRow>();

const sessionColumns = [
  columnHelper.accessor("name", {
    header: "세션 이름",
    cell: (info) => (
      <span className="session-name">
        <span className="branch-dot" style={{ backgroundColor: info.row.original.accent }} />
        {info.getValue()}
      </span>
    )
  }),
  columnHelper.accessor("owner", {
    header: "소유자",
    cell: (info) => (
      <span className="owner-cell">
        <span className="avatar avatar-sm">{info.row.original.ownerInitial}</span>
        {info.getValue()}
      </span>
    )
  }),
  columnHelper.accessor("tasks", {
    header: "작업"
  }),
  columnHelper.accessor("branch", {
    header: "브랜치"
  }),
  columnHelper.accessor("status", {
    header: "상태",
    cell: (info) => <span className={`status-pill ${statusClass[info.getValue()]}`}>{info.getValue()}</span>
  }),
  columnHelper.accessor("lastActive", {
    header: "마지막 활동"
  })
];

export function DashboardApp() {
  const table = useReactTable({
    data: sessionRows,
    columns: sessionColumns,
    getCoreRowModel: getCoreRowModel()
  });

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark">
            <Workflow size={18} aria-hidden="true" />
          </div>
          <span>AICHESTRA</span>
          <button className="icon-button compact" type="button" aria-label="메뉴 접기" title="메뉴 접기">
            <ChevronsLeft size={16} />
          </button>
        </div>
        <nav className="side-nav" aria-label="대시보드 내비게이션">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label || "home"}>
              {group.label ? <p className="nav-label">{group.label}</p> : null}
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <a className={`nav-item ${item.active ? "is-active" : ""}`} href="/" key={item.label}>
                    <Icon size={18} aria-hidden="true" />
                    <span>{item.label}</span>
                  </a>
                );
              })}
            </div>
          ))}
        </nav>
        <button className="collapse-button" type="button">
          <ChevronsLeft size={18} aria-hidden="true" />
          <span>메뉴 접기</span>
        </button>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <h1>대시보드</h1>
            <p>시스템 전체 상태와 주요 작업 현황을 한눈에 확인하세요.</p>
          </div>
          <div className="top-actions">
            <button className="select-button" type="button">
              <span>전체 조직</span>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
            <button className="icon-button" type="button" aria-label="알림" title="알림">
              <Bell size={18} />
            </button>
            <button className="icon-button" type="button" aria-label="도움말" title="도움말">
              <CircleHelp size={18} />
            </button>
            <button className="user-button" type="button">
              <span className="avatar">A</span>
              <span>Admin</span>
              <ChevronDown size={15} aria-hidden="true" />
            </button>
          </div>
        </header>

        <section className="refresh-row" aria-label="업데이트 상태">
          <label className="toggle">
            <input type="checkbox" />
            <span>자동 새로고침</span>
            <span className="toggle-track" aria-hidden="true" />
          </label>
          <span>마지막 업데이트: 1분 전</span>
        </section>

        <section className="metrics-grid" aria-label="핵심 지표">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <article className={`metric-card tone-${metric.tone}`} key={metric.title}>
                <div>
                  <p className="card-label">{metric.title}</p>
                  <div className="metric-value">
                    <strong>{metric.value}</strong>
                    <span>{metric.delta === "정상" ? <Circle size={8} fill="currentColor" /> : "↑"} {metric.delta}</span>
                  </div>
                  <p className="muted">{metric.caption}</p>
                </div>
                <Icon className="metric-icon" size={44} aria-hidden="true" />
              </article>
            );
          })}
        </section>

        <section className="content-grid primary-grid">
          <article className="panel panel-large">
            <PanelHeader title="세션 현황" />
            <div className="table-wrap">
              <table>
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th key={header.id}>
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="panel merge-panel">
            <PanelHeader title="병합 관리 현황" />
            <div className="merge-body">
              <div className="donut-wrap">
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie
                      data={mergeData}
                      dataKey="value"
                      innerRadius={56}
                      outerRadius={75}
                      paddingAngle={2}
                      stroke="none"
                      startAngle={90}
                      endAngle={-270}
                    >
                      {mergeData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center">
                  <strong>32</strong>
                  <span>전체</span>
                </div>
              </div>
              <div className="legend-list">
                {mergeData.map((item) => (
                  <div className="legend-row" key={item.name}>
                    <span className="legend-name">
                      <span style={{ backgroundColor: item.color }} />
                      {item.name}
                    </span>
                    <span>{item.value} ({item.value === 0 ? "0" : ((item.value / 32) * 100).toFixed(1)}%)</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="activity-row">
              <div>
                <p className="card-label">최근 충돌 해결</p>
                <strong>conflict in src/services/order.ts</strong>
              </div>
              <span className="status-pill status-green">해결 완료</span>
              <span className="muted">3분 전</span>
            </div>
          </article>
        </section>

        <section className="content-grid secondary-grid">
          <article className="panel repo-panel">
            <PanelHeader title="저장소 상태" />
            <div className="repo-card">
              <div className="repo-title">
                <GitPullRequest size={21} aria-hidden="true" />
                <div>
                  <strong>aichestra/core</strong>
                  <span>main</span>
                </div>
                <span className="provider-badge">GitHub</span>
                <span className="clean-state">
                  <CheckCircle2 size={15} aria-hidden="true" />
                  Clean
                </span>
              </div>
              <div className="repo-stats">
                <Stat label="커밋 (24h)" value="14" />
                <Stat label="변경 파일" value="23" />
                <Stat label="열린 PR" value="3" />
                <Stat label="미병합 브랜치" value="5" />
              </div>
            </div>
            <div className="chart-title">커밋 활동 (지난 7일)</div>
            <div className="bar-chart">
              <ResponsiveContainer width="100%" height={86}>
                <BarChart data={commitActivity}>
                  <Bar dataKey="commits" radius={[2, 2, 0, 0]}>
                    {commitActivity.map((entry, index) => (
                      <Cell key={entry.day} fill={index === commitActivity.length - 1 ? "#65bd78" : "#59616d"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="bar-labels">
                {commitActivity.map((entry) => (
                  <span key={entry.day}>{entry.day}</span>
                ))}
              </div>
            </div>
          </article>

          <article className="panel agent-panel">
            <PanelHeader title="에이전트 상태" />
            <div className="list-table">
              {agentRows.map((agent) => (
                <div className="agent-row" key={agent.name}>
                  <span className="agent-icon">
                    <Bot size={17} aria-hidden="true" />
                  </span>
                  <strong>{agent.name}</strong>
                  <span>{agent.work}</span>
                  <span className={`status-text ${statusClass[agent.status]}`}>{agent.status}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel system-panel">
            <PanelHeader title="시스템 상태" hideLink />
            <div className="list-table">
              {systemRows.map((system) => {
                const Icon = system.icon;
                return (
                  <div className="system-row" key={system.name}>
                    <Icon size={18} aria-hidden="true" />
                    <strong>{system.name}</strong>
                    <span className={`status-text ${statusClass[system.status]}`}>{system.status}</span>
                  </div>
                );
              })}
            </div>
          </article>
        </section>

        <footer className="footer-row">
          <span>AICHESTRA v0.1.0</span>
          <span>© 2025 Aichestra. All rights reserved.</span>
        </footer>
      </main>
    </div>
  );
}

function PanelHeader({ title, hideLink = false }: { title: string; hideLink?: boolean }) {
  return (
    <div className="panel-header">
      <h2>{title}</h2>
      {hideLink ? null : (
        <a href="/">
          전체 보기
          <ChevronDown size={14} aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
