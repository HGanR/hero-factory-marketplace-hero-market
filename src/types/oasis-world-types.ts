/**
 * Complete TypeScript Interface Definitions
 *
 * This file provides all type definitions needed for:
 * - Interactive assets in 3D buildings
 * - Interior color customization
 * - Wallet connections and signatures
 * - Asset persistence and snapshots
 *
 * Ensure all imports use these types for full type safety
 */

// ============================================================================
// INTERIOR COLORS
// ============================================================================

/**
 * Interior room color customization
 *
 * Defines all customizable colors in a room:
 * - Structural: walls, ceiling, floor
 * - Windows & Doors: glass, frames, panels
 * - Details: railings, trim
 * - Lighting: ambient light color and intensity
 */
export interface InteriorColors {
  /** Main wall color (hex) */
  walls: string;

  /** Ceiling color (hex) */
  ceiling: string;

  /** Floor color (hex) */
  floor: string;

  /** Window glass color (hex) */
  windows: string;

  /** Window frame color (hex) */
  windowFrames: string;

  /** Door panel color (hex) */
  doors: string;

  /** Door frame color (hex) */
  doorFrames: string;

  /** Railing color (hex) */
  railings: string;

  /** Ambient light color (hex) */
  ambientLightColor: string;

  /** Ambient light intensity (0-1) */
  ambientLightIntensity: number;
}

/**
 * Color palette preset
 *
 * Pre-defined color schemes that can be applied to rooms
 */
export interface ColorPalettePreset {
  /** Unique palette ID */
  id: string;

  /** Display name */
  name: string;

  /** Description of the palette */
  description: string;

  /** Color values */
  colors: InteriorColors;
}

// ============================================================================
// 3D VECTORS
// ============================================================================

/**
 * 3D position vector
 */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * 2D vector (for 2D operations)
 */
export interface Vector2 {
  x: number;
  y: number;
}

// ============================================================================
// INTERACTIVE ASSETS
// ============================================================================

/**
 * Custom properties for an asset
 *
 * Flexible key-value store for asset-specific data
 */
export interface AssetProperties {
  [key: string]: string | number | boolean | object | null;
}

/**
 * Interaction zone for proximity-based interactions
 *
 * Defines a radius around an asset where players can interact
 */
export interface InteractionZone {
  /** Unique zone ID */
  id: string;

  /** Center position of interaction zone */
  position: Vector3;

  /** Radius in units where interaction is possible */
  radius: number;

  /** Type of interaction zone */
  type: "asset" | "npc" | "door" | "shop" | "custom";

  /** ID of the target object */
  targetId: string;

  /** Prompt shown to player when in zone */
  prompt: string;

  /** Action to trigger on interaction */
  action: string;
}

/**
 * Interactive asset in the 3D world
 *
 * Represents furniture, electronics, decorations, and other objects
 * that can be placed, edited, and sold in the building
 */
export interface InteractiveAsset {
  // ========================================================================
  // IDENTIFICATION
  // ========================================================================

  /** Unique asset instance ID */
  id: string;

  /** Asset template ID (e.g., 'sofa-red', 'tv-samsung') */
  assetId: string;

  /** Asset type category */
  assetType: "furniture" | "electronics" | "decoration" | "fixture" | "custom";

  /** Asset display name */
  assetName: string;

  // ========================================================================
  // TRANSFORM
  // ========================================================================

  /** Position in 3D space */
  position: Vector3;

  /** Rotation in radians (Euler angles) */
  rotation: Vector3;

  /** Scale multiplier */
  scale: Vector3;

  // ========================================================================
  // PROPERTIES
  // ========================================================================

  /** Custom properties (color, material, brightness, etc.) */
  properties: AssetProperties;

  /** Display name for UI */
  displayName: string;

  /** Display description for UI */
  displayDescription: string;

  // ========================================================================
  // METADATA
  // ========================================================================

  /** Creation timestamp */
  createdAt: Date;

  /** Last modification timestamp */
  updatedAt: Date;

  /** Wallet address of creator */
  createdBy: string;

  /** Tags for categorization */
  tags: string[];

  // ========================================================================
  // STATE
  // ========================================================================

  /** Whether asset is visible */
  isVisible: boolean;

  /** Whether asset is locked from editing */
  isLocked: boolean;

  // ========================================================================
  // RPG/INTERACTION
  // ========================================================================

  /** Whether asset can be interacted with */
  isInteractable: boolean;

  /** Interaction zone definition */
  interactionZone: InteractionZone;

  /** Can player sit on this asset */
  canSit?: boolean;

  /** Can player pick up this asset */
  canPickup?: boolean;

  /** Can player use this asset */
  canUse?: boolean;

  // ========================================================================
  // COMMERCE
  // ========================================================================

  /** Whether asset is for sale */
  isForSale?: boolean;

  /** Price in currency units */
  price?: number;

  /** Currency type */
  currency?: "ETH" | "USDC" | "XRPL" | "tokens" | string;

  /** Stock quantity available */
  stock?: number;

  /** Model URL (GLB/GLTF) */
  modelUrl?: string;

  /** Image URL for display */
  imageUrl?: string;
}

// ============================================================================
// ASSET EDITING & PERSISTENCE
// ============================================================================

/**
 * Edit state for an asset
 *
 * Tracks changes, history, and sync status
 */
export interface AssetEditState {
  /** Asset ID being edited */
  assetId: string;

  /** Original asset before edits */
  originalAsset: InteractiveAsset;

  /** Current edited asset */
  editedAsset: InteractiveAsset;

  /** Whether there are unsaved changes */
  hasChanges: boolean;

  /** Set of field names that were changed */
  changedFields: Set<string>;

  /** Edit history for undo/redo */
  editHistory: InteractiveAsset[];

  /** Current position in edit history */
  historyIndex: number;

  /** Whether currently saving */
  isSaving: boolean;

  /** Timestamp of last save */
  lastSavedAt?: Date;

  /** Signature of last save */
  lastSavedSignature?: string;
}

/**
 * Snapshot of asset state at a point in time
 *
 * Includes wallet signature for verification
 */
export interface AssetEditSnapshot {
  /** Asset ID */
  assetId: string;

  /** Full asset data */
  asset: InteractiveAsset;

  /** When this snapshot was created */
  timestamp: Date;

  /** Wallet address that made the edit */
  walletAddress: string;

  /** Cryptographic signature */
  signature: string;

  /** List of fields that were changed */
  changedFields: string[];

  /** Optional IPFS hash if uploaded */
  ipfsHash?: string;

  /** Optional blockchain transaction hash */
  transactionHash?: string;
}

/**
 * Asset edit history entry
 *
 * Records each modification to an asset
 */
export interface AssetEditHistoryEntry {
  /** Unique entry ID */
  id: string;

  /** Asset ID */
  assetId: string;

  /** Who made the edit */
  editedBy: string;

  /** When the edit was made */
  editedAt: Date;

  /** What changed */
  changedFields: string[];

  /** Previous values */
  previousValues: Partial<InteractiveAsset>;

  /** New values */
  newValues: Partial<InteractiveAsset>;

  /** Wallet signature */
  signature: string;

  /** IPFS hash of snapshot */
  ipfsHash?: string;

  /** Blockchain transaction hash */
  transactionHash?: string;
}

// ============================================================================
// WALLET & AUTHENTICATION
// ============================================================================

/**
 * Wallet connection state
 *
 * Represents a connected blockchain wallet
 */
export interface WalletConnection {
  /** Whether wallet is connected */
  connected: boolean;

  /** Wallet address */
  address: string;

  /** Wallet name/type (MetaMask, WalletConnect, etc.) */
  type: string;

  /** Network chain ID */
  chainId: number;

  /** Network name */
  networkName: string;

  /** Sign a message with wallet
   * @param message - Message to sign
   * @returns Signature string
   */
  signMessage: (message: string) => Promise<string>;

  /** Sign a transaction
   * @param transaction - Transaction data
   * @returns Transaction hash
   */
  signTransaction?: (transaction: object) => Promise<string>;

  /** Get balance
   * @returns Balance in wei
   */
  getBalance?: () => Promise<string>;

  /** Disconnect wallet */
  disconnect?: () => Promise<void>;
}

/**
 * Signature verification result
 */
export interface SignatureVerification {
  /** Whether signature is valid */
  isValid: boolean;

  /** Recovered wallet address */
  recoveredAddress: string;

  /** Error message if invalid */
  error?: string;
}

// ============================================================================
// SHOPPING & COMMERCE
// ============================================================================

/**
 * Item displayed on a shelf
 *
 * For sale in the store
 */
export interface ShelfItem {
  /** Unique item ID */
  id: string;

  /** Asset template ID */
  assetId: string;

  /** Display name */
  assetName: string;

  /** Position on shelf */
  position: Vector3;

  /** Rotation on shelf */
  rotation: Vector3;

  /** Scale on shelf */
  scale: Vector3;

  /** Price per unit */
  price: number;

  /** Currency */
  currency: string;

  /** Stock quantity available */
  inStock: number;

  /** Description */
  description: string;

  /** Image URL */
  image: string;

  /** Creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Item in shopping cart
 */
export interface CartItem {
  /** Unique cart item ID */
  id: string;

  /** Shelf item ID */
  shelfItemId: string;

  /** Asset name */
  assetName: string;

  /** Quantity */
  quantity: number;

  /** Price per unit */
  pricePerUnit: number;

  /** Total price for this item */
  totalPrice: number;
}

/**
 * Shopping cart
 */
export interface ShoppingCart {
  /** Unique cart ID */
  id: string;

  /** Player/buyer ID */
  playerId: string;

  /** Items in cart */
  items: CartItem[];

  /** Total price of all items */
  totalPrice: number;

  /** Currency */
  currency: string;

  /** When cart was created */
  createdAt: Date;

  /** When cart expires */
  expiresAt: Date;
}

/**
 * Transaction record
 */
export interface Transaction {
  /** Unique transaction ID */
  id: string;

  /** Buyer ID */
  buyerId: string;

  /** Seller ID */
  sellerId: string;

  /** Store ID */
  storeId: string;

  /** Items purchased */
  items: CartItem[];

  /** Total price */
  totalPrice: number;

  /** Currency */
  currency: string;

  /** Transaction status */
  status: "pending" | "confirmed" | "failed" | "completed";

  /** When transaction was created */
  createdAt: Date;

  /** When transaction was completed */
  completedAt?: Date;

  /** Payment method */
  paymentMethod?: string;

  /** Blockchain transaction hash */
  transactionHash?: string;

  /** Error message if failed */
  error?: string;
}

// ============================================================================
// ROOMS & BUILDINGS
// ============================================================================

/**
 * Door connecting rooms
 */
export interface Door {
  /** Unique door ID */
  id: string;

  /** Door name */
  name: string;

  /** Position in 3D space */
  position: Vector3;

  /** Rotation */
  rotation: Vector3;

  /** Door width */
  width: number;

  /** Door height */
  height: number;

  /** Whether door is open */
  isOpen: boolean;

  /** Whether door is locked */
  isLocked: boolean;

  /** Room this door leads to */
  leadsToRoom: string;

  /** Position player spawns at in destination room */
  leadsToPosition: Vector3;

  /** Interaction zone */
  interactionZone: InteractionZone;
}

/**
 * Wall segment
 */
export interface Wall {
  /** Unique wall ID */
  id: string;

  /** Start position */
  startPosition: Vector3;

  /** End position */
  endPosition: Vector3;

  /** Wall height */
  height: number;

  /** Wall thickness */
  thickness: number;

  /** Wall color (hex) */
  color?: string;

  /** Wall material */
  material?: string;
}

/**
 * Room/space in building
 */
export interface Room {
  /** Unique room ID */
  id: string;

  /** Room name */
  name: string;

  /** Room type */
  type: "showroom" | "storage" | "office" | "custom";

  /** Position in world */
  position: Vector3;

  /** Room dimensions (width, height, depth) */
  size: Vector3;

  /** Floor level (0 = ground) */
  floor: number;

  /** Walls in room */
  walls: Wall[];

  /** Doors in room */
  doors: Door[];

  /** Ambient light settings */
  ambientLight: {
    color: string;
    intensity: number;
  };

  /** Room description */
  description: string;

  /** Max player capacity */
  capacity: number;

  /** Whether room is public */
  isPublic: boolean;
}

/**
 * Building/structure
 */
export interface Building {
  /** Unique building ID */
  id: string;

  /** Building name */
  name: string;

  /** Building type */
  type: "store" | "home" | "office" | "custom";

  /** Position in world */
  position: Vector3;

  /** Building dimensions */
  size: Vector3;

  /** Rooms in building */
  rooms: Room[];

  /** Interior colors */
  colors: InteriorColors;

  /** Owner wallet address */
  owner: string;

  /** Creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;

  /** Whether building is public */
  isPublic: boolean;

  /** Building description */
  description: string;
}

// ============================================================================
// NPC & DIALOGUE
// ============================================================================

/**
 * Dialogue response option
 */
export interface DialogueResponse {
  /** Unique response ID */
  id: string;

  /** Text shown to player */
  text: string;

  /** Next dialogue node ID */
  nextNodeId: string;

  /** Action to trigger */
  action: string;

  /** Required item to show this response */
  requiresItem?: string;

  /** Required level to show this response */
  requiresLevel?: number;
}

/**
 * Single dialogue node
 */
export interface DialogueNode {
  /** Unique node ID */
  id: string;

  /** NPC ID */
  npcId: string;

  /** Dialogue text */
  text: string;

  /** Response options */
  responses: DialogueResponse[];

  /** Required item to see this dialogue */
  requiresItem?: string;

  /** Required level */
  requiresLevel?: number;
}

/**
 * NPC in world
 */
export interface NPC {
  /** Unique NPC ID */
  id: string;

  /** NPC name */
  name: string;

  /** NPC type */
  type: "shopkeeper" | "guard" | "npc" | "custom";

  /** Position in 3D space */
  position: Vector3;

  /** Rotation */
  rotation: Vector3;

  /** Model URL (GLB/GLTF) */
  modelUrl: string;

  /** Scale */
  scale: Vector3;

  /** Whether NPC can be interacted with */
  isInteractable: boolean;

  /** Dialogue tree */
  dialogue: DialogueNode[];

  /** Current dialogue node */
  currentDialogueNode: string;

  /** Patrol path waypoints */
  patrolPath: Vector3[];

  /** Whether NPC is patrolling */
  isPatrolling: boolean;

  /** Interaction zone */
  interactionZone: InteractionZone;
}

// ============================================================================
// PLAYER CHARACTER
// ============================================================================

/**
 * Player character state
 */
export interface PlayerCharacter {
  /** Unique player ID */
  id: string;

  /** Player name */
  name: string;

  /** Position in 3D space */
  position: Vector3;

  /** Rotation (Euler angles) */
  rotation: Vector3;

  /** Player height */
  height: number;

  /** Movement speed */
  speed: number;

  /** Whether player is moving */
  isMoving: boolean;

  /** Current room ID */
  currentRoom: string;

  /** Inventory items */
  inventory: ShelfItem[];

  /** Connected wallet address */
  walletAddress: string;
}

/**
 * Camera settings
 */
export interface CameraSettings {
  /** Camera mode */
  mode: "first-person" | "third-person";

  /** Distance from player (for third-person) */
  distance: number;

  /** Height above player */
  height: number;

  /** Field of view */
  fov: number;

  /** Mouse sensitivity */
  sensitivity: number;

  /** Invert Y axis */
  invertY: boolean;
}

// ============================================================================
// SHELF DISPLAY
// ============================================================================

/**
 * Shelf display in store
 */
export interface ShelfDisplay {
  /** Unique shelf ID */
  id: string;

  /** Position in room */
  position: Vector3;

  /** Rotation */
  rotation: Vector3;

  /** Shelf dimensions */
  size: Vector3;

  /** Items on shelf */
  items: ShelfItem[];

  /** How to display items */
  displayType: "grid" | "carousel" | "list";

  /** Items per row (for grid) */
  itemsPerRow: number;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  /** Whether request was successful */
  success: boolean;

  /** Response data */
  data?: T;

  /** Error message if failed */
  error?: string;

  /** Error code */
  errorCode?: string;

  /** Timestamp */
  timestamp: Date;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  /** Items in this page */
  items: T[];

  /** Total number of items */
  total: number;

  /** Current page number */
  page: number;

  /** Items per page */
  pageSize: number;

  /** Total pages */
  totalPages: number;
}


