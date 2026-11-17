import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Keeps a renderer crash from leaving a blank window: shows the error, offers a
 * reload and can clear the saved workspace when a malformed snapshot is the
 * cause. Launcher projects and language preferences are kept.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("AcidMade render error", error, info.componentStack);
  }

  private reload = (): void => {
    window.location.reload();
  };

  private resetWorkspace = (): void => {
    try {
      window.localStorage.removeItem("acidmade.workspace.v1");
    } catch {
      /* ignore blocked storage */
    }
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className="grid h-screen w-screen place-items-center bg-shell p-6 text-zinc-300">
        <div className="w-[460px] max-w-full border border-line bg-panel p-4 shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
          <div className="flex items-start gap-2.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center border border-danger/30 bg-danger/[0.08]">
              <AlertTriangle size={14} className="text-danger" />
            </span>
            <div className="min-w-0">
              <h1 className="text-[12px] font-semibold text-zinc-100">
                The editor hit an unexpected error
              </h1>
              <p className="mt-1 text-[10.5px] leading-relaxed text-zinc-500">
                Your projects are safe. Reload the window, or reset the saved workspace if the
                error comes back.
              </p>
            </div>
          </div>

          <pre className="scroll-thin mt-3 max-h-36 overflow-auto border border-line-soft bg-void p-2 font-mono text-[9px] leading-relaxed text-zinc-500">
            {this.state.error.message || String(this.state.error)}
          </pre>

          <div className="mt-3 flex items-center gap-1.5">
            <button
              type="button"
              onClick={this.reload}
              className="flex h-[27px] flex-1 items-center justify-center border border-acid/40 bg-acid/[0.1] text-[10px] font-medium text-acid transition-colors hover:bg-acid/[0.16]"
            >
              Reload window
            </button>
            <button
              type="button"
              onClick={this.resetWorkspace}
              className="flex h-[27px] flex-1 items-center justify-center gap-1 border border-line text-[10px] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
            >
              <RotateCcw size={10} />
              Reset workspace
            </button>
          </div>
        </div>
      </div>
    );
  }
}
