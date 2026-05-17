import { useNavigate } from 'react-router-dom';
import Header from '../components/common/Header';
import Footer from '../components/common/Footer';
import { useAuth } from '../context/AuthContext';
import styles from './ProfilePage.module.css';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const roleLabel = (role) => {
    switch (role) {
      case 'customer': return 'Customer';
      case 'pharmacist': return 'Pharmacist';
      case 'admin': return 'Administrator';
      default: return role;
    }
  };

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1 className={styles.title}>My Profile</h1>
          </div>

          <div className={styles.profileCard}>
            <div className={styles.avatarSection}>
              <div className={styles.avatar}>
                {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
              </div>
              <span className={styles.roleBadge}>{roleLabel(user?.role)}</span>
            </div>

            <div className={styles.details}>
              <div className={styles.detailRow}>
                <div className={styles.detailLabel}>Full Name</div>
                <div className={styles.detailValue}>{user?.name || '-'}</div>
              </div>
              <div className={styles.detailRow}>
                <div className={styles.detailLabel}>Email</div>
                <div className={styles.detailValue}>{user?.email || '-'}</div>
              </div>
              <div className={styles.detailRow}>
                <div className={styles.detailLabel}>Role</div>
                <div className={styles.detailValue}>{roleLabel(user?.role)}</div>
              </div>
              <div className={styles.detailRow}>
                <div className={styles.detailLabel}>Member Since</div>
                <div className={styles.detailValue}>{user?.createdAt ? formatDate(user.createdAt) : '-'}</div>
              </div>
            </div>
          </div>

          <div className={styles.actions}>
            <button className={styles.logoutBtn} onClick={handleLogout}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ProfilePage;
