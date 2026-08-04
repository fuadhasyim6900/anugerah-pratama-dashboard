import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Tanpa Error Boundary ini, error apapun yang terjadi saat render (bug di
// komponen, data tak terduga dari Supabase, dll) akan membuat React
// meng-unmount seluruh tree dan browser cuma menampilkan layar putih kosong
// — pesan errornya cuma muncul di console (F12), tidak terlihat di halaman.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Dashboard crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex items-center justify-center min-h-screen p-6 bg-white">
          <div className="max-w-lg w-full rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="font-bold text-red-700 mb-2">Terjadi kesalahan pada dashboard</p>
            <p className="text-sm text-red-600 mb-4 break-words">{this.state.error.message}</p>
            <p className="text-xs text-red-400 mb-4">
              Buka Console browser (tekan F12 → tab Console) untuk detail teknis lengkap.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
