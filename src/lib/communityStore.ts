export type CommunityMediaType = "image" | "video" | "audio";

export type CommunityPost = {
  id: string;
  title: string;
  text?: string;
  by: string;
  createdAt: number; // epoch ms
  score: number;
  votes: number;
  superVotes: number;
  // optional media (stored as data URL for demo)
  mediaType?: CommunityMediaType;
  mediaUrl?: string;
  audioUrl?: string;
};

const POSTS_KEY = "community:posts:v1";
const VOTED_KEY = "community:voted:v1";

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadCommunityPosts(): CommunityPost[] {
  if (typeof window === "undefined") return [];
  const parsed = safeParse<CommunityPost[]>(localStorage.getItem(POSTS_KEY));
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((p) => p && typeof p.id === "string" && typeof p.title === "string")
    .map((p) => ({
      ...p,
      createdAt: typeof p.createdAt === "number" ? p.createdAt : Date.now(),
      score: typeof p.score === "number" ? p.score : 0,
      votes: typeof p.votes === "number" ? p.votes : 0,
      superVotes: typeof p.superVotes === "number" ? p.superVotes : 0,
    }));
}

export function saveCommunityPosts(posts: CommunityPost[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
}

export function createCommunityPost(input: Omit<CommunityPost, "id" | "createdAt" | "score" | "votes" | "superVotes">) {
  const posts = loadCommunityPosts();
  const next: CommunityPost = {
    id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    title: input.title,
    text: input.text,
    by: input.by,
    createdAt: Date.now(),
    score: 0,
    votes: 0,
    superVotes: 0,
    mediaType: input.mediaType,
    mediaUrl: input.mediaUrl,
    audioUrl: input.audioUrl,
  };
  const updated = [next, ...posts];
  saveCommunityPosts(updated);
  return next;
}

export function loadVotedSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  const parsed = safeParse<string[]>(localStorage.getItem(VOTED_KEY));
  if (!Array.isArray(parsed)) return new Set();
  return new Set(parsed.filter((x) => typeof x === "string"));
}

export function saveVotedSet(set: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(VOTED_KEY, JSON.stringify(Array.from(set)));
}

export function voteCommunityPost(postId: string, power: 1 | 3) {
  const posts = loadCommunityPosts();
  const updated = posts.map((p) => {
    if (p.id !== postId) return p;
    return {
      ...p,
      score: p.score + (power === 3 ? 3 : 1),
      votes: p.votes + (power === 3 ? 0 : 1),
      superVotes: p.superVotes + (power === 3 ? 1 : 0),
    };
  });
  saveCommunityPosts(updated);
  return updated;
}


