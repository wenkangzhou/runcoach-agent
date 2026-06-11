import Chat from "../components/Chat";
import ProfileCard from "../components/ProfileCard";
import RunLogList from "../components/RunLogList";
import StravaConnect from "../components/StravaConnect";

export default function Home() {
  return (
    <div style={styles.page}>
      {/* CRT 扫描线效果 */}
      <div style={styles.crtOverlay} />

      {/* 顶部标题栏 */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <h1 style={styles.title}>
            <span style={styles.titleIcon}>🏃</span>
            <span style={styles.titleText}>跑蓝</span>
            <span style={styles.titleSub}>RunCoach</span>
          </h1>
          <p style={styles.subtitle}>AI 跑步教练 · 像展示作品一样展示你的跑步生涯</p>
        </div>
      </header>

      {/* 主内容区 */}
      <div style={styles.main}>
        {/* 左侧边栏 */}
        <aside style={styles.sidebar}>
          <StravaConnect />
          <div style={styles.divider} />
          <ProfileCard />
          <div style={styles.divider} />
          <RunLogList />
        </aside>

        {/* 右侧聊天区 */}
        <main style={styles.chatArea}>
          <Chat />
        </main>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    background: "var(--bg-primary)",
    overflow: "hidden",
  },
  crtOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: 9999,
    background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 1px, transparent 1px, transparent 2px)",
  },
  header: {
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-secondary)",
    padding: "12px 20px",
    flexShrink: 0,
  },
  headerContent: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "20px",
    fontWeight: "bold",
    margin: 0,
  },
  titleIcon: {
    fontSize: "24px",
  },
  titleText: {
    color: "var(--accent)",
    fontFamily: "'Courier New', monospace",
  },
  titleSub: {
    color: "var(--text-secondary)",
    fontSize: "14px",
    fontWeight: "normal",
  },
  subtitle: {
    fontSize: "12px",
    color: "var(--text-secondary)",
    margin: 0,
  },
  main: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  sidebar: {
    width: "320px",
    minWidth: "320px",
    borderRight: "1px solid var(--border)",
    background: "var(--bg-secondary)",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
  },
  divider: {
    height: "1px",
    background: "var(--border)",
    margin: "0 16px",
  },
  chatArea: {
    flex: 1,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
};
