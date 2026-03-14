import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#1C2127",
            padding: "2rem",
          }}
        >
          <div
            style={{
              maxWidth: "480px",
              width: "100%",
              textAlign: "center",
              color: "#F0EDE8",
            }}
          >
            <h1
              style={{
                fontSize: "20px",
                fontWeight: 700,
                marginBottom: "12px",
                color: "#D4A574",
              }}
            >
              Something went wrong
            </h1>
            <p
              style={{
                fontSize: "13px",
                color: "#A8B0B8",
                lineHeight: 1.6,
                marginBottom: "16px",
              }}
            >
              This saved Micro-Domain could not be loaded correctly. The data may
              be outdated or corrupted.
            </p>
            <p
              style={{
                fontSize: "11px",
                color: "#6B7580",
                marginBottom: "20px",
              }}
            >
              {this.state.error?.message || "Unknown error"}
            </p>
            <button
              onClick={() => {
                // Navigate to clean URL (no ?d= param)
                window.location.href = window.location.pathname;
              }}
              style={{
                padding: "8px 24px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#141820",
                backgroundColor: "#D4A574",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Start Fresh
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}