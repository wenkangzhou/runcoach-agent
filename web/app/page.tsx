"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Chat from "../components/Chat";
import Dashboard from "../components/dashboard/Dashboard";
import ProfileCard from "../components/ProfileCard";
import RunLogList from "../components/RunLogList";
import StravaConnect from "../components/StravaConnect";

interface TrainingReminder {
  hasTraining: boolean;
  formatted?: string;
  reminder?: {
    type?: string;
    distance?: number;
    pace?: string;
  };
}

export default function Home() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<"chat" | "dashboard">("chat");
  const [mobileView, setMobileView] = useState<"main" | "sidebar">("main");
  const [isMobile, setIsMobile] = useState(false);
  const [reminder, setReminder] = useState<TrainingReminder | null>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    // 加载今日训练提醒
    const fetchReminder = async () => {
      try {
        const res = await fetch("/api/reminder");
        const data = await res.json();
        if (data.success && data.hasTraining) {
          setReminder(data);
        }
      } catch (err) {
        console.error("获取训练提醒失败:", err);
      }
    };
    fetchReminder();
  }, []);

  const isLoggedIn = status === "authenticated" && session?.user;

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
          <div style={styles.headerRight}>
            <p style={styles.subtitle}>AI 跑步教练 · 像展示作品一样展示你的跑步生涯</p>
            {/* 登录状态 - 仅已登录时显示 */}
            <div style={styles.authArea}>
              {isLoggedIn ? (
                <div style={styles.userInfo}>
                  {session.user?.image && (
                    <img
                      src={session.user.image}
                      alt="avatar"
                      style={styles.avatar}
                    />
                  )}
                  <span style={styles.userName}>{session.user?.name || "用户"}</span>
                  <button style={styles.authBtn} onClick={() => signOut()}>
                    登出
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {/* 今日训练提醒横幅 */}
      {reminder?.hasTraining && (
        <div style={styles.reminderBanner}>
          <span style={styles.reminderIcon}>🏃</span>
          <span style={styles.reminderText}>
            今日训练: {reminder.formatted}
          </span>
        </div>
      )}

      {/* 主内容区 */}
      <div style={styles.main}>
        {/* 左侧边栏 - 桌面端始终显示，移动端可切换 */}
        {(!isMobile || mobileView === "sidebar") && (
          <aside style={styles.sidebar}>
            {isMobile && (
              <button
                style={styles.backBtn}
                onClick={() => setMobileView("main")}
              >
                ← 返回
              </button>
            )}
            <StravaConnect />
            <div style={styles.divider} />
            <ProfileCard />
            <div style={styles.divider} />
            <RunLogList />
          </aside>
        )}

        {/* 右侧内容区 */}
        {(!isMobile || mobileView === "main") && (
          <main style={styles.contentArea}>
            {/* 移动端侧边栏切换按钮 */}
            {isMobile && (
              <button
                style={styles.sidebarToggle}
                onClick={() => setMobileView("sidebar")}
              >
                ☰ 训练记录
              </button>
            )}

            {/* 标签栏 */}
            <div style={styles.tabBar}>
              <button
                style={{
                  ...styles.tab,
                  ...(activeTab === "chat" ? styles.tabActive : {}),
                }}
                onClick={() => setActiveTab("chat")}
              >
                💬 教练对话
              </button>
              <button
                style={{
                  ...styles.tab,
                  ...(activeTab === "dashboard" ? styles.tabActive : {}),
                }}
                onClick={() => setActiveTab("dashboard")}
              >
                📊 数据仪表盘
              </button>
            </div>

            {/* 内容区 */}
            <div style={styles.tabContent}>
              {activeTab === "chat" ? <Chat /> : <Dashboard />}
            </div>
          </main>
        )}
      </div>

      {/* 移动端底部导航 */}
      {isMobile && (
        <nav style={styles.bottomNav}>
          <button
            style={{
              ...styles.navBtn,
              ...(activeTab === "chat" ? styles.navBtnActive : {}),
            }}
            onClick={() => {
              setActiveTab("chat");
              setMobileView("main");
            }}
          >
            <span style={styles.navIcon}>💬</span>
            <span style={styles.navLabel}>教练</span>
          </button>
          <button
            style={{
              ...styles.navBtn,
              ...(activeTab === "dashboard" ? styles.navBtnActive : {}),
            }}
            onClick={() => {
              setActiveTab("dashboard");
              setMobileView("main");
            }}
          >
            <span style={styles.navIcon}>📊</span>
            <span style={styles.navLabel}>数据</span>
          </button>
          <button
            style={styles.navBtn}
            onClick={() => setMobileView("sidebar")}
          >
            <span style={styles.navIcon}>📋</span>
            <span style={styles.navLabel}>记录</span>
          </button>
        </nav>
      )}
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
  headerRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "4px",
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
  authArea: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  userInfo: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  avatar: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    objectFit: "cover",
  },
  userName: {
    fontSize: "12px",
    color: "var(--text-primary)",
    fontWeight: 500,
  },
  authBtn: {
    fontSize: "12px",
    padding: "4px 10px",
    background: "var(--bg-tertiary)",
    color: "var(--text-secondary)",
    borderRadius: "4px",
    border: "1px solid var(--border)",
    cursor: "pointer",
  },
  reminderBanner: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 20px",
    background: "rgba(249, 115, 22, 0.15)",
    borderBottom: "1px solid rgba(249, 115, 22, 0.3)",
    color: "#f97316",
    fontSize: "14px",
    fontWeight: "bold",
    fontFamily: "'Courier New', monospace",
    flexShrink: 0,
  },
  reminderIcon: {
    fontSize: "18px",
  },
  reminderText: {
    flex: 1,
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
  contentArea: {
    flex: 1,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  tabBar: {
    display: "flex",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-secondary)",
    flexShrink: 0,
  },
  tab: {
    padding: "12px 20px",
    fontSize: "14px",
    color: "var(--text-secondary)",
    background: "transparent",
    borderBottom: "2px solid transparent",
    cursor: "pointer",
    minHeight: "44px",
    transition: "all 0.2s",
  },
  tabActive: {
    color: "var(--accent)",
    borderBottom: "2px solid var(--accent)",
    fontWeight: "bold",
  },
  tabContent: {
    flex: 1,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  sidebarToggle: {
    padding: "10px 16px",
    background: "var(--bg-tertiary)",
    color: "var(--text-primary)",
    fontSize: "14px",
    textAlign: "left",
    borderBottom: "1px solid var(--border)",
    minHeight: "44px",
  },
  backBtn: {
    padding: "12px 16px",
    background: "var(--bg-tertiary)",
    color: "var(--text-primary)",
    fontSize: "14px",
    textAlign: "left",
    borderBottom: "1px solid var(--border)",
    minHeight: "44px",
  },
  bottomNav: {
    display: "flex",
    justifyContent: "space-around",
    alignItems: "center",
    height: "56px",
    background: "var(--bg-secondary)",
    borderTop: "1px solid var(--border)",
    flexShrink: 0,
    zIndex: 100,
  },
  navBtn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "2px",
    flex: 1,
    height: "100%",
    background: "transparent",
    color: "var(--text-secondary)",
    fontSize: "10px",
    minHeight: "44px",
  },
  navBtnActive: {
    color: "var(--accent)",
  },
  navIcon: {
    fontSize: "20px",
  },
  navLabel: {
    fontSize: "10px",
  },
};
