"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-xl px-5 py-20 text-center">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-recent">
            Something went wrong
          </p>
          <p className="mt-4 text-sm text-muted-light">{this.state.error.message}</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-6 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-ink transition hover:bg-[#b5f34a]"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
