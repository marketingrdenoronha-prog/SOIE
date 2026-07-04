"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Rendered when a child throws during render. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Catches render errors from children and shows a fallback instead of taking
 * down the whole client tree (which surfaced as Next.js's generic
 * "Application error: a client-side exception has occurred"). Used to sandbox
 * the AI-generated spec renderer, whose JSON shape isn't fully guaranteed.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted">
            Não foi possível exibir este conteúdo. Tente regenerar a entrega.
          </p>
        )
      );
    }
    return this.props.children;
  }
}
