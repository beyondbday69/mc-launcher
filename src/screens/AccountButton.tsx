import { useEffect, useRef, useState } from "react";
import { api, Account } from "../lib/types";
import { IconChevronDown, IconUser, IconRefresh, IconTrash } from "../lib/icons";

export function AccountButton() {
  const [account, setAccount] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    api.authAccounts().then((list) => setAccount(list[0] ?? null)).catch(() => {});
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  const startLogin = async () => {
    setError(null);
    setBusy(true);
    setMenuOpen(false);
    try {
      const acc = await api.authBegin();
      setAccount(acc);
    } catch (e) {
      setError(typeof e === "string" ? e : (e as any)?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    if (!account) return;
    try {
      await api.authRemove(account.id);
      setAccount(null);
      setMenuOpen(false);
    } catch (e) {
      setError(String(e));
    }
  };

  if (account) {
    const initial = (account.username || "M").charAt(0).toUpperCase();

    return (
      <div ref={containerRef} style={{ position: "relative" }}>
        {/* Glass Account Chip */}
        <button
          className="chip glass-account-chip"
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            cursor: "pointer",
            padding: "4px 12px 4px 5px",
            gap: 8,
            backgroundColor: menuOpen
              ? "var(--glass-bg-base)"
              : "var(--glass-bg-interactive)",
            backdropFilter: "var(--glass-blur-sm)",
            WebkitBackdropFilter: "var(--glass-blur-sm)",
            borderColor: menuOpen
              ? "rgba(56, 189, 248, 0.45)"
              : "var(--glass-border)",
            boxShadow: menuOpen
              ? "0 0 14px rgba(6, 182, 212, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.25)"
              : "var(--glass-sheen)",
          }}
          title="Account profile"
        >
          {/* Avatar Circle with Online Dot */}
          <div style={{ position: "relative", width: 24, height: 24 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--liquid-cyan) 0%, var(--liquid-violet) 100%)",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 10px rgba(6, 182, 212, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.5)",
              }}
            >
              {initial}
            </div>
            {/* Fluid Online Status Indicator */}
            <span
              className="liquid-online-indicator"
              style={{
                position: "absolute",
                bottom: -1,
                right: -1,
              }}
              title="Online"
            />
          </div>

          <span
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: "var(--md-sys-color-on-surface)",
            }}
          >
            {account.username}
          </span>

          <IconChevronDown
            size={13}
            style={{
              color: "var(--md-sys-color-on-surface-variant)",
              transform: menuOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform var(--glass-motion-duration-sm) var(--glass-ease-standard)",
            }}
          />
        </button>

        {/* Floating Frosted Dropdown Sheet */}
        {menuOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              minWidth: 268,
              background: "rgba(15, 23, 42, 0.88)",
              backdropFilter: "var(--glass-blur-lg)",
              WebkitBackdropFilter: "var(--glass-blur-lg)",
              border: "var(--glass-border)",
              borderRadius: "var(--glass-radius-xl)",
              padding: "16px",
              boxShadow: "var(--glass-sheen-elevated), 0 0 32px rgba(6, 182, 212, 0.15)",
              zIndex: 100,
              animation: "liquid-dialog-enter var(--glass-motion-duration-sm) var(--glass-ease-spring)",
              overflow: "hidden",
            }}
          >
            <div className="liquid-refraction-line" aria-hidden="true" style={{ opacity: 0.5 }} />
            {/* Account Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, var(--liquid-cyan) 0%, var(--liquid-violet) 100%)",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 16px rgba(6, 182, 212, 0.45), inset 0 1px 2px rgba(255, 255, 255, 0.6)",
                  flexShrink: 0,
                }}
              >
                {initial}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "var(--md-sys-color-on-surface)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {account.username}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <span className="tag success" style={{ fontSize: 10, padding: "1px 6px" }}>
                    {account.is_msa ? "Microsoft Account" : "Online"}
                  </span>
                </div>
              </div>
            </div>

            {/* UUID Info */}
            <div
              style={{
                background: "var(--md-sys-color-surface-container-lowest)",
                padding: "8px 10px",
                borderRadius: "var(--md-sys-shape-corner-md)",
                fontSize: 11,
                fontFamily: "var(--mono)",
                color: "var(--md-sys-color-on-surface-variant)",
                marginBottom: 12,
                wordBreak: "break-all",
              }}
            >
              UUID: {account.uuid ? account.uuid.slice(0, 18) + "…" : "Local session"}
            </div>

            <div className="divider" style={{ margin: "8px 0 12px" }} />

            {/* Actions */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <button
                className="btn ghost"
                onClick={startLogin}
                style={{
                  width: "100%",
                  justifyContent: "flex-start",
                  padding: "8px 12px",
                  borderRadius: "var(--md-sys-shape-corner-md)",
                  fontSize: 13,
                }}
              >
                <IconRefresh size={15} />
                <span>Switch / Add Account</span>
              </button>

              <button
                className="btn ghost"
                onClick={logout}
                style={{
                  width: "100%",
                  justifyContent: "flex-start",
                  padding: "8px 12px",
                  borderRadius: "var(--md-sys-shape-corner-md)",
                  fontSize: 13,
                  color: "var(--md-sys-color-error)",
                }}
              >
                <IconTrash size={15} />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="row" style={{ gap: 8, alignItems: "center" }}>
      {error && (
        <span
          className="tag danger"
          style={{ fontSize: 11, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}
          title={error}
        >
          {error}
        </span>
      )}
      <button
        className="btn primary"
        onClick={startLogin}
        disabled={busy}
        style={{
          padding: "4px 14px",
          fontSize: 12.5,
          gap: 6,
        }}
      >
        <IconUser size={14} />
        <span>{busy ? "Signing in…" : "Sign in"}</span>
      </button>
    </div>
  );
}
