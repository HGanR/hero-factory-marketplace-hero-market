"use client";
import dynamic from "next/dynamic";
const GreenTerrainExperience=dynamic(()=>import("@/components/green-terrain/GreenTerrainExperience"),{ssr:false,loading:()=> <main>Loading Troo Town…</main>});
/** Same renderer and saved green-terrain snapshot as the editor. No localStorage fallback. */
export default function TrooTownPage(){return <GreenTerrainExperience readOnly/>}
