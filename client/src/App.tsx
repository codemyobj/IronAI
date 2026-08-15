import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { HeaderProvider } from './context/HeaderContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import TrainingPage from './pages/TrainingPage';
import DietPage from './pages/DietPage';
import AIAnalysisPage from './pages/AIAnalysisPage';
import ProfilePage from './pages/ProfilePage';


export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <HeaderProvider>
          <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected routes — wrapped in Layout with navbar */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/training" element={<TrainingPage />} />
            <Route path="/diet" element={<DietPage />} />
            <Route path="/ai-analysis" element={<AIAnalysisPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
        </HeaderProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}