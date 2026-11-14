'use client';
import dynamic from 'next/dynamic';
const Preview=dynamic(()=>import('@/components/green-terrain/JarvonPreview'),{ssr:false});
export default function Page(){return <Preview/>}
