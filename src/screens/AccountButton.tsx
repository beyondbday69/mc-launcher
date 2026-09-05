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
          padding: "5px 12px 5px 6px",
          background: "var(--nv-surface-elevated)",
          border: "1px solid var(--nv-hairline)",
          borderRadius: "var(--rounded-sm)",
          cursor: "pointer",
          transition: "border-color 0.1s",
        }}
        title="Manage Gamer Account"
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: "var(--rounded-sm)",
            background: "var(--nv-surface-dark)",
            border: "1px solid var(--nv-hairline)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 700,
            color: "var(--nv-primary)",
          }}
        >
          {selectedAcc ? selectedAcc.username.charAt(0).toUpperCase() : "P"}
        </div>

        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#ffffff" }}>
            {selectedAcc ? selectedAcc.username : "Player"}
          </span>
        </div>

        <div
          style={{
            width: 7,
            height: 7,
            background: "var(--nv-primary)",
          }}
        />
      </div>

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="corner-square" />
            <div className="modal-header">
              <h3>GAMER ID & ACCOUNTS</h3>
              <button
                type="button"
                style={{ background: "none", border: "none", color: "var(--nv-on-dark-mute)", fontSize: 18, cursor: "pointer" }}
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* Active Profile */}
              <div
                style={{
                  padding: "16px 20px",
                  background: "var(--nv-surface-dark)",
                  border: "1px solid var(--nv-hairline)",
                  borderRadius: "var(--rounded-sm)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#ffffff" }}>
                    {selectedAcc ? selectedAcc.username : "Player (Offline)"}
                  </div>
                  <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--nv-primary)" }}>
                    {selectedAcc?.is_msa ? "MICROSOFT AUTHENTICATED" : "LOCAL OFFLINE PROFILE"}
                  </div>
                </div>

                {selectedAcc && (
                  <button
                    type="button"
                    className="button-outline-on-dark button-sm"
                    style={{ color: "var(--nv-error)" }}
                    onClick={() => handleLogout(selectedAcc.id)}
                  >
                    DISCONNECT
                  </button>
                )}
              </div>

              {/* Add Offline Profile */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--nv-mute)", marginBottom: 6 }}>
                  Quick Offline Username
                </label>
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    type="text"
                    className="text-input"
                    placeholder="Enter offline username..."
                    value={offlineName}
                    onChange={(e) => setOfflineName(e.target.value)}
                  />
                  <button
                    type="button"
                    className="button-outline-on-dark"
                    disabled={!offlineName.trim()}
                    onClick={handleAddOffline}
                  >
                    ADD
                  </button>
                </div>
              </div>

              {/* Microsoft Account */}
              <div style={{ paddingTop: 16, borderTop: "1px solid var(--nv-hairline)" }}>
                <button
                  type="button"
                  className="button-primary"
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
                className="button-outline-on-dark"
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
