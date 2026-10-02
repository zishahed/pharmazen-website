import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/common/Header';
import Footer from '../components/common/Footer';
import { useAuth } from '../context/AuthContext';
import { getRestrictedMedicines } from '../api/medicinesApi';
import { uploadPrescription } from '../api/presApi';
import { compressImage } from '../utils/imageCompression';
import styles from './PrescriptionUploadPage.module.css';

// Vercel rejects a request body over ~4.5MB before the function runs, so the
// whole selection must stay under that. Two compressed files leave room for the
// form fields around them.
const MAX_FILES = 2;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;

/**
 * Both a Vercel 413 and a blocked cross-origin request arrive as errors with no
 * usable `response.data.error`, which is why this used to collapse into one
 * generic message.
 */
const describeUploadError = (err) => {
  const status = err.response?.status;

  if (status === 413) {
    return 'That image is too large to upload (4MB limit). Please try a smaller photo.';
  }
  if (status === 401 || status === 403) {
    return 'Your session has expired. Please sign in and try again.';
  }
  if (!err.response) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  return (
    err.response?.data?.error ||
    err.response?.data?.message ||
    'Failed to upload prescription. Please try again.'
  );
};

const PrescriptionUploadPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isCustomer } = useAuth();

  const [prescriptionFiles, setPrescriptionFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [filteredMedicines, setFilteredMedicines] = useState([]);
  const [medicineSearch, setMedicineSearch] = useState('');
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [showMedicineDropdown, setShowMedicineDropdown] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fileInputRef = useRef(null);
  const medicineDropdownRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated() || !isCustomer()) {
      navigate('/unauthorized');
    }
  }, [isAuthenticated, isCustomer, navigate]);

  useEffect(() => {
    const fetchMedicines = async () => {
      setLoading(true);
      try {
        const response = await getRestrictedMedicines('');
        setMedicines(response.data.data);
        setFilteredMedicines(response.data.data);
      } catch (err) {
        console.error('Error fetching medicines:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMedicines();
  }, []);

  useEffect(() => {
    if (medicineSearch) {
      const filtered = medicines.filter(med =>
        med.name.toLowerCase().includes(medicineSearch.toLowerCase())
      );
      setFilteredMedicines(filtered);
    } else {
      setFilteredMedicines(medicines);
    }
  }, [medicineSearch, medicines]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (medicineDropdownRef.current && !medicineDropdownRef.current.contains(event.target)) {
        setShowMedicineDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const processFiles = (newFiles) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    const validFiles = [];
    const validPreviews = [];
    let errorMsg = '';

    for (const file of newFiles) {
      if (!allowedTypes.includes(file.type)) {
        errorMsg = 'Only JPG, PNG, and PDF files are allowed';
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        errorMsg =
          'Each file must be under 2MB. Photos are compressed automatically when you upload.';
        continue;
      }
      validFiles.push(file);
    }

    if (prescriptionFiles.length + validFiles.length > MAX_FILES) {
      setError(`Maximum ${MAX_FILES} files allowed`);
      return;
    }

    const projectedTotal = [...prescriptionFiles, ...validFiles].reduce(
      (sum, file) => sum + file.size,
      0
    );
    if (projectedTotal > MAX_TOTAL_BYTES) {
      setError('Those files are too large in total. Please select fewer files.');
      return;
    }

    if (validFiles.length === 0) {
      setError(errorMsg || 'No valid files selected');
      return;
    }

    setError('');

    const previewPromises = validFiles.map((file) => {
      if (file.type.startsWith('image/')) {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve({ file, preview: reader.result });
          reader.readAsDataURL(file);
        });
      }
      return Promise.resolve({ file, preview: null });
    });

    Promise.all(previewPromises).then((results) => {
      setPrescriptionFiles((prev) => [...prev, ...results.map((r) => r.file)]);
      setFilePreviews((prev) => [...prev, ...results.map((r) => r.preview)]);
    });
  };

  const handleFileSelect = (e) => {
    processFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    processFiles(Array.from(e.dataTransfer.files));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleMedicineSelect = (medicine) => {
    setSelectedMedicine(medicine);
    setMedicineSearch(medicine.name);
    setShowMedicineDropdown(false);
  };

  const removeFile = (index) => {
    setPrescriptionFiles((prev) => prev.filter((_, i) => i !== index));
    setFilePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const isFormValid = () => {
    return prescriptionFiles.length > 0 && selectedMedicine && startDate && endDate;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isFormValid()) {
      setError('Please fill in all required fields');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      setError('End date must be after start date');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      // Compress before sending: a raw phone photo can exceed Vercel's request
      // body limit on its own, and the backend never runs well enough to
      // reject it with a useful message.
      const preparedFiles = await Promise.all(
        prescriptionFiles.map((file) => compressImage(file))
      );
      preparedFiles.forEach((file) => {
        formData.append('files', file);
      });
      formData.append('medicineId', selectedMedicine.id);
      formData.append('medicineName', selectedMedicine.name);
      formData.append('startDate', startDate);
      formData.append('endDate', endDate);
      if (comment) {
        formData.append('comment', comment);
      }

      await uploadPrescription(formData);

      setSuccess('Prescription uploaded successfully!');
      setTimeout(() => navigate('/prescriptions'), 2000);
    } catch (err) {
      setError(describeUploadError(err));
    } finally {
      setUploading(false);
    }
  };

  const getMinDate = () => {
    return startDate ? startDate : '';
  };

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>Upload Prescription</h1>
          <p className={styles.subtitle}>
            Upload your doctor's prescription to purchase restricted medicines
          </p>

          {success && (
            <div className={styles.successMessage}>
              {success}
            </div>
          )}

          {error && (
            <div className={styles.errorMessage}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.stepNumber}>1</span>
                Upload Prescription File
              </h2>
              <div
                className={styles.dropzone}
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                {prescriptionFiles.length > 0 ? (
                  <div className={styles.filesGrid}>
                    {prescriptionFiles.map((file, index) => (
                      <div key={index} className={styles.filePreview}>
                        {filePreviews[index] ? (
                          <img src={filePreviews[index]} alt={`Prescription ${index + 1}`} className={styles.previewImage} />
                        ) : (
                          <div className={styles.pdfPreview}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span>{file.name}</span>
                          </div>
                        )}
                        <button
                          type="button"
                          className={styles.removeFileBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(index);
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    {prescriptionFiles.length < MAX_FILES && (
                      <div
                        className={styles.addMoreBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <span>Add more</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={styles.dropzoneContent}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p>Drag and drop your prescription files here</p>
                    <span>or click to browse</span>
                    <span className={styles.fileTypes}>JPG, PNG, PDF (max 10MB each, up to 4 files)</span>
                  </div>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/jpeg,image/png,image/jpg,application/pdf"
                  className={styles.fileInput}
                  multiple
                />
              </div>
              <span className={styles.requiredLabel}>* Required (up to 4 files)</span>
            </div>

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.stepNumber}>2</span>
                Select Restricted Medicine
              </h2>
              <div className={styles.searchWrapper} ref={medicineDropdownRef}>
                <input
                  type="text"
                  placeholder="Search for restricted medicine..."
                  className={styles.searchInput}
                  value={medicineSearch}
                  onChange={(e) => {
                    setMedicineSearch(e.target.value);
                    setSelectedMedicine(null);
                    setShowMedicineDropdown(true);
                  }}
                  onFocus={() => setShowMedicineDropdown(true)}
                />
                <svg className={styles.searchIcon} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>

                {showMedicineDropdown && (
                  <div className={styles.medicineDropdown}>
                    {loading ? (
                      <div className={styles.dropdownLoading}>Loading medicines...</div>
                    ) : filteredMedicines.length > 0 ? (
                      filteredMedicines.map((medicine) => (
                        <button
                          key={medicine.id}
                          type="button"
                          className={`${styles.medicineOption} ${selectedMedicine?.id === medicine.id ? styles.medicineOptionSelected : ''}`}
                          onClick={() => handleMedicineSelect(medicine)}
                        >
                          <span className={styles.medicineName}>{medicine.name}</span>
                          {medicine.category && (
                            <span className={styles.medicineCategory}>{medicine.category.name}</span>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className={styles.dropdownEmpty}>No medicines found</div>
                    )}
                  </div>
                )}
              </div>
              <span className={styles.requiredLabel}>* Required</span>
            </div>

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.stepNumber}>3</span>
                Prescription Duration
              </h2>
              <div className={styles.dateRange}>
                <div className={styles.dateField}>
                  <label className={styles.label}>From Date</label>
                  <input
                    type="date"
                    className={styles.dateInput}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className={styles.dateField}>
                  <label className={styles.label}>To Date</label>
                  <input
                    type="date"
                    className={styles.dateInput}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={getMinDate()}
                  />
                </div>
              </div>
              <span className={styles.requiredLabel}>* Required</span>
            </div>

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.stepNumber}>4</span>
                Additional Comments
              </h2>
              <textarea
                placeholder="Add any additional notes or comments (optional)..."
                className={styles.textarea}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
              />
            </div>

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={uploading || !isFormValid()}
            >
              {uploading ? (
                <>
                  <span className={styles.spinner}></span>
                  Uploading...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload Prescription
                </>
              )}
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PrescriptionUploadPage;