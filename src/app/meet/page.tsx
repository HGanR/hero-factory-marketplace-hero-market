// TROO Video Meeting - Complete Anti-Flicker Version
// Drop-in replacement for pages/meet.tsx

"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAccount, useChainId, useConnect, useDisconnect, useReadContract } from 'wagmi';
import { injected } from '@wagmi/core';
import { TokenGateWrapper } from '../components/TokenGateWrapper';
import type {
  MeetAvatarNftItem,
  MeetAvatarNftsResponse,
  MeetAvatarNftWarning,
} from '@/lib/meet/avatar-nfts/types';
import { meetAvatarLog } from '@/lib/meet/meetAvatarLog';
import { TrooLiveKitMeeting } from './TrooLiveKitMeeting';

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

type DemoNftPick = { mint: string; name: string; image: string; description?: string };

interface ExtendedMediaRecorder extends MediaRecorder {
  timer?: ReturnType<typeof setInterval>;
}

// Constants
const ELECTRIC_BLUE = "#00D1FF";
const BRIGHT_ELECTRIC_BLUE = "#00E5FF";

// HERO NFT (Polygon ERC-1155) gate configuration
const HERO_1155_CONTRACT = "0x7202cd71cb52ce0d71b9a13f2dacc4599b6cb13a" as `0x${string}`;
const HERO_1155_TOKEN_IDS = [0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n];
const ERC1155_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "id", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "uri",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

const REQUIRED_NFT_LABEL = "Hero NFT (ERC-1155)";
const DEV_TREASURY_ADDRESS = "0x5c8B7C050d7E83E01A278bE24d578A4Daf3e17EF";

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
  const searchParams = useSearchParams();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  
  // Meeting state
  const [meetingState, setMeetingState] = useState('setup');
  const [roomId, setRoomId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [displayName, setDisplayName] = useState('');
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
  
  // LiveKit state (real-time multi-participant video)
  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const [livekitServerUrl, setLivekitServerUrl] = useState<string | null>(null);
  const [livekitError, setLivekitError] = useState<string | null>(null);

  // Host-only: layout, participant record, recording
  const [meetingLayout, setMeetingLayout] = useState<'grid' | 'speaker' | 'single-speaker'>('grid');
  const [recordParticipants, setRecordParticipants] = useState(false);
  const [egressId, setEgressId] = useState<string | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Token gate state
  const [walletType, setWalletType] = useState<'phantom' | 'metamask' | null>(null);
  
  // Avatar NFTs (unified GET /api/meet/avatar-nfts)
  const [avatarNftItems, setAvatarNftItems] = useState<MeetAvatarNftItem[]>([]);
  const [avatarNftWarnings, setAvatarNftWarnings] = useState<MeetAvatarNftWarning[]>([]);
  const [avatarNftSourcesSucceeded, setAvatarNftSourcesSucceeded] = useState<
    Array<"marketplace" | "hero">
  >([]);
  const [nftFetchPartialFailure, setNftFetchPartialFailure] = useState(false);
  const [solanaAvatarUnsupported, setSolanaAvatarUnsupported] = useState(false);
  const [avatarNftsTruncated, setAvatarNftsTruncated] = useState(false);
  const [nftFetchError, setNftFetchError] = useState<string | null>(null);
  const [isLoadingNFTs, setIsLoadingNFTs] = useState(false);
  
  // Device detection state
  const [deviceInfo, setDeviceInfo] = useState<{videoDevices: number, audioDevices: number, error?: string} | null>(null);

  // NFT gate checks (Polygon ERC-1155)
  const heroReads = HERO_1155_TOKEN_IDS.map((id) =>
    useReadContract({
      address: HERO_1155_CONTRACT,
      abi: ERC1155_ABI,
      functionName: "balanceOf",
      args: address ? [address as `0x${string}`, id] : undefined,
      chainId: 137,
      query: { enabled: Boolean(address && address.startsWith("0x")) },
    })
  );
  const heroBalances = heroReads.map((r) => Number(r.data ?? 0n));
  const heroAny = heroBalances.some((b) => b > 0);
  const heroLoadingAny = heroReads.some((r) => r.isLoading);

  const isTokenHolder = Boolean(isConnected && address?.startsWith("0x") && heroAny);
  const gatePending = Boolean(isConnected && address?.startsWith("0x") && heroLoadingAny);

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

  const selectableAvatarNfts = useMemo(
    () => avatarNftItems.filter((i) => i.selectable && i.image),
    [avatarNftItems]
  );

  const displayAvatarNfts = useMemo(
    () => selectableAvatarNfts.slice(0, 7),
    [selectableAvatarNfts]
  );

  const hasSolanaWarning =
    solanaAvatarUnsupported ||
    avatarNftWarnings.some((w) => w.code === "solana_unsupported");
  const marketplaceFetchFailed = avatarNftWarnings.some(
    (w) => w.code === "marketplace_fetch_failed"
  );
  const heroFetchFailed = avatarNftWarnings.some((w) => w.code === "hero_fetch_failed");
  const heroSourceOk = avatarNftSourcesSucceeded.includes("hero");
  const marketplaceSourceOk = avatarNftSourcesSucceeded.includes("marketplace");

  useEffect(() => {
    meetAvatarLog("picker NFT count (server)", {
      items: avatarNftItems.length,
      selectable: selectableAvatarNfts.length,
    });
  }, [avatarNftItems.length, selectableAvatarNfts.length]);

  useEffect(() => {
    meetAvatarLog("selected avatar payload", {
      imageUrl: selectedAvatar,
      isLiveCamera: selectedAvatar === null,
      previewLen: selectedAvatar ? selectedAvatar.length : 0,
    });
  }, [selectedAvatar]);

  useEffect(() => {
    if (!showAvatarSelector) return;
    meetAvatarLog("avatar picker open", {
      selectableTotal: selectableAvatarNfts.length,
      truncated: avatarNftsTruncated,
      isLoadingNFTs,
      nftFetchError,
      partialFailure: nftFetchPartialFailure,
      hasSolanaWarning,
    });
  }, [
    showAvatarSelector,
    selectableAvatarNfts.length,
    avatarNftsTruncated,
    isLoadingNFTs,
    nftFetchError,
    nftFetchPartialFailure,
    hasSolanaWarning,
  ]);

  useEffect(() => {
    if (address) {
      meetAvatarLog("wallet context", {
        address,
        chainId,
        walletType,
        renderWalletNftSection: Boolean(address && walletType),
      });
    }
  }, [address, chainId, walletType]);

  // Unified server avatar NFTs (marketplace DB + Hero ERC-1155 on Polygon)
  useEffect(() => {
    if (!address || !walletType) {
      setAvatarNftItems([]);
      setAvatarNftWarnings([]);
      setAvatarNftSourcesSucceeded([]);
      setNftFetchPartialFailure(false);
      setSolanaAvatarUnsupported(false);
      setAvatarNftsTruncated(false);
      setNftFetchError(null);
      return;
    }
    const apiWalletType = walletType === "phantom" ? "phantom" : "evm";
    let cancelled = false;
    setIsLoadingNFTs(true);
    meetAvatarLog("avatar-nfts API fetch", { address, apiWalletType });
    const q = new URLSearchParams({
      walletAddress: address,
      walletType: apiWalletType,
      limit: "20",
    });
    fetch(`/api/meet/avatar-nfts?${q.toString()}`)
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Request failed (${res.status})`);
        }
        return res.json() as Promise<MeetAvatarNftsResponse>;
      })
      .then((data) => {
        if (cancelled) return;
        setAvatarNftItems(data.items ?? []);
        setAvatarNftWarnings(data.warnings ?? []);
        setAvatarNftSourcesSucceeded(data.sourcesSucceeded ?? []);
        setNftFetchPartialFailure(Boolean(data.partialFailure));
        setSolanaAvatarUnsupported(Boolean(data.solanaAvatarUnsupported));
        setAvatarNftsTruncated(Boolean(data.truncated));
        setNftFetchError(null);
        meetAvatarLog("avatar-nfts API settled", {
          items: data.items?.length ?? 0,
          partialFailure: data.partialFailure,
          solanaUnsupported: data.solanaAvatarUnsupported,
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setAvatarNftItems([]);
        setAvatarNftWarnings([]);
        setAvatarNftSourcesSucceeded([]);
        setNftFetchPartialFailure(true);
        setSolanaAvatarUnsupported(false);
        setAvatarNftsTruncated(false);
        setNftFetchError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingNFTs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address, walletType]);

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

  // Read room, name, presetLabel from URL when arriving via shared link (e.g. /meet?room=ABC123&name=RoomName&presetLabel=Voice%20discussion%20room)
  const presetLabelFromUrl = searchParams?.get("presetLabel")?.trim() || "";
  useEffect(() => {
    const room = searchParams?.get("room")?.trim().toUpperCase() || searchParams?.get("room")?.trim() || "";
    const name = searchParams?.get("name")?.trim() || "";
    if (room) {
      setRoomId(room);
      if (name) setRoomName(name);
    }
  }, [searchParams]);

  // Resolve avatar identity for room entry (Phase 2)
  const [avatarIdentity, setAvatarIdentity] = useState<{ displayName: string; avatarModelUrl: string; thumbnailUrl?: string | null; isFallback: boolean } | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(true);
  useEffect(() => {
    fetch("/api/avatars/default", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data?.avatar) {
          setAvatarIdentity({
            displayName: data.avatar.displayName || "Guest",
            avatarModelUrl: data.avatar.avatarModelUrl,
            thumbnailUrl: data.avatar.thumbnailUrl,
            isFallback: false,
          });
          setDisplayName((prev) => prev || data.avatar.displayName || "");
          if (!selectedAvatar && data.avatar.thumbnailUrl) {
            setSelectedAvatar(data.avatar.thumbnailUrl);
          }
        } else {
          setAvatarIdentity({
            displayName: "Guest",
            avatarModelUrl: "/models/avatars/guest/default-avatar.glb",
            thumbnailUrl: null,
            isFallback: true,
          });
        }
      })
      .catch(() => {
        setAvatarIdentity({
          displayName: "Guest",
          avatarModelUrl: "/models/avatars/guest/default-avatar.glb",
          thumbnailUrl: null,
          isFallback: true,
        });
      })
      .finally(() => setAvatarLoading(false));
  }, []);

  // Visitor arrived via shared link (room in URL) = joining existing meeting
  const isJoiningViaLink = Boolean(searchParams?.get("room")?.trim());

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

  // Start/join meeting - fetches LiveKit token for real-time multi-participant video
  const handleStartMeeting = useCallback(async () => {
    setIsConnecting(true);
    setLivekitError(null);
    setMeetingState('joining');

    try {
      const participantIdentity = address
        ? `${address.slice(0, 8)}-${Date.now().toString(36)}`
        : `guest-${Date.now().toString(36)}`;
      const participantName =
        (displayName?.trim() || '').slice(0, 64) ||
        (address ? `0x${address.slice(2, 6)}...${address.slice(-4)}` : 'Guest');

      const res = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: roomId,
          participantIdentity,
          participantName,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 503) {
          setLivekitError(
            'LiveKit not configured. Using demo mode—participants won\'t see each other. Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET for real video calls.'
          );
          // Fall back to local demo
          setTimeout(() => {
            setMeetingState('meeting');
            setIsConnecting(false);
            setParticipants([
              {
                id: 'self',
                address: address || 'demo',
                name: 'You',
                isHost,
                isMuted: !isAudioOn,
                isVideoOn: isVideoOn && !cameraOptional,
                avatar: selectedAvatar || undefined,
                stream: localStream || undefined,
              },
            ]);
          }, 800);
          return;
        }
        throw new Error(data?.error || `Token request failed (${res.status})`);
      }

      // Stop setup stream; LiveKit will manage its own media
      localStream?.getTracks().forEach((t) => t.stop());
      setLocalStream(null);

      setLivekitToken(data.token);
      setLivekitServerUrl(data.serverUrl);
      setMeetingState('meeting');
      setIsConnecting(false);
    } catch (err) {
      setLivekitError(err instanceof Error ? err.message : 'Failed to connect');
      setMeetingState('setup');
      setIsConnecting(false);
    }
  }, [roomId, address, displayName, isHost, isAudioOn, isVideoOn, cameraOptional, selectedAvatar, localStream]);

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
    setLivekitToken(null);
    setLivekitServerUrl(null);
    setLivekitError(null);
    setEgressId(null);
  }, [localStream, screenStream, isRecording, stopRecording]);

  // Generate invite link
  const generateInviteLink = useCallback(() => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const params = new URLSearchParams();
    params.set('room', roomId);
    if (roomName) params.set('name', roomName);
    const presetLabel = searchParams?.get('presetLabel')?.trim();
    if (presetLabel) params.set('presetLabel', presetLabel);
    const link = `${baseUrl}/meet?${params.toString()}`;
    setInviteLink(link);
    
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(link).then(() => {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      });
    }
  }, [roomId, roomName, searchParams]);

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

                {/* Token Status — collapsed by default; expand for full wallet / contract / balances */}
                {isConnected && (
                  <details className="group mb-6 rounded-lg bg-slate-700">
                    <summary className="cursor-pointer list-none p-4 rounded-lg select-none [&::-webkit-details-marker]:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-white">Token Status</div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
                            <span className="font-mono">
                              {address?.slice(0, 6)}…{address?.slice(-4)}
                            </span>
                            <span className="text-slate-500">·</span>
                            <span className="capitalize">{walletType || "Unknown"}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={
                              gatePending
                                ? "text-slate-300"
                                : isTokenHolder
                                  ? "text-green-400"
                                  : "text-red-400"
                            }
                          >
                            {gatePending
                              ? "Checking…"
                              : heroAny
                                ? "✓ NFT holder"
                                : "No NFT"}
                          </span>
                          <svg
                            className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </div>
                      </div>
                    </summary>
                    <div className="space-y-2 border-t border-slate-600 px-4 pb-4 pt-3 text-sm">
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-400">Wallet</span>
                        <span className="font-mono text-right text-xs sm:text-sm">
                          {address?.slice(0, 6)}…{address?.slice(-4)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-400">Wallet type</span>
                        <span className="capitalize">{walletType || "Unknown"}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-400">Contract</span>
                        <span className="font-mono text-right text-xs sm:text-sm">
                          {HERO_1155_CONTRACT.slice(0, 6)}…{HERO_1155_CONTRACT.slice(-4)}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-2">
                        <span className="shrink-0 text-slate-400">Token IDs</span>
                        <span className="break-all text-xs text-slate-300">
                          {HERO_1155_TOKEN_IDS.join(", ")}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-slate-400">Balances</span>
                        <span className="break-all text-xs leading-relaxed text-slate-300">
                          {heroBalances.map((b, i) => `${HERO_1155_TOKEN_IDS[i]}:${b}`).join(" | ")}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-400">NFT balance</span>
                        <span className={isTokenHolder ? "text-green-400" : "text-red-400"}>
                          {gatePending
                            ? "Checking…"
                            : heroAny
                              ? "✓ NFT holder"
                              : "No NFT found"}
                        </span>
                      </div>
                      {!isTokenHolder && address !== DEV_TREASURY_ADDRESS && (
                        <p className="text-xs text-gray-400 pt-1">
                          Member perks: hold the {REQUIRED_NFT_LABEL} on Polygon to unlock host
                          privileges (e.g., recording).
                        </p>
                      )}
                    </div>
                  </details>
                )}

                {/* Joining via link banner */}
                {isJoiningViaLink && (
                  <div className="mb-6 p-4 rounded-lg border border-blue-500/50 bg-blue-500/10">
                    <p className="text-sm text-blue-200 font-medium">
                      You&apos;re joining an existing meeting. Grant permissions below and click Join to enter.
                    </p>
                  </div>
                )}

                {/* Avatar identity banner (Phase 2) */}
                {!avatarLoading && avatarIdentity?.isFallback && (
                  <div className="mb-6 p-4 rounded-lg border border-amber-500/40 bg-amber-500/10">
                    <p className="text-sm text-amber-200 font-medium">
                      You&apos;re using a default guest avatar.
                    </p>
                    <a
                      href="/avatars"
                      className="text-sm text-cyan-400 hover:text-cyan-300 mt-1 inline-block"
                    >
                      Create your avatar →
                    </a>
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

                {/* Display Name - shown to other participants */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">Your display name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value.slice(0, 64))}
                    placeholder={address ? `0x${address.slice(2, 6)}...${address.slice(-4)}` : "Guest"}
                    className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white focus:border-blue-400 focus:outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">Change from guest or wallet address</p>
                </div>

                {/* Avatar - NFT from wallet or live camera */}
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
                      <span>{selectedAvatar ? "NFT from wallet" : "Live camera"}</span>
                    </div>
                  </button>
                  <p className="text-xs text-gray-400 mt-1">Display an NFT from your wallet as your avatar</p>
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
                        <span>{isJoiningViaLink ? "Joining Meeting..." : "Starting Meeting..."}</span>
                      </div>
                    ) : (
                      isJoiningViaLink ? "Join Meeting" : "Start Meeting"
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
                {presetLabelFromUrl && <p className="text-cyan-400/80 text-sm">{presetLabelFromUrl}</p>}
              </div>
            </div>
          )}

          {meetingState === 'meeting' && livekitToken && livekitServerUrl && (
            /* LiveKit real-time meeting with host controls */
            <TrooLiveKitMeeting
              token={livekitToken}
              serverUrl={livekitServerUrl}
              roomId={roomId}
              roomName={roomName}
              isHost={isHost}
              meetingLayout={meetingLayout}
              setMeetingLayout={setMeetingLayout}
              recordParticipants={recordParticipants}
              setRecordParticipants={setRecordParticipants}
              egressId={egressId}
              setEgressId={setEgressId}
              selectedAvatar={selectedAvatar}
              isAudioOn={isAudioOn}
              isVideoOn={isVideoOn}
              cameraOptional={cameraOptional}
              onLeave={leaveMeeting}
              hostWalletAddress={address ?? ''}
              onOpenAvatarPicker={() => setShowAvatarSelector(true)}
            />
          )}

          {meetingState === 'meeting' && !livekitToken && (
            /* Fallback demo (LiveKit not configured) */
            <div className="flex-1 flex flex-col">
              {livekitError && (
                <div className="flex-none px-4 py-2 bg-amber-900/50 border-b border-amber-600/50 text-amber-200 text-sm">
                  {livekitError}
                </div>
              )}
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
                    {presetLabelFromUrl && (
                      <>
                        <span>•</span>
                        <span className="text-cyan-400/90">{presetLabelFromUrl}</span>
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
                    type="button"
                    onClick={() => setShowAvatarSelector(true)}
                    className="px-3 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-sm"
                    title="NFT or camera avatar"
                  >
                    Avatar
                  </button>
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
              {hasSolanaWarning ? (
                <p className="mb-3 text-xs text-amber-300/90" role="status">
                  Solana NFT avatars are not supported in Meet yet. Connect an EVM wallet (e.g. MetaMask) on
                  Polygon for wallet NFTs, or use live camera / sample images below.
                </p>
              ) : nftFetchError ? (
                <p className="mb-3 text-xs text-amber-300/90" role="status">
                  Could not load avatar NFTs from the server: {nftFetchError}. You can still use live camera
                  or sample images below.
                </p>
              ) : nftFetchPartialFailure &&
                selectableAvatarNfts.length > 0 &&
                marketplaceFetchFailed &&
                heroSourceOk ? (
                <p className="mb-3 text-xs text-amber-300/90" role="status">
                  Marketplace NFTs could not be loaded. The avatars below are on-chain Hero (ERC-1155) assets
                  from Polygon.
                </p>
              ) : nftFetchPartialFailure &&
                selectableAvatarNfts.length > 0 &&
                heroFetchFailed &&
                marketplaceSourceOk ? (
                <p className="mb-3 text-xs text-amber-300/90" role="status">
                  On-chain Hero assets could not be loaded. The avatars below are from your marketplace
                  wallet list.
                </p>
              ) : nftFetchPartialFailure && selectableAvatarNfts.length > 0 ? (
                <p className="mb-3 text-xs text-amber-300/90" role="status">
                  Some avatar sources failed to load; showing what we could recover below.
                </p>
              ) : nftFetchPartialFailure && selectableAvatarNfts.length === 0 ? (
                <p className="mb-3 text-xs text-amber-300/90" role="status">
                  Wallet NFT sources could not be loaded. Use live camera or sample images below, or try again
                  later.
                </p>
              ) : null}
              {avatarNftsTruncated && selectableAvatarNfts.length > 0 ? (
                <p className="mb-2 text-xs text-slate-400" role="status">
                  Showing first 7 selectable avatars; more may be available (list was truncated server-side).
                </p>
              ) : null}

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
                    <span className="ml-2 text-sm text-gray-400">Loading wallet NFTs…</span>
                  </div>
                ) : displayAvatarNfts.length > 0 ? (
                  displayAvatarNfts.map((nft) => (
                    <div
                      key={nft.id}
                      onClick={() => {
                        if (nft.image) {
                          setSelectedAvatar(nft.image);
                          setShowAvatarSelector(false);
                        }
                      }}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                        selectedAvatar === nft.image ? 'border-blue-400 bg-slate-700' : 'border-slate-600 hover:border-slate-500'
                      }`}
                    >
                      <div className="aspect-square bg-slate-700 rounded-lg overflow-hidden mb-2">
                        <img 
                          src={nft.image!} 
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
                ) : nftFetchError || (nftFetchPartialFailure && selectableAvatarNfts.length === 0) ? (
                  <>
                    <div className="col-span-3 flex flex-col justify-center rounded-lg border border-slate-600 bg-slate-900/40 p-4 text-sm text-slate-300">
                      <p className="font-medium text-slate-200">No wallet NFTs loaded</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {nftFetchError
                          ? "Server request failed (see note above)."
                          : "All avatar sources failed (see note above)."}{" "}
                        Sample images below are not from your wallet.
                      </p>
                    </div>
                    {DEMO_NFTS.map((nft) => (
                      <div
                        key={nft.mint}
                        onClick={() => {
                          setSelectedAvatar(nft.image);
                          setShowAvatarSelector(false);
                        }}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                          selectedAvatar === nft.image
                            ? 'border-amber-400/80 bg-slate-700'
                            : 'border-dashed border-slate-500 hover:border-slate-400'
                        }`}
                      >
                        <div className="aspect-square bg-slate-700 rounded-lg overflow-hidden mb-2">
                          <img
                            src={nft.image}
                            alt={nft.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <p className="text-xs text-center text-slate-400">Demo</p>
                        <p className="text-sm text-center truncate">{nft.name}</p>
                      </div>
                    ))}
                  </>
                ) : (
                  /* Successful fetch (or non-EVM) with zero wallet NFTs: optional demo placeholders */
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
                        <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
                      </div>
                      <p className="text-xs text-center text-slate-500">Sample</p>
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

/** `useSearchParams` must be under Suspense (App Router). */
function MeetPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-400 text-sm">
          Loading…
        </div>
      }
    >
      <TrooVideoMeeting />
    </Suspense>
  );
}

// Export as dynamic component to disable SSR
const DynamicMeetPage = dynamic(() => Promise.resolve(MeetPage), { ssr: false });
export default DynamicMeetPage;