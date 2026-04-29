"use client";

/**
 * Troo fork of LiveKit ControlBar: excludes current browser tab from screen-share picker by default
 * (reduces infinite “hall of mirrors” when the meeting tab is shared) and adds camera PIP controls while sharing.
 * Based on @livekit/components-react ControlBar (v2.9.x).
 */

import { supportsScreenSharing } from "@livekit/components-core";
import {
  ChatIcon,
  ChatToggle,
  DisconnectButton,
  LeaveIcon,
  MediaDeviceMenu,
  StartMediaButton,
  TrackToggle,
  useLocalParticipantPermissions,
  useMaybeLayoutContext,
  usePersistentUserChoices,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import * as React from "react";
import { useMeetScreenShareUi, type PipCorner } from "./meet-screen-share-ui-context";

export type TrooLiveKitControlBarControls = {
  microphone?: boolean;
  camera?: boolean;
  chat?: boolean;
  screenShare?: boolean;
  leave?: boolean;
  settings?: boolean;
};

const trackSourceToProtocol = (source: Track.Source) => {
  switch (source) {
    case Track.Source.Camera:
      return 1;
    case Track.Source.Microphone:
      return 2;
    case Track.Source.ScreenShare:
      return 3;
    default:
      return 0;
  }
};

function useViewportMaxWidth(maxPx: number): boolean {
  const [ok, setOk] = React.useState(false);
  React.useEffect(() => {
    const q = window.matchMedia(`(max-width: ${maxPx}px)`);
    const fn = () => setOk(q.matches);
    fn();
    q.addEventListener("change", fn);
    return () => q.removeEventListener("change", fn);
  }, [maxPx]);
  return ok;
}

function cn(...parts: (string | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export interface TrooLiveKitControlBarProps extends React.HTMLAttributes<HTMLDivElement> {
  onDeviceError?: (error: { source: Track.Source; error: Error }) => void;
  variation?: "minimal" | "verbose" | "textOnly";
  controls?: TrooLiveKitControlBarControls;
  saveUserChoices?: boolean;
}

export function TrooLiveKitControlBar({
  variation: variationProp,
  controls,
  saveUserChoices = true,
  onDeviceError,
  className,
  ...props
}: TrooLiveKitControlBarProps) {
  const { pipEnabled, setPipEnabled, pipCorner, setPipCorner } = useMeetScreenShareUi();
  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const layoutContext = useMaybeLayoutContext();
  React.useEffect(() => {
    if (layoutContext?.widget.state?.showChat !== undefined) {
      setIsChatOpen(layoutContext.widget.state.showChat);
    }
  }, [layoutContext?.widget.state?.showChat]);

  const isTooLittleSpace = useViewportMaxWidth(isChatOpen ? 1000 : 760);
  const variation = variationProp ?? (isTooLittleSpace ? "minimal" : "verbose");

  const visibleControls: TrooLiveKitControlBarControls = { leave: true, ...controls };

  const localPermissions = useLocalParticipantPermissions();

  if (!localPermissions) {
    visibleControls.camera = false;
    visibleControls.chat = false;
    visibleControls.microphone = false;
    visibleControls.screenShare = false;
  } else {
    const canPublishSource = (source: Track.Source) =>
      localPermissions.canPublish &&
      (localPermissions.canPublishSources.length === 0 ||
        localPermissions.canPublishSources.includes(trackSourceToProtocol(source)));
    visibleControls.camera ??= canPublishSource(Track.Source.Camera);
    visibleControls.microphone ??= canPublishSource(Track.Source.Microphone);
    visibleControls.screenShare ??= canPublishSource(Track.Source.ScreenShare);
    visibleControls.chat ??= Boolean(localPermissions.canPublishData && controls?.chat);
  }

  const showIcon = variation === "minimal" || variation === "verbose";
  const showText = variation === "textOnly" || variation === "verbose";

  const browserSupportsScreenSharing = supportsScreenSharing();

  const [isScreenShareEnabled, setIsScreenShareEnabled] = React.useState(false);

  const onScreenShareChange = React.useCallback((enabled: boolean) => {
    setIsScreenShareEnabled(enabled);
  }, []);

  const {
    saveAudioInputEnabled,
    saveVideoInputEnabled,
    saveAudioInputDeviceId,
    saveVideoInputDeviceId,
  } = usePersistentUserChoices({ preventSave: !saveUserChoices });

  const microphoneOnChange = React.useCallback(
    (enabled: boolean, isUserInitiated: boolean) => (isUserInitiated ? saveAudioInputEnabled(enabled) : null),
    [saveAudioInputEnabled]
  );

  const cameraOnChange = React.useCallback(
    (enabled: boolean, isUserInitiated: boolean) => (isUserInitiated ? saveVideoInputEnabled(enabled) : null),
    [saveVideoInputEnabled]
  );

  return (
    <div className={cn("lk-control-bar", className)} {...props}>
      {visibleControls.microphone && (
        <div className="lk-button-group">
          <TrackToggle
            source={Track.Source.Microphone}
            showIcon={showIcon}
            onChange={microphoneOnChange}
            onDeviceError={(error) => onDeviceError?.({ source: Track.Source.Microphone, error })}
          >
            {showText && "Microphone"}
          </TrackToggle>
          <div className="lk-button-group-menu">
            <MediaDeviceMenu
              kind="audioinput"
              onActiveDeviceChange={(_kind, deviceId) => saveAudioInputDeviceId(deviceId ?? "default")}
            />
          </div>
        </div>
      )}
      {visibleControls.camera && (
        <div className="lk-button-group">
          <TrackToggle
            source={Track.Source.Camera}
            showIcon={showIcon}
            onChange={cameraOnChange}
            onDeviceError={(error) => onDeviceError?.({ source: Track.Source.Camera, error })}
          >
            {showText && "Camera"}
          </TrackToggle>
          <div className="lk-button-group-menu">
            <MediaDeviceMenu
              kind="videoinput"
              onActiveDeviceChange={(_kind, deviceId) => saveVideoInputDeviceId(deviceId ?? "default")}
            />
          </div>
        </div>
      )}
      {visibleControls.screenShare && browserSupportsScreenSharing && (
        <div className="lk-button-group flex flex-wrap items-center gap-x-2 gap-y-1">
          <TrackToggle
            source={Track.Source.ScreenShare}
            captureOptions={{
              audio: true,
              /** Prefer window/monitor over this meeting tab to avoid infinite mirror capture. */
              selfBrowserSurface: "exclude",
              preferCurrentTab: false,
            }}
            showIcon={showIcon}
            onChange={onScreenShareChange}
            onDeviceError={(error) => onDeviceError?.({ source: Track.Source.ScreenShare, error })}
          >
            {showText && (isScreenShareEnabled ? "Stop screen share" : "Share screen")}
          </TrackToggle>
          {isScreenShareEnabled && (
            <>
              <label className="flex items-center gap-1.5 text-[11px] text-white cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={pipEnabled}
                  onChange={(e) => setPipEnabled(e.target.checked)}
                  data-testid="troo-screen-share-pip-toggle"
                />
                Camera PIP
              </label>
              <label className="flex items-center gap-1 text-[11px] text-white/90">
                <span className="sr-only">PIP position</span>
                <select
                  value={pipCorner}
                  onChange={(e) => setPipCorner(e.target.value as PipCorner)}
                  className="rounded bg-slate-800 border border-slate-600 text-[11px] px-1 py-0.5 max-w-[6.5rem]"
                  data-testid="troo-screen-share-pip-corner"
                >
                  <option value="br">Corner ↘</option>
                  <option value="bl">Corner ↙</option>
                  <option value="tr">Corner ↗</option>
                  <option value="tl">Corner ↖</option>
                </select>
              </label>
            </>
          )}
        </div>
      )}
      {visibleControls.chat && (
        <ChatToggle>
          {showIcon && <ChatIcon />}
          {showText && "Chat"}
        </ChatToggle>
      )}
      {visibleControls.leave && (
        <DisconnectButton>
          {showIcon && <LeaveIcon />}
          {showText && "Leave"}
        </DisconnectButton>
      )}
      <StartMediaButton />
    </div>
  );
}
