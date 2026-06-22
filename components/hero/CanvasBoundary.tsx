"use client";

import React from "react";

/** Keeps a WebGL/postprocessing failure from taking down the whole page —
 *  the hero falls back to the gradient + text, and the tool below still works. */
export class CanvasBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error("Hero canvas failed:", err);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
