import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { HeaderProvider } from './context/HeaderContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import TrainingPage from './pages/TrainingPage';
import WorkoutSessionPage from './pages/WorkoutSessionPage';
import DietPage from './pages/DietPage';
import ProfilePage from './pages/ProfilePage';


export default function App() {
  return (
    <ThemeProvider defaultTheme="system">
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
              <Route path="/training/session/:programId" element={<WorkoutSessionPage />} />
              <Route path="/diet" element={<DietPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
          </HeaderProvider>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}