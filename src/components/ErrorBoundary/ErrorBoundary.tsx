import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in UI:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public handleReload = () => {
    window.location.reload();
  };

  public handleDismiss = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#0D0E11] text-[#F0F3F8] p-6 select-none">
          <div className="max-w-lg w-full bg-[#14161B] border border-[#EF4444]/40 rounded-xl p-6 shadow-2xl flex flex-col gap-4 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <AlertCircle size={24} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#F0F3F8]">Something went wrong</h2>
              <p className="text-xs text-[#8A92A6] mt-1">
                The editor encountered an unexpected error while rendering.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-[#0C0E12] border border-[#222630] rounded-lg text-left text-xs font-mono text-red-400 overflow-x-auto max-h-40">
                <span className="font-bold">{this.state.error.name}: </span>
                {this.state.error.message}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 mt-2">
              <button
                onClick={this.handleDismiss}
                className="px-4 py-2 rounded-lg bg-[#1F2430] hover:bg-[#282F3F] border border-[#2B3245] text-xs font-semibold text-[#F0F3F8] transition-colors cursor-pointer"
              >
                Dismiss & Continue
              </button>
              <button
                onClick={this.handleReload}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#00F0FF] hover:bg-[#3bf1ff] text-[#0D0E11] text-xs font-bold transition-all shadow-[0_0_12px_rgba(0,240,255,0.3)] cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>Reload Application</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
