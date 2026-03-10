import styles from './MedicineCard.module.css';

const MedicineCard = ({
  name,
  genericName,
  stockQuantity,
  price,
  dosageForm,
  requiresPrescription,
}) => {
  // Determine price unit based on dosage form
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
      if (form.includes(key)) {
        return value;
      }
    }

    return 'per unit';
  };

  // Get icon based on dosage form
  const getDosageIcon = (dosageForm) => {
    if (!dosageForm) return 'pill';
    const form = dosageForm.toLowerCase();
    
    if (form.includes('tablet') || form.includes('capsule')) return 'pill';
    if (form.includes('syrup') || form.includes('suspension') || form.includes('lotion')) return 'bottle';
    if (form.includes('injection') || form.includes('syringe')) return 'syringe';
    if (form.includes('cream') || form.includes('ointment') || form.includes('gel')) return 'tube';
    if (form.includes('drops')) return 'drops';
    if (form.includes('inhaler') || form.includes('spray')) return 'spray';
    
    return 'pill';
  };

  const priceUnit = getPriceUnit(dosageForm);
  const dosageIcon = getDosageIcon(dosageForm);
  const isInStock = stockQuantity > 0;

  const renderIcon = () => {
    const iconProps = { className: styles.dosageIcon, xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor" };
    
    switch(dosageIcon) {
      case 'pill':
        return (
          <svg {...iconProps}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
        );
      case 'bottle':
        return (
          <svg {...iconProps}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        );
      case 'syringe':
        return (
          <svg {...iconProps} viewBox="0 0 24 24" fill="none">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4l1.5 1.5m0 0L11 7m-1.5-1.5L8 7m13 5l-2-2m-6 6l2 2m-2-2l2-2m-2 2l-6 6m6-6l-2-2M5 19l-2 2" />
          </svg>
        );
      case 'spray':
        return (
          <svg {...iconProps}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
      default:
        return (
          <svg {...iconProps}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
        );
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.iconWrapper}>
          {renderIcon()}
        </div>
        <div className={styles.badges}>
          <span className={isInStock ? styles.inStock : styles.outOfStock}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isInStock ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              )}
            </svg>
            {isInStock ? 'In Stock' : 'Out of Stock'}
          </span>
          {requiresPrescription && (
            <span className={styles.prescriptionBadge}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Rx
            </span>
          )}
        </div>
      </div>

      <h3 className={styles.medicineName}>{name}</h3>
      <p className={styles.genericName}>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        {genericName}
      </p>

      <div className={styles.priceSection}>
        <div className={styles.price}>
          <span className={styles.currency}>৳</span>
          <span className={styles.amount}>{parseFloat(price).toFixed(2)}</span>
        </div>
        <span className={styles.unit}>{priceUnit}</span>
      </div>

      <button
        className={styles.addToCartBtn}
        disabled={!isInStock}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        {isInStock ? 'Add to Cart' : 'Out of Stock'}
      </button>
    </div>
  );
};

export default MedicineCard;
