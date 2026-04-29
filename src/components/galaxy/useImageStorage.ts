"use client";

import { useCallback } from "react";

const DB_NAME = "TrustCertificateDB";
const STORE_NAME = "images";
const DB_VERSION = 1;

interface StoredImage {
  key: string;
  blob: Blob;
  mimeType: string;
  uploadedAt: string;
}

function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
  });
}

async function storeImageInDB(key: string, blob: Blob): Promise<void> {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const data: StoredImage = {
      key,
      blob,
      mimeType: blob.type,
      uploadedAt: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.warn("IndexedDB storage failed, falling back to sessionStorage:", error);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      try {
        sessionStorage.setItem(key, base64);
      } catch (e) {
        console.error("sessionStorage also failed:", e);
      }
    };
    reader.readAsDataURL(blob);
  }
}

async function loadImageFromDB(key: string): Promise<Blob | null> {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const data = request.result as StoredImage | undefined;
        resolve(data?.blob ?? null);
      };
    });
  } catch (error) {
    console.warn("IndexedDB load failed, trying sessionStorage:", error);
    const base64 = sessionStorage.getItem(key);
    if (base64) {
      try {
        const response = await fetch(base64);
        return response.blob();
      } catch (e) {
        console.error("sessionStorage fallback failed:", e);
        return null;
      }
    }
    return null;
  }
}

async function removeImageFromDB(key: string): Promise<void> {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.warn("IndexedDB delete failed, trying sessionStorage:", error);
    sessionStorage.removeItem(key);
  }
}

export function useImageStorage() {
  const storeSeal = useCallback((blob: Blob) => storeImageInDB("trust-seal", blob), []);
  const loadSeal = useCallback(() => loadImageFromDB("trust-seal"), []);
  const removeSeal = useCallback(() => removeImageFromDB("trust-seal"), []);

  const storeWatermark = useCallback((blob: Blob) => storeImageInDB("trust-watermark", blob), []);
  const loadWatermark = useCallback(() => loadImageFromDB("trust-watermark"), []);
  const removeWatermark = useCallback(() => removeImageFromDB("trust-watermark"), []);

  return {
    storeSeal,
    loadSeal,
    removeSeal,
    storeWatermark,
    loadWatermark,
    removeWatermark,
  };
}









