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
        {/* Material 3 Account Chip */}
        <button
          className="chip"
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            cursor: "pointer",
            padding: "3px 10px 3px 4px",
            gap: 8,
            backgroundColor: menuOpen
              ? "var(--md-sys-color-surface-container-highest)"
              : "var(--md-sys-color-surface-container-high)",
            borderColor: menuOpen
              ? "var(--md-sys-color-primary)"
              : "var(--md-sys-color-outline-variant)",
            boxShadow: menuOpen ? "0 0 10px rgba(56, 189, 248, 0.25)" : undefined,
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
                background: "linear-gradient(135deg, var(--md-sys-color-primary) 0%, var(--md-sys-color-secondary) 100%)",
                color: "var(--md-sys-color-on-primary)",
                fontWeight: 700,
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 8px rgba(56, 189, 248, 0.3)",
              }}
            >
              {initial}
            </div>
            {/* Online Status Badge */}
            <span
              style={{
                position: "absolute",
                bottom: -1,
                right: -1,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--md-sys-color-tertiary)",
                border: "1.5px solid var(--md-sys-color-surface)",
                boxShadow: "0 0 6px var(--md-sys-color-tertiary)",
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
              transition: "transform var(--md-sys-motion-duration-short) var(--md-sys-motion-easing-standard)",
            }}
          />
        </button>

        {/* Smooth Material 3 Dropdown Menu */}
        {menuOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              minWidth: 260,
              background: "var(--md-sys-color-surface-container)",
              border: "1px solid var(--md-sys-color-outline-variant)",
              borderRadius: "var(--md-sys-shape-corner-xl)",
              padding: "16px",
              boxShadow: "var(--md-sys-elevation-3)",
              zIndex: 100,
              animation: "m3-dialog-enter var(--md-sys-motion-duration-short) var(--md-sys-motion-easing-emphasized)",
            }}
          >
            {/* Account Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, var(--md-sys-color-primary) 0%, var(--md-sys-color-secondary) 100%)",
                  color: "var(--md-sys-color-on-primary)",
                  fontWeight: 700,
                  fontSize: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 14px rgba(56, 189, 248, 0.4)",
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
