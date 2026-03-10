import { useState, useEffect, useRef } from 'react';
import styles from './SearchableSelect.module.css';

const SearchableSelect = ({ options, value, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);

  // Filter options based on search term
  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Set initial search term to current value
  useEffect(() => {
    setSearchTerm(value || '');
  }, [value]);

  const handleSelect = (option) => {
    setSearchTerm(option);
    onChange(option);
    setIsOpen(false);
  };

  const handleClear = () => {
    setSearchTerm('');
    onChange('');
  };

  return (
    <div className={styles.searchableSelect} ref={wrapperRef}>
      <div className={styles.inputWrapper}>
        <input
          type="text"
          className={styles.input}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
        />
        {searchTerm && (
          <button
            className={styles.clearBtn}
            onClick={handleClear}
            type="button"
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && (
        <ul className={styles.dropdown}>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => (
              <li
                key={index}
                className={styles.option}
                onClick={() => handleSelect(option)}
              >
                {option}
              </li>
            ))
          ) : (
            <li className={styles.noResults}>No results found</li>
          )}
        </ul>
      )}
    </div>
  );
};

export default SearchableSelect;
