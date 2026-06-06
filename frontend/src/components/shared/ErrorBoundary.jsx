/* This class catches rendering errors so the SPA fails gracefully. */
import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="grid min-h-screen place-items-center bg-slate-950 px-6 text-slate-100">
          <div className="max-w-lg rounded-3xl border border-slate-800 bg-slate-900/80 p-8 text-center">
            <h1 className="text-2xl font-semibold">Something went wrong</h1>
            <p className="mt-3 text-sm text-slate-400">
              The page hit an unexpected error. Refresh the app or sign in again.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
