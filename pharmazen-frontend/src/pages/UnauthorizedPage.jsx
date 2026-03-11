import { useNavigate } from 'react-router-dom';
import styles from './UnauthorizedPage.module.css';

function UnauthorizedPage() {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.errorCode}>403</h1>
        <h2 className={styles.title}>Access Denied</h2>
        <p className={styles.message}>
          You don't have permission to access this page.
        </p>
        <p className={styles.submessage}>
          This page is restricted to administrators only.
        </p>
        <div className={styles.actions}>
          <button 
            onClick={() => navigate(-1)} 
            className={styles.backButton}
          >
            Go Back
          </button>
          <button 
            onClick={() => navigate('/')} 
            className={styles.homeButton}
          >
            Go to Home
          </button>
        </div>
      </div>
    </div>
  );
}

export default UnauthorizedPage;
