import { useEffect, useState } from "react";
import { Avatar, Button, Chip, Dropdown } from "@heroui/react";
import { api, Account } from "../lib/types";
import { IconChevronDown, IconUser, IconRefresh, IconTrash } from "../lib/icons";

export function AccountButton() {
  const [account, setAccount] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.authAccounts().then((list) => setAccount(list[0] ?? null)).catch(() => {});
  }, []);

  const startLogin = async () => {
    setError(null);
    setBusy(true);
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
    } catch (e) {
      setError(String(e));
    }
  };

  if (account) {
    const initial = (account.username || "M").charAt(0).toUpperCase();

    return (
      <Dropdown>
        {/* Glass Account Chip Trigger */}
        <Dropdown.Trigger>
          <div
            className="chip glass-account-chip"
            style={{
              cursor: "pointer",
              padding: "4px 12px 4px 5px",
              gap: 8,
              display: "inline-flex",
              alignItems: "center",
              backdropFilter: "var(--glass-blur-sm)",
              WebkitBackdropFilter: "var(--glass-blur-sm)",
              boxShadow: "var(--glass-sheen)",
            }}
            title="Account profile"
          >
            {/* Avatar with Online Dot */}
            <div style={{ position: "relative", width: 24, height: 24 }}>
              <Avatar size="sm">
                <Avatar.Fallback>{initial}</Avatar.Fallback>
              </Avatar>
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
              }}
            />
          </div>
        </Dropdown.Trigger>

        {/* Floating Frosted Dropdown Popover */}
        <Dropdown.Popover
          placement="bottom end"
          style={{
            minWidth: 268,
            background: "rgba(15, 23, 42, 0.95)",
            backdropFilter: "var(--glass-blur-lg)",
            WebkitBackdropFilter: "var(--glass-blur-lg)",
            border: "var(--glass-border)",
            borderRadius: "var(--glass-radius-xl)",
            padding: "16px",
            boxShadow: "var(--glass-sheen-elevated), 0 0 32px rgba(6, 182, 212, 0.15)",
            zIndex: 100,
            overflow: "hidden",
          }}
        >
          <div className="liquid-refraction-line" aria-hidden="true" style={{ opacity: 0.5 }} />

          {/* Account Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <Avatar size="md">
              <Avatar.Fallback>{initial}</Avatar.Fallback>
            </Avatar>
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
                <Chip size="sm" color="success">
                  {account.is_msa ? "Microsoft Account" : "Online"}
                </Chip>
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
          <Dropdown.Menu aria-label="Account Actions" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Dropdown.Item
              id="switch-account"
              onAction={startLogin}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: "var(--md-sys-shape-corner-md)",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              <IconRefresh size={15} />
              <span>Switch / Add Account</span>
            </Dropdown.Item>

            <Dropdown.Item
              id="logout"
              onAction={logout}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: "var(--md-sys-shape-corner-md)",
                fontSize: 13,
                color: "var(--md-sys-color-error)",
                cursor: "pointer",
              }}
            >
              <IconTrash size={15} />
              <span>Sign out</span>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
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
      <Button
        variant="primary"
        size="sm"
        onPress={startLogin}
        isDisabled={busy}
        style={{
          padding: "4px 14px",
          fontSize: 12.5,
          gap: 6,
        }}
      >
        <IconUser size={14} />
        <span>{busy ? "Signing in…" : "Sign in"}</span>
      </Button>
    </div>
  );
}
