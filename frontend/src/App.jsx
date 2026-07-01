import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import AlertsPage from './pages/AlertsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AuditorPage from './pages/AuditorPage';
import DashboardPage from './pages/DashboardPage';
import InputPage from './pages/InputPage';
import ReportsPage from './pages/ReportsPage';
import api, { ensureAuthToken } from './services/api';

function App() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [dataRefreshKey, setDataRefreshKey] = useState(0);
  const [lastDataUpdate, setLastDataUpdate] = useState(null);

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
    ensureAuthToken().catch(() => {
      // Public pages still work; protected actions will retry on demand.
    });
  }, []);

  const notifyDataUpdated = (payload) => {
    const update = {
      at: Date.now(),
      ...payload,
    };
    setLastDataUpdate(update);
    setDataRefreshKey((prev) => prev + 1);
  };

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
                dataRefreshKey={dataRefreshKey}
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
                onDataUpdated={notifyDataUpdated}
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
                dataRefreshKey={dataRefreshKey}
                lastDataUpdate={lastDataUpdate}
              />
            }
          />
          <Route
            path="/auditor"
            element={
              <AuditorPage
                companies={companies}
                selectedCompanyId={selectedCompanyId}
                dataRefreshKey={dataRefreshKey}
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
                dataRefreshKey={dataRefreshKey}
                lastDataUpdate={lastDataUpdate}
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
                dataRefreshKey={dataRefreshKey}
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
