import { useEffect, useMemo, useRef, useState } from 'react';
import CompanySelector from '../components/CompanySelector';
import api from '../services/api';

const tabs = ['Manual Entry', 'File Upload', 'Sensor Connect'];
const uploadAccept = '.csv,.tsv,.txt,.xlsx,.xls,.json,.jsonl,.ndjson';

const fieldOptions = {
  environmental: [
    'carbon_emissions_tonnes',
    'energy_kwh',
    'water_litres',
    'waste_kg',
    'recycled_waste_kg',
  ],
  social: ['total_employees', 'female_employees', 'safety_incidents', 'training_hours', 'community_investment'],
  governance: ['board_members', 'independent_directors', 'audit_meetings', 'has_whistleblower_policy', 'data_breaches'],
};

const fieldAliases = {
  carbon_emissions_tonnes: ['carbon', 'co2', 'emission', 'emissions_tonnes', 'carbon_tonnes'],
  energy_kwh: ['energy', 'power', 'electricity', 'energy_used_kwh'],
  water_litres: ['water', 'water_consumed', 'water_liters', 'water_litres'],
  waste_kg: ['waste', 'waste_generated', 'waste_kg'],
  recycled_waste_kg: ['recycled', 'recycle', 'recycled_waste', 'recycled_kg'],
  total_employees: ['employees', 'employee_count', 'headcount', 'total_staff'],
  female_employees: ['female', 'women', 'female_employees', 'women_employees'],
  safety_incidents: ['safety', 'incident', 'safety_incidents'],
  training_hours: ['training', 'training_hours', 'learning_hours'],
  community_investment: ['community', 'csr', 'community_spend', 'community_investment'],
  board_members: ['board_members', 'board_size', 'total_board_members'],
  independent_directors: ['independent_directors', 'independent_board_members'],
  audit_meetings: ['audit_meetings', 'audit_committee_meetings'],
  has_whistleblower_policy: ['whistleblower', 'whistle_blower', 'policy_enabled'],
  data_breaches: ['data_breaches', 'breaches', 'security_breaches'],
};

const normalizeHeader = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const buildSmartMapping = (columns, targets) => {
  const mapped = {};
  const usedTargets = new Set();

  columns.forEach((col) => {
    mapped[col] = '';
    const source = normalizeHeader(col);

    for (const target of targets) {
      if (usedTargets.has(target)) continue;
      const aliases = [target, ...(fieldAliases[target] || [])].map(normalizeHeader);
      const isMatch = aliases.some((alias) => alias && (source === alias || source.includes(alias) || alias.includes(source)));
      if (isMatch) {
        mapped[col] = target;
        usedTargets.add(target);
        break;
      }
    }
  });

  return mapped;
};

const detectBestDataType = (columns) => {
  const scored = Object.keys(fieldOptions).map((type) => {
    const autoMap = buildSmartMapping(columns, fieldOptions[type]);
    const matched = Object.values(autoMap).filter(Boolean).length;
    return { type, matched };
  });

  scored.sort((a, b) => b.matched - a.matched);
  if (!scored[0] || scored[0].matched === 0) {
    return 'environmental';
  }
  return scored[0].type;
};

const inferPeriodFromRows = (rows) => {
  const first = rows?.[0] || {};
  const keys = Object.keys(first);
  const normalized = Object.fromEntries(keys.map((k) => [normalizeHeader(k), first[k]]));

  const monthRaw = normalized.month ?? normalized.monthno ?? normalized.monthnumber;
  const yearRaw = normalized.year ?? normalized.fiscalyear;

  const month = Number(monthRaw);
  const year = Number(yearRaw);

  if (month >= 1 && month <= 12 && year >= 2000) {
    return { month, year };
  }

  const dateRaw = normalized.date ?? normalized.period ?? normalized.reportdate;
  if (!dateRaw) return null;

  const parsed = new Date(String(dateRaw));
  if (Number.isNaN(parsed.getTime())) return null;
  return { month: parsed.getMonth() + 1, year: parsed.getFullYear() };
};

function InputPage({ companies, selectedCompanyId, setSelectedCompanyId, onDataUpdated }) {
  const [tab, setTab] = useState('Manual Entry');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const [envForm, setEnvForm] = useState({
    carbon_emissions_tonnes: '',
    energy_kwh: '',
    water_litres: '',
    waste_kg: '',
    recycled_waste_kg: '',
  });
  const [socialForm, setSocialForm] = useState({
    total_employees: '',
    female_employees: '',
    safety_incidents: '',
    training_hours: '',
    community_investment: '',
  });
  const [govForm, setGovForm] = useState({
    board_members: '',
    independent_directors: '',
    audit_meetings: '',
    has_whistleblower_policy: false,
    data_breaches: '',
  });

  const [uploadData, setUploadData] = useState(null);
  const [dataType, setDataType] = useState('environmental');
  const [mapping, setMapping] = useState({});
  const [uploadMeta, setUploadMeta] = useState({ fileName: '', format: '', rows: 0 });
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  const [sensorForm, setSensorForm] = useState({
    sensor_name: '',
    api_endpoint: '',
    api_key: '',
    data_type: 'carbon',
    is_active: true,
  });
  const [sensors, setSensors] = useState([]);

  const loadSensors = async () => {
    if (!selectedCompanyId) return;
    const { data } = await api.get(`/sensors/${selectedCompanyId}`);
    setSensors(data);
  };

  useEffect(() => {
    loadSensors();
  }, [selectedCompanyId]);

  const saveManual = async () => {
    if (!selectedCompanyId) return;
    await Promise.all([
      api.post('/data/environmental', { company_id: selectedCompanyId, month, year, ...Object.fromEntries(Object.entries(envForm).map(([k, v]) => [k, Number(v || 0)])) }),
      api.post('/data/social', { company_id: selectedCompanyId, month, year, ...Object.fromEntries(Object.entries(socialForm).map(([k, v]) => [k, Number(v || 0)])) }),
      api.post('/data/governance', {
        company_id: selectedCompanyId,
        month,
        year,
        board_members: Number(govForm.board_members || 0),
        independent_directors: Number(govForm.independent_directors || 0),
        audit_meetings: Number(govForm.audit_meetings || 0),
        has_whistleblower_policy: Boolean(govForm.has_whistleblower_policy),
        data_breaches: Number(govForm.data_breaches || 0),
      }),
    ]);
    onDataUpdated?.();
    window.alert('Data saved successfully');
  };

  const handleFile = async (file) => {
    if (!file) return;
    setUploadError('');

    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post('/upload/csv', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUploadData(data);
      setUploadMeta({
        fileName: file.name,
        format: data.detected_format || 'unknown',
        rows: data.total_rows || 0,
      });

      const bestType = detectBestDataType(data.columns);
      setDataType(bestType);
      setMapping(buildSmartMapping(data.columns, fieldOptions[bestType]));

      const inferred = inferPeriodFromRows(data.rows);
      if (inferred) {
        setMonth(inferred.month);
        setYear(inferred.year);
      }
    } catch (err) {
      setUploadData(null);
      setUploadMeta({ fileName: '', format: '', rows: 0 });
      setMapping({});
      setUploadError(err?.response?.data?.detail || 'Unable to parse this file. Try another format.');
    }
  };

  const autoConfigureForCurrentType = () => {
    if (!uploadData) return;
    setMapping(buildSmartMapping(uploadData.columns, fieldOptions[dataType]));
  };

  const autoImportAll = async () => {
    if (!uploadData || !selectedCompanyId) return;

    try {
      const detectedTypes = Object.keys(fieldOptions).filter((type) => {
        const smartMapping = buildSmartMapping(uploadData.columns, fieldOptions[type]);
        return Object.values(smartMapping).some(Boolean);
      });

      if (detectedTypes.length === 0) {
        window.alert('No matching ESG columns detected for automatic import.');
        return;
      }

      let importedTotal = 0;
      for (const type of detectedTypes) {
        const smartMapping = buildSmartMapping(uploadData.columns, fieldOptions[type]);
        const { data } = await api.post('/upload/import', {
          company_id: selectedCompanyId,
          month,
          year,
          data_type: type,
          rows: uploadData.rows,
          mapping: smartMapping,
        });
        importedTotal += Number(data?.imported_records || 0);
      }

      onDataUpdated?.();
      window.alert(`Auto import done for ${detectedTypes.join(', ')}. Imported rows: ${importedTotal}`);
    } catch (err) {
      window.alert(err?.response?.data?.detail || 'Automatic import failed.');
    }
  };

  const onDropFile = async (event) => {
    event.preventDefault();
    setIsDragActive(false);
    const dropped = event.dataTransfer?.files?.[0];
    if (dropped) {
      await handleFile(dropped);
    }
  };

  const importData = async () => {
    if (!uploadData) return;
    if (!selectedCompanyId) {
      window.alert('Select a company first');
      return;
    }

    try {
      const { data } = await api.post('/upload/import', {
        company_id: selectedCompanyId,
        month,
        year,
        data_type: dataType,
        rows: uploadData.rows,
        mapping,
      });
      onDataUpdated?.();
      window.alert(`Imported ${data.imported_records} records`);
    } catch (err) {
      window.alert(err?.response?.data?.detail || 'Import failed. Please check mapping and file values.');
    }
  };

  const saveSensor = async () => {
    await api.post('/sensors', {
      company_id: selectedCompanyId,
      ...sensorForm,
    });
    setSensorForm({ sensor_name: '', api_endpoint: '', api_key: '', data_type: 'carbon', is_active: true });
    loadSensors();
  };

  const options = useMemo(() => fieldOptions[dataType], [dataType]);

  useEffect(() => {
    if (!uploadData) return;
    setMapping(buildSmartMapping(uploadData.columns, fieldOptions[dataType]));
  }, [dataType, uploadData]);

  return (
    <div className="card">
      <h2>Data Input</h2>
      <div className="tab-row">
        {tabs.map((t) => (
          <button key={t} className={`tab ${tab === t ? 'tab-active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      <div className="row gap wrap">
        <CompanySelector companies={companies} value={selectedCompanyId} onChange={setSelectedCompanyId} />
        <input className="input" type="number" value={month} min={1} max={12} onChange={(e) => setMonth(Number(e.target.value))} placeholder="Month" />
        <input className="input" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} placeholder="Year" />
      </div>

      {tab === 'Manual Entry' && (
        <div className="stack-lg">
          <details open className="accordion"><summary>Environmental</summary>
            <div className="form-grid">{Object.keys(envForm).map((k) => <input key={k} className="input" placeholder={k} value={envForm[k]} onChange={(e) => setEnvForm((p) => ({ ...p, [k]: e.target.value }))} />)}</div>
          </details>
          <details open className="accordion"><summary>Social</summary>
            <div className="form-grid">{Object.keys(socialForm).map((k) => <input key={k} className="input" placeholder={k} value={socialForm[k]} onChange={(e) => setSocialForm((p) => ({ ...p, [k]: e.target.value }))} />)}</div>
          </details>
          <details open className="accordion"><summary>Governance</summary>
            <div className="form-grid">
              <input className="input" placeholder="board_members" value={govForm.board_members} onChange={(e) => setGovForm((p) => ({ ...p, board_members: e.target.value }))} />
              <input className="input" placeholder="independent_directors" value={govForm.independent_directors} onChange={(e) => setGovForm((p) => ({ ...p, independent_directors: e.target.value }))} />
              <input className="input" placeholder="audit_meetings" value={govForm.audit_meetings} onChange={(e) => setGovForm((p) => ({ ...p, audit_meetings: e.target.value }))} />
              <input className="input" placeholder="data_breaches" value={govForm.data_breaches} onChange={(e) => setGovForm((p) => ({ ...p, data_breaches: e.target.value }))} />
              <label className="toggle-row"><input type="checkbox" checked={govForm.has_whistleblower_policy} onChange={(e) => setGovForm((p) => ({ ...p, has_whistleblower_policy: e.target.checked }))} /> Whistleblower Policy</label>
            </div>
          </details>
          <button className="btn" onClick={saveManual}>Save Data</button>
        </div>
      )}

      {tab === 'File Upload' && (
        <div className="stack-lg">
          <div
            className={`upload-zone ${isDragActive ? 'upload-zone-active' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragActive(true);
            }}
            onDragLeave={() => setIsDragActive(false)}
            onDrop={onDropFile}
          >
            <input
              ref={fileInputRef}
              className="upload-file-input"
              type="file"
              accept={uploadAccept}
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <p className="upload-title">Drop your dataset here</p>
            <p className="upload-subtitle">CSV, TSV, TXT, Excel, JSON, JSONL</p>
            <button className="btn btn-light" onClick={() => fileInputRef.current?.click()}>Choose File</button>
            {uploadMeta.fileName && (
              <p className="upload-meta">{uploadMeta.fileName} | format: {uploadMeta.format} | rows: {uploadMeta.rows}</p>
            )}
            {uploadError && <p className="upload-error">{uploadError}</p>}
          </div>

          <div className="row gap wrap">
            <label>Detected Data Type</label>
            <div className="input">{dataType}</div>
            <button className="btn btn-light" onClick={autoConfigureForCurrentType}>Auto Map This Type</button>
            <button className="btn" onClick={autoImportAll}>Auto Import All</button>
          </div>

          {uploadData && (
            <>
              <h4>Column Mapping</h4>
              <div className="form-grid">
                {uploadData.columns.map((col) => (
                  <div key={col}>
                    <label>{col}</label>
                    <select className="input" value={mapping[col] || ''} onChange={(e) => setMapping((p) => ({ ...p, [col]: e.target.value }))}>
                      <option value="">Ignore</option>
                      {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <h4>Preview</h4>
              <div className="table-wrap">
                <table>
                  <thead><tr>{uploadData.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                  <tbody>
                    {(uploadData.preview_rows || uploadData.rows).slice(0, 6).map((row, idx) => (
                      <tr key={idx}>{uploadData.columns.map((c) => <td key={c}>{String(row[c])}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="btn" onClick={importData}>Confirm and Import</button>
            </>
          )}
        </div>
      )}

      {tab === 'Sensor Connect' && (
        <div className="stack-lg">
          <div className="form-grid">
            <input className="input" placeholder="Sensor Name" value={sensorForm.sensor_name} onChange={(e) => setSensorForm((p) => ({ ...p, sensor_name: e.target.value }))} />
            <input className="input" placeholder="API Endpoint URL" value={sensorForm.api_endpoint} onChange={(e) => setSensorForm((p) => ({ ...p, api_endpoint: e.target.value }))} />
            <input className="input" placeholder="API Key" value={sensorForm.api_key} onChange={(e) => setSensorForm((p) => ({ ...p, api_key: e.target.value }))} />
            <select className="input" value={sensorForm.data_type} onChange={(e) => setSensorForm((p) => ({ ...p, data_type: e.target.value }))}>
              <option value="carbon">carbon</option>
              <option value="energy">energy</option>
              <option value="water">water</option>
              <option value="waste">waste</option>
            </select>
          </div>
          <button className="btn" onClick={saveSensor}>Save Connection</button>

          <div className="table-wrap">
            <table>
              <thead><tr><th>Sensor</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {sensors.map((s) => (
                  <tr key={s.id}>
                    <td>{s.sensor_name}</td>
                    <td>{s.data_type}</td>
                    <td><span className={`dot ${s.is_active ? 'info' : 'critical'}`} /> {s.is_active ? 'active' : 'inactive'}</td>
                    <td className="row gap">
                      <button className="btn btn-light" onClick={() => api.post(`/sensors/test/${s.id}`).then(loadSensors)}>Test Connection</button>
                      <button
                        className="btn btn-light"
                        onClick={async () => {
                          await api.post(`/sensors/pull/${s.id}`);
                          onDataUpdated?.();
                        }}
                      >
                        Manual Pull Data
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default InputPage;
