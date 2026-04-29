"use client";

import { useEffect, useRef } from "react";
import type { AvatarState } from "@/wreck-room/lib/avatar/AvatarRenderer";

// @ts-expect-error JS module from avatar library (Three + v3 studio)
import { CartoonAvatarStudio } from "@/lib/avatar-library/src/core/v3/CartoonAvatarStudio.js";

interface Props {
  state: AvatarState;
  className?: string;
}

/** Maps Wreck Room UI attachment IDs to CartoonHair3D style keys */
function mapAvatarStateToStudioConfig(state: AvatarState) {
  const hairMap: Record<string, string> = {
    "hair-short-crop": "shortCrop",
    "hair-buzz": "buzzCut",
    "hair-curly": "curlyMedium",
    "hair-mohawk": "mohawk",
    "hair-slicked": "slickedBack",
    "hair-wavy": "longWavy",
    "hair-cornrows": "cornrows",
    "hair-ponytail": "highPonytail",
    "hair-bun": "bun",
    "hair-long-straight": "longWavy",
    "hair-afro": "afro",
    "hair-dreadlocks": "dreadlocks",
  };

  /** SHIRTS in CartoonClothing3D: jersey, tshirt, hoodie, cropTop, turtleneck */
  const shirtMap: Record<string, string> = {
    "shirt-tshirt": "tshirt",
    "shirt-polo": "tshirt",
    "shirt-hoodie": "hoodie",
    "shirt-crop": "cropTop",
    "shirt-jersey": "jersey",
    "shirt-flannel": "jersey",
  };

  /** JACKETS: bomber, denim only — map the rest to bomber */
  const jacketMap: Record<string, string> = {
    "jacket-bomber": "bomber",
    "jacket-denim": "denim",
    "jacket-leather": "bomber",
    "jacket-puffer": "bomber",
    "jacket-varsity": "bomber",
    "jacket-blazer": "denim",
  };

  /** FOOTWEAR: chunkyBoots, sneakers, heels */
  const shoeMap: Record<string, string> = {
    "sneaker-low-white": "sneakers",
    "sneaker-high-top": "chunkyBoots",
    "sneaker-runner": "sneakers",
    "boots-combat": "chunkyBoots",
    "boots-chelsea": "chunkyBoots",
    "shoe-oxford": "sneakers",
    "shoe-loafer": "heels",
  };

  const hairId = state.attachments?.hair;
  const hairStyle = hairId ? hairMap[hairId] ?? "shortCrop" : "shortCrop";

  const metres = (state.height ?? 1) * 1.75;

  return {
    skinTone: state.skinTone ?? "#F5CBA7",
    eyeColor: state.face?.eyeColor ?? "#3a2010",
    lipColor: state.face?.lipColor ?? "#c0392b",
    hairColor: "#2c1810",
    hairStyle,
    showHair: Boolean(hairId),
    bodyShape: state.bodyShape ?? "average",
    muscleTone: state.muscleTone ?? 0.5,
    height: metres,

    shirt: state.attachments?.shirt
      ? {
          style: shirtMap[state.attachments.shirt] ?? "tshirt",
          color: "#1a2a6c",
          accent: "#88ccff",
        }
      : null,

    jacket: state.attachments?.jacket
      ? {
          style: jacketMap[state.attachments.jacket] ?? "bomber",
          color: "#111827",
          accent: "#6b7280",
        }
      : null,

    bottom: {
      style: "shorts",
      color: "#111827",
      accent: "#60a5fa",
    },

    socks: {
      style: "kneeHigh",
      color: "#0f172a",
      accent: "#cbd5e1",
    },

    footwear: {
      style: shoeMap[state.attachments?.sneakers ?? ""] ?? "sneakers",
      color: "#111827",
      accent: "#60a5fa",
    },
  };
}

export default function AvatarStudioViewport({ state, className }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const studioRef = useRef<CartoonAvatarStudio | null>(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const studio = new CartoonAvatarStudio(el);
    studioRef.current = studio;

    studio.setAutoRotate(true);
    studio.setCameraView("full");

    return () => {
      try {
        studio.dispose?.();
      } catch {
        /* ignore */
      }
      studioRef.current = null;
      if (mountRef.current) {
        mountRef.current.innerHTML = "";
      }
    };
  }, []);

  useEffect(() => {
    const studio = studioRef.current;
    if (!studio) return;

    const config = mapAvatarStateToStudioConfig(state);

    studio.setSkinTone(config.skinTone);
    studio.setEyeColor(config.eyeColor);
    studio.setLipColor(config.lipColor);
    studio.setHairColor(config.hairColor);
    studio.setHairStyle(config.hairStyle);
    if (studio.hair?.group) {
      studio.hair.group.visible = config.showHair;
    }
    studio.setBodyShape(config.bodyShape);
    studio.setMuscleTone(config.muscleTone);
    studio.setHeight(config.height);

    studio.setShirt(config.shirt);
    studio.setJacket(config.jacket);
    studio.setBottom(config.bottom);
    studio.setSocks(config.socks);
    studio.setFootwear(config.footwear);

    studio.refresh?.();
  }, [state]);

  return (
    <div
      ref={mountRef}
      className={
        className ??
        "w-full h-full min-h-[320px] rounded-xl overflow-hidden border border-gray-700/50 bg-[#070b1a]"
      }
    />
  );
}
