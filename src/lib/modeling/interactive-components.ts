/**
 * Interactive Components System
 * Defines behavior contracts for interactive objects in buildings
 */

export type InteractionType =
  | 'door'
  | 'lightSwitch'
  | 'tv'
  | 'kiosk'
  | 'pickup'
  | 'seat'
  | 'teleport'
  | 'purchase';

export type InteractionEvent =
  | 'onEnterTrigger'
  | 'onInteract'
  | 'onPickupComplete'
  | 'onUseStart'
  | 'onUseEnd'
  | 'onStateChange'
  | 'onPurchaseComplete';

export interface InteractionConfig {
  type: InteractionType;
  properties: Record<string, any>;
  events: Partial<Record<InteractionEvent, any>>;
  state?: Record<string, any>;
  persistence?: {
    saveState: boolean;
    key: string;
  };
}

/**
 * Predefined interaction templates
 */
export const INTERACTION_TEMPLATES: Record<InteractionType, Omit<InteractionConfig, 'properties'>> = {
  door: {
    type: 'door',
    events: {
      onInteract: {
        action: 'toggle',
        animation: 'door-swing',
        sound: 'door-creak'
      }
    },
    state: {
      isOpen: false,
      isLocked: false
    },
    persistence: {
      saveState: true,
      key: 'door-state'
    }
  },

  lightSwitch: {
    type: 'lightSwitch',
    events: {
      onInteract: {
        action: 'toggle-lights',
        targetNodes: [], // Will be populated with light node IDs
        sound: 'switch-click'
      }
    },
    state: {
      isOn: false
    },
    persistence: {
      saveState: true,
      key: 'light-state'
    }
  },

  tv: {
    type: 'tv',
    events: {
      onInteract: {
        action: 'open-ui',
        uiType: 'tv-remote',
        channels: ['news', 'sports', 'movies'],
        sound: 'tv-static'
      }
    },
    state: {
      isOn: false,
      currentChannel: 0,
      volume: 50
    },
    persistence: {
      saveState: false, // TV state doesn't persist
      key: 'tv-state'
    }
  },

  kiosk: {
    type: 'kiosk',
    events: {
      onInteract: {
        action: 'open-modal',
        modalType: 'info',
        content: {}, // Will be populated with content data
        closeOnOutsideClick: true
      }
    }
  },

  pickup: {
    type: 'pickup',
    events: {
      onInteract: {
        action: 'add-to-inventory',
        itemId: '', // Will be populated
        quantity: 1,
        sound: 'pickup'
      },
      onPickupComplete: {
        action: 'remove-from-scene'
      }
    }
  },

  seat: {
    type: 'seat',
    events: {
      onInteract: {
        action: 'sit-down',
        cameraOffset: [0, 0.5, 0.5], // Camera position relative to seat
        animation: 'sit-loop',
        exitKey: 'E'
      },
      onUseEnd: {
        action: 'stand-up',
        restoreCamera: true
      }
    }
  },

  teleport: {
    type: 'teleport',
    events: {
      onInteract: {
        action: 'teleport',
        destination: [0, 0, 0], // Will be populated
        sound: 'teleport'
      }
    }
  },

  purchase: {
    type: 'purchase',
    events: {
      onInteract: {
        action: 'open-marketplace',
        productId: '', // Will be populated
        currency: 'TROO'
      },
      onPurchaseComplete: {
        action: 'deliver-item',
        deliveryMethod: 'inventory'
      }
    }
  }
};

/**
 * Create an interactive component configuration
 */
export function createInteractiveComponent(
  type: InteractionType,
  customProperties: Record<string, any> = {}
): InteractionConfig {
  const template = INTERACTION_TEMPLATES[type];
  return {
    ...template,
    properties: {
      ...customProperties
    }
  };
}

/**
 * Validate an interaction configuration
 */
export function validateInteractionConfig(config: InteractionConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check required properties based on type
  switch (config.type) {
    case 'door':
      if (!config.properties.width || !config.properties.height) {
        errors.push('Door requires width and height properties');
      }
      break;
    case 'lightSwitch':
      if (!Array.isArray(config.properties.targetLights)) {
        errors.push('Light switch requires targetLights array');
      }
      break;
    case 'tv':
      if (!Array.isArray(config.properties.channels)) {
        errors.push('TV requires channels array');
      }
      break;
    case 'teleport':
      if (!config.properties.destination) {
        errors.push('Teleport requires destination coordinates');
      }
      break;
    case 'purchase':
      if (!config.properties.productId) {
        errors.push('Purchase requires productId');
      }
      break;
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get available interaction types for UI
 */
export function getAvailableInteractionTypes(): Array<{
  type: InteractionType;
  name: string;
  description: string;
  icon: string;
}> {
  return [
    {
      type: 'door',
      name: 'Door',
      description: 'Openable/closable door with animation',
      icon: '🚪'
    },
    {
      type: 'lightSwitch',
      name: 'Light Switch',
      description: 'Toggle lights on/off',
      icon: '💡'
    },
    {
      type: 'tv',
      name: 'TV',
      description: 'Interactive television with channels',
      icon: '📺'
    },
    {
      type: 'kiosk',
      name: 'Info Kiosk',
      description: 'Display information or web content',
      icon: '📱'
    },
    {
      type: 'pickup',
      name: 'Pickup Item',
      description: 'Collectible item added to inventory',
      icon: '📦'
    },
    {
      type: 'seat',
      name: 'Seat',
      description: 'Chair players can sit in',
      icon: '🪑'
    },
    {
      type: 'teleport',
      name: 'Teleport',
      description: 'Transport to another location',
      icon: '✨'
    },
    {
      type: 'purchase',
      name: 'Purchase Point',
      description: 'Buy items or services',
      icon: '🛒'
    }
  ];
}