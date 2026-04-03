import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AuthCartSync from './components/AuthCartSync';
import HomePage from './pages/HomePage';
import ProductsPage from './pages/ProductsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import StaffRegistrationPage from './pages/StaffRegistrationPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import PaymentStatusPage from './pages/PaymentStatusPage';

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <AuthCartSync />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/payment/success" element={<PaymentStatusPage />} />
            <Route path="/payment/failed" element={<PaymentStatusPage />} />
            
            {/* Admin-only routes */}
            <Route 
              path="/admin/register-staff" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <StaffRegistrationPage />
                </ProtectedRoute>
              } 
            />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
