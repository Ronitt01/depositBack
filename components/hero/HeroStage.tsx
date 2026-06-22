"use client";

/* Mounts the Molten Verdict hero client-only (it's WebGL — no SSR) and isolates
   any render failure behind an error boundary so a hero crash can never take the
   whole page down; visitors still see a calm headline + the tool below. */

import dynamic from "next/dynamic";
import React from "react";

const HeroMolten = dynamic(() => import("./HeroMolten"), { ssr: false });

class HeroErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error("Hero failed to render:", err);
  }
  render() {
    if (this.state.failed) {
      return (
        <section className="flex h-screen w-full flex-col items-center justify-center bg-paper px-6 text-center">
          <span className="mb-4 inline-block h-4 w-4 rotate-45 rounded-[3px] bg-gradient-to-br from-gold-bright to-gold" />
          <h1 className="font-display text-3xl text-ink sm:text-4xl">Get back every dollar.</h1>
          <p className="mt-2 text-sm text-muted">Scroll down to check your deposit.</p>
        </section>
      );
    }
    return this.props.children;
  }
}

export default function HeroStage() {
  return (
    <HeroErrorBoundary>
      <HeroMolten />
    </HeroErrorBoundary>
  );
}
