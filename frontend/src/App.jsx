import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import AlertsPage from './pages/AlertsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AuditorPage from './pages/AuditorPage';
import DashboardPage from './pages/DashboardPage';
import InputPage from './pages/InputPage';
import ReportsPage from './pages/ReportsPage';
import api from './services/api';

function App() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [dashboardRefreshTick, setDashboardRefreshTick] = useState(0);

  const notifyDashboardRefresh = () => {
    setDashboardRefreshTick((prev) => prev + 1);
  };

  const loadCompanies = async () => {
    const { data } = await api.get('/companies');
    setCompanies(data);
    if (!selectedCompanyId && data.length > 0) {
      setSelectedCompanyId(data[0].id);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    if (!selectedCompanyId) return undefined;

    const intervalId = setInterval(async () => {
      try {
        const { data } = await api.post(`/sensors/pull/company/${selectedCompanyId}`);
        if ((data?.succeeded || 0) > 0) {
          notifyDashboardRefresh();
        }
      } catch (error) {
        // Ignore sensor pull errors and retry on next interval.
      }
    }, 8000);

    return () => clearInterval(intervalId);
  }, [selectedCompanyId]);

  return (
    <div className="app-bg">
      <Navbar />
      <main className="page-shell">
        <Routes>
          <Route
            path="/"
            element={
              <DashboardPage
                companies={companies}
                selectedCompanyId={selectedCompanyId}
                setSelectedCompanyId={setSelectedCompanyId}
                refreshCompanies={loadCompanies}
                refreshTick={dashboardRefreshTick}
              />
            }
          />
          <Route
            path="/input"
            element={
              <InputPage
                companies={companies}
                selectedCompanyId={selectedCompanyId}
                setSelectedCompanyId={setSelectedCompanyId}
                onDataUpdated={notifyDashboardRefresh}
              />
            }
          />
          <Route
            path="/analytics"
            element={
              <AnalyticsPage
                companies={companies}
                selectedCompanyId={selectedCompanyId}
                setSelectedCompanyId={setSelectedCompanyId}
                refreshTick={dashboardRefreshTick}
              />
            }
          />
          <Route
            path="/auditor"
            element={
              <AuditorPage
                companies={companies}
                selectedCompanyId={selectedCompanyId}
                refreshTick={dashboardRefreshTick}
              />
            }
          />
          <Route
            path="/reports"
            element={
              <ReportsPage
                companies={companies}
                selectedCompanyId={selectedCompanyId}
                setSelectedCompanyId={setSelectedCompanyId}
                refreshTick={dashboardRefreshTick}
              />
            }
          />
          <Route
            path="/alerts"
            element={
              <AlertsPage
                companies={companies}
                selectedCompanyId={selectedCompanyId}
                setSelectedCompanyId={setSelectedCompanyId}
                refreshTick={dashboardRefreshTick}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
