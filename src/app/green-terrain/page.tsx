"use client";
import {AuthGate} from "@/components/AuthGate";
import GreenTerrainExperience from "@/components/green-terrain/GreenTerrainExperience";
export default function GreenTerrainPage(){return <AuthGate redirectTo="/green-terrain" showWalletAuth={false}><GreenTerrainExperience/></AuthGate>}
