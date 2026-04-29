"use client";

/**
 * Troo LiveKit video conference shell: same behavior as @livekit/components-react VideoConference,
 * with MeetScreenShareUiProvider, local camera PIP while screen sharing, and TrooLiveKitControlBar
 * (screen capture excludes this browser tab by default).
 */

import type { MessageDecoder, MessageEncoder, TrackReferenceOrPlaceholder, WidgetState } from "@livekit/components-core";
import { isEqualTrackRef, isTrackReference, isWeb, log } from "@livekit/components-core";
import type { MessageFormatter } from "@livekit/components-react";
import {
  CarouselLayout,
  Chat,
  ConnectionStateToast,
  FocusLayout,
  FocusLayoutContainer,
  GridLayout,
  LayoutContextProvider,
  ParticipantTile,
  RoomAudioRenderer,
  useCreateLayoutContext,
  usePinnedTracks,
  useTracks,
} from "@livekit/components-react";
import { RoomEvent, Track } from "livekit-client";
import * as React from "react";
import { MeetScreenShareUiProvider } from "./meet-screen-share-ui-context";
import { TrooLiveKitControlBar } from "./TrooLiveKitControlBar";
import { TrooScreenShareCameraPip } from "./TrooScreenShareCameraPip";

export interface TrooVideoConferenceProps extends React.HTMLAttributes<HTMLDivElement> {
  chatMessageFormatter?: MessageFormatter;
  chatMessageEncoder?: MessageEncoder;
  chatMessageDecoder?: MessageDecoder;
  SettingsComponent?: React.ComponentType;
}

export function TrooVideoConference({
  chatMessageFormatter,
  chatMessageDecoder,
  chatMessageEncoder,
  SettingsComponent,
  ...props
}: TrooVideoConferenceProps) {
  const [widgetState, setWidgetState] = React.useState<WidgetState>({
    showChat: false,
    unreadMessages: 0,
    showSettings: false,
  });
  const lastAutoFocusedScreenShareTrack = React.useRef<TrackReferenceOrPlaceholder | null>(null);

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { updateOnlyOn: [RoomEvent.ActiveSpeakersChanged], onlySubscribed: false }
  );

  const widgetUpdate = (state: WidgetState) => {
    log.debug("updating widget state", state);
    setWidgetState(state);
  };

  const layoutContext = useCreateLayoutContext();

  const screenShareTracks = tracks.filter(isTrackReference).filter((track) => track.publication.source === Track.Source.ScreenShare);

  const focusTrack = usePinnedTracks(layoutContext)?.[0];
  const carouselTracks = tracks.filter((track) => !isEqualTrackRef(track, focusTrack));

  React.useEffect(() => {
    if (
      screenShareTracks.some((track) => track.publication.isSubscribed) &&
      lastAutoFocusedScreenShareTrack.current === null
    ) {
      log.debug("Auto set screen share focus:", { newScreenShareTrack: screenShareTracks[0] });
      layoutContext.pin.dispatch?.({ msg: "set_pin", trackReference: screenShareTracks[0] });
      lastAutoFocusedScreenShareTrack.current = screenShareTracks[0];
    } else if (
      lastAutoFocusedScreenShareTrack.current &&
      !screenShareTracks.some(
        (track) => track.publication.trackSid === lastAutoFocusedScreenShareTrack.current?.publication?.trackSid
      )
    ) {
      log.debug("Auto clearing screen share focus.");
      layoutContext.pin.dispatch?.({ msg: "clear_pin" });
      lastAutoFocusedScreenShareTrack.current = null;
    }
    if (focusTrack && !isTrackReference(focusTrack)) {
      const updatedFocusTrack = tracks.find(
        (tr) => tr.participant.identity === focusTrack.participant.identity && tr.source === focusTrack.source
      );
      if (updatedFocusTrack !== focusTrack && isTrackReference(updatedFocusTrack)) {
        layoutContext.pin.dispatch?.({ msg: "set_pin", trackReference: updatedFocusTrack });
      }
    }
  }, [
    screenShareTracks.map((ref) => `${ref.publication.trackSid}_${ref.publication.isSubscribed}`).join(),
    focusTrack?.publication?.trackSid,
    tracks,
  ]);

  return (
    <MeetScreenShareUiProvider>
      <div className="lk-video-conference" {...props}>
        {isWeb() && (
          <LayoutContextProvider value={layoutContext} onWidgetChange={widgetUpdate}>
            <div className="lk-video-conference-inner relative">
              {!focusTrack ? (
                <div className="lk-grid-layout-wrapper">
                  <GridLayout tracks={tracks}>
                    <ParticipantTile />
                  </GridLayout>
                </div>
              ) : (
                <div className="lk-focus-layout-wrapper">
                  <FocusLayoutContainer>
                    <CarouselLayout tracks={carouselTracks}>
                      <ParticipantTile />
                    </CarouselLayout>
                    {focusTrack ? <FocusLayout trackRef={focusTrack} /> : null}
                  </FocusLayoutContainer>
                </div>
              )}
              <TrooScreenShareCameraPip />
              <TrooLiveKitControlBar controls={{ chat: true, settings: !!SettingsComponent }} />
            </div>
            <Chat
              style={{ display: widgetState.showChat ? "grid" : "none" }}
              messageFormatter={chatMessageFormatter}
              messageEncoder={chatMessageEncoder}
              messageDecoder={chatMessageDecoder}
            />
            {SettingsComponent ? (
              <div
                className="lk-settings-menu-modal"
                style={{ display: widgetState.showSettings ? "block" : "none" }}
              >
                <SettingsComponent />
              </div>
            ) : null}
          </LayoutContextProvider>
        )}
        <RoomAudioRenderer />
        <ConnectionStateToast />
      </div>
    </MeetScreenShareUiProvider>
  );
}
