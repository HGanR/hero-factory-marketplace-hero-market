# Meet Page – LiveKit Setup

The `/meet` page uses **LiveKit** for real-time multi-participant video. When a group opens a shared link, everyone joins the same room and sees each other.

## Quick Start (LiveKit Cloud)

1. Sign up at [cloud.livekit.io](https://cloud.livekit.io) (free tier available).
2. Create a project and copy the **URL**, **API Key**, and **API Secret**.
3. Add to `.env.local`:

```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
```

4. Restart the dev server.

## Features

- **Display name**: Visitors can set their name before joining (instead of guest/wallet address).
- **Layout** (Host only): Choose grid, speaker, or single-speaker layout for recordings.
- **Participant record** (Host only): Toggle "Record participants" to log attendees for Meeting Minutes. Export as JSON when done.
- **Recording** (Host only): Start/stop LiveKit Egress recording. Requires S3 config (see below).
- **NFT avatar**: Select an NFT from your wallet to display as your video avatar.

## Recording (S3)

To enable meeting recording, add S3 credentials:

```env
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1
```

Recordings are saved to `meet-recordings/{roomName}-{timestamp}.mp4`.

## Fallback Mode

If LiveKit is not configured, the meet page runs in **demo mode**: users can enter rooms and use the UI, but participants in different browsers will not see each other’s video. A banner explains this.

## Shared Links

When someone starts a meeting and copies the invite link (e.g. `https://yoursite.com/meet?room=ABC123&name=MyRoom`), anyone who opens it will:

- Land on the meet page
- See the room pre-filled from the URL
- See “Join Meeting” instead of “Start Meeting”
- Enter the same LiveKit room when they join
