import { useState, useEffect } from 'react';
import SearchableSelect from '../common/SearchableSelect';
import styles from './FiltersSidebar.module.css';

const FiltersSidebar = ({
  genericNames,
  companies,
  categories,
  maxPrice,
  onApplyFilters,
  isMobile,
}) => {
  const [isOpen, setIsOpen] = useState(!isMobile);
  const [filters, setFilters] = useState({
    genericName: '',
    company: '',
    categoryId: '',
    minPrice: 0,
    maxPrice: maxPrice,
  });

  // Update maxPrice when prop changes
  useEffect(() => {
    setFilters((prev) => ({ ...prev, maxPrice }));
  }, [maxPrice]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleApply = () => {
    onApplyFilters(filters);
    if (isMobile) {
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    const clearedFilters = {
      genericName: '',
      company: '',
      categoryId: '',
      minPrice: 0,
      maxPrice: maxPrice,
    };
    setFilters(clearedFilters);
    onApplyFilters(clearedFilters);
  };

  // Mobile toggle button
  if (isMobile && !isOpen) {
    return (
      <button
        className={styles.showFiltersBtn}
        onClick={() => setIsOpen(true)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        Show Filters
      </button>
    );
  }

  return (
    <>
      {isMobile && isOpen && (
        <div className={styles.backdrop} onClick={() => setIsOpen(false)} />
      )}

      <aside className={`${styles.sidebar} ${isMobile && isOpen ? styles.mobileOpen : ''}`}>
        {isMobile && (
          <div className={styles.mobileHeader}>
            <h2 className={styles.title}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
            </h2>
            <button
              className={styles.closeBtn}
              onClick={() => setIsOpen(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {!isMobile && (
          <h2 className={styles.title}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
          </h2>
        )}

        {/* Generic Name Filter */}
        <div className={styles.filterGroup}>
          <label className={styles.label}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Generic Name
          </label>
          <SearchableSelect
            options={genericNames}
            value={filters.genericName}
            onChange={(value) => handleFilterChange('genericName', value)}
            placeholder="Type or select..."
          />
        </div>

        {/* Company Filter */}
        <div className={styles.filterGroup}>
          <label className={styles.label}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Company
          </label>
          <SearchableSelect
            options={companies}
            value={filters.company}
            onChange={(value) => handleFilterChange('company', value)}
            placeholder="Type or select..."
          />
        </div>

        {/* Category Filter */}
        <div className={styles.filterGroup}>
          <label className={styles.label}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Category
          </label>
          <select
            className={styles.select}
            value={filters.categoryId}
            onChange={(e) => handleFilterChange('categoryId', e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        {/* Price Range Filter */}
        <div className={styles.filterGroup}>
          <label className={styles.label}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Price Range
          </label>
          <div className={styles.priceSlider}>
            <div className={styles.sliderLabels}>
              <span>৳{filters.minPrice}</span>
              <span>৳{filters.maxPrice}</span>
            </div>
            <div className={styles.rangeInputs}>
              <input
                type="range"
                min="0"
                max={maxPrice}
                value={filters.minPrice}
                onChange={(e) =>
                  handleFilterChange('minPrice', parseInt(e.target.value))
                }
                className={styles.rangeInput}
              />
              <input
                type="range"
                min="0"
                max={maxPrice}
                value={filters.maxPrice}
                onChange={(e) =>
                  handleFilterChange('maxPrice', parseInt(e.target.value))
                }
                className={styles.rangeInput}
              />
            </div>
            <div className={styles.priceRange}>
              <span className={styles.priceLabel}>Min: ৳{filters.minPrice}</span>
              <span className={styles.priceLabel}>Max: ৳{filters.maxPrice}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className={styles.actions}>
          <button className={styles.applyBtn} onClick={handleApply}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Apply Filters
          </button>
          <button className={styles.clearBtn} onClick={handleClear}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Clear All
          </button>
        </div>
      </aside>
    </>
  );
};

export default FiltersSidebar;
