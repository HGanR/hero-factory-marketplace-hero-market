"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, Key, Shield, Users, Wallet } from "lucide-react";

type Member = {
  id: string;
  name: string;
  email: string;
  status: "verified" | "pending" | "rejected";
  kycStatus: "approved" | "in_review" | "pending" | "rejected";
  accountType: string;
  joinDate: string;
  beneficialOwner: string;
  riskLevel: "low" | "medium" | "high";
  rippleWallet: string | null;
  rippleWalletCreated: boolean;
};

export default function SecuritiesMembersPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "kyc" | "registry" | "accounts">("overview");
  const [members, setMembers] = useState<Member[]>([
    {
      id: "MEM001",
      name: "John Smith",
      email: "john.smith@example.com",
      status: "verified",
      kycStatus: "approved",
      accountType: "Individual",
      joinDate: "2025-01-15",
      beneficialOwner: "John Smith",
      riskLevel: "low",
      rippleWallet: "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      rippleWalletCreated: true,
    },
    {
      id: "MEM002",
      name: "Estate Planning LLC",
      email: "contact@estateplanning.com",
      status: "verified",
      kycStatus: "approved",
      accountType: "Corporate",
      joinDate: "2025-02-20",
      beneficialOwner: "Jane Doe",
      riskLevel: "low",
      rippleWallet: "rYYYYYYYYYYYYYYYYYYYYYYYYYYY",
      rippleWalletCreated: true,
    },
    {
      id: "MEM003",
      name: "Investment Trust Fund",
      email: "admin@investmenttrust.com",
      status: "pending",
      kycStatus: "in_review",
      accountType: "Trust",
      joinDate: "2025-11-25",
      beneficialOwner: "Multiple Beneficiaries",
      riskLevel: "medium",
      rippleWallet: null,
      rippleWalletCreated: false,
    },
  ]);

  const [newMember, setNewMember] = useState({
    memberName: "",
    email: "",
    accountType: "Individual",
    beneficialOwner: "",
  });

  const [newWalletSecret, setNewWalletSecret] = useState<string>("");
  const [secretForMember, setSecretForMember] = useState<string>("");

  useEffect(() => {
    try {
      const hasUser = !!localStorage.getItem("user");
      const hasAdmin = localStorage.getItem("adminLoggedIn") === "true";
      if (!hasUser && !hasAdmin) router.push("/");
    } catch {
      router.push("/");
    }
  }, [router]);

  const stats = useMemo(() => {
    const totalMembers = members.length;
    const verifiedCount = members.filter((m) => m.status === "verified").length;
    const pendingCount = members.filter((m) => m.status === "pending").length;
    const kycApproved = members.filter((m) => m.kycStatus === "approved").length;
    const kycPending = members.filter((m) => m.kycStatus === "in_review" || m.kycStatus === "pending").length;
    const rippleWalletsCreated = members.filter((m) => m.rippleWalletCreated).length;
    return { totalMembers, verifiedCount, pendingCount, kycApproved, kycPending, rippleWalletsCreated };
  }, [members]);

  const addMember = () => {
    if (!newMember.memberName.trim() || !newMember.email.trim()) {
      alert("Please fill in at least name and email.");
      return;
    }
    const id = `MEM${String(members.length + 1).padStart(3, "0")}`;
    const next: Member = {
      id,
      name: newMember.memberName.trim(),
      email: newMember.email.trim(),
      status: "pending",
      kycStatus: "pending",
      accountType: newMember.accountType,
      joinDate: new Date().toISOString().split("T")[0],
      beneficialOwner: newMember.beneficialOwner.trim() || newMember.memberName.trim(),
      riskLevel: "medium",
      rippleWallet: null,
      rippleWalletCreated: false,
    };
    setMembers((prev) => [next, ...prev]);
    setNewMember({ memberName: "", email: "", accountType: "Individual", beneficialOwner: "" });
    setActiveTab("overview");
  };

  const createRippleWallet = (memberId: string) => {
    const newAddress = `r${Math.random().toString(36).substring(2, 27).toUpperCase()}`;
    const secret = `s${Math.random().toString(36).substring(2, 35)}`;
    setNewWalletSecret(secret);
    setSecretForMember(memberId);
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, rippleWallet: newAddress, rippleWalletCreated: true } : m))
    );
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="w-full px-6 py-6 border-b border-white/10 bg-slate-900/60 backdrop-blur">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-purple-200">Member Accounts</h1>
            <p className="text-sm text-slate-300 mt-1">
              KYC status, beneficial ownership notes, and XRPL wallet provisioning (demo).
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Link href="/securities" className="text-slate-300 hover:text-white underline">
              Back to Securities
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        {newWalletSecret && secretForMember ? (
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-5">
            <div className="flex items-center gap-2 text-yellow-200 font-semibold">
              <Key className="h-5 w-5" /> Wallet Secret Key Generated (save it)
            </div>
            <div className="text-sm text-yellow-100/90 mt-2">
              Member: <span className="font-mono">{secretForMember}</span>
            </div>
            <div className="mt-3 flex gap-2 flex-wrap items-center">
              <input
                readOnly
                value={newWalletSecret}
                className="flex-1 min-w-[240px] px-3 py-2 rounded-lg bg-slate-950/40 border border-white/10 font-mono text-sm"
              />
              <button
                onClick={() => copyToClipboard(newWalletSecret)}
                className="px-3 py-2 rounded-lg bg-slate-800 border border-white/10 hover:bg-slate-700 transition-colors inline-flex items-center gap-2"
              >
                <Copy className="h-4 w-4" /> Copy
              </button>
              <button
                onClick={() => {
                  setNewWalletSecret("");
                  setSecretForMember("");
                }}
                className="px-3 py-2 rounded-lg bg-slate-800 border border-white/10 hover:bg-slate-700 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-6">
          <Stat title="Total" value={String(stats.totalMembers)} icon={<Users className="h-5 w-5 text-purple-200" />} />
          <Stat title="Verified" value={String(stats.verifiedCount)} icon={<Shield className="h-5 w-5 text-green-200" />} />
          <Stat title="Pending" value={String(stats.pendingCount)} icon={<Shield className="h-5 w-5 text-yellow-200" />} />
          <Stat title="KYC Approved" value={String(stats.kycApproved)} icon={<Shield className="h-5 w-5 text-cyan-200" />} />
          <Stat title="KYC Pending" value={String(stats.kycPending)} icon={<Shield className="h-5 w-5 text-slate-200" />} />
          <Stat title="XRPL Wallets" value={String(stats.rippleWalletsCreated)} icon={<Wallet className="h-5 w-5 text-cyan-200" />} />
        </div>

        <div className="flex gap-2 border-b border-white/10 flex-wrap">
          <Tab active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>
            Overview
          </Tab>
          <Tab active={activeTab === "kyc"} onClick={() => setActiveTab("kyc")}>
            KYC (demo)
          </Tab>
          <Tab active={activeTab === "registry"} onClick={() => setActiveTab("registry")}>
            Registry
          </Tab>
          <Tab active={activeTab === "accounts"} onClick={() => setActiveTab("accounts")}>
            Account Mgmt
          </Tab>
        </div>

        {activeTab === "overview" ? (
          <div className="grid gap-4 md:grid-cols-2">
            {members.map((m) => (
              <div key={m.id} className="rounded-xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-lg">{m.name}</div>
                    <div className="text-xs text-slate-400">
                      {m.id} • {m.email}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Type: {m.accountType} • Join: {m.joinDate} • Risk: {m.riskLevel}
                    </div>
                    <div className="text-sm text-slate-200 mt-2">
                      Beneficial owner: <span className="font-semibold">{m.beneficialOwner}</span>
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="px-3 py-1 rounded-full border border-white/10 bg-slate-950/30 inline-block">
                      status: {m.status}
                    </div>
                    <div className="mt-2 px-3 py-1 rounded-full border border-white/10 bg-slate-950/30 inline-block">
                      kyc: {m.kycStatus}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-white/10 bg-slate-950/20 p-3">
                  <div className="text-xs text-slate-400 mb-2">XRPL wallet</div>
                  {m.rippleWallet ? (
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <code className="text-xs break-all">{m.rippleWallet}</code>
                      <a
                        href={`https://xrpscan.com/account/${m.rippleWallet}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1 text-xs"
                      >
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-300">No wallet yet.</div>
                  )}
                </div>

                <div className="mt-4 flex gap-2 flex-wrap">
                  <button
                    onClick={() => createRippleWallet(m.id)}
                    disabled={m.rippleWalletCreated}
                    className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                      m.rippleWalletCreated
                        ? "bg-slate-800 text-slate-400 cursor-not-allowed"
                        : "bg-cyan-500 text-black hover:bg-cyan-400"
                    }`}
                  >
                    {m.rippleWalletCreated ? "Wallet Created" : "Create XRPL Wallet"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {activeTab === "kyc" ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <div className="font-semibold text-lg">KYC Verification (demo)</div>
            <div className="text-sm text-slate-300 mt-2">
              This is the placeholder area where we can port OLDSITE `KYCForm.tsx` + beneficial ownership tooling.
            </div>
          </div>
        ) : null}

        {activeTab === "registry" ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <div className="font-semibold text-lg">Add Member</div>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Name *</label>
                <input
                  value={newMember.memberName}
                  onChange={(e) => setNewMember((p) => ({ ...p, memberName: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950/30 border border-white/10"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Email *</label>
                <input
                  value={newMember.email}
                  onChange={(e) => setNewMember((p) => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950/30 border border-white/10"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Account Type</label>
                <select
                  value={newMember.accountType}
                  onChange={(e) => setNewMember((p) => ({ ...p, accountType: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950/30 border border-white/10"
                >
                  <option>Individual</option>
                  <option>Corporate</option>
                  <option>Trust</option>
                  <option>Non-Profit</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Beneficial Owner</label>
                <input
                  value={newMember.beneficialOwner}
                  onChange={(e) => setNewMember((p) => ({ ...p, beneficialOwner: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950/30 border border-white/10"
                />
              </div>
            </div>
            <button
              onClick={addMember}
              className="mt-4 px-4 py-2 rounded-lg bg-purple-500 text-black font-semibold hover:bg-purple-400 transition-colors"
            >
              Add Member
            </button>
          </div>
        ) : null}

        {activeTab === "accounts" ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <div className="font-semibold text-lg">Account Management (demo)</div>
            <div className="text-sm text-slate-300 mt-2">
              Next step: wire this to your real users + approvals system and persist to DB.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 font-medium transition-colors border-b-2 ${
        active ? "text-purple-200 border-purple-200" : "text-slate-300 border-transparent hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Stat({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 md:col-span-2 lg:col-span-1">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-300">{title}</div>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}


