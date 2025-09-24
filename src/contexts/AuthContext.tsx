import React, { useEffect, useState } from 'react';
import {
  type User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  GoogleAuthProvider
} from 'firebase/auth';
import { auth } from '../firebase';
import { AuthContext, type AuthContextType } from '../types/auth';
import { logger } from '../services/logger';
import { useErrorHandler } from '../hooks/useErrorHandler';

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { handleAuthError } = useErrorHandler();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          logger.info('Authentication state changed', {
            component: 'auth',
            action: 'state_change',
            userId: user.uid
          });

          const tokenResult = await user.getIdTokenResult();
          const hasAccess = tokenResult.claims.admin === true;

          if (!hasAccess) {
            logger.warn('Access denied - no admin claim', {
              component: 'auth',
              action: 'access_denied',
              userId: user.uid,
              email: user.email
            });

            await signOut(auth);
            setError('このアカウントはシステムへのアクセスが許可されていません。管理者にお問い合わせください。');
            setUser(null);
            setLoading(false);
            return;
          }

          logger.info('Authentication successful', {
            component: 'auth',
            action: 'login_success',
            userId: user.uid
          });

          // Logger にユーザーIDを設定
          logger.setUserId(user.uid);
          setError(null);
        } catch (error) {
          const errorMessage = handleAuthError(error, {
            component: 'auth',
            action: 'token_verification'
          });
          setError(errorMessage);
          setUser(null);
          setLoading(false);
          return;
        }
      } else {
        logger.info('User signed out', {
          component: 'auth',
          action: 'logout'
        });
        logger.setUserId(null);
      }

      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [handleAuthError]);

  const signInWithGoogle = async () => {
    try {
      setError(null);
      logger.info('Google sign-in initiated', {
        component: 'auth',
        action: 'signin_start'
      });

      const provider = new GoogleAuthProvider();

      // カスタムパラメータでアカウント選択を強制
      provider.setCustomParameters({
        prompt: 'select_account'
      });

      await signInWithPopup(auth, provider);

      logger.userAction('google_signin_completed', {
        component: 'auth'
      });

    } catch (error: unknown) {
      const errorMessage = handleAuthError(error, {
        component: 'auth',
        action: 'signin_error'
      });
      setError(errorMessage);
    }
  };

  const clearError = () => {
    setError(null);
  };

  const logout = async () => {
    logger.userAction('logout_initiated', {
      component: 'auth'
    });
    await signOut(auth);
  };

  const value: AuthContextType = {
    user,
    loading,
    error,
    signInWithGoogle,
    logout,
    clearError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};