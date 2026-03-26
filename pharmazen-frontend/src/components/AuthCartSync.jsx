import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export default function AuthCartSync() {
  const { onLogin, onLogout: authOnLogout } = useAuth();
  const { onLoginSuccess, onLogout: cartOnLogout } = useCart();

  useEffect(() => {
    const unsubLogin = onLogin(onLoginSuccess);
    const unsubLogout = authOnLogout(cartOnLogout);
    return () => {
      unsubLogin();
      unsubLogout();
    };
  }, [onLogin, authOnLogout, onLoginSuccess, cartOnLogout]);

  return null;
}
