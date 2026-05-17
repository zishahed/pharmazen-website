import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import Header from '../components/common/Header';
import Footer from '../components/common/Footer';
import styles from './CartPage.module.css';

const MAX_QUANTITY = 5;

const CartPage = () => {
  const navigate = useNavigate();
  const { cartItems, removeFromCart, updateQuantity, getCartTotal, getCartCount, isLoading } = useCart();
  const { isAuthenticated } = useAuth();
  const cartTotal = getCartTotal();
  const cartCount = getCartCount();

  if (isLoading) {
    return (
      <div className={styles.cartPage}>
        <Header />
        <div className={styles.cartContainer}>
          <div className={styles.loadingContainer}>
            <div className={styles.spinner}></div>
            <p>Loading cart...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const getPriceUnit = (dosageForm) => {
    if (!dosageForm) return 'per unit';
    const form = dosageForm.toLowerCase();
    const unitMap = {
      tablet: 'per tablet',
      capsule: 'per capsule',
      syrup: 'per bottle',
      injection: 'per syringe',
      cream: 'per tube',
      ointment: 'per tube',
      drops: 'per bottle',
      suspension: 'per bottle',
      inhaler: 'per inhaler',
      spray: 'per spray',
      gel: 'per tube',
      lotion: 'per bottle',
      powder: 'per sachet',
    };
    for (const [key, value] of Object.entries(unitMap)) {
      if (form.includes(key)) return value;
    }
    return 'per unit';
  };

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/cart' } });
      return;
    }
    navigate('/checkout');
  };

  if (cartItems.length === 0) {
    return (
      <div className={styles.cartPage}>
        <Header />
        <div className={styles.emptyCartContainer}>
          <div className={styles.emptyCartContent}>
            <div className={styles.emptyCartIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h2 className={styles.emptyCartTitle}>Your Cart is Empty</h2>
            <p className={styles.emptyCartText}>
              Looks like you haven't added any medicines to your cart yet.
            </p>
            <button onClick={() => navigate('/products')} className={styles.goShoppingBtn}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Go to Shopping
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className={styles.cartPage}>
      <Header />
      <div className={styles.cartContainer}>
        <div className={styles.cartHeader}>
          <h1 className={styles.cartTitle}>Shopping Cart</h1>
          <span className={styles.cartCount}>{cartCount} {cartCount === 1 ? 'item' : 'items'}</span>
        </div>

        <div className={styles.cartContent}>
          <div className={styles.cartItemsSection}>
            {cartItems.map((item) => (
              <div key={item.id} className={styles.cartItem}>
                <div className={styles.itemIcon}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                </div>
                <div className={styles.itemDetails}>
                  <h3 className={styles.itemName}>{item.name}</h3>
                  <p className={styles.itemGeneric}>{item.genericName}</p>
                  <p className={styles.itemPrice}>
                    ৳{item.price.toFixed(2)} <span className={styles.priceUnit}>{getPriceUnit(item.dosageForm)}</span>
                  </p>
                </div>
                <div className={styles.itemActions}>
                  <div className={styles.quantityControl}>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      className={styles.qtyBtn}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </button>
                    <span className={styles.quantity}>{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      disabled={item.quantity >= MAX_QUANTITY}
                      className={styles.qtyBtn}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                  <div className={styles.itemTotal}>
                    ৳{(item.price * item.quantity).toFixed(2)}
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className={styles.removeBtn}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.cartSummary}>
            <h2 className={styles.summaryTitle}>Order Summary</h2>
            <div className={styles.summaryRow}>
              <span>Subtotal ({cartCount} items)</span>
              <span>৳{cartTotal.toFixed(2)}</span>
            </div>
            <div className={styles.summaryRow}>
              <span>Delivery</span>
              <span className={styles.freeDelivery}>Free</span>
            </div>
            <div className={styles.summaryDivider}></div>
            <div className={styles.summaryRowTotal}>
              <span>Total</span>
              <span>৳{cartTotal.toFixed(2)}</span>
            </div>
            <button
              onClick={handleCheckout}
              className={styles.checkoutBtn}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '18px', height: '18px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Proceed to Checkout
            </button>
            <button onClick={() => navigate('/products')} className={styles.continueShoppingBtn}>
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default CartPage;
