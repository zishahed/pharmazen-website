import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/common/Header';
import Footer from '../components/common/Footer';
import { useAuth } from '../context/AuthContext';
import { getPendingPrescriptions, getPrescriptionById, reviewPrescription } from '../api/presApi';
import styles from './PrescriptionReviewPage.module.css';

const PrescriptionReviewPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isPharmacist, isAdmin } = useAuth();

  const [pendingPrescriptions, setPendingPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  // Phase 7b: units the pharmacist authorises. Seeded from the prescription's
  // own default when one is opened, so the number is always explicit rather than
  // an invisible server fallback.
  const [maxQuantity, setMaxQuantity] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState('');

  useEffect(() => {
    if (!isAuthenticated() || (!isPharmacist() && !isAdmin())) {
      navigate('/unauthorized');
    }
  }, [isAuthenticated, isPharmacist, isAdmin, navigate]);

  useEffect(() => {
    fetchPendingPrescriptions();
  }, []);

  const fetchPendingPrescriptions = async () => {
    setLoading(true);
    try {
      const response = await getPendingPrescriptions();
      setPendingPrescriptions(response.data.data);
    } catch (err) {
      console.error('Error fetching pending prescriptions:', err);
      setError('Failed to load pending prescriptions.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrescriptionClick = async (id) => {
    setDetailLoading(true);
    setSelectedPrescription(null);
    setReviewNote('');
    setReviewSuccess('');
    setMaxQuantity('');
    try {
      const response = await getPrescriptionById(id);
      setSelectedPrescription(response.data.data);
      // Phase 7b: pre-fill the current limit so the pharmacist edits a known
      // value instead of retyping it, and so the field never reads as blank.
      setMaxQuantity(String(response.data.data?.maxQuantity ?? ''));
    } catch (err) {
      console.error('Error fetching prescription details:', err);
      setError('Failed to load prescription details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleReview = async (status) => {
    if (!selectedPrescription) return;

    setReviewing(true);
    try {
      await reviewPrescription(selectedPrescription.id, {
        status,
        reviewNote: reviewNote || undefined,
        ...(status === 'approved' && maxQuantity !== ''
          ? { maxQuantity: Number(maxQuantity) }
          : {}),
      });
      setReviewSuccess(`Prescription ${status} successfully!`);
      setPendingPrescriptions((prev) => prev.filter((p) => p.id !== selectedPrescription.id));
      setTimeout(() => {
        setSelectedPrescription(null);
        setReviewSuccess('');
        setReviewNote('');
        setMaxQuantity('');
      }, 1500);
    } catch (err) {
      console.error('Error reviewing prescription:', err);
      setError(err.response?.data?.error || `Failed to ${status} prescription.`);
    } finally {
      setReviewing(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedPrescription(null);
    setReviewNote('');
    setReviewSuccess('');
    setError('');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1 className={styles.title}>Review Prescriptions</h1>
            <p className={styles.subtitle}>
              Review and approve pending prescription requests
            </p>
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

          <div className={styles.content}>
            <div className={styles.listSection}>
              <h2 className={styles.sectionTitle}>Pending Approvals</h2>
              <span className={styles.countBadge}>{pendingPrescriptions.length}</span>

              {loading ? (
                <div className={styles.loadingState}>
                  <div className={styles.spinner}></div>
                  <p>Loading pending prescriptions...</p>
                </div>
              ) : pendingPrescriptions.length === 0 ? (
                <div className={styles.emptyState}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>No pending prescriptions to review</p>
                </div>
              ) : (
                <div className={styles.prescriptionList}>
                  {pendingPrescriptions.map((prescription) => (
                    <button
                      key={prescription.id}
                      className={`${styles.prescriptionCard} ${selectedPrescription?.id === prescription.id ? styles.prescriptionCardSelected : ''}`}
                      onClick={() => handlePrescriptionClick(prescription.id)}
                    >
                      <div className={styles.cardHeader}>
                        <span className={styles.medicineName}>{prescription.medicineName}</span>
                        <span className={styles.statusBadge}>Pending</span>
                      </div>
                      <div className={styles.cardDetails}>
                        <div className={styles.cardDetail}>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span>{prescription.user.name}</span>
                        </div>
                        <div className={styles.cardDetail}>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>{formatDate(prescription.startDate)} - {formatDate(prescription.endDate)}</span>
                        </div>
                        <div className={styles.cardDetail}>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{formatDateTime(prescription.createdAt)}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.detailSection}>
              {detailLoading ? (
                <div className={styles.detailLoading}>
                  <div className={styles.spinner}></div>
                  <p>Loading prescription details...</p>
                </div>
              ) : selectedPrescription ? (
                <div className={styles.detailPanel}>
                  <div className={styles.detailHeader}>
                    <h2 className={styles.detailTitle}>Prescription Details</h2>
                    <button className={styles.closeBtn} onClick={handleCloseDetail}>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {reviewSuccess && (
                    <div className={styles.successMessage}>{reviewSuccess}</div>
                  )}

                  <div className={styles.detailContent}>
                    <div className={styles.infoGroup}>
                      <h3 className={styles.infoGroupTitle}>Patient Information</h3>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Name</span>
                        <span className={styles.infoValue}>{selectedPrescription.user.name}</span>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Email</span>
                        <span className={styles.infoValue}>{selectedPrescription.user.email}</span>
                      </div>
                    </div>

                    <div className={styles.infoGroup}>
                      <h3 className={styles.infoGroupTitle}>Medicine Request</h3>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Medicine</span>
                        <span className={`${styles.infoValue} ${styles.medicineValue}`}>{selectedPrescription.medicineName}</span>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Duration</span>
                        <span className={styles.infoValue}>
                          {formatDate(selectedPrescription.startDate)} to {formatDate(selectedPrescription.endDate)}
                        </span>
                      </div>
                    </div>

                    {selectedPrescription.comment && (
                      <div className={styles.infoGroup}>
                        <h3 className={styles.infoGroupTitle}>Patient Comments</h3>
                        <p className={styles.commentText}>{selectedPrescription.comment}</p>
                      </div>
                    )}

                    <div className={styles.infoGroup}>
                      <h3 className={styles.infoGroupTitle}>Prescription Documents ({selectedPrescription.files?.length || 0})</h3>
                      <div className={styles.filesList}>
                        {selectedPrescription.files?.map((file, index) => (
                          <a
                            key={file.id}
                            href={file.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.downloadBtn}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            File {index + 1}
                          </a>
                        ))}
                      </div>
                      <p className={styles.downloadHint}>Download and verify the prescription files against the requested medicine and duration</p>
                    </div>

                    <div className={styles.reviewSection}>
                      <h3 className={styles.infoGroupTitle}>Authorised quantity</h3>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        inputMode="numeric"
                        className={styles.limitInput}
                        placeholder="Units the patient may take"
                        value={maxQuantity}
                        onChange={(e) => setMaxQuantity(e.target.value)}
                      />
                      <p className={styles.limitHint}>
                        Total units of {selectedPrescription.medicineName} this approval allows,
                        across all orders until {formatDate(selectedPrescription.endDate)}.
                        {selectedPrescription.consumedQuantity > 0 &&
                          ` Already dispensed: ${selectedPrescription.consumedQuantity}.`}
                        {' '}Leave blank to allow {selectedPrescription.maxQuantity}.
                      </p>
                    </div>

                    <div className={styles.reviewSection}>
                      <h3 className={styles.infoGroupTitle}>Review Decision</h3>
                      <textarea
                        placeholder="Add a review note (optional)..."
                        className={styles.reviewNoteInput}
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        rows={3}
                      />
                      <div className={styles.reviewActions}>
                        <button
                          className={styles.rejectBtn}
                          onClick={() => handleReview('rejected')}
                          disabled={reviewing}
                        >
                          {reviewing ? (
                            <span className={styles.spinnerSmall}></span>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                          Reject
                        </button>
                        <button
                          className={styles.approveBtn}
                          onClick={() => handleReview('approved')}
                          disabled={reviewing}
                        >
                          {reviewing ? (
                            <span className={styles.spinnerSmall}></span>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          Approve
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.detailPlaceholder}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                  <p>Select a prescription to review</p>
                  <span>Click on a pending prescription from the list to view its details and make a decision</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PrescriptionReviewPage;
