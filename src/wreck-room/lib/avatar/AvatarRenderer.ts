import * as THREE from "three";

export interface AvatarState {
  skinTone?: string;
  bodyShape?: string;
  muscleTone?: number;
  height?: number;
  gender?: string;
  face?: {
    eyes?: string;
    eyeColor?: string;
    nose?: string;
    ears?: string;
    mouth?: string;
    lipColor?: string;
  };
  attachments?: {
    hair?: string | null;
    hat?: string | null;
    glasses?: string | null;
    sunglasses?: string | null;
    shirt?: string | null;
    jacket?: string | null;
    sneakers?: string | null;
    shoes?: string | null;
    boots?: string | null;
    jewelry?: string | null;
  };
}

function hexToThree(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

export class AvatarRenderer {
  group: THREE.Group;
  private state: AvatarState;
  private parts: Record<string, THREE.Mesh | THREE.Group> = {};
  private animState: "idle" | "walk" | "talk" | "dance" | "wave" | "sit" = "idle";
  private animTime = 0;
  private speechBubble: THREE.Sprite | null = null;
  private speechBubbleTimeout: ReturnType<typeof setTimeout> | null = null;
  isTalking = false;
  isMuted = false;

  constructor(state: AvatarState = {}) {
    this.state = state;
    this.group = new THREE.Group();
    this.build();
  }

  private build() {
    const skinHex = this.state.skinTone ?? "#F5CBA7";
    const skinColor = hexToThree(skinHex);
    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.8 });

    const muscle = this.state.muscleTone ?? 0.5;
    const heightScale = this.state.height ?? 1.0;
    const bodyShape = this.state.bodyShape ?? "average";

    const shapeScale: Record<string, { sx: number; sz: number }> = {
      slim:     { sx: 0.85, sz: 0.85 },
      average:  { sx: 1.0,  sz: 1.0 },
      athletic: { sx: 1.05, sz: 1.0 },
      curvy:    { sx: 1.1,  sz: 1.05 },
      plus:     { sx: 1.2,  sz: 1.15 },
      muscular: { sx: 1.15, sz: 1.1 },
    };
    const ss = shapeScale[bodyShape] ?? { sx: 1.0, sz: 1.0 };

    const chestW = 0.45 * ss.sx * (1 + muscle * 0.2);
    const hipW   = 0.42 * ss.sx;
    const depth  = 0.28 * ss.sz;

    // Torso
    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(chestW, 0.6, depth), skinMat);
    torsoMesh.position.y = 1.1;
    torsoMesh.castShadow = true;
    this.group.add(torsoMesh);
    this.parts.torso = torsoMesh;

    // Shirt overlay
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0x1a3a6e, roughness: 0.9 });
    const shirt = new THREE.Mesh(new THREE.BoxGeometry(chestW + 0.02, 0.62, depth + 0.02), shirtMat);
    shirt.position.y = 1.1;
    this.group.add(shirt);
    this.parts.shirt = shirt;

    // Hips
    const hipMesh = new THREE.Mesh(new THREE.BoxGeometry(hipW, 0.25, depth * 0.95), skinMat);
    hipMesh.position.y = 0.775;
    this.group.add(hipMesh);

    // Pants
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.9 });
    const pants = new THREE.Mesh(new THREE.BoxGeometry(hipW + 0.02, 0.27, depth * 0.97), pantsMat);
    pants.position.y = 0.775;
    this.group.add(pants);

    // Legs
    const legW = 0.18 * (1 + muscle * 0.1);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.9 });
    [-0.13, 0.13].forEach((lx, i) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(legW, 0.55, legW), legMat);
      leg.position.set(lx * ss.sx, 0.375, 0);
      leg.castShadow = true;
      this.group.add(leg);
      this.parts[`leg${i}`] = leg;

      const shoeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(legW + 0.04, 0.1, legW + 0.08), shoeMat);
      shoe.position.set(lx * ss.sx, 0.07, 0.04);
      this.group.add(shoe);
      this.parts[`shoe${i}`] = shoe;
    });

    // Arms
    const armW = 0.14 * (1 + muscle * 0.15);
    [-1, 1].forEach((side, i) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(armW, 0.5, armW), skinMat);
      const armX = side * (chestW / 2 + armW / 2 + 0.02);
      arm.position.set(armX, 1.05, 0);
      arm.castShadow = true;
      this.group.add(arm);
      this.parts[`arm${i}`] = arm;

      const hand = new THREE.Mesh(new THREE.SphereGeometry(armW * 0.6, 8, 8), skinMat);
      hand.position.set(armX, 0.78, 0);
      this.group.add(hand);
      this.parts[`hand${i}`] = hand;
    });

    // Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.15, 8), skinMat);
    neck.position.y = 1.47;
    this.group.add(neck);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), skinMat);
    head.position.y = 1.75;
    head.castShadow = true;
    this.group.add(head);
    this.parts.head = head;

    this.buildFace(skinMat);
    this.buildHair();
    this.buildAccessories();

    this.group.scale.y = heightScale;
  }

  private buildFace(skinMat: THREE.MeshStandardMaterial) {
    const face = this.state.face ?? {};
    const eyeColor = face.eyeColor ? hexToThree(face.eyeColor) : 0x3a2010;
    const lipColor = face.lipColor ? hexToThree(face.lipColor) : 0xc0392b;

    const eyeMat = new THREE.MeshStandardMaterial({ color: eyeColor });
    const scleraMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    [-0.08, 0.08].forEach(ex => {
      const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), scleraMat);
      sclera.position.set(ex, 1.77, 0.2);
      this.group.add(sclera);
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), eyeMat);
      iris.position.set(ex, 1.77, 0.225);
      this.group.add(iris);
    });

    const noseMat = new THREE.MeshStandardMaterial({ color: skinMat.color.getHex() });
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), noseMat);
    nose.position.set(0, 1.72, 0.225);
    this.group.add(nose);

    const mouthMat = new THREE.MeshStandardMaterial({ color: lipColor });
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.01), mouthMat);
    mouth.position.set(0, 1.67, 0.225);
    this.group.add(mouth);
    this.parts.mouth = mouth;
  }

  private buildHair() {
    const hairId = this.state.attachments?.hair;
    if (!hairId) return;
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x2c1810, roughness: 0.9 });
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.23, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), hairMat);
    cap.position.y = 1.78;
    this.group.add(cap);
    this.parts.hair = cap;
    if (hairId.includes("long") || hairId.includes("wavy") || hairId.includes("curly")) {
      const long = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.4, 8), hairMat);
      long.position.y = 1.6;
      this.group.add(long);
    }
  }

  private buildAccessories() {
    const att = this.state.attachments ?? {};

    if (att.hat) {
      const hatMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 16), hatMat);
      brim.position.y = 1.97;
      this.group.add(brim);
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.25, 16), hatMat);
      crown.position.y = 2.1;
      this.group.add(crown);
    }

    if (att.glasses || att.sunglasses) {
      const glassMat = new THREE.MeshStandardMaterial({
        color: att.sunglasses ? 0x111111 : 0xcccccc,
        roughness: 0.1, metalness: 0.8,
      });
      [-0.08, 0.08].forEach(gx => {
        const frame = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 8, 16), glassMat);
        frame.position.set(gx, 1.77, 0.23);
        frame.rotation.y = Math.PI / 2;
        this.group.add(frame);
      });
    }

    if (att.jacket) {
      const jacketMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });
      const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.64, 0.32), jacketMat);
      jacket.position.y = 1.1;
      this.group.add(jacket);
    }
  }

  setTalking(talking: boolean) {
    this.isTalking = talking;
    const mouth = this.parts.mouth as THREE.Mesh;
    if (mouth) {
      (mouth.material as THREE.MeshStandardMaterial).emissive.setHex(talking ? 0xffaaaa : 0x000000);
      (mouth.material as THREE.MeshStandardMaterial).emissiveIntensity = talking ? 1 : 0;
    }
  }

  showSpeechBubble(text: string) {
    if (this.speechBubbleTimeout) clearTimeout(this.speechBubbleTimeout);
    if (this.speechBubble) { this.group.remove(this.speechBubble); this.speechBubble = null; }

    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    (ctx as any).roundRect(4, 4, 504, 100, 16);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const display = text.length > 40 ? text.slice(0, 40) + "…" : text;
    ctx.fillText(display, 256, 52);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    this.speechBubble = new THREE.Sprite(mat);
    this.speechBubble.scale.set(1.4, 0.35, 1);
    this.speechBubble.position.y = 2.4;
    this.group.add(this.speechBubble);

    this.speechBubbleTimeout = setTimeout(() => {
      if (this.speechBubble) { this.group.remove(this.speechBubble); this.speechBubble = null; }
    }, 5000);
  }

  setNameLabel(name: string) {
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 48;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    (ctx as any).roundRect(2, 2, 252, 44, 8);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name.slice(0, 20), 128, 24);
    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const label = new THREE.Sprite(mat);
    label.scale.set(1.0, 0.19, 1);
    label.position.y = 2.15;
    this.group.add(label);
  }

  setAnimation(anim: typeof this.animState) {
    this.animState = anim;
  }

  update(delta: number) {
    this.animTime += delta;
    const t = this.animTime;
    const arm0 = this.parts["arm0"] as THREE.Mesh;
    const arm1 = this.parts["arm1"] as THREE.Mesh;
    const leg0 = this.parts["leg0"] as THREE.Mesh;
    const leg1 = this.parts["leg1"] as THREE.Mesh;

    switch (this.animState) {
      case "idle": {
        this.group.position.y = Math.sin(t * 1.5) * 0.01;
        if (arm0) arm0.rotation.z = Math.sin(t * 1.5) * 0.05 + 0.05;
        if (arm1) arm1.rotation.z = -Math.sin(t * 1.5) * 0.05 - 0.05;
        break;
      }
      case "walk": {
        const swing = Math.sin(t * 6) * 0.4;
        if (arm0) arm0.rotation.x = swing;
        if (arm1) arm1.rotation.x = -swing;
        if (leg0) leg0.rotation.x = -swing * 0.6;
        if (leg1) leg1.rotation.x = swing * 0.6;
        this.group.position.y = Math.abs(Math.sin(t * 6)) * 0.03;
        break;
      }
      case "dance": {
        this.group.rotation.y = Math.sin(t * 3) * 0.3;
        this.group.position.y = Math.abs(Math.sin(t * 4)) * 0.1;
        if (arm0) arm0.rotation.z = Math.sin(t * 4) * 0.8 + 0.3;
        if (arm1) arm1.rotation.z = -Math.sin(t * 4) * 0.8 - 0.3;
        break;
      }
      case "wave": {
        if (arm0) arm0.rotation.z = Math.sin(t * 8) * 0.5 + 1.2;
        break;
      }
      case "talk": {
        this.group.position.y = Math.sin(t * 2) * 0.008;
        break;
      }
      case "sit": {
        this.group.position.y = -0.3;
        if (leg0) leg0.rotation.x = -Math.PI / 2;
        if (leg1) leg1.rotation.x = -Math.PI / 2;
        break;
      }
    }
  }

  dispose() {
    this.group.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
  }
}
