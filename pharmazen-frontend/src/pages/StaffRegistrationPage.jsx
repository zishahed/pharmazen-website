import { useState } from 'react';
import { registerStaff } from '../api/adminApi';
import styles from './StaffRegistrationPage.module.css';

function StaffRegistrationPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'pharmacist',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    // Clear messages when user types
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const response = await registerStaff(formData);
      setSuccess(`${response.data.user.role === 'admin' ? 'Administrator' : 'Pharmacist'} account created successfully for ${response.data.user.name}!`);
      
      // Clear form except role
      setFormData({
        name: '',
        email: '',
        password: '',
        role: formData.role, // Keep the same role selected
      });
    } catch (err) {
      setError(err.message || 'Failed to create staff account');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.formContainer}>
        <div className={styles.header}>
          <h1 className={styles.title}>Register Staff Member</h1>
          <p className={styles.subtitle}>Create accounts for pharmacists and administrators</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && (
            <div className={styles.errorMessage}>
              {error}
            </div>
          )}

          {success && (
            <div className={styles.successMessage}>
              {success}
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="name" className={styles.label}>
              Full Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={styles.input}
              placeholder="Enter full name"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={styles.input}
              placeholder="Enter email address"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={styles.input}
              placeholder="Enter password (min 6 characters)"
              required
              minLength={6}
            />
            <small className={styles.hint}>Minimum 6 characters</small>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="role" className={styles.label}>
              Role
            </label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              className={styles.select}
              required
            >
              <option value="pharmacist">Pharmacist - Can verify prescriptions and manage medications</option>
              <option value="admin">Administrator - Full system access and management</option>
            </select>
          </div>

          <button 
            type="submit" 
            className={styles.submitButton}
            disabled={isLoading}
          >
            {isLoading ? 'Creating Account...' : 'Create Staff Account'}
          </button>
        </form>

        <div className={styles.infoSection}>
          <h3 className={styles.infoTitle}>Account Information</h3>
          <ul className={styles.infoList}>
            <li>Staff members will receive their login credentials via email</li>
            <li>They can change their password after first login</li>
            <li>Pharmacists can verify prescriptions and manage medications</li>
            <li>Administrators have full access to all system features</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default StaffRegistrationPage;
