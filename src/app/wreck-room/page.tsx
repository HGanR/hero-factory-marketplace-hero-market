"use client";

import dynamic from "next/dynamic";

const WreckRoom = dynamic(() => import("@/wreck-room/WreckRoom"), { ssr: false });

export default function WreckRoomPage() {
  return <WreckRoom />;
}
