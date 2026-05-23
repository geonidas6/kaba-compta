"use client";

import dynamic from "next/dynamic";

const AppRoot = dynamic(() => import("@/components/AppRoot"), {
  ssr: false,
});

export default function CatchAll() {
  return <AppRoot />;
}
