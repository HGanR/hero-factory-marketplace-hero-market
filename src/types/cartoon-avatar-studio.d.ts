declare module "@/lib/avatar-library/src/core/v3/CartoonAvatarStudio.js" {
  export class CartoonAvatarStudio {
    constructor(el: HTMLElement);
    hair?: { group?: { visible: boolean } };
    setAutoRotate(v: boolean): void;
    setCameraView(v: string): void;
    setSkinTone(v: unknown): void;
    setEyeColor(v: unknown): void;
    setLipColor(v: unknown): void;
    setHairColor(v: unknown): void;
    setHairStyle(v: unknown): void;
    setBodyShape(v: unknown): void;
    setMuscleTone(v: unknown): void;
    setHeight(v: unknown): void;
    setShirt(v: unknown): void;
    setJacket(v: unknown): void;
    setBottom(v: unknown): void;
    setSocks(v: unknown): void;
    setFootwear(v: unknown): void;
    refresh?(): void;
    dispose?(): void;
  }
}
