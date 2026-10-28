import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  scoped?: boolean;
  sectionTitle?: string;
  onResetState?: () => void;
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
    console.error(`Uncaught error in ${this.props.sectionTitle || 'UI'}:`, error, errorInfo);
    this.setState({ errorInfo });
  }

  public componentDidMount() {
    window.addEventListener('webglcontextlost', this.handleContextLost as EventListener);
  }

  public componentWillUnmount() {
    window.removeEventListener('webglcontextlost', this.handleContextLost as EventListener);
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    console.warn('WebGL/WebGPU graphics context lost');
    this.setState({
      hasError: true,
      error: new Error('Graphics Context (WebGL/WebGPU) was lost due to GPU reset or hardware memory pressure.'),
    });
  };

  public handleReload = () => {
    window.location.reload();
  };

  public handleDismiss = () => {
    if (this.props.onResetState) {
      try {
        this.props.onResetState();
      } catch (err) {
        console.warn('onResetState callback error:', err);
      }
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.scoped) {
        return (
          <div className="flex flex-col items-center justify-center w-full h-full min-h-[140px] bg-[#0E1015]/95 border border-[#EF4444]/30 rounded-lg p-4 select-none text-center">
            <div className="w-9 h-9 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-2">
              <AlertCircle size={18} />
            </div>
            <h3 className="text-xs font-bold text-[#F0F3F8]">
              {this.props.sectionTitle || 'View'} Rendering Interrupted
            </h3>
            <p className="text-[11px] text-[#8A92A6] max-w-sm mt-0.5 line-clamp-2">
              {this.state.error?.message || 'An unexpected graphics or state exception occurred.'}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={this.handleDismiss}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#00F0FF] hover:bg-[#3bf1ff] text-[#0D0E11] text-[11px] font-bold transition-all shadow-[0_0_10px_rgba(0,240,255,0.3)] cursor-pointer"
              >
                <RotateCcw size={12} />
                <span>Restore {this.props.sectionTitle || 'View'}</span>
              </button>
              <button
                onClick={this.handleReload}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#1C202B] hover:bg-[#252B3A] text-[#8A92A6] hover:text-[#F0F3F8] text-[11px] font-medium transition-colors cursor-pointer border border-[#2B3245]"
              >
                <RefreshCw size={12} />
                <span>Reload App</span>
              </button>
            </div>
          </div>
        );
      }

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
