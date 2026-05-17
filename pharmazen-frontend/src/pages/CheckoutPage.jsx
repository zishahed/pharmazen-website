import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import Header from '../components/common/Header';
import Footer from '../components/common/Footer';
import styles from './CheckoutPage.module.css';

const API_BASE = 'http://localhost:5000/api';

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { cartItems, getCartTotal, getCartCount, clearCart } = useCart();
  const { isAuthenticated } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [prescriptionWarning, setPrescriptionWarning] = useState(false);
  const cartTotal = getCartTotal();
  const cartCount = getCartCount();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/checkout' } });
      return;
    }
    if (cartItems.length === 0) {
      navigate('/cart');
    }
  }, [isAuthenticated, cartItems, navigate]);

  const getPriceUnit = (dosageForm) => {
    if (!dosageForm) return 'per unit';
    const form = dosageForm.toLowerCase();
    const unitMap = {
      tablet: 'per tablet', capsule: 'per capsule', syrup: 'per bottle',
      injection: 'per syringe', cream: 'per tube', ointment: 'per tube',
      drops: 'per bottle', suspension: 'per bottle', inhaler: 'per inhaler',
      spray: 'per spray', gel: 'per tube', lotion: 'per bottle',
      powder: 'per sachet',
    };
    for (const [key, value] of Object.entries(unitMap)) {
      if (form.includes(key)) return value;
    }
    return 'per unit';
  };

  const handlePayment = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        credentials: 'include'
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to create order');
      }

      const order = result.data;

      if (order.prescriptionRequired) {
        setPrescriptionWarning(true);
        setIsProcessing(false);
        return;
      }

      const paymentResponse = await fetch(`${API_BASE}/payments/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderId: order.id, amount: order.totalAmount })
      });
      const paymentResult = await paymentResponse.json();

      if (!paymentResult.success) {
        throw new Error(paymentResult.message || 'Failed to create payment');
      }

      const { paymentId, isMock } = paymentResult.data;

      const executeResponse = await fetch(`${API_BASE}/payments/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ paymentId })
      });
      const executeResult = await executeResponse.json();

      if (executeResult.success && executeResult.data?.success) {
        clearCart();
        navigate('/payment/success', {
          state: {
            orderId: order.id,
            transactionId: executeResult.data.transactionId,
          },
        });
      } else {
        throw new Error(executeResult.data?.status || 'Payment execution failed');
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message || 'Failed to process payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCardPayment = () => {
    alert('Card payment is not available yet. Please use bKash.');
  };

  const handleCodPayment = () => {
    alert('Cash on Delivery is not available yet. Please use bKash.');
  };

  if (cartItems.length === 0) {
    return null;
  }

  return (
    <div className={styles.checkoutPage}>
      <Header />
      <div className={styles.checkoutContainer}>
        <div className={styles.checkoutHeader}>
          <button onClick={() => navigate('/cart')} className={styles.backBtn}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Cart
          </button>
          <h1 className={styles.checkoutTitle}>Checkout</h1>
        </div>

        <div className={styles.checkoutContent}>
          <div className={styles.orderItemsSection}>
            <h2 className={styles.sectionTitle}>Order Summary</h2>
            <div className={styles.itemsList}>
              {cartItems.map((item) => (
                <div key={item.id} className={styles.orderItem}>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{item.name}</span>
                    <span className={styles.itemQuantity}>x{item.quantity}</span>
                    {item.requiresPrescription && (
                      <span className={styles.prescriptionBadge}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Rx Required
                      </span>
                    )}
                  </div>
                  <span className={styles.itemPrice}>৳{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.paymentSection}>
            <h2 className={styles.sectionTitle}>Payment Method</h2>
            
            {prescriptionWarning && (
              <div className={styles.warningMessage}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <strong>Prescription Required</strong>
                  <p>Some items in your cart require a valid, approved prescription. Please upload a prescription first.</p>
                </div>
              </div>
            )}

            {error && (
              <div className={styles.errorMessage}>{error}</div>
            )}

            <div className={styles.paymentMethods}>
              <button
                className={`${styles.paymentMethod} ${styles.bkashMethod}`}
                onClick={handlePayment}
                disabled={isProcessing}
              >
                <div className={styles.methodIcon}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm4 0h-2v-6h2v6zm0-8H9V7h6v2z"/>
                  </svg>
                </div>
                <div className={styles.methodDetails}>
                  <span className={styles.methodName}>bKash</span>
                  <span className={styles.methodStatus}>Active</span>
                </div>
                {isProcessing && !prescriptionWarning ? (
                  <span className={styles.processingSpinner}></span>
                ) : (
                  <svg className={styles.arrowIcon} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </button>

              <button
                className={`${styles.paymentMethod} ${styles.disabledMethod}`}
                onClick={handleCardPayment}
                disabled
              >
                <div className={styles.methodIcon}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
                  </svg>
                </div>
                <div className={styles.methodDetails}>
                  <span className={styles.methodName}>Credit/Debit Card</span>
                  <span className={styles.methodStatus}>Coming Soon</span>
                </div>
                <svg className={styles.lockIcon} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </button>

              <button
                className={`${styles.paymentMethod} ${styles.disabledMethod}`}
                onClick={handleCodPayment}
                disabled
              >
                <div className={styles.methodIcon}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm6 16H6V8h2v2c0 .55.45 1 1 1s1-.45 1-1V8h4v2c0 .55.45 1 1 1s1-.45 1-1V8h2v12z"/>
                  </svg>
                </div>
                <div className={styles.methodDetails}>
                  <span className={styles.methodName}>Cash on Delivery</span>
                  <span className={styles.methodStatus}>Coming Soon</span>
                </div>
                <svg className={styles.lockIcon} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </button>
            </div>

            <div className={styles.totalSection}>
              <div className={styles.totalRow}>
                <span>Subtotal ({cartCount} items)</span>
                <span>৳{cartTotal.toFixed(2)}</span>
              </div>
              <div className={styles.totalRow}>
                <span>Delivery</span>
                <span className={styles.freeDelivery}>Free</span>
              </div>
              <div className={styles.totalDivider}></div>
              <div className={styles.totalRowFinal}>
                <span>Total</span>
                <span>৳{cartTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default CheckoutPage;
