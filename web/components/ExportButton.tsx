"use client";

import { useState, useRef, useEffect } from "react";

/**
 * 导出按钮组件
 * 下拉菜单：导出 CSV、导出 JSON、导出周报
 */
export default function ExportButton() {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExport = async (format: string) => {
    setExporting(true);
    setOpen(false);
    try {
      const url = `/api/export?format=${format}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("导出失败");

      const blob = await res.blob();
      const filename = format === "csv" ? "runcoach-export.csv" : "runcoach-export.json";
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error("导出失败:", err);
      alert("导出失败，请重试");
    } finally {
      setExporting(false);
    }
  };

  const handleExportWeekly = async () => {
    setExporting(true);
    setOpen(false);
    try {
      const res = await fetch("/api/export/weekly?weeks=4");
      if (!res.ok) throw new Error("导出失败");

      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "runcoach-weekly-report.json";
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error("导出周报失败:", err);
      alert("导出周报失败，请重试");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div ref={containerRef} style={styles.container}>
      <button
        style={styles.mainBtn}
        onClick={() => setOpen(!open)}
        disabled={exporting}
      >
        {exporting ? "⏳ 导出中..." : "📥 导出数据"}
      </button>

      {open && (
        <div style={styles.dropdown}>
          <button style={styles.dropBtn} onClick={() => handleExport("csv")}>
            📄 导出 CSV
          </button>
          <button style={styles.dropBtn} onClick={() => handleExport("json")}>
            🗃️ 导出 JSON
          </button>
          <div style={styles.divider} />
          <button style={styles.dropBtn} onClick={handleExportWeekly}>
            📊 导出周报
          </button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "relative",
    display: "inline-block",
  },
  mainBtn: {
    padding: "8px 16px",
    background: "var(--bg-tertiary)",
    color: "var(--text-primary)",
    borderRadius: "4px",
    fontSize: "13px",
    fontWeight: "bold",
    cursor: "pointer",
    fontFamily: "'Courier New', monospace",
    minHeight: "44px",
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    right: 0,
    marginTop: "4px",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    background: "var(--bg-secondary)",
    border: "2px solid var(--border)",
    borderRadius: "4px",
    padding: "4px",
    zIndex: 100,
    minWidth: "140px",
  },
  dropBtn: {
    padding: "8px 12px",
    background: "transparent",
    color: "var(--text-primary)",
    fontSize: "12px",
    textAlign: "left",
    cursor: "pointer",
    borderRadius: "2px",
    fontFamily: "'Courier New', monospace",
    minHeight: "36px",
  },
  divider: {
    height: "1px",
    background: "var(--border)",
    margin: "2px 0",
  },
};
