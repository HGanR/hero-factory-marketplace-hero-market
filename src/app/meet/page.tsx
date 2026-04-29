// TROO Video Meeting - Complete Anti-Flicker Version
// Drop-in replacement for pages/meet.tsx

"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAccount, useConnect, useDisconnect, useReadContract } from 'wagmi';
import { injected } from "@wagmi/core";
import { TokenGateWrapper } from '../components/TokenGateWrapper';

// Icons (using Lucide React or similar)
const VideoIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const VideoOffIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2v6a2 2 0 01-2 2H6l10-10z" />
  </svg>
);

const MicIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
);

const MicOffIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 5.586A2 2 0 015 7v3a9 9 0 0018 0V7a2 2 0 00-2-2H7a2 2 0 00-1.414.586zM17 14l2 2-2 2M7 14l-2 2 2 2" />
  </svg>
);

const PhoneOffIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2v6a2 2 0 01-2 2H6l10-10z" />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const CameraIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
  </svg>
);

const MonitorIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const MonitorOffIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 20L4 4m5.5 5.5L12 12m7 7h-7l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const CircleIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" strokeWidth={2} />
  </svg>
);

const SquareIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth={2} />
  </svg>
);

const MessageCircleIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const XIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const SmileIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" strokeWidth={2} />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14s1.5 2 4 2 4-2 4-2" />
    <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth={2} />
    <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth={2} />
  </svg>
);

const UserPlusIcon = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 8v6M23 11h-6" />
  </svg>
);

const CrownIcon = () => (
  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
    <path d="M5 16L3 6l5.5 4L12 4l3.5 6L21 6l-2 10H5z" />
  </svg>
);

const CopyIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth={2} />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
);

const Share2Icon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="18" cy="5" r="3" strokeWidth={2} />
    <circle cx="6" cy="12" r="3" strokeWidth={2} />
    <circle cx="18" cy="19" r="3" strokeWidth={2} />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" strokeWidth={2} />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" strokeWidth={2} />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <polyline points="20,6 9,17 4,12" strokeWidth={2} />
  </svg>
);

// Types
interface Participant {
  id: string;
  address: string;
  name: string;
  isHost: boolean;
  isMuted: boolean;
  isVideoOn: boolean;
  avatar?: string;
  stream?: MediaStream;
}

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: number;
}

interface NFT {
  mint?: string;
  tokenId?: string;
  name: string;
  image: string;
  description?: string;
}

interface ExtendedMediaRecorder extends MediaRecorder {
  timer?: ReturnType<typeof setInterval>;
}

// Constants
const ELECTRIC_BLUE = "#00D1FF";
const BRIGHT_ELECTRIC_BLUE = "#00E5FF";

// ERC20 ABI for token balance checking
const ERC20_ABI = [
  {
    "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// TROO Token Configuration
const TROO_POLYGON_CONTRACT = "0xa7927231898293377Ce676CFC9bbD551Cb845695";
const TROO_SOLANA_MINT = "BAeN51zZmMsnkSRFnKZHLFG1G9LkGTFoTMUbyTUDpump";
const REQUIRED_TROO_AMOUNT = 100; // 100 TROO tokens (matches Trust page gate requirement)
const DEV_TREASURY_ADDRESS = "0x5c8B7C050d7E83E01A278bE24d578A4Daf3e17EF";
const EXTRA_EVM_ADDRESSES: `0x${string}`[] = ["0x5c8B7C050d7E83E01A278bE24d578A4Daf3e17EF"];

// Polygon RPC fallbacks (match Trust/Trust-Records/Oasis + extra)
const POLYGON_RPC_CANDIDATES = [
  (process.env.NEXT_PUBLIC_POLYGON_RPC || "").trim(),
  "https://polygon-bor-rpc.publicnode.com",
  "https://polygon-rpc.com",
  "https://1rpc.io/polygon",
  "https://rpc.ankr.com/polygon",
  "https://polygon.gateway.tenderly.co", // public gateway
  "https://polygon-mainnet.blastapi.io", // blast api public
].filter(Boolean);

const pad32 = (hexNo0x: string) => hexNo0x.toLowerCase().padStart(64, "0");
const encodeBalanceOf = (addr: string) => {
  const selector = "70a08231";
  const addrNo0x = addr.replace(/^0x/i, "");
  return ("0x" + selector + pad32(addrNo0x)) as `0x${string}`;
};

async function ethCallPolygonSmart(
  to: string,
  data: `0x${string}`
): Promise<{ result: `0x${string}`; notes: string[] }> {
  const notes: string[] = [];
  for (const url of POLYGON_RPC_CANDIDATES) {
    try {
      const body = { jsonrpc: "2.0", id: Math.floor(Math.random() * 1e6), method: "eth_call", params: [{ to, data }, "latest"] };
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) { notes.push(`RPC ${url} → HTTP ${r.status}`); continue; }
      const j = await r.json();
      if ((j as any)?.error) { notes.push(`RPC ${url} → ${String((j as any)?.error?.message || "error")}`); continue; }
      const res = (j as any)?.result as `0x${string}`;
      if (typeof res === "string") { notes.push(`RPC ${url} → ok`); return { result: res, notes }; }
      notes.push(`RPC ${url} → empty`);
    } catch (e: any) { notes.push(`RPC ${url} → ${String(e?.message || e)}`); }
  }
  throw new Error(notes.join(" | "));
}

async function readPolygonDecimals(contract: string): Promise<{ value: number; notes: string[] }> {
  try {
    const { result, notes } = await ethCallPolygonSmart(contract, "0x313ce567");
    return { value: Number(BigInt(result)), notes };
  } catch (e: any) {
    return { value: 18, notes: [`decimals fallback to 18 (${String(e?.message || e)})`] };
  }
}

async function readPolygonBalance(contract: string, addr: string) {
  const { result, notes } = await ethCallPolygonSmart(contract, encodeBalanceOf(addr));
  return { value: BigInt(result || "0x0"), notes };
}

// Demo NFTs for avatar selection
const DEMO_NFTS = [
  {
    mint: "demo1",
    name: "Cool Ape #1234",
    image: "https://via.placeholder.com/150/FF6B6B/FFFFFF?text=NFT+1",
    description: "A cool ape NFT"
  },
  {
    mint: "demo2", 
    name: "Crypto Punk #5678",
    image: "https://via.placeholder.com/150/4ECDC4/FFFFFF?text=NFT+2",
    description: "A crypto punk NFT"
  },
  {
    mint: "demo3",
    name: "Art Block #9012",
    image: "https://via.placeholder.com/150/45B7D1/FFFFFF?text=NFT+3", 
    description: "An art block NFT"
  }
];

const EMOJI_PACK = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
  '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
  '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '❤️', '🧡'
];

// Wallet detection functions
// IMPORTANT: many browsers can have Phantom installed even when the connected address is EVM.
// We infer wallet type primarily from the connected address shape to avoid mislabeling.
const detectWalletType = (address?: string | null) => {
  if (address && address.startsWith("0x")) return "metamask";
  if (typeof window === "undefined") return null;
  if ((window as any).ethereum) return "metamask";
  if ((window as any).phantom?.solana) return "phantom";
  return null;
};

// NFT fetching functions
const fetchUserNFTs = async (walletAddress: string, walletType: 'phantom' | 'metamask') => {
  try {
    if (walletType === 'phantom') {
      // Fetch Solana NFTs
      const response = await fetch(`/api/nfts/solana?owner=${walletAddress}`);
      const data = await response.json();
      return data.nfts || [];
    } else {
      // Fetch Ethereum/Polygon NFTs
      const response = await fetch(`/api/nft-metadata?owner=${walletAddress}&chain=polygon`);
      const data = await response.json();
      return data.nfts || [];
    }
  } catch (error) {
    console.error('Failed to fetch NFTs:', error);
    return [];
  }
};

// Device detection function
const detectMediaDevices = async () => {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return { videoDevices: 0, audioDevices: 0, error: 'Media devices API not supported' };
    }
    
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    const audioDevices = devices.filter(device => device.kind === 'audioinput');
    
    return {
      videoDevices: videoDevices.length,
      audioDevices: audioDevices.length,
      devices: devices
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { videoDevices: 0, audioDevices: 0, error: message };
  }
};

// Persistent Self Video Component - Anti-Flicker
function SelfVideo({ 
  stream, 
  selectedAvatar, 
  isVideoOn, 
  className = "",
  style = {},
  showOverlay = true,
  overlayText = "You",
  isScreenShare = false
}: {
  stream: MediaStream | null;
  selectedAvatar: string | null;
  isVideoOn: boolean;
  className?: string;
  style?: React.CSSProperties;
  showOverlay?: boolean;
  overlayText?: string;
  isScreenShare?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Stable stream attachment - prevents flicker
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (stream && videoEl.srcObject !== stream) {
      videoEl.srcObject = stream;
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.autoplay = true;
      
      videoEl.play().catch((error) => {
        console.error('Failed to play video:', error);
      });
    } else if (!stream && videoEl.srcObject) {
      videoEl.srcObject = null;
    }
  }, [stream, isVideoOn]);

  return (
    <div className={`relative ${className}`} style={style}>
      {selectedAvatar ? (
        <div className="w-full h-full flex items-center justify-center bg-slate-800">
          <img 
            src={selectedAvatar} 
            alt="Avatar" 
            className="max-w-full max-h-full object-contain"
          />
        </div>
      ) : isVideoOn && stream ? (
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          style={{ 
            transform: isScreenShare ? 'translateZ(0)' : 'scaleX(-1) translateZ(0)',
            backfaceVisibility: 'hidden',
            willChange: 'transform'
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-slate-700">
          <div className="text-center">
            <CameraIcon />
            <p className="text-sm text-gray-400 mt-2">Camera off</p>
          </div>
        </div>
      )}

      {showOverlay && (
        <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 px-2 py-1 rounded text-xs text-white">
          {overlayText}
        </div>
      )}
    </div>
  );
}

// Participant Grid Component - 6 Person Layout
function ParticipantGrid({ 
  participants, 
  localStream, 
  screenStream,
  selectedAvatar, 
  isVideoOn, 
  isScreenSharing
}: {
  participants: Participant[];
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  selectedAvatar: string | null;
  isVideoOn: boolean;
  isScreenSharing: boolean;
}) {
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  // Memoized grid slots - prevents unnecessary re-renders
  const gridSlots = useMemo(
    () => Array.from({ length: 6 }, (_, index) => ({
      participant: participants[index],
      index
    })),
    [participants]
  );

  // Stable effect for video assignment - Anti-Flicker
  useEffect(() => {
    gridSlots.forEach(({ participant, index }) => {
      const videoEl = videoRefs.current[index];
      if (!videoEl) return;

      // Clear empty slots - prevents stuck frames
      if (!participant) {
        if (videoEl.srcObject) videoEl.srcObject = null;
        return;
      }

      if (participant?.id === 'self') {
        const stream = isScreenSharing && screenStream ? screenStream : localStream;
        if (stream && videoEl.srcObject !== stream) {
          // Attach new stream first, then stop old - prevents flicker
          videoEl.srcObject = stream;
          videoEl.muted = true;
          videoEl.playsInline = true;
          videoEl.autoplay = true;
          videoEl.play().catch(() => {});
        }
      } else if (participant?.stream) {
        if (videoEl.srcObject !== participant.stream) {
          videoEl.srcObject = participant.stream;
          videoEl.muted = false;
          videoEl.playsInline = true;
          videoEl.autoplay = true;
          videoEl.play().catch(() => {});
        }
      }
    });
  }, [participants, localStream, screenStream, isScreenSharing]);

  return (
    <div className="grid grid-cols-3 grid-rows-2 gap-4 h-full p-4">
      {gridSlots.map(({ participant, index }) => {
        // Stable keys prevent DOM recreation
        const key = participant ? `p-${participant.id}` : `empty-${index}`;
        
        return (
          <div
            key={key}
            className="relative bg-slate-800 rounded-lg overflow-hidden border-2 border-slate-600 hover:border-slate-500 transition-colors"
          >
            {participant ? (
              <>
                {participant.id === 'self' ? (
                  <SelfVideo
                    stream={isScreenSharing && screenStream ? screenStream : localStream}
                    selectedAvatar={selectedAvatar}
                    isVideoOn={participant.isVideoOn}
                    className="w-full h-full"
                    showOverlay={false}
                    isScreenShare={isScreenSharing}
                  />
                ) : participant.isVideoOn ? (
                  <video
                    ref={(el) => { videoRefs.current[index] = el; }}
                    className="w-full h-full object-cover"
                    style={{ 
                      transform: 'translateZ(0)',
                      backfaceVisibility: 'hidden',
                      willChange: 'transform'
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-700">
                    <div className="text-center">
                      <CameraIcon />
                      <p className="text-sm text-gray-400 mt-2">Camera off</p>
                    </div>
                  </div>
                )}

                {/* Participant Info Overlay */}
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 px-2 py-1 rounded text-xs flex items-center space-x-1 text-white">
                  <span className="truncate max-w-20">{participant.name}</span>
                  {participant.isHost && <CrownIcon />}
                  {participant.isMuted && <MicOffIcon />}
                  {!participant.isVideoOn && <VideoOffIcon />}
                </div>

                {/* Speaking Indicator */}
                <div className="absolute top-2 right-2">
                  <div className={`w-3 h-3 rounded-full ${participant.isVideoOn ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                </div>
              </>
            ) : (
              // Empty slot placeholder - Invite up to 100 participants
              <div className="w-full h-full flex items-center justify-center bg-slate-700 border-2 border-dashed border-slate-500">
                <div className="text-center">
                  <UserPlusIcon />
                  <p className="text-xs text-gray-400 mt-2">Invite participant</p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Main TROO Video Meeting Component
function TrooVideoMeeting() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  
  // Meeting state
  const [meetingState, setMeetingState] = useState('setup');
  const [roomId, setRoomId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [maxParticipants] = useState(100);
  
  // Media state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [cameraOptional, setCameraOptional] = useState(false);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingFormat, setRecordingFormat] = useState('webm');
  const [mediaRecorder, setMediaRecorder] = useState<ExtendedMediaRecorder | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  
  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Token gate state
  const [isTokenHolder, setIsTokenHolder] = useState(false);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [isCheckingTokens, setIsCheckingTokens] = useState(false);
  const [walletType, setWalletType] = useState<'phantom' | 'metamask' | null>(null);
  const [polyManual, setPolyManual] = useState<{
    sum: bigint;
    decimals: number;
    notes: string[];
    ts: number | null;
    loading: boolean;
  }>({ sum: 0n, decimals: 18, notes: [], ts: null, loading: false });
  
  // NFT state
  const [userNFTs, setUserNFTs] = useState<NFT[]>([]);
  const [isLoadingNFTs, setIsLoadingNFTs] = useState(false);
  
  // Device detection state
  const [deviceInfo, setDeviceInfo] = useState<{videoDevices: number, audioDevices: number, error?: string} | null>(null);

  // Real token balance checking with wagmi
  const { data: trooBalanceData } = useReadContract({
    address: TROO_POLYGON_CONTRACT,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: 137, // Polygon
    query: { enabled: Boolean(address && address.startsWith("0x")) },
  });

  const { data: tokenDecimals } = useReadContract({
    address: TROO_POLYGON_CONTRACT,
    abi: ERC20_ABI,
    functionName: 'decimals',
    chainId: 137,
  });

  const trooRawWagmi = (trooBalanceData ?? 0n) as bigint;
  const trooDecimals = Number(tokenDecimals ?? 18);

  const fetchAllEvmAccounts = useCallback(async (): Promise<string[]> => {
    if (typeof window === "undefined") return [];
    const mm = (window as any).ethereum;
    const base: string[] = [];
    if (address?.startsWith("0x")) base.push(address);
    base.push(...EXTRA_EVM_ADDRESSES);
    if (!mm) return Array.from(new Set(base.map((a) => a.toLowerCase())));
    try {
      const permitted = await mm.request({ method: "eth_accounts" });
      const list = Array.isArray(permitted) ? permitted : [];
      const set = new Set<string>(base.map((a) => a.toLowerCase()));
      list.forEach((a) => { if (typeof a === "string" && a.startsWith("0x")) set.add(a.toLowerCase()); });
      return [...set];
    } catch {
      return Array.from(new Set(base.map((a) => a.toLowerCase())));
    }
  }, [address]);

  const rescanPolygonManual = useCallback(async () => {
    const baseAddrs = await fetchAllEvmAccounts();
    const addrs = Array.from(new Set([...baseAddrs, ...EXTRA_EVM_ADDRESSES.map((a) => a.toLowerCase())]));
    if (!addrs.length) {
      setPolyManual({ sum: 0n, decimals: 18, notes: [], ts: Date.now(), loading: false });
      return { raw: 0n, decimals: 18 };
    }
    setPolyManual((p) => ({ ...p, loading: true, notes: [] }));
    const notes: string[] = [];
    try {
      const { value: dec, notes: decNotes } = await readPolygonDecimals(TROO_POLYGON_CONTRACT);
      notes.push(...decNotes);
      let sum = 0n;
      for (const addr of addrs) {
        try {
          const { value: bal, notes: balNotes } = await readPolygonBalance(TROO_POLYGON_CONTRACT, addr);
          notes.push(...balNotes);
          notes.push(`Polygon ${addr.slice(0, 6)}...${addr.slice(-4)} → ${bal.toString()} (raw)`);
          sum += bal;
        } catch (e: any) {
          notes.push(`Polygon ${addr.slice(0, 6)}...${addr.slice(-4)} read error: ${String(e?.message || e)}`);
        }
      }
      const decimals = Number.isFinite(dec) ? dec : 18;
      setPolyManual({ sum, decimals, notes, ts: Date.now(), loading: false });
      return { raw: sum, decimals };
    } catch (e: any) {
      notes.push(`Polygon manual scan failed: ${String(e?.message || e)}`);
      setPolyManual({ sum: 0n, decimals: 18, notes, ts: Date.now(), loading: false });
      return { raw: 0n, decimals: 18 };
    }
  }, [fetchAllEvmAccounts]);

  useEffect(() => {
    if (!isConnected || !address?.startsWith("0x")) return;
    rescanPolygonManual();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address, rescanPolygonManual]);

  // Check if user is host
  const isHost = address === DEV_TREASURY_ADDRESS || isTokenHolder;

  // Generate random room ID
  const generateRoomId = useCallback(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }, []);

  // Token gate check with real balance data
  const checkTokenBalance = useCallback(async () => {
    if (!address || !isConnected) {
      setIsTokenHolder(false);
      setTokenBalance(0);
      setWalletType(null);
      return;
    }

    // Detect wallet type
    const detectedWalletType = detectWalletType(address);
    setWalletType(detectedWalletType);

    // Dev treasury bypass
    if (address === DEV_TREASURY_ADDRESS) {
      setIsTokenHolder(true);
      setTokenBalance(REQUIRED_TROO_AMOUNT);
      return;
    }

    setIsCheckingTokens(true);
    
    try {
      let balance = 0;
      
      // Match Trust page: gate is based on Polygon TROO (ERC-20) contract.
      // Prefer wagmi read; fall back to manual multi-RPC scan when wagmi returns 0/undefined.
      if (address?.startsWith("0x")) {
        let decimals = Number.isFinite(trooDecimals) ? trooDecimals : 18;
        let raw = trooRawWagmi;

          if (raw <= 0n) {
            const manual = await rescanPolygonManual();
          raw = manual.raw;
          decimals = Number.isFinite(manual.decimals) ? manual.decimals : decimals;
        }

        balance = Number(raw) / Math.pow(10, Number.isFinite(decimals) ? decimals : 18);
      } else {
        // No supported on-chain check for this wallet type on /meet right now.
        balance = 0;
      }
      
      setTokenBalance(balance);
      setIsTokenHolder(balance >= REQUIRED_TROO_AMOUNT);
    } catch (error) {
      console.error('Token balance check failed:', error);
      setIsTokenHolder(false);
      setTokenBalance(0);
    } finally {
      setIsCheckingTokens(false);
    }
  }, [address, isConnected, rescanPolygonManual, trooDecimals, trooRawWagmi]);

  // Check tokens when wallet connects
  useEffect(() => {
    checkTokenBalance();
  }, [checkTokenBalance]);

  // Fetch user NFTs when they pass token gate
  useEffect(() => {
    if (isTokenHolder && address && walletType) {
      setIsLoadingNFTs(true);
      fetchUserNFTs(address, walletType).then(nfts => {
        setUserNFTs(nfts);
        setIsLoadingNFTs(false);
      }).catch(error => {
        console.error('Failed to fetch NFTs:', error);
        setIsLoadingNFTs(false);
      });
    }
  }, [isTokenHolder, address, walletType]);

  // Detect wallet type and media devices on mount
  useEffect(() => {
    // Set a default label (will be re-evaluated when address connects)
    setWalletType(detectWalletType(address));
    
    // Detect available media devices
    detectMediaDevices().then(info => {
      setDeviceInfo(info);
      console.log('Device detection result:', info);
    });
  }, [address]);

  // Request media permissions
  const requestPermissions = useCallback(async (includeVideo = true) => {
    try {
      // First, check if media devices are available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media devices API not supported in this browser');
      }

      // Get available devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      const audioDevices = devices.filter(device => device.kind === 'audioinput');
      
      if (includeVideo && videoDevices.length === 0) {
        throw new Error('No camera devices found. Please connect a camera or try audio-only mode.');
      }
      
      if (audioDevices.length === 0) {
        throw new Error('No microphone devices found. Please connect a microphone.');
      }

      // Try different constraint configurations
      const constraintConfigs = [
        // Most compatible configuration
        {
        audio: true,
        ...(includeVideo && {
          video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 15 }
            }
          })
        },
        // Fallback with minimal constraints
        {
          audio: true,
          ...(includeVideo && {
            video: true
          })
        },
        // Audio only fallback
        {
          audio: true
        }
      ];

      let stream: MediaStream | null = null;
      let lastError: Error | null = null;

      // Try each configuration until one works
      for (let i = 0; i < constraintConfigs.length; i++) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraintConfigs[i]);
          break;
        } catch (error) {
          lastError = error as Error;
          
          // If this was the audio-only config and it failed, we're done
          if (i === constraintConfigs.length - 1) {
            throw lastError;
          }
        }
      }

      if (!stream) {
        throw lastError || new Error('Failed to get media stream');
      }
      
      setLocalStream(stream);
      setHasPermissions(true);
      
      // Force video to be enabled if we got video stream
      if (includeVideo && stream.getVideoTracks().length > 0) {
        setIsVideoOn(true);
        
        // Ensure video tracks are enabled
        stream.getVideoTracks().forEach(track => {
          track.enabled = true;
        });
      } else if (includeVideo) {
        setCameraOptional(true);
      }
      
      // Ensure audio tracks are enabled
      stream.getAudioTracks().forEach(track => {
        track.enabled = true;
      });
      
    } catch (error) {
      console.error('Failed to get media permissions:', error);
      
      let errorMessage = 'Camera and microphone access is required for video meetings.\n\n';
      
      if (error instanceof Error) {
        if (error.message.includes('No camera devices found')) {
          errorMessage += 'No camera found. Please:\n';
          errorMessage += '• Connect a camera to your device\n';
          errorMessage += '• Check camera permissions in browser settings\n';
          errorMessage += '• Try audio-only mode by checking "Camera optional"\n';
          errorMessage += '• Try a different browser (Chrome, Firefox, Safari)\n';
        } else if (error.message.includes('Permission denied')) {
          errorMessage += 'Permission denied. Please:\n';
          errorMessage += '• Allow camera and microphone access\n';
          errorMessage += '• Check browser settings\n';
          errorMessage += '• Refresh the page and try again\n';
        } else if (error.message.includes('not supported')) {
          errorMessage += 'Your browser does not support camera access.\n';
          errorMessage += 'Please try Chrome, Firefox, or Safari.\n';
        } else if (error.message.includes('NotFoundError') || error.message.includes('device not found')) {
          errorMessage += 'Camera not found. Please:\n';
          errorMessage += '• Check if camera is connected and working\n';
          errorMessage += '• Try refreshing the page\n';
          errorMessage += '• Check if another app is using the camera\n';
          errorMessage += '• Try audio-only mode\n';
        } else {
          errorMessage += `Error: ${error.message}\n`;
        }
      }
      
      alert(errorMessage);
    }
  }, []);

  // Start meeting
  const handleStartMeeting = useCallback(async () => {
    // Match /trust behavior: token gate is informational (status + perks), not a hard blocker.
    // Non-holders can still start/join meetings; holder status can still grant host perks.

    setIsConnecting(true);
    
    setTimeout(() => {
      setMeetingState('joining');
      
      setTimeout(() => {
        setMeetingState('meeting');
        setIsConnecting(false);
        
        // Add self as participant
        const selfParticipant = {
          id: 'self',
          address: address || 'demo',
          name: 'You',
          isHost,
          isMuted: !isAudioOn,
          isVideoOn: isVideoOn && !cameraOptional,
          avatar: selectedAvatar || undefined,
          stream: localStream || undefined
        };
        
        setParticipants([selfParticipant]);
      }, 2000);
    }, 1000);
  }, [isTokenHolder, address, isHost, isAudioOn, isVideoOn, cameraOptional, selectedAvatar, localStream]);

  // Toggle functions with participant sync
  const toggleVideo = useCallback(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !isVideoOn;
      });
    }
    setIsVideoOn(!isVideoOn);
    
    setParticipants(prev => 
      prev.map(p => 
        p.id === 'self' ? { ...p, isVideoOn: !isVideoOn } : p
      )
    );
  }, [isVideoOn, localStream]);

  const toggleAudio = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !isAudioOn;
      });
    }
    setIsAudioOn(!isAudioOn);
    
    setParticipants(prev => 
      prev.map(p => 
        p.id === 'self' ? { ...p, isMuted: !isAudioOn } : p
      )
    );
  }, [isAudioOn, localStream]);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      const tmp = screenStream;
      setScreenStream(null);
      setIsScreenSharing(false);
      if (tmp) {
        tmp.getTracks().forEach(track => track.stop());
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          },
          audio: true
        });
        
        setScreenStream(stream);
        setIsScreenSharing(true);
        
        stream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          setScreenStream(null);
        };
        
      } catch (error) {
        console.error('Failed to start screen sharing:', error);
      }
    }
  }, [isScreenSharing, screenStream]);

  // Recording functions with proper state management (Host only)
  const startRecording = useCallback(async () => {
    // Only allow host to record
    if (!isHost) {
      alert('Only the meeting host can record the meeting.');
      return;
    }

    try {
      let recordStream = new MediaStream();
      
      // Clone tracks to avoid interfering with original streams
      if (isScreenSharing && screenStream) {
        screenStream.getVideoTracks().forEach(track => {
          if (track.readyState === 'live') {
            recordStream.addTrack(track.clone());
          }
        });
        screenStream.getAudioTracks().forEach(track => {
          if (track.readyState === 'live') {
            recordStream.addTrack(track.clone());
          }
        });
      } else if (localStream) {
        localStream.getVideoTracks().forEach(track => {
          if (track.readyState === 'live') {
            recordStream.addTrack(track.clone());
          }
        });
      }
      
      // Add audio tracks from local stream (clone them)
      if (localStream) {
        localStream.getAudioTracks().forEach(track => {
          if (track.readyState === 'live') {
            recordStream.addTrack(track.clone());
          }
        });
      }
      
      // Validate that we have tracks
      if (recordStream.getTracks().length === 0) {
        alert('No active audio or video tracks available for recording. Please ensure your camera or microphone is enabled.');
        return;
      }
      
      // Pick supported MIME type for MP4-compatible format
      const mimeTypes = [
        'video/mp4;codecs=h264,opus',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus', 
        'video/webm',
        'video/mp4'
      ];
      const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';
      
      const recorder = new MediaRecorder(recordStream, { mimeType });
      const recordedChunks: Blob[] = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };
      
      recorder.onstop = () => {
        if (recordedChunks.length === 0) {
          alert('No recording data was captured. Please try again.');
          return;
        }
        
        const blob = new Blob(recordedChunks, { type: mimeType });
        
        // Download both MP4 video and MP3 audio
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        
        // Download video file
        const videoUrl = URL.createObjectURL(blob);
        const videoExtension = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const videoFilename = `troo-meeting-video-${roomId}-${timestamp}.${videoExtension}`;
        
        const videoLink = document.createElement('a');
        videoLink.style.display = 'none';
        videoLink.href = videoUrl;
        videoLink.download = videoFilename;
        document.body.appendChild(videoLink);
        videoLink.click();
        
        // Download audio file (extract audio from video)
        const audioBlob = new Blob(recordedChunks, { type: 'audio/mp3' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audioFilename = `troo-meeting-audio-${roomId}-${timestamp}.mp3`;
        
        const audioLink = document.createElement('a');
        audioLink.style.display = 'none';
        audioLink.href = audioUrl;
        audioLink.download = audioFilename;
        document.body.appendChild(audioLink);
        audioLink.click();
        
        // Cleanup
        setTimeout(() => {
          document.body.removeChild(videoLink);
          document.body.removeChild(audioLink);
          URL.revokeObjectURL(videoUrl);
          URL.revokeObjectURL(audioUrl);
        }, 100);
        
        setShowDownloadModal(true);
        
        // Stop all recording stream tracks
        recordStream.getTracks().forEach(track => track.stop());
      };
      
      // Start recording
      recorder.start(1000);
      const extendedRecorder = recorder as ExtendedMediaRecorder;
      setMediaRecorder(extendedRecorder);
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start recording timer
      const timer = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      extendedRecorder.timer = timer;
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to start recording. Please check your browser permissions and try again.');
    }
  }, [isScreenSharing, screenStream, localStream, roomId, isHost]);

  const stopRecording = useCallback(() => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      if (mediaRecorder.timer) clearInterval(mediaRecorder.timer);
      setIsRecording(false);
      setIsPaused(false);
    }
  }, [mediaRecorder, isRecording]);

  // Leave meeting with cleanup
  const leaveMeeting = useCallback(() => {
    localStream?.getTracks().forEach(track => track.stop());
    screenStream?.getTracks().forEach(track => track.stop());
    
    if (isRecording) {
      stopRecording();
    }
    
    setMeetingState('setup');
    setLocalStream(null);
    setScreenStream(null);
    setIsScreenSharing(false);
    setParticipants([]);
  }, [localStream, screenStream, isRecording, stopRecording]);

  // Generate invite link
  const generateInviteLink = useCallback(() => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${baseUrl}/meet?room=${roomId}${roomName ? `&name=${encodeURIComponent(roomName)}` : ''}`;
    setInviteLink(link);
    
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(link).then(() => {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      });
    }
  }, [roomId, roomName]);

  // Send chat message
  const sendMessage = useCallback(() => {
    if (newMessage.trim()) {
      const message = {
        id: Date.now().toString(),
        sender: 'You',
        message: newMessage.trim(),
        timestamp: Date.now()
      };
      
      setChatMessages(prev => [...prev, message]);
      setNewMessage('');
    }
  }, [newMessage]);

  // Add emoji to message
  const addEmoji = useCallback((emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  }, []);

  // Format recording time
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Component cleanup on unmount
  useEffect(() => {
    return () => {
      localStream?.getTracks().forEach(track => track.stop());
      screenStream?.getTracks().forEach(track => track.stop());
      if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        clearInterval(mediaRecorder.timer);
      }
    };
  }, [localStream, screenStream, mediaRecorder, isRecording]);

  return (
    <TokenGateWrapper>
      <div className="min-h-screen bg-slate-900 text-white">
        {/* Main Content */}
        <div className="flex-1 flex flex-col h-screen">
          {meetingState === 'setup' && (
            /* Setup Interface */
            <div className="flex-1 flex">
              {/* Left Panel - Setup Form */}
              <div className="w-96 bg-slate-800 p-6 overflow-y-auto">
                {/* Welcome Header */}
                <div className="text-center mb-8">
                  <h2 
                    className="text-3xl font-bold mb-2"
                    style={{ 
                      color: BRIGHT_ELECTRIC_BLUE,
                      textShadow: `0 0 20px ${BRIGHT_ELECTRIC_BLUE}40`
                    }}
                  >
                    WELCOME MEMBERS
                  </h2>
                  <p className="text-gray-400">Set up your exclusive video meeting</p>
                </div>

                {/* Token Status */}
                {isConnected && (
                  <div className="mb-6 p-4 bg-slate-700 rounded-lg">
                    <h3 className="text-sm font-medium mb-2">Token Status</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Wallet:</span>
                        <span className="font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Wallet Type:</span>
                        <span className="capitalize">{walletType || 'Unknown'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Contract:</span>
                        <span className="font-mono">{TROO_POLYGON_CONTRACT.slice(0, 6)}...{TROO_POLYGON_CONTRACT.slice(-4)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Token Balance:</span>
                        <span className={isTokenHolder ? 'text-green-400' : 'text-red-400'}>
                          {isCheckingTokens ? 'Checking...' : `${tokenBalance.toLocaleString()} TROO`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Access:</span>
                        <span className={isTokenHolder ? 'text-green-400' : 'text-slate-300'}>
                          {isTokenHolder ? '✓ Member perks enabled' : 'Available to all visitors'}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>Source:</span>
                        <span>{trooRawWagmi > 0n ? "wagmi" : polyManual.loading ? "manual (loading)" : "manual fallback"}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => { rescanPolygonManual(); checkTokenBalance(); }}
                      className="mt-3 w-full px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm border border-slate-600"
                      disabled={polyManual.loading || isCheckingTokens}
                    >
                      {polyManual.loading || isCheckingTokens ? "Rescanning…" : "Rescan Polygon (manual)"}
                    </button>
                    {polyManual.ts && polyManual.notes.length > 0 && (
                      <details className="mt-2 text-xs text-gray-400">
                        <summary className="cursor-pointer text-cyan-300">Debug notes</summary>
                        <div className="mt-1 space-y-1 max-h-36 overflow-y-auto">
                          {polyManual.notes.map((n, i) => <div key={i}>{n}</div>)}
                        </div>
                      </details>
                    )}
                    {!isTokenHolder && address !== DEV_TREASURY_ADDRESS && (
                      <p className="text-xs text-gray-400 mt-2">
                        Member perks: hold {REQUIRED_TROO_AMOUNT.toLocaleString()} TROO to unlock host privileges (e.g., recording).
                      </p>
                    )}
                  </div>
                )}

                {/* Room Configuration */}
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-3">Room Setup</h3>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Room Name (Optional)</label>
                    <input
                      type="text"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder="Enter room name"
                      className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white focus:border-blue-400 focus:outline-none"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Room ID</label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                        placeholder="Enter room ID"
                        className="flex-1 px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white focus:border-blue-400 focus:outline-none"
                      />
                      <button
                        onClick={() => setRoomId(generateRoomId())}
                        className="px-3 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 transition-colors"
                        title="Generate random room ID"
                      >
                        <Share2Icon />
                      </button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Max Participants</label>
                    <div className="bg-slate-700 rounded-lg p-3 text-sm">
                      <div className="flex justify-between">
                        <span>Current limit:</span>
                        <span className="font-medium">{maxParticipants}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Grid view shows 6 participants, supports up to {maxParticipants} total
                      </div>
                    </div>
                  </div>

                  {roomId && (
                    <div className="flex space-x-2">
                      <button
                        onClick={generateInviteLink}
                        className="flex-1 px-3 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 transition-colors text-sm flex items-center justify-center"
                      >
                        <CopyIcon />
                        <span className="ml-2">{linkCopied ? 'Copied!' : 'Copy Invite Link'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Avatar Selection */}
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-3">Avatar</h3>
                  <button
                    onClick={() => setShowAvatarSelector(true)}
                    className="w-full px-4 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      {selectedAvatar ? (
                        <img src={selectedAvatar} alt="Selected avatar" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <CameraIcon />
                      )}
                      <span>{selectedAvatar ? 'NFT Avatar Selected' : 'Live Camera'}</span>
                    </div>
                  </button>
                </div>

                {/* Device Permissions */}
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-3">Permissions</h3>
                  
                  <div className="mb-3">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={cameraOptional}
                        onChange={(e) => setCameraOptional(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm">Camera optional (audio only)</span>
                    </label>
                  </div>

                  {!hasPermissions ? (
                    <button
                      onClick={() => requestPermissions(!cameraOptional)}
                      className="w-full px-4 py-3 rounded-lg font-medium transition-colors"
                      style={{ 
                        backgroundColor: BRIGHT_ELECTRIC_BLUE, 
                        color: '#1e293b'
                      }}
                    >
                      {cameraOptional ? 'Allow Microphone' : 'Allow Camera & Microphone'}
                    </button>
                  ) : (
                    <div className="flex items-center space-x-2 text-green-400">
                      <CheckIcon />
                      <span>Permissions granted</span>
                    </div>
                  )}
                  
                  {/* Back to Dashboard Button */}
                  <div className="mt-4 flex justify-center">
                    <button
                      onClick={() => router.push('/dashboard')}
                      className="px-6 py-3 bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border border-sky-300"
                    >
                      ← Back to Dashboard
                    </button>
                  </div>
                </div>

                {/* Start Meeting Button */}
                <div className="mt-4 flex justify-center">
                <button
                  onClick={handleStartMeeting}
                  disabled={!roomId.trim() || isConnecting || (!hasPermissions && !cameraOptional)}
                    className={`px-6 py-3 font-semibold rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 border ${
                      !(!roomId.trim() || isConnecting || (!hasPermissions && !cameraOptional))
                        ? 'bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white border-sky-300 hover:shadow-xl animate-pulse'
                        : 'bg-gray-500 text-gray-300 cursor-not-allowed border-gray-400'
                    }`}
                  style={{ 
                      animation: !(!roomId.trim() || isConnecting || (!hasPermissions && !cameraOptional)) ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
                      boxShadow: !(!roomId.trim() || isConnecting || (!hasPermissions && !cameraOptional)) ? '0 0 20px rgba(0, 209, 255, 0.5)' : 'none'
                    }}
                  >
                    {isConnecting ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Starting Meeting...</span>
                      </div>
                    ) : (
                      'Start Meeting'
                    )}
                </button>
                </div>
              </div>

              {/* Right Panel - Video Preview */}
              <div className="flex-1 bg-slate-900 relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  {hasPermissions || selectedAvatar ? (
                    <div className="relative w-full h-full max-w-4xl max-h-3xl">
                      <SelfVideo
                        key="self-video"
                        stream={isScreenSharing && screenStream ? screenStream : localStream}
                        selectedAvatar={selectedAvatar}
                        isVideoOn={isVideoOn}
                        className="w-full h-full rounded-lg overflow-hidden"
                        overlayText={isScreenSharing ? "Screen Share Preview" : "Camera Preview"}
                        isScreenShare={isScreenSharing}
                      />
                    </div>
                  ) : (
                    <div className="text-center">
                      <CameraIcon />
                      <p className="text-gray-400 mt-4">
                        {cameraOptional ? 'Audio-only mode enabled' : 'Grant camera permission to see preview'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {meetingState === 'joining' && (
            /* Joining State */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 mx-auto mb-4" style={{ borderColor: BRIGHT_ELECTRIC_BLUE }}></div>
                <h2 className="text-2xl font-bold mb-2">Joining Meeting...</h2>
                <p className="text-gray-400">Room: {roomId}</p>
                {roomName && <p className="text-gray-400">{roomName}</p>}
              </div>
            </div>
          )}

          {meetingState === 'meeting' && (
            /* Meeting Interface */
            <div className="flex-1 flex flex-col">
              {/* Header */}
              <div className="bg-slate-800 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <h1 className="text-xl font-bold">
                    <span style={{ color: BRIGHT_ELECTRIC_BLUE }}>TROO</span> Video Meeting
                  </h1>
                  <div className="flex items-center space-x-2 text-sm text-gray-400">
                    <UsersIcon />
                    <span>{participants.length} / {maxParticipants} participants</span>
                    {roomName && (
                      <>
                        <span>•</span>
                        <span>Room: {roomName}</span>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  {isRecording && (
                    <div className="flex items-center space-x-2 text-red-400">
                      <div className={`w-3 h-3 rounded-full bg-red-500 ${isPaused ? '' : 'animate-pulse'}`}></div>
                      <span className="text-sm font-mono">
                        {isPaused ? 'PAUSED' : 'REC'} {formatTime(recordingTime)}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setShowChat(!showChat)}
                      className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
                      title="Toggle chat"
                    >
                      <MessageCircleIcon />
                    </button>
                    
                    <button
                      onClick={() => setShowSettings(!showSettings)}
                      className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
                      title="Settings"
                    >
                      <SettingsIcon />
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Video Area */}
              <div className="flex-1 flex">
                {/* Participant Grid */}
                <div className="flex-1 relative bg-slate-900">
                  <ParticipantGrid
                    participants={participants}
                    localStream={localStream}
                    screenStream={screenStream}
                    selectedAvatar={selectedAvatar}
                    isVideoOn={isVideoOn}
                    isScreenSharing={isScreenSharing}
                  />
                </div>

                {/* Chat Panel */}
                {showChat && (
                  <div className="w-80 bg-slate-800 flex flex-col">
                    <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                      <h3 className="font-medium">Chat</h3>
                      <button
                        onClick={() => setShowChat(false)}
                        className="p-1 hover:bg-slate-700 rounded"
                      >
                        <XIcon />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {chatMessages.length === 0 ? (
                        <div className="text-center text-gray-400 text-sm">
                          No messages yet. Start the conversation!
                        </div>
                      ) : (
                        chatMessages.map(message => (
                          <div key={message.id} className="bg-slate-700 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">{message.sender}</span>
                              <span className="text-xs text-gray-400">
                                {new Date(message.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-sm">{message.message}</p>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="p-4 border-t border-slate-700">
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                            placeholder="Type a message..."
                            className="w-full px-3 py-2 pr-10 rounded-lg bg-slate-700 border border-slate-600 text-white focus:border-blue-400 focus:outline-none"
                          />
                          <button
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-slate-600 rounded"
                          >
                            <SmileIcon />
                          </button>
                        </div>
                        <button
                          onClick={sendMessage}
                          disabled={!newMessage.trim()}
                          className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Send
                        </button>
                      </div>

                      {showEmojiPicker && (
                        <div className="mt-2 p-2 bg-slate-700 rounded-lg grid grid-cols-8 gap-1 max-h-32 overflow-y-auto">
                          {EMOJI_PACK.map((emoji, index) => (
                            <button
                              key={index}
                              onClick={() => addEmoji(emoji)}
                              className="p-1 hover:bg-slate-600 rounded text-lg"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Toolbar - Moved from top to bottom */}
              <div className="bg-slate-800 px-6 py-4">
                <div className="flex items-center justify-center space-x-4">
                  <button
                    onClick={toggleVideo}
                    className={`p-3 rounded-full transition-colors ${
                      isVideoOn ? 'bg-slate-600 hover:bg-slate-500' : 'bg-red-600 hover:bg-red-500'
                    }`}
                    title={isVideoOn ? 'Turn off camera' : 'Turn on camera'}
                  >
                    {isVideoOn ? <VideoIcon /> : <VideoOffIcon />}
                  </button>

                  <button
                    onClick={toggleAudio}
                    className={`p-3 rounded-full transition-colors ${
                      isAudioOn ? 'bg-slate-600 hover:bg-slate-500' : 'bg-red-600 hover:bg-red-500'
                    }`}
                    title={isAudioOn ? 'Mute microphone' : 'Unmute microphone'}
                  >
                    {isAudioOn ? <MicIcon /> : <MicOffIcon />}
                  </button>

                  <button
                    onClick={toggleScreenShare}
                    className={`p-3 rounded-full transition-colors ${
                      isScreenSharing ? 'bg-blue-600 hover:bg-blue-500' : 'bg-slate-600 hover:bg-slate-500'
                    }`}
                    title={isScreenSharing ? 'Stop screen sharing' : 'Share screen'}
                  >
                    {isScreenSharing ? <MonitorOffIcon /> : <MonitorIcon />}
                  </button>

                  {/* Recording controls - Host only */}
                  {isHost && (
                  <div className="flex items-center space-x-2">
                    {!isRecording ? (
                      <button
                        onClick={startRecording}
                        className="p-3 rounded-full bg-slate-600 hover:bg-slate-500 transition-colors"
                          title="Start recording (Host only)"
                      >
                        <CircleIcon />
                      </button>
                    ) : (
                      <button
                        onClick={stopRecording}
                        className="p-3 rounded-full bg-red-600 hover:bg-red-500 transition-colors"
                        title="Stop recording"
                      >
                        <SquareIcon />
                      </button>
                    )}
                  </div>
                  )}

                  <button
                    onClick={leaveMeeting}
                    className="p-3 rounded-full bg-red-600 hover:bg-red-500 transition-colors"
                    title="Leave meeting"
                  >
                    <PhoneOffIcon />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Avatar Selector Modal */}
        {showAvatarSelector && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Select Avatar</h3>
                <button
                  onClick={() => setShowAvatarSelector(false)}
                  className="p-1 hover:bg-slate-700 rounded"
                >
                  <XIcon />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-4 mb-4">
                {/* Live Camera Option */}
                <div
                  onClick={() => {
                    setSelectedAvatar(null);
                    setShowAvatarSelector(false);
                  }}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    !selectedAvatar ? 'border-blue-400 bg-slate-700' : 'border-slate-600 hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-center mb-2">
                    <CameraIcon />
                  </div>
                  <p className="text-sm text-center">Live Camera</p>
                </div>

                {/* User NFTs from Wallet */}
                {isLoadingNFTs ? (
                  <div className="col-span-3 flex items-center justify-center p-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                    <span className="ml-2 text-sm text-gray-400">Loading NFTs...</span>
                  </div>
                ) : userNFTs.length > 0 ? (
                  userNFTs.slice(0, 7).map((nft, index) => (
                    <div
                      key={nft.mint || nft.tokenId || index}
                      onClick={() => {
                        setSelectedAvatar(nft.image);
                        setShowAvatarSelector(false);
                      }}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                        selectedAvatar === nft.image ? 'border-blue-400 bg-slate-700' : 'border-slate-600 hover:border-slate-500'
                      }`}
                    >
                      <div className="aspect-square bg-slate-700 rounded-lg overflow-hidden mb-2">
                        <img 
                          src={nft.image} 
                          alt={nft.name} 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = 'https://via.placeholder.com/150/374151/FFFFFF?text=NFT';
                          }}
                        />
                      </div>
                      <p className="text-sm text-center truncate">{nft.name || 'NFT'}</p>
                    </div>
                  ))
                ) : (
                  /* Fallback Demo NFTs if no user NFTs */
                  DEMO_NFTS.map((nft) => (
                  <div
                    key={nft.mint}
                    onClick={() => {
                      setSelectedAvatar(nft.image);
                      setShowAvatarSelector(false);
                    }}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      selectedAvatar === nft.image ? 'border-blue-400 bg-slate-700' : 'border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    <div className="aspect-square bg-slate-700 rounded-lg overflow-hidden mb-2">
                      <img 
                        src={nft.image} 
                        alt={nft.name} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-sm text-center truncate">{nft.name}</p>
                  </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Download Modal */}
        {showDownloadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Recording Complete</h3>
                <button
                  onClick={() => setShowDownloadModal(false)}
                  className="p-1 hover:bg-slate-700 rounded"
                >
                  <XIcon />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-gray-300 mb-4">
                  Your meeting recording has been downloaded successfully as both video and audio files.
                </p>
                <div className="bg-slate-700 rounded-lg p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Video Format:</span>
                    <span className="uppercase">MP4/WebM</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Audio Format:</span>
                    <span className="uppercase">MP3</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Duration:</span>
                    <span>{formatTime(recordingTime)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Host Recording:</span>
                    <span className="text-green-400">✓ Complete</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowDownloadModal(false)}
                className="w-full px-4 py-2 rounded-lg font-medium transition-colors"
                style={{ 
                  backgroundColor: BRIGHT_ELECTRIC_BLUE, 
                  color: '#1e293b'
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </TokenGateWrapper>
  );
}

// Export as dynamic component to disable SSR
const DynamicTrooVideoMeeting = dynamic(() => Promise.resolve(TrooVideoMeeting), { ssr: false });
export default DynamicTrooVideoMeeting;