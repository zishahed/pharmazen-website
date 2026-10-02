import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const CartContext = createContext(null);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://pharmazen-backend.vercel.app/api';
const MAX_QUANTITY = 5;

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [pendingItem, setPendingItem] = useState(null);
  const initDone = useRef(false);

  const fetchCart = useCallback(async (forceLogout = false) => {
    try {
      const response = await fetch(`${API_BASE}/cart`, {
        credentials: 'include'
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setCartItems(result.data?.items || []);
          setIsLoggedIn(true);
          return;
        }
      }
      if (!forceLogout) {
        setCartItems([]);
        setIsLoggedIn(false);
      }
    } catch (error) {
      console.error('Failed to fetch cart:', error);
      setCartItems([]);
      setIsLoggedIn(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    
    const initCart = async () => {
      await fetchCart();
    };
    initCart();
  }, [fetchCart]);

  const syncLocalCartToBackend = async (localItems) => {
    try {
      await fetch(`${API_BASE}/cart`, {
        method: 'DELETE',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Failed to clear cart before sync:', error);
    }
    
    for (const item of localItems) {
      try {
        await fetch(`${API_BASE}/cart`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ medicineId: item.id, quantity: item.quantity })
        });
      } catch (error) {
        console.error('Failed to sync item:', error);
      }
    }
  };

  const addToCart = useCallback(async (item) => {
    const localItems = JSON.parse(localStorage.getItem('pharmazen_cart') || '[]');
    
    try {
      const response = await fetch(`${API_BASE}/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ medicineId: item.id, quantity: 1 })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setCartItems(result.data.items || []);
          setIsLoggedIn(true);
          localStorage.removeItem('pharmazen_cart');
          return;
        }
      }
      
      if (response.status === 401) {
        setIsLoggedIn(false);
      }
    } catch (error) {
      console.error('Failed to add to cart:', error);
    }
    
    setCartItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.id === item.id);
      let updated;
      if (existingIndex >= 0) {
        const currentQty = prev[existingIndex].quantity;
        if (currentQty >= MAX_QUANTITY) {
          return prev;
        }
        updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: currentQty + 1,
        };
      } else {
        updated = [...prev, { ...item, quantity: 1 }];
      }
      localStorage.setItem('pharmazen_cart', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeFromCart = useCallback(async (itemId) => {
    try {
      const response = await fetch(`${API_BASE}/cart/${itemId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setCartItems(result.data.items || []);
          return;
        }
      }
      
      if (response.status === 401) {
        setIsLoggedIn(false);
      }
    } catch (error) {
      console.error('Failed to remove from cart:', error);
    }
    
    setCartItems((prev) => {
      const updated = prev.filter((i) => i.id !== itemId);
      localStorage.setItem('pharmazen_cart', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const updateQuantity = useCallback(async (itemId, quantity) => {
    if (quantity < 1) {
      return removeFromCart(itemId);
    }
    if (quantity > MAX_QUANTITY) {
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/cart`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ medicineId: itemId, quantity })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setCartItems(result.data.items || []);
          return;
        }
      }
      
      if (response.status === 401) {
        setIsLoggedIn(false);
      }
    } catch (error) {
      console.error('Failed to update cart:', error);
    }
    
    setCartItems((prev) => {
      const updated = prev.map((i) => (i.id === itemId ? { ...i, quantity } : i));
      localStorage.setItem('pharmazen_cart', JSON.stringify(updated));
      return updated;
    });
  }, [removeFromCart]);

  const clearCart = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/cart`, {
        method: 'DELETE',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Failed to clear cart:', error);
    }
    setCartItems([]);
    setPendingItem(null);
    localStorage.removeItem('pharmazen_cart');
  }, []);

  const onLoginSuccess = useCallback(async () => {
    const localItems = JSON.parse(localStorage.getItem('pharmazen_cart') || '[]');
    
    if (pendingItem) {
      const itemToAdd = { ...pendingItem, id: pendingItem.id };
      localItems.push(itemToAdd);
      localStorage.setItem('pharmazen_cart', JSON.stringify(localItems));
    }
    
    if (localItems.length > 0) {
      await syncLocalCartToBackend(localItems);
      localStorage.removeItem('pharmazen_cart');
    }
    
    setPendingItem(null);
    await fetchCart();
  }, [fetchCart, pendingItem]);

  const onLogout = useCallback(async () => {
    const backendItems = [...cartItems];
    setCartItems([]);
    setPendingItem(null);
    setIsLoggedIn(false);
    localStorage.removeItem('pharmazen_cart');
  }, [cartItems]);

  const getCartTotal = useCallback(() => {
    return cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
  }, [cartItems]);

  const getCartCount = useCallback(() => {
    return cartItems.reduce((count, item) => count + item.quantity, 0);
  }, [cartItems]);

  const setPendingCartItem = useCallback((item) => {
    setPendingItem(item);
  }, []);

  const consumePendingItem = useCallback(() => {
    const item = pendingItem;
    setPendingItem(null);
    return item;
  }, [pendingItem]);

  const value = {
    cartItems,
    pendingItem,
    isLoading,
    isLoggedIn,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartTotal,
    getCartCount,
    setPendingCartItem,
    consumePendingItem,
    onLoginSuccess,
    onLogout
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
