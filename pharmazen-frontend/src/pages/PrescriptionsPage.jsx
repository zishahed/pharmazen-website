import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/common/Header';
import Footer from '../components/common/Footer';
import { useAuth } from '../context/AuthContext';
import { getUserPrescriptions } from '../api/presApi';
import styles from './PrescriptionsPage.module.css';

const PrescriptionsPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isCustomer } = useAuth();

  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated() || !isCustomer()) {
      navigate('/unauthorized');
    }
  }, [isAuthenticated, isCustomer, navigate]);

  useEffect(() => {
    fetchPrescriptions();
  }, []);

  const fetchPrescriptions = async () => {
    setLoading(true);
    try {
      const response = await getUserPrescriptions();
      setPrescriptions(response.data.data);
    } catch (err) {
      console.error('Error fetching prescriptions:', err);
      setError('Failed to load prescriptions.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'pending': return styles.statusPending;
      case 'approved': return styles.statusApproved;
      case 'rejected': return styles.statusRejected;
      default: return '';
    }
  };

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1 className={styles.title}>My Prescriptions</h1>
            <p className={styles.subtitle}>View all your uploaded prescriptions and their status</p>
          </div>

          {error && (
            <div className={styles.errorMessage}>
              {error}
              <button className={styles.errorDismiss} onClick={() => setError('')}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {loading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner}></div>
              <p>Loading prescriptions...</p>
            </div>
          ) : prescriptions.length === 0 ? (
            <div className={styles.emptyState}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>No prescriptions yet</p>
              <button
                className={styles.uploadBtn}
                onClick={() => navigate('/upload-prescription')}
              >
                Upload Your First Prescription
              </button>
            </div>
          ) : (
            <div className={styles.list}>
              {prescriptions.map((prescription) => (
                <div key={prescription.id} className={styles.card}>
                  <div className={styles.cardTop}>
                    <div className={styles.cardHeader}>
                      <h3 className={styles.medicineName}>{prescription.medicineName}</h3>
                      <span className={`${styles.statusBadge} ${getStatusClass(prescription.status)}`}>
                        {prescription.status}
                      </span>
                    </div>
                    <div className={styles.cardMeta}>
                      <div className={styles.metaItem}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>{formatDate(prescription.startDate)} - {formatDate(prescription.endDate)}</span>
                      </div>
                      <div className={styles.metaItem}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Submitted {formatDate(prescription.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.cardBody}>
                    {prescription.comment && (
                      <div className={styles.comment}>
                        <strong>Note:</strong> {prescription.comment}
                      </div>
                    )}
                    <div className={styles.files}>
                      {prescription.files?.map((file, index) => (
                        <a
                          key={file.id}
                          href={file.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.fileLink}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          View File {index + 1}
                        </a>
                      ))}
                    </div>
                  </div>

                  <div className={styles.cardFooter}>
                    {prescription.reviewer && (
                      <span className={styles.reviewedBy}>
                        Reviewed by: {prescription.reviewer.name}
                      </span>
                    )}
                    {prescription.reviewNote && (
                      <div className={styles.reviewNote}>
                        <strong>Review note:</strong> {prescription.reviewNote}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PrescriptionsPage;
