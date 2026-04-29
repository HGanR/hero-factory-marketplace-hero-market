/**
 * Shared shape for `/api/revenue-os/content-engine` responses — used by Content Engine UI and
 * Bentley first-campaign mapping (no duplicate generation).
 */
export interface ContentEngineOutput {
  captions: {
    hook: string;
    authority: string;
    curiosity: string;
    controversial: string;
    shortViral: string;
  };
  imagePrompts: string[];
  viralIdeas: Array<{
    title: string;
    description: string;
  }>;
  hooks: string[];
  fullPost: {
    caption: string;
    content: string;
    visualPrompt: string;
    hashtags: string[];
  };
}
