import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/common/Header';
import Footer from '../components/common/Footer';
import styles from './PaymentStatusPage.module.css';

const PaymentStatusPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isSuccess = location.pathname.includes('/success');

  const orderId = location.state?.orderId;
  const transactionId = location.state?.transactionId;

  useEffect(() => {
    if (!orderId && !transactionId) {
      navigate('/');
    }
  }, [orderId, transactionId, navigate]);

  if (isSuccess) {
    return (
      <div className={styles.statusPage}>
        <Header />
        <div className={styles.statusContainer}>
          <div className={styles.successCard}>
            <div className={styles.iconWrapper}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className={styles.title}>Payment Successful!</h1>
            <p className={styles.subtitle}>Thank you for your order</p>

            <div className={styles.detailsCard}>
              {transactionId && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Transaction ID</span>
                  <span className={styles.detailValue}>{transactionId}</span>
                </div>
              )}
              {orderId && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Order ID</span>
                  <span className={styles.detailValue}>{orderId.substring(0, 8)}...</span>
                </div>
              )}
            </div>

            <p className={styles.message}>
              Your order has been placed successfully. You will receive a confirmation shortly.
            </p>

            <div className={styles.buttonGroup}>
              <button onClick={() => navigate('/products')} className={styles.primaryBtn}>
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className={styles.statusPage}>
      <Header />
      <div className={styles.statusContainer}>
        <div className={styles.failedCard}>
          <div className={styles.iconWrapperFailed}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className={styles.title}>Payment Failed</h1>
          <p className={styles.subtitle}>Something went wrong</p>

          <p className={styles.message}>
            Your payment could not be processed. Please try again or contact support if the problem persists.
          </p>

          <div className={styles.buttonGroup}>
            <button onClick={() => navigate('/cart')} className={styles.primaryBtn}>
              Back to Cart
            </button>
            <button onClick={() => navigate('/products')} className={styles.secondaryBtn}>
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default PaymentStatusPage;
