"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useDisconnect, useReadContract } from "wagmi";
import MobileWalletButton from "@/components/MobileWalletButton";
import { TokenGateWrapper } from "../components/TokenGateWrapper";
import {
  loadVotedSet,
  saveVotedSet,
  type CommunityMediaType,
} from "@/lib/communityStore";

type CommunityPost = {
  id: string;
  userId: number;
  title: string;
  text?: string;
  by: string;
  createdAt: number; // epoch ms
  score: number;
  votes: number;
  superVotes: number;
  visibility: "public" | "private";
  isMine: boolean;
  mediaType?: CommunityMediaType;
  mediaUrl?: string;
  audioUrl?: string;
};

export default function CommunityPage() {
  // Token gate constants (match meet.tsx / oldsite)
  const REQUIRED_TROO_AMOUNT = 100;
  const TROO_POLYGON_CONTRACT = "0xa7927231898293377Ce676CFC9bbD551Cb845695" as `0x${string}`;
  const DEV_TREASURY_ADDRESS = "0x5c8B7C050d7E83E01A278bE24d578A4Daf3e17EF".toLowerCase();

  const ERC20_ABI = [
    {
      inputs: [{ name: "account", type: "address" }],
      name: "balanceOf",
      outputs: [{ name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "decimals",
      outputs: [{ name: "", type: "uint8" }],
      stateMutability: "view",
      type: "function",
    },
  ] as const;

  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  const { data: trooBalance } = useReadContract({
    address: TROO_POLYGON_CONTRACT,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: 137,
  });

  const { data: tokenDecimals } = useReadContract({
    address: TROO_POLYGON_CONTRACT,
    abi: ERC20_ABI,
    functionName: "decimals",
    chainId: 137,
  });

  const [isTokenHolder, setIsTokenHolder] = useState(false);
  const [balance, setBalance] = useState<number>(0);

  // Profile (localStorage) - simple banner + avatar + username
  const bannerKey = useMemo(
    () => (address ? `hf_banner_${address.toLowerCase()}` : "hf_banner_guest"),
    [address]
  );
  const avatarKey = useMemo(
    () => (address ? `hf_avatar_${address.toLowerCase()}` : "hf_avatar_guest"),
    [address]
  );
  const usernameKey = useMemo(
    () => (address ? `community:username:${address.toLowerCase()}` : "community:username:guest"),
    [address]
  );
  const bioKey = useMemo(
    () => (address ? `community:bio:${address.toLowerCase()}` : "community:bio:guest"),
    [address]
  );

  const [bannerImage, setBannerImage] = useState<string | null>(null);
  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");

  // Feed
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<"new" | "top">("new");
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [feedView, setFeedView] = useState<"public" | "mine">("public");
  const [meUserId, setMeUserId] = useState<number | null>(null);

  // Create post
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [mediaType, setMediaType] = useState<CommunityMediaType>("image");
  const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [visibility, setVisibility] = useState<"public" | "private">("public");

  async function compressImage(dataUrl: string, maxBytes = 2.6 * 1024 * 1024, maxWidth = 1800) {
    return new Promise<string | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxWidth / img.width);
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.floor(img.width * scale));
          canvas.height = Math.max(1, Math.floor(img.height * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          let quality = 0.9;
          let out = canvas.toDataURL("image/jpeg", quality);
          while (out.length > maxBytes && quality > 0.4) {
            quality -= 0.1;
            out = canvas.toDataURL("image/jpeg", quality);
          }
          resolve(out.length <= maxBytes ? out : null);
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  function fileToDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const rd = new FileReader();
      rd.onload = () => resolve(String(rd.result));
      rd.onerror = reject;
      rd.readAsDataURL(file);
    });
  }

  useEffect(() => {
    // load voted on mount
    setVoted(loadVotedSet());
    (async () => {
      try {
        const resp = await fetch("/api/community/posts");
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && Array.isArray(data?.posts)) {
          setPosts(data.posts as CommunityPost[]);
          setMeUserId(typeof data?.meUserId === "number" ? data.meUserId : null);
        } else {
          setPosts([]);
          setMeUserId(null);
        }
      } catch {
        setPosts([]);
        setMeUserId(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    // load profile fields when wallet changes
    if (!address) {
      setBannerImage(null);
      setAvatarImage(null);
      setUsername("");
      setBio("");
      return;
    }
    try {
      setBannerImage(localStorage.getItem(bannerKey));
      setAvatarImage(localStorage.getItem(avatarKey));
      setUsername(
        localStorage.getItem(usernameKey) ||
          (address ? `User_${address.slice(0, 6)}` : "Guest_User")
      );
      setBio(localStorage.getItem(bioKey) || "Welcome to the community!");
    } catch {
      // ignore
    }
  }, [address, bannerKey, avatarKey, usernameKey, bioKey]);

  // Manual Polygon scan (similar to trust-records)
  const POLY_RPCS = [
    "https://polygon-bor-rpc.publicnode.com",
    "https://polygon-rpc.com",
    "https://1rpc.io/matic",
    "https://rpc.ankr.com/polygon",
    "https://polygon-mainnet-bor.publicnode.com",
  ];

  const [manualBalance, setManualBalance] = useState<number>(0);
  const [manualTs, setManualTs] = useState<number | null>(null);
  const [manualNotes, setManualNotes] = useState<string[]>([]);

  async function manualBalanceScan(addrs: string[]) {
    if (!addrs.length) return { bal: 0, notes: ["No addresses to scan"] };
    const notes: string[] = [];
    let decimals = 18;
    // read decimals from first good rpc
    for (const rpc of POLY_RPCS) {
      try {
        const resp = await fetch(rpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_call",
            params: [
              {
                to: TROO_POLYGON_CONTRACT,
                data: "0x313ce567", // decimals()
              },
              "latest",
            ],
          }),
        });
        const json = await resp.json();
        if (json?.result) {
          decimals = parseInt(json.result, 16) || 18;
          notes.push(`Decimals from ${rpc}: ${decimals}`);
          break;
        }
      } catch (e) {
        notes.push(`${rpc} decimals failed`);
      }
    }

    let total = 0n;
    for (const addr of addrs) {
      for (const rpc of POLY_RPCS) {
        try {
          const data = "0x70a08231" + addr.replace("0x", "").padStart(64, "0");
          const resp = await fetch(rpc, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "eth_call",
              params: [
                {
                  to: TROO_POLYGON_CONTRACT,
                  data,
                },
                "latest",
              ],
            }),
          });
          const json = await resp.json();
          if (json?.result) {
            const raw = BigInt(json.result);
            total += raw;
            notes.push(`${rpc} ${addr.slice(0, 6)}... -> ${raw.toString()}`);
            break;
          }
        } catch (e: any) {
          notes.push(`${rpc} failed`);
        }
      }
    }
    const bal = Number(total) / Math.pow(10, decimals);
    return { bal, notes };
  }

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!address || !isConnected) {
        setIsTokenHolder(false);
        setBalance(0);
        setManualBalance(0);
        setManualNotes([]);
        return;
      }
      if (address.toLowerCase() === DEV_TREASURY_ADDRESS) {
        setIsTokenHolder(true);
        setBalance(REQUIRED_TROO_AMOUNT);
        setManualBalance(REQUIRED_TROO_AMOUNT);
        setManualNotes(["Treasury address override"]);
        return;
      }
      // wagmi read
      try {
        const decimals = Number(tokenDecimals ?? 18);
        const raw = trooBalance ? Number(trooBalance) : 0;
        const b = raw / Math.pow(10, decimals);
        setBalance(b);
        setIsTokenHolder(b >= REQUIRED_TROO_AMOUNT);
      } catch {
        setBalance(0);
        setIsTokenHolder(false);
      }

      // manual scan with treasury included
      const addrs = Array.from(
        new Set([address.toLowerCase(), DEV_TREASURY_ADDRESS].filter(Boolean))
      );
      const { bal, notes } = await manualBalanceScan(addrs);
      if (cancelled) return;
      setManualBalance(bal);
      setManualNotes(notes);
      setManualTs(Date.now());
      if (bal >= REQUIRED_TROO_AMOUNT) {
        setIsTokenHolder(true);
        setBalance(bal);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [address, isConnected, trooBalance, tokenDecimals]);

  const sorted = useMemo(() => {
    const copy = [...posts];
    if (sort === "top") {
      copy.sort((a, b) => b.score - a.score || b.createdAt - a.createdAt);
    } else {
      copy.sort((a, b) => b.createdAt - a.createdAt);
    }
    return copy;
  }, [posts, sort]);

  const visiblePosts = useMemo(() => {
    if (feedView === "mine") return sorted.filter((p) => p.isMine);
    return sorted.filter((p) => p.visibility === "public");
  }, [sorted, feedView]);

  const timeAgo = (ts: number) => {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 48) return `${h}h`;
    const d = Math.floor(h / 24);
    return `${d}d`;
  };

  async function handleBannerUpload(file: File) {
    const MAX_BYTES = 2 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      alert("Please upload an image under 2MB (stored in localStorage).");
      return;
    }
    let dataUrl = await fileToDataURL(file);
    const compressed = await compressImage(dataUrl);
    if (compressed) dataUrl = compressed;
    try {
      localStorage.setItem(bannerKey, dataUrl);
    } catch (err) {
      console.warn("Failed to store banner in localStorage; using in-memory only", err);
    }
    setBannerImage(dataUrl);
  }

  async function handleAvatarUpload(file: File) {
    const MAX_BYTES = 2 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      alert("Please upload an image under 2MB (stored in localStorage).");
      return;
    }
    let dataUrl = await fileToDataURL(file);
    const compressed = await compressImage(dataUrl, 1.8 * 1024 * 1024, 900);
    if (compressed) dataUrl = compressed;
    try {
      localStorage.setItem(avatarKey, dataUrl);
    } catch (err) {
      console.warn("Failed to store avatar in localStorage; using in-memory only", err);
    }
    setAvatarImage(dataUrl);
  }

  function saveProfile() {
    if (!address) return;
    localStorage.setItem(usernameKey, username.trim() || `User_${address.slice(0, 6)}`);
    localStorage.setItem(bioKey, bio.trim());
    alert("Profile saved.");
  }

  async function handleCreatePost(e: React.FormEvent) {
    e.preventDefault();
    if (!isTokenHolder && address?.toLowerCase() !== DEV_TREASURY_ADDRESS) {
      alert("You need TROO tokens to create posts.");
      return;
    }
    if (!title.trim()) {
      alert("Title is required.");
      return;
    }

    setCreating(true);
    try {
      let mediaUrl: string | undefined;
      let audioUrl: string | undefined;

      const MAX_BYTES = 2 * 1024 * 1024;
      if (selectedMedia) {
        if (selectedMedia.size > MAX_BYTES) {
          alert("Media file too large for demo (max 2MB).");
          return;
        }
        mediaUrl = await fileToDataURL(selectedMedia);
      }
      if (selectedAudio) {
        if (selectedAudio.size > MAX_BYTES) {
          alert("Audio file too large for demo (max 2MB).");
          return;
        }
        audioUrl = await fileToDataURL(selectedAudio);
      }

      const resp = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          text: caption.trim() || undefined,
          visibility,
          mediaType: selectedMedia ? mediaType : undefined,
          mediaUrl,
          audioUrl,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        alert(data?.error || "Failed to create post. Please login first.");
        return;
      }
      if (data?.post) {
        setPosts((prev) => [data.post as CommunityPost, ...prev]);
        setFeedView("mine");
      } else {
        const r = await fetch("/api/community/posts");
        const j = await r.json().catch(() => ({}));
        if (Array.isArray(j?.posts)) setPosts(j.posts);
      }
      setTitle("");
      setCaption("");
      setSelectedMedia(null);
      setSelectedAudio(null);
      setVisibility("public");
    } finally {
      setCreating(false);
    }
  }

  async function handleVote(id: string, power: 1 | 3) {
    if (voted.has(id)) return;
    setPosts((prev) =>
      prev.map((p) =>
        p.id !== id
          ? p
          : {
              ...p,
              score: p.score + (power === 3 ? 3 : 1),
              votes: p.votes + (power === 3 ? 0 : 1),
              superVotes: p.superVotes + (power === 3 ? 1 : 0),
            }
      )
    );
    const next = new Set(voted);
    next.add(id);
    setVoted(next);
    saveVotedSet(next);
  }

  // Token gate screen
  if (!isTokenHolder && address?.toLowerCase() !== DEV_TREASURY_ADDRESS) {
    return (
      <TokenGateWrapper>
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
          <div className="max-w-md mx-auto p-8 text-center">
            <h1 className="text-3xl font-bold mb-4">🔒 Token Gate</h1>
            <p className="text-slate-300 mb-6">
              You need at least {REQUIRED_TROO_AMOUNT.toLocaleString()} TROO tokens to access the community.
            </p>

            <div className="mt-4 p-3 bg-slate-800 rounded-lg text-xs text-left">
              <div className="text-yellow-300 mb-2">Debug Info:</div>
              <div>Address: {address || "Not connected"}</div>
              <div>Balance: {isConnected ? balance.toLocaleString() : "—"}</div>
              <div>Required: {REQUIRED_TROO_AMOUNT.toLocaleString()}</div>
              <div>Contract: {TROO_POLYGON_CONTRACT}</div>
              {manualTs ? <div>Manual scan: {new Date(manualTs).toLocaleTimeString()}</div> : null}
              {manualNotes.length ? (
                <details className="mt-2">
                  <summary>Manual scan notes</summary>
                  <div className="mt-1 space-y-1">
                    {manualNotes.map((n, i) => (
                      <div key={i}>{n}</div>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>

            <div className="space-y-4 mt-6">
              <div className="flex justify-center">
                <MobileWalletButton />
              </div>
              <Link
                href="/dashboard"
                className="block w-full px-6 py-3 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300"
              >
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </TokenGateWrapper>
    );
  }

  return (
    <TokenGateWrapper>
      <div className="min-h-screen bg-slate-900 text-slate-100">
        <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="font-bold">Community</div>
          <div className="flex items-center gap-3 text-sm flex-wrap">
            {isConnected && address ? (
              <>
                <span className="text-slate-300 font-mono">
                  {address.slice(0, 6)}…{address.slice(-4)}
                </span>
                <button
                  onClick={() => disconnect()}
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <MobileWalletButton />
            )}
            <Link href="/dashboard" className="text-slate-300 hover:text-cyan-300 transition-colors">
              Dashboard
            </Link>
            <Link href="/" className="text-slate-300 hover:text-cyan-300 transition-colors">
              Home
            </Link>
          </div>
        </nav>

        <main className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold">Community</h1>
              <p className="text-slate-300 mt-2">
                Share media and build community. Token-gated feed.
              </p>
              <div className="mt-2 text-xs text-slate-400">
                Balance: <span className="text-slate-200">{balance.toLocaleString()}</span> • Required:{" "}
                {REQUIRED_TROO_AMOUNT.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Profile banner */}
          {address ? (
            <section className="relative mb-10">
              <div className="relative h-56 md:h-72 bg-gradient-to-r from-sky-500 to-blue-600 rounded-lg overflow-hidden border border-white/10">
                {bannerImage ? (
                  <img src={bannerImage} alt="Banner" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center text-white">
                      <div className="text-4xl mb-2">🏔️</div>
                      <div className="text-sm">Upload your banner</div>
                    </div>
                  </div>
                )}

                <input
                  ref={bannerInputRef}
                  id="community-banner-upload"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleBannerUpload(f);
                    e.currentTarget.value = "";
                  }}
                />
                <label
                  htmlFor="community-banner-upload"
                  className="absolute top-4 right-4 px-4 py-2 bg-black/60 hover:bg-black/70 text-white rounded-lg text-sm transition-colors cursor-pointer select-none"
                >
                  📷 Upload Banner
                </label>
              </div>

              <div className="absolute -bottom-8 left-8">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full border-4 border-white bg-slate-700 overflow-hidden">
                    {avatarImage ? (
                      <img src={avatarImage} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">👤</div>
                    )}
                  </div>
                  <input
                    ref={avatarInputRef}
                    id="community-avatar-upload"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleAvatarUpload(f);
                      e.currentTarget.value = "";
                    }}
                  />
                  <label
                    htmlFor="community-avatar-upload"
                    className="absolute -bottom-1 -right-1 w-8 h-8 bg-sky-500 hover:bg-sky-600 rounded-full flex items-center justify-center text-white text-sm transition-colors cursor-pointer select-none"
                  >
                    📷
                  </label>
                </div>
              </div>

              <div className="pt-12 pl-32">
                <div className="flex items-end gap-3 flex-wrap">
                  <div className="w-full max-w-sm">
                    <label className="text-xs text-slate-400">Username</label>
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="mt-1 w-full rounded-lg bg-slate-800/70 px-3 py-2 border border-white/10"
                      maxLength={32}
                    />
                  </div>
                  <button
                    onClick={saveProfile}
                    className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-lg transition-colors"
                  >
                    Save Profile
                  </button>
                </div>
                <div className="mt-3 max-w-2xl">
                  <label className="text-xs text-slate-400">Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="mt-1 w-full h-20 rounded-lg bg-slate-800/70 px-3 py-2 border border-white/10 resize-none"
                    maxLength={240}
                  />
                </div>
              </div>
            </section>
          ) : null}

          {/* Post creator */}
          <section className="mb-8 rounded-2xl border border-white/10 bg-slate-800/40 p-6">
            <h2 className="text-xl font-semibold mb-4">Create a Post</h2>
            <form onSubmit={handleCreatePost} className="space-y-4">
              <div>
                <label className="text-sm text-slate-400">Visibility</label>
                <div className="mt-2 flex items-center gap-6 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="visibility"
                      value="public"
                      checked={visibility === "public"}
                      onChange={() => setVisibility("public")}
                    />
                    <span className="text-slate-200">Public</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="visibility"
                      value="private"
                      checked={visibility === "private"}
                      onChange={() => setVisibility("private")}
                    />
                    <span className="text-slate-200">Private</span>
                  </label>
                  <span className="text-xs text-slate-500">
                    {meUserId ? "Public shows in the feed; Private shows only under My Posts." : "Login required to post."}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-400">Title *</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={140}
                  placeholder="What's on your mind?"
                  className="mt-1 w-full rounded-lg bg-slate-900/70 px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="text-sm text-slate-400">Caption</label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add a caption..."
                  className="mt-1 w-full h-24 rounded-lg bg-slate-900/70 px-3 py-2 resize-none"
                  maxLength={500}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm text-slate-400">Media Type</label>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {(["image", "video", "audio"] as CommunityMediaType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setMediaType(t)}
                        className={`px-4 py-2 rounded-lg text-sm ${
                          mediaType === t ? "bg-sky-500 text-white" : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {t === "image" ? "📸 Image" : t === "video" ? "🎬 Video" : "🎵 Audio"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-slate-400">Upload Media (optional, max 2MB)</label>
                  <input
                    type="file"
                    accept={mediaType === "image" ? "image/*" : mediaType === "video" ? "video/*" : "audio/*"}
                    onChange={(e) => setSelectedMedia(e.target.files?.[0] || null)}
                    className="mt-2 w-full"
                  />
                  {selectedMedia ? (
                    <div className="text-sm text-green-400 mt-2">✓ {selectedMedia.name} selected</div>
                  ) : null}
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-400">Background Audio (optional, max 2MB)</label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setSelectedAudio(e.target.files?.[0] || null)}
                  className="mt-2 w-full"
                />
                {selectedAudio ? (
                  <div className="text-sm text-green-400 mt-2">✓ {selectedAudio.name} selected</div>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Publish Post"}
              </button>
            </form>
          </section>

          {/* Feed */}
          <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
            <div className="text-sm text-slate-400">
              {loading ? "Loading…" : `${visiblePosts.length} post${visiblePosts.length === 1 ? "" : "s"}`}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFeedView("public")}
                className={`px-3 py-1.5 rounded-xl border text-sm ${
                  feedView === "public" ? "bg-slate-700 border-slate-500" : "border-slate-700"
                }`}
              >
                Public Feed
              </button>
              <button
                onClick={() => setFeedView("mine")}
                className={`px-3 py-1.5 rounded-xl border text-sm ${
                  feedView === "mine" ? "bg-slate-700 border-slate-500" : "border-slate-700"
                }`}
              >
                My Posts
              </button>
              <button
                onClick={() => setSort("new")}
                className={`px-3 py-1.5 rounded-xl border text-sm ${
                  sort === "new" ? "bg-slate-700 border-slate-500" : "border-slate-700"
                }`}
              >
                New
              </button>
              <button
                onClick={() => setSort("top")}
                className={`px-3 py-1.5 rounded-xl border text-sm ${
                  sort === "top" ? "bg-slate-700 border-slate-500" : "border-slate-700"
                }`}
              >
                Top
              </button>
            </div>
          </div>

          <section className="grid grid-cols-1 gap-6 pb-20">
            {visiblePosts.map((post) => (
              <article key={post.id} className="rounded-2xl border border-white/10 bg-slate-800/40 p-6">
                <div className="flex items-start gap-4">
                  {/* Media Preview */}
                  <div className="w-32 h-32 rounded-xl bg-slate-700/50 flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {post.mediaUrl && post.mediaType === "image" ? (
                      <img src={post.mediaUrl} alt="Post media" className="w-full h-full object-cover" />
                    ) : post.mediaUrl && post.mediaType === "video" ? (
                      <video src={post.mediaUrl} className="w-full h-full object-cover" controls />
                    ) : post.mediaUrl && post.mediaType === "audio" ? (
                      <audio src={post.mediaUrl} className="w-full" controls />
                    ) : (
                      <div className="text-2xl">📣</div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-semibold break-words mb-2">{post.title}</h3>
                    <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
                      <span>by {post.by || "anonymous"}</span>
                      <span>•</span>
                      <span>{timeAgo(post.createdAt)} ago</span>
                      {post.isMine ? (
                        <>
                          <span>•</span>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] border ${
                              post.visibility === "private"
                                ? "border-amber-500/40 text-amber-300"
                                : "border-emerald-500/40 text-emerald-300"
                            }`}
                          >
                            {post.visibility === "private" ? "Private" : "Public"}
                          </span>
                        </>
                      ) : null}
                    </div>

                    {post.text ? (
                      <p className="text-sm text-slate-200 whitespace-pre-wrap break-words mb-4">{post.text}</p>
                    ) : null}

                    {post.audioUrl ? (
                      <div className="mb-4">
                        <div className="text-xs text-slate-400 mb-1">Background audio</div>
                        <audio src={post.audioUrl} controls className="w-full" />
                      </div>
                    ) : null}

                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="rounded-full px-3 py-1 text-sm bg-slate-900/60 border border-white/10">
                        score <b>{post.score}</b>
                      </span>
                      <span className="rounded-full px-3 py-1 text-xs bg-slate-900/60 border border-white/10">
                        {post.votes} votes • {post.superVotes} ⚡
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          className={`h-9 px-3 rounded-full bg-slate-700 hover:bg-slate-600 ${
                            voted.has(post.id) ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                          onClick={() => void handleVote(post.id, 1)}
                          disabled={voted.has(post.id)}
                        >
                          ▲ Vote
                        </button>
                        <button
                          className={`h-9 px-3 rounded-full bg-indigo-600 hover:bg-indigo-500 ${
                            voted.has(post.id) ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                          onClick={() => void handleVote(post.id, 3)}
                          disabled={voted.has(post.id)}
                        >
                          ⚡ Super-vote
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}

            {!loading && visiblePosts.length === 0 ? (
              <div className="text-slate-400 text-sm text-center py-12">
                No posts yet{feedView === "mine" ? " (for you)" : ""} — be the first to share something!
              </div>
            ) : null}
          </section>
        </main>
      </div>
    </TokenGateWrapper>
  );
}


