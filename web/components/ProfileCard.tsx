"use client";

import { useState, useEffect } from "react";

interface Profile {
  goal: string;
  weeklyMileage: string;
  availableTime: string;
  issues: string[];
  preferredPace?: string;
  experience?: string;
}

export default function ProfileCard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Profile>>({});

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/profile");
      const data = await res.json();
      if (data.success) {
        setProfile(data.profile);
        setForm(data.profile);
      }
    } catch (err) {
      console.error("获取画像失败:", err);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const saveProfile = async () => {
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setProfile(data.profile);
        setEditing(false);
      }
    } catch (err) {
      console.error("更新画像失败:", err);
    }
  };

  if (!profile) {
    return <div style={styles.loading}>加载中...</div>;
  }

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>👤 跑者画像</h3>

      {editing ? (
        <div style={styles.form}>
          <label style={styles.label}>目标</label>
          <input
            style={styles.input}
            value={form.goal || ""}
            onChange={(e) => setForm({ ...form, goal: e.target.value })}
          />
          <label style={styles.label}>周跑量</label>
          <input
            style={styles.input}
            value={form.weeklyMileage || ""}
            onChange={(e) => setForm({ ...form, weeklyMileage: e.target.value })}
          />
          <label style={styles.label}>可用时间</label>
          <input
            style={styles.input}
            value={form.availableTime || ""}
            onChange={(e) => setForm({ ...form, availableTime: e.target.value })}
          />
          <label style={styles.label}>偏好配速</label>
          <input
            style={styles.input}
            value={form.preferredPace || ""}
            onChange={(e) => setForm({ ...form, preferredPace: e.target.value })}
          />
          <label style={styles.label}>经验</label>
          <input
            style={styles.input}
            value={form.experience || ""}
            onChange={(e) => setForm({ ...form, experience: e.target.value })}
          />
          <div style={styles.buttonRow}>
            <button style={styles.saveButton} onClick={saveProfile}>
              💾 保存
            </button>
            <button
              style={styles.cancelButton}
              onClick={() => {
                setForm(profile);
                setEditing(false);
              }}
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <div style={styles.display}>
          <div style={styles.row}>
            <span style={styles.label}>🎯 目标</span>
            <span style={styles.value}>{profile.goal}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>📏 周跑量</span>
            <span style={styles.value}>{profile.weeklyMileage}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>⏰ 可用时间</span>
            <span style={styles.value}>{profile.availableTime}</span>
          </div>
          {profile.preferredPace && (
            <div style={styles.row}>
              <span style={styles.label}>🏃 偏好配速</span>
              <span style={styles.value}>{profile.preferredPace}</span>
            </div>
          )}
          {profile.experience && (
            <div style={styles.row}>
              <span style={styles.label}>📅 经验</span>
              <span style={styles.value}>{profile.experience}</span>
            </div>
          )}
          {(profile.issues?.length || 0) > 0 && (
            <div style={styles.issues}>
              <span style={styles.label}>⚠️ 注意事项</span>
              <div style={styles.issueTags}>
                {profile.issues?.map((issue, i) => (
                  <span key={i} style={styles.issueTag}>{issue}</span>
                ))}
              </div>
            </div>
          )}
          <button
            style={styles.editButton}
            onClick={() => setEditing(true)}
          >
            ✏️ 编辑
          </button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "16px",
  },
  loading: {
    padding: "20px",
    textAlign: "center",
    color: "var(--text-secondary)",
  },
  title: {
    color: "var(--accent)",
    fontSize: "16px",
    marginBottom: "12px",
    borderBottom: "1px solid var(--border)",
    paddingBottom: "8px",
  },
  display: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 0",
    borderBottom: "1px solid var(--border)",
  },
  label: {
    fontSize: "12px",
    color: "var(--text-secondary)",
  },
  value: {
    fontSize: "13px",
    color: "var(--text-primary)",
    fontWeight: "bold",
  },
  input: {
    fontSize: "13px",
    padding: "6px 10px",
  },
  issues: {
    marginTop: "8px",
  },
  issueTags: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginTop: "6px",
  },
  issueTag: {
    fontSize: "11px",
    padding: "3px 8px",
    background: "var(--error)",
    color: "var(--bg-primary)",
    borderRadius: "4px",
  },
  buttonRow: {
    display: "flex",
    gap: "8px",
    marginTop: "8px",
  },
  editButton: {
    marginTop: "12px",
    padding: "8px",
    background: "var(--bg-tertiary)",
    color: "var(--text-primary)",
    borderRadius: "4px",
    fontSize: "13px",
  },
  saveButton: {
    flex: 1,
    padding: "8px",
    background: "var(--accent)",
    color: "var(--bg-primary)",
    borderRadius: "4px",
    fontSize: "13px",
    fontWeight: "bold",
  },
  cancelButton: {
    flex: 1,
    padding: "8px",
    background: "var(--bg-tertiary)",
    color: "var(--text-primary)",
    borderRadius: "4px",
    fontSize: "13px",
  },
};
