import * as THREE from "three";

export class RoomEnvironment {
  scene: THREE.Scene;
  floorSize = 40;
  wallHeight = 8;
  colliders: THREE.Box3[] = [];
  private neonLights: THREE.PointLight[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.build();
  }

  private build() {
    this.buildLighting();
    this.buildRoom();
    this.buildFurniture();
    this.buildDecorations();
    this.buildDanceFloor();
  }

  // ─── Lighting ──────────────────────────────────────────────────────────────
  private buildLighting() {
    const ambient = new THREE.AmbientLight(0x1a1a2e, 0.6);
    this.scene.add(ambient);

    // Main overhead light
    const overhead = new THREE.DirectionalLight(0xffffff, 0.8);
    overhead.position.set(0, 20, 0);
    overhead.castShadow = true;
    overhead.shadow.mapSize.set(2048, 2048);
    this.scene.add(overhead);

    // Neon accent lights
    const neonColors = [0xff0080, 0x00ffff, 0x8000ff, 0xff4400, 0x00ff88];
    const neonPositions = [
      [-15, 4, -15], [15, 4, -15], [-15, 4, 15], [15, 4, 15], [0, 6, 0]
    ];
    neonColors.forEach((color, i) => {
      const light = new THREE.PointLight(color, 2, 20);
      light.position.set(...(neonPositions[i] as [number, number, number]));
      this.scene.add(light);
      this.neonLights.push(light);
    });

    // DJ booth spotlight
    const spot = new THREE.SpotLight(0xffffff, 3, 30, Math.PI / 6, 0.3);
    spot.position.set(0, 10, -18);
    spot.target.position.set(0, 0, -15);
    this.scene.add(spot);
    this.scene.add(spot.target);
  }

  // ─── Room shell ────────────────────────────────────────────────────────────
  private buildRoom() {
    const s = this.floorSize;
    const h = this.wallHeight;

    // Floor — dark tiles
    const floorGeo = new THREE.PlaneGeometry(s, s, 20, 20);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x111118,
      roughness: 0.3,
      metalness: 0.6,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.name = "floor";
    this.scene.add(floor);

    // Ceiling
    const ceilGeo = new THREE.PlaneGeometry(s, s);
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0x0a0a12 });
    const ceil = new THREE.Mesh(ceilGeo, ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = h;
    this.scene.add(ceil);

    // Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0d0d1a, roughness: 0.8 });
    const wallConfigs: [number, number, number, number, number][] = [
      [s, h, 0, h / 2, -s / 2],   // back
      [s, h, 0, h / 2, s / 2],    // front
      [s, h, Math.PI / 2, h / 2, -s / 2], // left
      [s, h, Math.PI / 2, h / 2, s / 2],  // right
    ];
    wallConfigs.forEach(([w, ht, ry, py, pz], i) => {
      const geo = new THREE.PlaneGeometry(w, ht);
      const mesh = new THREE.Mesh(geo, wallMat);
      if (i < 2) {
        mesh.position.set(0, py, pz);
        if (i === 0) mesh.rotation.y = Math.PI;
      } else {
        mesh.position.set(pz, py, 0);
        mesh.rotation.y = i === 2 ? Math.PI / 2 : -Math.PI / 2;
      }
      this.scene.add(mesh);
    });

    // Neon border strips on walls
    this.addNeonStrip(-s / 2 + 0.05, 0.5, 0, s, 0, 0xff0080);
    this.addNeonStrip(s / 2 - 0.05, 0.5, 0, s, 0, 0x00ffff);
    this.addNeonStrip(0, 0.5, -s / 2 + 0.05, s, Math.PI / 2, 0x8000ff);
    this.addNeonStrip(0, 0.5, s / 2 - 0.05, s, Math.PI / 2, 0xff4400);
  }

  private addNeonStrip(x: number, y: number, z: number, length: number, ry: number, color: number) {
    const geo = new THREE.BoxGeometry(length, 0.08, 0.08);
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 3,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    this.scene.add(mesh);
  }

  // ─── Dance floor ───────────────────────────────────────────────────────────
  private buildDanceFloor() {
    const size = 12;
    const tiles = 8;
    const tileSize = size / tiles;
    const colors = [0x1a0033, 0x00001a, 0x001a1a, 0x1a0010];
    for (let i = 0; i < tiles; i++) {
      for (let j = 0; j < tiles; j++) {
        const geo = new THREE.BoxGeometry(tileSize - 0.05, 0.05, tileSize - 0.05);
        const color = colors[(i + j) % colors.length];
        const mat = new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.5,
          roughness: 0.1,
          metalness: 0.9,
        });
        const tile = new THREE.Mesh(geo, mat);
        tile.position.set(
          -size / 2 + tileSize * i + tileSize / 2,
          0.025,
          -size / 2 + tileSize * j + tileSize / 2
        );
        this.scene.add(tile);
      }
    }
  }

  // ─── Furniture ─────────────────────────────────────────────────────────────
  private buildFurniture() {
    // DJ Booth
    this.addDJBooth(0, 0, -17);

    // Bar counter (back right)
    this.addBar(14, 0, -10);

    // Sofas around the edges
    this.addSofa(-14, 0, 5, 0);
    this.addSofa(-14, 0, -5, 0);
    this.addSofa(14, 0, 5, Math.PI);
    this.addSofa(14, 0, -5, Math.PI);
    this.addSofa(-5, 0, -17, Math.PI / 2);
    this.addSofa(5, 0, -17, -Math.PI / 2);

    // Round tables
    this.addTable(-10, 0, 8);
    this.addTable(10, 0, 8);
    this.addTable(-10, 0, -8);
    this.addTable(10, 0, -8);

    // Arcade machines
    this.addArcade(-17, 0, 8);
    this.addArcade(-17, 0, 12);
    this.addArcade(-17, 0, 16);
  }

  private addDJBooth(x: number, y: number, z: number) {
    const group = new THREE.Group();

    // Main desk
    const deskGeo = new THREE.BoxGeometry(6, 1.2, 2);
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x1a0033, roughness: 0.3, metalness: 0.8 });
    const desk = new THREE.Mesh(deskGeo, deskMat);
    desk.position.y = 0.6;
    group.add(desk);

    // Turntable
    const ttGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.05, 32);
    const ttMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });
    [-1.2, 1.2].forEach(tx => {
      const tt = new THREE.Mesh(ttGeo, ttMat);
      tt.position.set(tx, 1.25, 0);
      group.add(tt);
    });

    // Mixer
    const mixGeo = new THREE.BoxGeometry(1.2, 0.15, 1.2);
    const mixMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.9 });
    const mixer = new THREE.Mesh(mixGeo, mixMat);
    mixer.position.set(0, 1.28, 0);
    group.add(mixer);

    // Neon front panel
    const panelGeo = new THREE.BoxGeometry(6, 0.8, 0.05);
    const panelMat = new THREE.MeshStandardMaterial({ color: 0xff0080, emissive: 0xff0080, emissiveIntensity: 2 });
    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.position.set(0, 0.4, 1.05);
    group.add(panel);

    group.position.set(x, y, z);
    this.scene.add(group);
    this.addCollider(group, new THREE.Vector3(6, 1.5, 2));
  }

  private addBar(x: number, y: number, z: number) {
    const group = new THREE.Group();

    const counterGeo = new THREE.BoxGeometry(8, 1.1, 1.5);
    const counterMat = new THREE.MeshStandardMaterial({ color: 0x2a1500, roughness: 0.6, metalness: 0.3 });
    const counter = new THREE.Mesh(counterGeo, counterMat);
    counter.position.y = 0.55;
    group.add(counter);

    // Top surface
    const topGeo = new THREE.BoxGeometry(8.1, 0.08, 1.6);
    const topMat = new THREE.MeshStandardMaterial({ color: 0x4a2800, roughness: 0.2, metalness: 0.5 });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = 1.14;
    group.add(top);

    // Bottles (decorative)
    for (let i = 0; i < 6; i++) {
      const bottleGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.5, 8);
      const bottleMat = new THREE.MeshStandardMaterial({
        color: [0x00aa44, 0xaa4400, 0x0044aa, 0xaa0044][i % 4],
        roughness: 0.1,
        metalness: 0.1,
        transparent: true,
        opacity: 0.7,
      });
      const bottle = new THREE.Mesh(bottleGeo, bottleMat);
      bottle.position.set(-3 + i * 1.2, 1.5, -0.5);
      group.add(bottle);
    }

    group.position.set(x, y, z);
    group.rotation.y = Math.PI / 2;
    this.scene.add(group);
    this.addCollider(group, new THREE.Vector3(1.5, 1.2, 8));
  }

  private addSofa(x: number, y: number, z: number, ry: number) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x1a0a2e, roughness: 0.8 });

    // Seat
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.4, 1), mat);
    seat.position.y = 0.4;
    group.add(seat);

    // Back
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.8, 0.2), mat);
    back.position.set(0, 0.9, -0.4);
    group.add(back);

    // Arms
    [-1.15, 1.15].forEach(ax => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 1), mat);
      arm.position.set(ax, 0.5, 0);
      group.add(arm);
    });

    group.position.set(x, y, z);
    group.rotation.y = ry;
    this.scene.add(group);
    this.addCollider(group, new THREE.Vector3(2.5, 1.2, 1));
  }

  private addTable(x: number, y: number, z: number) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.4, metalness: 0.6 });

    // Top
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.08, 32), mat);
    top.position.y = 0.8;
    group.add(top);

    // Leg
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8), mat);
    leg.position.y = 0.4;
    group.add(leg);

    // Glasses on table
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.5, roughness: 0.1 });
    for (let i = 0; i < 3; i++) {
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.2, 8), glassMat);
      const angle = (i / 3) * Math.PI * 2;
      glass.position.set(Math.cos(angle) * 0.4, 0.94, Math.sin(angle) * 0.4);
      group.add(glass);
    }

    group.position.set(x, y, z);
    this.scene.add(group);
  }

  private addArcade(x: number, y: number, z: number) {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0a0a1a, roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.6), bodyMat);
    body.position.y = 0.9;
    group.add(body);

    // Screen
    const screenMat = new THREE.MeshStandardMaterial({ color: 0x0000ff, emissive: 0x0000aa, emissiveIntensity: 1 });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.4), screenMat);
    screen.position.set(0, 1.3, 0.31);
    group.add(screen);

    // Buttons
    const btnMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0x880000, emissiveIntensity: 1 });
    [[-0.15, 0], [0, -0.1], [0.15, 0]].forEach(([bx, bz]) => {
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 8), btnMat);
      btn.rotation.x = Math.PI / 2;
      btn.position.set(bx, 0.9, 0.31);
      group.add(btn);
    });

    group.position.set(x, y, z);
    group.rotation.y = Math.PI / 2;
    this.scene.add(group);
    this.addCollider(group, new THREE.Vector3(0.8, 1.8, 0.6));
  }

  // ─── Decorations ───────────────────────────────────────────────────────────
  private buildDecorations() {
    // Hanging lights
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const r = 14;
      this.addHangingLight(Math.cos(angle) * r, Math.sin(angle) * r);
    }

    // Plants
    this.addPlant(-18, 0, -18);
    this.addPlant(18, 0, -18);
    this.addPlant(-18, 0, 18);
    this.addPlant(18, 0, 18);

    // Mirror ball
    this.addMirrorBall(0, 7, 0);

    // Neon signs
    this.addNeonSign("WRECK ROOM", 0, 5, -19.5, 0);
    this.addNeonSign("VIBE", -19.5, 4, 0, Math.PI / 2);
  }

  private addHangingLight(x: number, z: number) {
    const group = new THREE.Group();
    const cordGeo = new THREE.CylinderGeometry(0.01, 0.01, 2, 4);
    const cordMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const cord = new THREE.Mesh(cordGeo, cordMat);
    cord.position.y = -1;
    group.add(cord);

    const bulbGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffeecc, emissive: 0xffeecc, emissiveIntensity: 2 });
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.y = -2.15;
    group.add(bulb);

    group.position.set(x, this.wallHeight, z);
    this.scene.add(group);
  }

  private addPlant(x: number, y: number, z: number) {
    const group = new THREE.Group();
    const potMat = new THREE.MeshStandardMaterial({ color: 0x3a2010, roughness: 0.8 });
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.5, 8), potMat);
    pot.position.y = 0.25;
    group.add(pot);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x1a4a1a, roughness: 0.9 });
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 6), leafMat);
      const angle = (i / 5) * Math.PI * 2;
      leaf.position.set(Math.cos(angle) * 0.2, 0.8 + Math.random() * 0.3, Math.sin(angle) * 0.2);
      leaf.scale.set(1, 1.5, 1);
      group.add(leaf);
    }
    group.position.set(x, y, z);
    this.scene.add(group);
  }

  private addMirrorBall(x: number, y: number, z: number) {
    const geo = new THREE.SphereGeometry(0.6, 16, 16);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0,
      metalness: 1,
      envMapIntensity: 2,
    });
    const ball = new THREE.Mesh(geo, mat);
    ball.position.set(x, y, z);
    ball.name = "mirrorBall";
    this.scene.add(ball);
  }

  private addNeonSign(text: string, x: number, y: number, z: number, ry: number) {
    // Simplified neon sign as glowing box
    const geo = new THREE.BoxGeometry(text.length * 0.35, 0.5, 0.05);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xff0080,
      emissive: 0xff0080,
      emissiveIntensity: 3,
    });
    const sign = new THREE.Mesh(geo, mat);
    sign.position.set(x, y, z);
    sign.rotation.y = ry;
    this.scene.add(sign);
  }

  // ─── Theme ────────────────────────────────────────────────────────────────
  applyTheme(lightingColor: string, _ambiance: string) {
    const hex = parseInt(lightingColor.replace('#', ''), 16);
    this.neonLights.forEach((light, i) => {
      light.color.setHex(hex);
      // Slightly vary each light for visual depth
      light.intensity = 1.5 + (i % 3) * 0.5;
    });
    // Update neon signs
    this.scene.traverse(obj => {
      if (obj.name === 'mirrorBall') return;
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat && mat.emissiveIntensity > 1) {
          mat.emissive?.setHex(hex);
          mat.color?.setHex(hex);
        }
      }
    });
  }

  // ─── Collider helpers ─────────────────────────────────────────────────────
  private addCollider(group: THREE.Group, size: THREE.Vector3) {
    const box = new THREE.Box3();
    const center = new THREE.Vector3();
    group.getWorldPosition(center);
    box.setFromCenterAndSize(center, size);
    this.colliders.push(box);
  }

  // ─── Update (animations) ──────────────────────────────────────────────────
  update(delta: number) {
    const mirrorBall = this.scene.getObjectByName("mirrorBall");
    if (mirrorBall) mirrorBall.rotation.y += delta * 0.5;
  }
}
