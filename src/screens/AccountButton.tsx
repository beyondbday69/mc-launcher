import { useEffect, useState } from "react";
import { api, Account } from "../lib/types";

export function AccountButton() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAcc, setSelectedAcc] = useState<Account | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [offlineName, setOfflineName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.authAccounts()
      .then((list) => {
        setAccounts(list);
        if (list.length > 0) setSelectedAcc(list[0]);
      })
      .catch(() => {});
  }, []);

  const handleMicrosoftLogin = async () => {
    setBusy(true);
    try {
      const acc = await api.authBegin();
      setAccounts((prev) => [...prev, acc]);
      setSelectedAcc(acc);
      setShowModal(false);
    } catch (err) {
      console.error("[NVIDIA Auth]:", err);
    } finally {
      setBusy(false);
    }
  };

  const handleAddOffline = () => {
    if (!offlineName.trim()) return;
    const offlineAcc: Account = {
      id: `offline-${Date.now()}`,
      username: offlineName.trim(),
      uuid: "00000000-0000-0000-0000-000000000000",
      access_token: "offline-token",
      refresh_token: "offline-refresh",
      expires_at: "2099-01-01T00:00:00Z",
      is_msa: false,
    };
    setAccounts((prev) => [...prev, offlineAcc]);
    setSelectedAcc(offlineAcc);
    setOfflineName("");
    setShowModal(false);
  };

  const handleLogout = async (id: string) => {
    try {
      await api.authRemove(id);
      const updated = accounts.filter((a) => a.id !== id);
      setAccounts(updated);
      setSelectedAcc(updated[0] || null);
    } catch (err) {
      console.error("[NVIDIA Logout]:", err);
    }
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setShowModal(true)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "4px 12px 4px 6px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-xs)",
          cursor: "pointer",
          transition: "all 0.15s ease",
        }}
        title="Manage Gamer Account"
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: "var(--radius-xs)",
            background: "var(--bg-interactive)",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 800,
            color: "var(--nvidia-green)",
          }}
        >
          {selectedAcc ? selectedAcc.username.charAt(0).toUpperCase() : "P"}
        </div>

        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "#ffffff" }}>
            {selectedAcc ? selectedAcc.username : "Player"}
          </span>
        </div>

        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--nvidia-green)",
            boxShadow: "0 0 6px var(--nvidia-green)",
          }}
        />
      </div>

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <h3>GEFORCE GAMER ID & PROFILES</h3>
              <button
                type="button"
                style={{ background: "none", border: "none", color: "#9da5b4", fontSize: 18, cursor: "pointer" }}
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* Active Profile */}
              <div
                style={{
                  padding: "14px",
                  background: "var(--bg-canvas)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-xs)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#ffffff" }}>
                    {selectedAcc ? selectedAcc.username : "Player (Offline)"}
                  </div>
                  <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#76b900" }}>
                    {selectedAcc?.is_msa ? "MICROSOFT AUTHENTICATED" : "LOCAL OFFLINE PROFILE"}
                  </div>
                </div>

                {selectedAcc && (
                  <button
                    type="button"
                    className="btn-nvidia-secondary"
                    style={{ padding: "4px 10px", fontSize: 11, color: "#ef4444" }}
                    onClick={() => handleLogout(selectedAcc.id)}
                  >
                    DISCONNECT
                  </button>
                )}
              </div>

              {/* Add Offline Profile */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#9da5b4", marginBottom: 6 }}>
                  Quick Offline Username
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    className="input-nvidia"
                    placeholder="Enter offline username..."
                    value={offlineName}
                    onChange={(e) => setOfflineName(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-nvidia-secondary"
                    disabled={!offlineName.trim()}
                    onClick={handleAddOffline}
                  >
                    ADD
                  </button>
                </div>
              </div>

              {/* Microsoft Account */}
              <div style={{ paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
                <button
                  type="button"
                  className="btn-nvidia-primary"
                  style={{ width: "100%" }}
                  disabled={busy}
                  onClick={handleMicrosoftLogin}
                >
                  {busy ? "CONNECTING TO MICROSOFT..." : "SIGN IN WITH MICROSOFT ACCOUNT"}
                </button>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-nvidia-secondary"
                onClick={() => setShowModal(false)}
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default AccountButton;
