import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '../components/common/Header';
import Footer from '../components/common/Footer';
import Loader from '../components/common/Loader';
import MedicineCard from '../components/user/MedicineCard';
import FiltersSidebar from '../components/user/FiltersSidebar';
import { getMedicines, getMaxPrice, getFilterOptions, getCategories } from '../api/medicinesApi';
import styles from './ProductsPage.module.css';

const ProductsPage = () => {
  // Get search params from URL
  const [searchParams, setSearchParams] = useSearchParams();
  
  // State management
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalMedicines, setTotalMedicines] = useState(0);

  // Filter data
  const [genericNames, setGenericNames] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [maxPriceValue, setMaxPriceValue] = useState(10000);

  // Applied filters
  const [filters, setFilters] = useState({});
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');

  // Detect mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 767);

  // Update search query when URL params change
  useEffect(() => {
    const searchFromUrl = searchParams.get('search') || '';
    setSearchQuery(searchFromUrl);
  }, [searchParams]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 767);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch initial data (filter options, max price, categories)
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [filterRes, maxPriceRes, categoriesRes] = await Promise.all([
          getFilterOptions(),
          getMaxPrice(),
          getCategories(),
        ]);

        setGenericNames(filterRes.data.data.genericNames);
        setCompanies(filterRes.data.data.companies);
        setMaxPriceValue(maxPriceRes.data.data.maxPrice || 10000);
        setCategories(categoriesRes.data.data);
      } catch (err) {
        console.error('Error fetching initial data:', err);
      }
    };

    fetchInitialData();
  }, []);

  // Fetch medicines whenever page, filters, or search changes
  useEffect(() => { fetchMedicinesData(); }, [page, filters, searchQuery]);

  const fetchMedicinesData = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        page,
        limit: 20,
        search: searchQuery,
        ...filters,
      };

      const response = await getMedicines(params);
      const data = response.data.data;

      setMedicines(data.medicines);
      setTotalMedicines(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error('Error fetching medicines:', err);
      setError('Failed to load medicines. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Parse medicine data (extract generic name, dosage form from description)
  const parseMedicineData = (medicine) => {
    const parts = medicine.description?.split('|') || [];
    return {
      id: medicine.id,
      name: medicine.name,
      genericName: parts[0]?.trim() || 'N/A',
      dosageForm: parts[1]?.trim() || '',
      stockQuantity: medicine.stockQuantity,
      price: parseFloat(medicine.price),
      requiresPrescription: medicine.requiresPrescription,
    };
  };

  // Handle filter application
  const handleApplyFilters = (newFilters) => {
    setFilters(newFilters);
    setPage(1); // Reset to page 1 when filters change
  };

  // Handle search
  const handleSearch = (query) => {
    setSearchQuery(query);
    setSearchParams(query ? { search: query } : {});
    setPage(1); // Reset to page 1 when search changes
  };

  // Handle pagination
  const handlePreviousPage = () => {
    if (page > 1) {
      setPage(page - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNextPage = () => {
    if (page < totalPages) {
      setPage(page + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className={styles.productsPage}>
      <Header
        totalMedicines={totalMedicines}
        onSearch={handleSearch}
      />

      <div className={styles.mainContent}>
        <FiltersSidebar
          genericNames={genericNames}
          companies={companies}
          categories={categories}
          maxPrice={maxPriceValue}
          onApplyFilters={handleApplyFilters}
          isMobile={isMobile}
        />

        <div className={styles.productsSection}>
          {loading ? (
            <Loader />
          ) : error ? (
            <div className={styles.error}>
              <p>{error}</p>
              <button onClick={fetchMedicinesData} className={styles.retryBtn}>
                Retry
              </button>
            </div>
          ) : medicines.length === 0 ? (
            <div className={styles.noResults}>
              <p className={styles.noResultsText}>Sorry! Nothing found here.</p>
              <p className={styles.noResultsSubtext}>
                Try adjusting your filters or search query.
              </p>
            </div>
          ) : (
            <>
              <div className={styles.resultsInfo}>
                <p>
                  Showing {medicines.length} of {totalMedicines.toLocaleString()} medicines
                  {searchQuery && <strong> for "{searchQuery}"</strong>}
                </p>
              </div>

              <div className={styles.medicineGrid}>
                {medicines.map((medicine) => (
                  <MedicineCard key={medicine.id} {...parseMedicineData(medicine)} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <button
                    className={styles.pageBtn}
                    onClick={handlePreviousPage}
                    disabled={page === 1}
                  >
                    ← Previous
                  </button>

                  <span className={styles.pageInfo}>
                    Page {page} of {totalPages}
                  </span>

                  <button
                    className={styles.pageBtn}
                    onClick={handleNextPage}
                    disabled={page === totalPages}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ProductsPage;