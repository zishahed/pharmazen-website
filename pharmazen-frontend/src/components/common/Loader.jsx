import styles from './Loader.module.css';

const Loader = () => {
  return (
    <div className={styles.loaderContainer}>
      <div className={styles.loader}>
        <div className={styles.medicalCross}>
          <div className={styles.crossVertical}></div>
          <div className={styles.crossHorizontal}></div>
        </div>
        <div className={styles.pulseRing}></div>
        <div className={styles.pulseRing2}></div>
      </div>
      <p className={styles.text}>Loading medicines...</p>
    </div>
  );
};

export default Loader;
