import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

const LoginScreen = () => {
  const { signInWithGoogle, error: authError, clearError } = useAuth();
  const [localLoading, setLocalLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLocalLoading(true);
    clearError();
    try {
      await signInWithGoogle();
    } catch {
      // エラーはAuthContextで管理
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-5">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">CareEMR</h1>
          <p className="text-sm text-gray-600">介護施設電子カルテシステム</p>
        </div>

        <div className="bg-white p-8 rounded-lg shadow-lg">
          {authError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md mb-5 text-sm relative">
              {authError}
              <button
                onClick={clearError}
                className="absolute top-3 right-3 text-red-600 hover:text-red-800 font-bold text-lg leading-none"
              >
                ×
              </button>
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            disabled={localLoading}
            className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-5 rounded-md text-base transition-all duration-200 flex items-center justify-center gap-2 ${
              localLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            {localLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ログイン中...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Googleでログイン
              </>
            )}
          </button>

          <p className="text-center text-xs text-gray-500 mt-5">
            認証されたユーザーのみアクセス可能
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;