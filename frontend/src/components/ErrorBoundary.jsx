import { Component } from "react";

// Catches errors thrown while rendering any child component, so one bug
// shows a readable message instead of a blank white page.
// (Error boundaries must be class components; hooks can't do this yet.)
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Match Centre crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="card error-box" role="alert">
        <h3>Something went wrong</h3>
        <p className="hint">The Match Centre hit an error. Details below:</p>
        <pre>{String(this.state.error?.stack || this.state.error)}</pre>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Reload page
        </button>
      </div>
    );
  }
}
