import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../api";
import { Modal } from "./Modal";
import { isCtfProject } from "../projectStatus";
import { useT } from "../i18n";

interface TrackSlots {
  active: number;
  limit: number;
  cap: number;
}
interface PiInfo {
  active: number;
  limit: number;
  cap: number;
  per_project: number;
}
interface Health {
  active: number;
  concurrency_limit: number;
  cap: number;
  redteam?: TrackSlots;
  ctf?: TrackSlots;
  claude?: PiInfo;
  claude_sdk?: { state: "ready" | "unavailable"; label?: string };
}

function SlotSelect({
  value,
  cap,
  onChange,
}: {
  value: number;
  cap: number;
  onChange: (n: number) => void;
}) {
  return (
    <select
      className="select"
      style={{ width: 56, padding: "4px 6px", fontSize: 12 }}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {Array.from({ length: Math.max(1, cap) }).map((_, i) => (
        <option key={i + 1} value={i + 1}>{i + 1}</option>
      ))}
    </select>
  );
}

interface ProxyInfo {
  enabled: boolean;
  live: number;
  fetching: boolean;
  custom_count?: number;
  need_proxy?: boolean;
  exit_ip?: string | null;
  error?: string | null;
}

function projectIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/project\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function TopNav() {
  const { t } = useT();
  const location = useLocation();
  const [h, setH] = useState<Health | null>(null);
  const [px, setPx] = useState<ProxyInfo | null>(null);
  const [needProxy, setNeedProxy] = useState(false);
  const [ctfView, setCtfView] = useState<boolean | null>(null);

  useEffect(() => {
    const load = () => api.health().then((r) => setH(r)).catch(() => {});
    load();
    const t = setInterval(load, 10000);
    window.addEventListener("atkbrain-health", load);
    return () => {
      clearInterval(t);
      window.removeEventListener("atkbrain-health", load);
    };
  }, []);

  useEffect(() => {
    const load = () => api.proxyStatus().then((r) => setPx(r)).catch(() => {});
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const pid = projectIdFromPath(location.pathname);
    if (!pid) {
      setCtfView(false);
      return;
    }
    setCtfView(null);
    let alive = true;
    api.getProject(pid).then((p) => {
      if (alive) setCtfView(isCtfProject(p));
    }).catch(() => {
      if (alive) setCtfView(false);
    });
    return () => { alive = false; };
  }, [location.pathname]);

  const applySnap = (r: any) => {
    if (!r) return;
    setH((c) => (c ? {
      ...c,
      concurrency_limit: r.concurrency_limit ?? c.concurrency_limit,
      cap: r.cap ?? c.cap,
      redteam: r.redteam ?? c.redteam,
      ctf: r.ctf ?? c.ctf,
      claude: r.claude ?? c.claude,
    } : c));
  };

  const changeTrack = async (track: "redteam" | "ctf", v: number) => {
    const r = await api.setConcurrency(v, track).catch(() => null);
    applySnap(r);
  };

  const toggleProxy = async () => {
    if (ctfView) return;
    const next = !(px?.enabled);
    if (next && !Number(px?.custom_count || 0)) {
      setNeedProxy(true);
      return;
    }
    const r = await api.setProxyEnabled(next).catch(() => null);
    if (!r) return;
    if (r.need_proxy) setNeedProxy(true);
    setPx({
      enabled: !!r.enabled,
      live: Number(r.live || 0),
      fetching: !!r.fetching,
      custom_count: Number(r.custom_count || 0),
      exit_ip: r.exit_ip,
      error: r.error,
    });
  };

  const cl = h?.claude;
  const rt = h?.redteam;
  const ctf = h?.ctf;
  const rtActive = rt?.active ?? 0;
  const ctfActive = ctf?.active ?? 0;
  const onProject = !!projectIdFromPath(location.pathname);
  const ctfLocked = ctfView === true;
  const srcProxyOn = !ctfLocked && ctfView !== null && !!px?.enabled;
  const proxyLabel = ctfLocked
    ? t("topnav.ctfDirect")
    : (onProject && ctfView === null)
      ? t("topnav.proxyWait")
      : t("topnav.proxyLive", { n: px?.live ?? 0 });

  return (
    <div className="topnav">
      <div className="workspace-title">{t("shell.console")} <span>{t("shell.consoleSub")}</span></div>
      <div className="nav-meta">
        <div className="row" style={{ gap: 12 }}>
        {h && (
            <div
              className="row status-control"
              style={{ gap: 8 }}
              title={t("topnav.slotsTitle")}
            >
              <span className="pulse-dot" style={{ background: (rtActive + ctfActive) > 0 ? "var(--success)" : "var(--muted-soft)" }} />
              <span>{t("topnav.redSrc", { a: rtActive, b: rt?.limit ?? "-" })}</span>
              {rt && (
                <SlotSelect
                  value={rt.limit}
                  cap={rt.cap}
                  onChange={(n) => changeTrack("redteam", n)}
                />
              )}
              <span>{t("topnav.ctf", { a: ctfActive, b: ctf?.limit ?? "-" })}</span>
              {ctf && (
                <SlotSelect
                  value={ctf.limit}
                  cap={ctf.cap}
                  onChange={(n) => changeTrack("ctf", n)}
                />
              )}
            </div>
        )}
            <div
              className="row status-control"
              style={{ gap: 8 }}
              title={
                ctfLocked
                  ? t("topnav.proxyCtf")
                  : (px?.error
                    ? String(px.error)
                    : t("topnav.proxyHint"))
              }
            >
              <button
                type="button"
                className={`proxy-switch${srcProxyOn ? " is-on" : ""}${ctfLocked ? " is-locked" : ""}`}
                aria-pressed={srcProxyOn}
                aria-disabled={ctfLocked}
                disabled={ctfLocked}
                onClick={() => { void toggleProxy(); }}
              >
                <span className="proxy-switch-knob" />
              </button>
              <span>{proxyLabel}</span>
              {!ctfLocked && (
                <span
                  className={`proxy-spin${px?.fetching ? " is-on" : ""}`}
                  aria-label={px?.fetching ? t("topnav.fetching") : t("topnav.proxyOff")}
                />
              )}
            </div>
            {h?.claude_sdk && (
              <div className="row status-control" style={{ gap: 6 }} title={t("topnav.piTitle")}>
                <span className="pulse-dot" style={{ background: h.claude_sdk?.state === "unavailable" ? "var(--error)" : "var(--success)" }} />
                <span>{h.claude_sdk?.label || t("topnav.piReady")}</span>
                {(cl?.active ?? 0) > 0 && (
                  <span className="muted" style={{ fontSize: 11 }}>
                    {t("topnav.piProcs", {
                      n: cl?.limit ? `${cl.active}/${cl.limit}` : (cl?.active ?? 0),
                    })}
                  </span>
                )}
              </div>
            )}
        </div>
      </div>
      {needProxy && (
        <Modal title={t("topnav.needProxyTitle")} onClose={() => setNeedProxy(false)}>
          <p style={{ marginTop: 0 }}>{t("topnav.needProxy")}</p>
          <button className="btn btn-primary" type="button" onClick={() => setNeedProxy(false)}>{t("common.close")}</button>
        </Modal>
      )}
    </div>
  );
}
