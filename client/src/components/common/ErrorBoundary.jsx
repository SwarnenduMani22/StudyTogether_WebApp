import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
    };
  }

  /* ================= DETECT ERROR ================= */

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  /* ================= LOG ERROR ================= */

  componentDidCatch(error, info) {
    console.error("React Error Boundary:", error);
    console.error("Component Stack:", info?.componentStack);
  }

  /* ================= ACTIONS ================= */

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    window.location.href = "/";
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  /* ================= RENDER ================= */

  render() {
    if (this.state.hasError) {
      /* Custom fallback */

      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-6">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg text-center max-w-md w-full">
            <h1 className="text-2xl font-bold mb-4 text-red-500">
              Something went wrong ⚠️
            </h1>

            <p className="text-gray-600 dark:text-gray-300 mb-6">
              The application encountered an unexpected error. Please try
              reloading the page.
            </p>

            {/* DEV ERROR MESSAGE */}

            {import.meta.env.DEV && this.state.error && (
              <pre className="text-xs text-left bg-gray-100 dark:bg-gray-900 p-3 rounded mb-4 overflow-auto">
                {this.state.error.toString()}
              </pre>
            )}

            <div className="flex justify-center gap-3">
              <button
                onClick={this.handleReload}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded"
              >
                Reload Page
              </button>

              <button
                onClick={this.handleHome}
                className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded"
              >
                Go Home
              </button>

              <button
                onClick={this.handleReset}
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
