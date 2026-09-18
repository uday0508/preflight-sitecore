import { Component, type ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message };
  }

  componentDidCatch(err: Error) {
    console.error("[Preflight] Boundary caught:", err);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert variant="destructive">
          <AlertDescription className="space-y-2">
            <p>Preflight crashed: {this.state.message}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => this.setState({ hasError: false, message: "" })}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      );
    }
    return this.props.children;
  }
}