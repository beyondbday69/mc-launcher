import { useEffect, useState } from "react";
import { api, Account } from "../lib/types";

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
      // auth_begin handles the entire flow on the Rust side and blocks
      // until the user signs in.
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
    return (
      <div className="row" style={{ gap: 8 }}>
        <span style={{ fontSize: 12 }}>{account.username}</span>
        <button className="btn ghost" onClick={logout} style={{ padding: "2px 8px" }}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="row" style={{ gap: 8 }}>
      {error && <span style={{ fontSize: 11, color: "var(--danger)" }}>{error}</span>}
      <button
        className="btn primary"
        onClick={startLogin}
        disabled={busy}
        style={{ padding: "2px 10px" }}
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </div>
  );
}
