import { useEffect, useMemo, useRef, useState } from 'react';
import CompanySelector from '../components/CompanySelector';
import api from '../services/api';

const tabs = ['Manual Entry', 'File Upload', 'Sensor Connect'];

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
  others: [],
};

const allTypedFields = ['environmental', 'social', 'governance'].flatMap((key) => fieldOptions[key]);
const fieldToType = allTypedFields.reduce((acc, field) => {
  if (fieldOptions.environmental.includes(field)) acc[field] = 'environmental';
  else if (fieldOptions.social.includes(field)) acc[field] = 'social';
  else if (fieldOptions.governance.includes(field)) acc[field] = 'governance';
  return acc;
}, {});

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

  const [sensorForm, setSensorForm] = useState({
    sensor_name: '',
    api_endpoint: '',
    api_key: '',
    data_type: 'carbon',
    is_active: true,
  });
  const [sensors, setSensors] = useState([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [autoImporting, setAutoImporting] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const fileInputRef = useRef(null);

  const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const autoDetectMapping = (columns, currentType) => {
    const byField = currentType === 'others' ? allTypedFields : fieldOptions[currentType];
    const aliases = {
      carbon_emissions_tonnes: ['carbon', 'co2', 'emission', 'carbonemissions'],
      energy_kwh: ['energy', 'electricity', 'kwh', 'power'],
      water_litres: ['water', 'litres', 'liter', 'waterusage'],
      waste_kg: ['waste', 'wastekg', 'solidwaste'],
      recycled_waste_kg: ['recycled', 'recycle', 'recycledwaste'],
      total_employees: ['employees', 'headcount', 'totalemployees'],
      female_employees: ['female', 'women', 'femaleemployees'],
      safety_incidents: ['safety', 'incidents', 'accidents'],
      training_hours: ['training', 'learninghours'],
      community_investment: ['community', 'csr', 'investment'],
      board_members: ['board', 'boardmembers'],
      independent_directors: ['independent', 'directors', 'independentdirectors'],
      audit_meetings: ['audit', 'meetings', 'auditmeetings'],
      has_whistleblower_policy: ['whistleblower', 'whistle', 'policy'],
      data_breaches: ['breach', 'breaches', 'databreach'],
    };

    const detected = {};
    columns.forEach((col) => {
      const cleanCol = normalize(col);
      let match = byField.find((field) => normalize(field) === cleanCol);
      if (!match) {
        match = byField.find((field) => (aliases[field] || []).some((alias) => cleanCol.includes(normalize(alias))));
      }
      detected[col] = match || '';
    });
    return detected;
  };

  const groupMappingsByType = (detectedMapping) => {
    const grouped = {
      environmental: {},
      social: {},
      governance: {},
    };
    Object.entries(detectedMapping || {}).forEach(([sourceCol, targetCol]) => {
      if (!targetCol) return;
      const type = fieldToType[targetCol];
      if (!type) return;
      grouped[type][sourceCol] = targetCol;
    });
    return grouped;
  };

  const findColumnByAlias = (columns, aliases) => {
    const normalizedAliases = aliases.map((a) => normalize(a));
    return columns.find((col) => {
      const clean = normalize(col);
      return normalizedAliases.some((alias) => clean.includes(alias));
    });
  };

  const inferCompanyId = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) {
      const byId = companies.find((c) => c.id === asNumber);
      if (byId) return byId.id;
    }
    const cleanValue = normalize(value);
    const byName = companies.find((c) => {
      const cleanName = normalize(c.name);
      return cleanName === cleanValue || cleanName.includes(cleanValue) || cleanValue.includes(cleanName);
    });
    return byName?.id ?? null;
  };

  const detectDataType = (columns) => {
    const types = ['environmental', 'social', 'governance'];
    const scoreByType = types.map((type) => {
      const mapped = autoDetectMapping(columns, type);
      const score = Object.values(mapped).filter(Boolean).length;
      return { type, score };
    });
    scoreByType.sort((a, b) => b.score - a.score);
    return scoreByType[0]?.score >= 2 ? scoreByType[0].type : 'others';
  };

  const detectUploadMeta = (columns, rows) => {
    const first = rows?.[0] || {};
    const monthCol = findColumnByAlias(columns, ['month', 'mnth', 'period_month']);
    const yearCol = findColumnByAlias(columns, ['year', 'yr', 'period_year']);
    const companyCol = findColumnByAlias(columns, ['company_id', 'companyid', 'company', 'organization', 'org']);

    const detectedMonth = monthCol ? Number(first[monthCol]) : null;
    const detectedYear = yearCol ? Number(first[yearCol]) : null;
    const detectedCompanyId = companyCol ? inferCompanyId(first[companyCol]) : null;

    return {
      month: detectedMonth >= 1 && detectedMonth <= 12 ? detectedMonth : null,
      year: Number.isFinite(detectedYear) && detectedYear >= 2000 ? detectedYear : null,
      companyId: detectedCompanyId,
    };
  };

  const applyAutoFill = (payload) => {
    if (payload?.environmental) {
      setEnvForm({
        carbon_emissions_tonnes: String(payload.environmental.carbon_emissions_tonnes ?? ''),
        energy_kwh: String(payload.environmental.energy_kwh ?? ''),
        water_litres: String(payload.environmental.water_litres ?? ''),
        waste_kg: String(payload.environmental.waste_kg ?? ''),
        recycled_waste_kg: String(payload.environmental.recycled_waste_kg ?? ''),
      });
    }
    if (payload?.social) {
      setSocialForm({
        total_employees: String(payload.social.total_employees ?? ''),
        female_employees: String(payload.social.female_employees ?? ''),
        safety_incidents: String(payload.social.safety_incidents ?? ''),
        training_hours: String(payload.social.training_hours ?? ''),
        community_investment: String(payload.social.community_investment ?? ''),
      });
    }
    if (payload?.governance) {
      setGovForm({
        board_members: String(payload.governance.board_members ?? ''),
        independent_directors: String(payload.governance.independent_directors ?? ''),
        audit_meetings: String(payload.governance.audit_meetings ?? ''),
        has_whistleblower_policy: Boolean(payload.governance.has_whistleblower_policy),
        data_breaches: String(payload.governance.data_breaches ?? ''),
      });
    }
  };

  const applySmartFillDefaults = () => {
    setEnvForm((prev) => {
      const waste = Number(prev.waste_kg || 0);
      return {
        ...prev,
        recycled_waste_kg: prev.recycled_waste_kg === '' && waste > 0 ? String(Math.round(waste * 0.6)) : prev.recycled_waste_kg,
      };
    });

    setSocialForm((prev) => {
      const total = Number(prev.total_employees || 0);
      return {
        ...prev,
        female_employees: prev.female_employees === '' && total > 0 ? String(Math.round(total * 0.4)) : prev.female_employees,
        training_hours: prev.training_hours === '' ? '40' : prev.training_hours,
        community_investment: prev.community_investment === '' && total > 0 ? String(total * 1000) : prev.community_investment,
      };
    });

    setGovForm((prev) => {
      const board = Number(prev.board_members || 0);
      return {
        ...prev,
        independent_directors: prev.independent_directors === '' && board > 0 ? String(Math.ceil(board * 0.5)) : prev.independent_directors,
        audit_meetings: prev.audit_meetings === '' ? '4' : prev.audit_meetings,
      };
    });

    setStatusMsg('Smart fill applied: missing values were auto-populated using ESG baseline assumptions.');
  };

  const syncEverything = async (companyId, targetMonth, targetYear, source) => {
    if (!companyId || !targetMonth || !targetYear) return;

    const startMonth = Math.max(1, targetMonth - 2);
    const startYear = targetYear;
    try {
      await Promise.all([
        api.get(`/scores/${companyId}`),
        api.get(`/alerts/${companyId}`),
        api.get('/auditor/submissions'),
        api.get(`/auditor/trail/${companyId}`),
        api.get(`/reports/history/${companyId}`),
        api.get(`/analytics/${companyId}`, {
          params: {
            start_month: startMonth,
            start_year: startYear,
            end_month: targetMonth,
            end_year: targetYear,
          },
        }),
      ]);
      await api.get(`/reports/generate/${companyId}/${targetMonth}/${targetYear}`, { responseType: 'blob' });
    } catch {
      // Soft-fail: the pages still refresh through the global data update event.
    }

    onDataUpdated?.({ companyId, month: targetMonth, year: targetYear, source });
  };

  const loadMonthlyData = async () => {
    if (!selectedCompanyId) return;
    try {
      const { data } = await api.get(`/data/monthly/${selectedCompanyId}`, {
        params: { month, year },
      });

      if (data?.has_data) {
        applyAutoFill(data);
        setStatusMsg(`Auto-filled from saved data for ${String(month).padStart(2, '0')}/${year}`);
        return;
      }

      const latest = await api.get(`/data/monthly/${selectedCompanyId}`);
      if (latest.data?.has_data) {
        applyAutoFill(latest.data);
        setStatusMsg(
          `No exact data for ${String(month).padStart(2, '0')}/${year}. Auto-filled using latest available ${String(latest.data.month).padStart(2, '0')}/${latest.data.year}.`
        );
      } else {
        setStatusMsg('No saved data found for this company yet.');
      }
    } catch {
      setStatusMsg('Could not auto-fill data for selected month/year.');
    }
  };

  const loadSensors = async () => {
    if (!selectedCompanyId) return;
    const { data } = await api.get(`/sensors/${selectedCompanyId}`);
    setSensors(data);
  };

  useEffect(() => {
    loadSensors();
  }, [selectedCompanyId]);

  useEffect(() => {
    loadMonthlyData();
  }, [selectedCompanyId, month, year]);

  useEffect(() => {
    if (uploadData) {
      setMapping(autoDetectMapping(uploadData.columns, dataType));
    }
  }, [dataType]);

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
    await loadMonthlyData();
    await syncEverything(selectedCompanyId, month, year, 'manual-entry');
    window.alert('Data saved and everything is auto-updated: dashboard, analytics, auditor, reports, and alerts.');
  };

  const executeImport = async ({ companyId, targetMonth, targetYear, detectedType, rows, detectedMapping, source }) => {
    if (!companyId || !targetMonth || !targetYear) {
      setStatusMsg('Auto-import paused: please confirm company, month, and year.');
      return;
    }
    let importedTotal = 0;
    if (detectedType === 'others') {
      const grouped = groupMappingsByType(detectedMapping);
      const importTargets = Object.entries(grouped).filter(([, mapObj]) => Object.keys(mapObj).length > 0);

      if (importTargets.length === 0) {
        const fallback = await api.post('/upload/import', {
          company_id: companyId,
          month: targetMonth,
          year: targetYear,
          data_type: 'others',
          rows,
          mapping: detectedMapping,
        });
        importedTotal = fallback.data?.imported_records || 0;
      } else {
        const results = await Promise.all(
          importTargets.map(([type, mapObj]) =>
            api.post('/upload/import', {
              company_id: companyId,
              month: targetMonth,
              year: targetYear,
              data_type: type,
              rows,
              mapping: mapObj,
            })
          )
        );
        importedTotal = results.reduce((sum, r) => sum + (r.data?.imported_records || 0), 0);
      }
    } else {
      const response = await api.post('/upload/import', {
        company_id: companyId,
        month: targetMonth,
        year: targetYear,
        data_type: detectedType,
        rows,
        mapping: detectedMapping,
      });
      importedTotal = response.data?.imported_records || 0;
    }

    await loadMonthlyData();
    await syncEverything(companyId, targetMonth, targetYear, source);
    setStatusMsg(`Auto-import completed: ${importedTotal} records processed and all modules synced.`);
  };

  const handleFile = async (file) => {
    if (!file) return;
    setSelectedFileName(file.name || '');
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post('/upload/csv', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    setUploadData(data);

    const detectedType = detectDataType(data.columns);
    const detectedMeta = detectUploadMeta(data.columns, data.rows || []);
    const targetCompanyId = detectedMeta.companyId || selectedCompanyId;
    const targetMonth = detectedMeta.month || month;
    const targetYear = detectedMeta.year || year;

    setDataType(detectedType);
    if (targetMonth) setMonth(targetMonth);
    if (targetYear) setYear(targetYear);
    if (detectedMeta.companyId) setSelectedCompanyId(detectedMeta.companyId);

    const detectedMapping = autoDetectMapping(data.columns, detectedType);
    setMapping(detectedMapping);

    const detectNotes = [
      `type=${detectedType}`,
      targetMonth ? `month=${targetMonth}` : null,
      targetYear ? `year=${targetYear}` : null,
      targetCompanyId ? `company_id=${targetCompanyId}` : null,
    ].filter(Boolean).join(', ');

    const mappedCount = Object.values(detectedMapping).filter(Boolean).length;
    const groupedForOthers = groupMappingsByType(detectedMapping);
    const othersDetectedGroups = ['environmental', 'social', 'governance'].filter((type) => Object.keys(groupedForOthers[type]).length > 0).length;
    const requiredFields = fieldOptions[detectedType]?.length || 0;
    const minimumMapped = requiredFields === 0 ? 0 : Math.max(2, Math.ceil(requiredFields * 0.5));
    const isOthersConfident = detectedType === 'others' && othersDetectedGroups >= 1;
    if (!targetCompanyId || (!isOthersConfident && mappedCount < minimumMapped)) {
      const reason = !targetCompanyId
        ? 'company could not be detected'
        : detectedType === 'others'
          ? "dataset does not match Environmental/Social/Governance fields"
          : 'detection confidence is low';
      setStatusMsg(`Upload detected automatically: ${detectNotes}. Auto-import paused because ${reason}, please review mapping and click Confirm and Import.`);
      return;
    }

    setAutoImporting(true);
    setStatusMsg(`Upload detected automatically: ${detectNotes}. Auto-import in progress...`);
    try {
      await executeImport({
        companyId: targetCompanyId,
        targetMonth,
        targetYear,
        detectedType,
        rows: data.rows,
        detectedMapping,
        source: 'file-auto-import',
      });
    } finally {
      setAutoImporting(false);
    }
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const onFileInputChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFile(file);
    }
    e.target.value = '';
  };

  const onUploadDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingFile) setIsDraggingFile(true);
  };

  const onUploadDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  };

  const onUploadDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      await handleFile(file);
    }
  };

  const onUploadZoneKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openFilePicker();
    }
  };

  const importData = async () => {
    if (!uploadData) return;
    await executeImport({
      companyId: selectedCompanyId,
      targetMonth: month,
      targetYear: year,
      detectedType: dataType,
      rows: uploadData.rows,
      detectedMapping: mapping,
      source: 'file-import',
    });
    window.alert('Import completed and everything is auto-updated: dashboard, analytics, auditor, reports, and alerts.');
  };

  const saveSensor = async () => {
    await api.post('/sensors', {
      company_id: selectedCompanyId,
      ...sensorForm,
    });
    setSensorForm({ sensor_name: '', api_endpoint: '', api_key: '', data_type: 'carbon', is_active: true });
    loadSensors();
  };

  const pullSensorData = async (sensorId) => {
    await api.post(`/sensors/pull/${sensorId}`);
    const now = new Date();
    setMonth(now.getMonth() + 1);
    setYear(now.getFullYear());
    await loadMonthlyData();
    await syncEverything(selectedCompanyId, now.getMonth() + 1, now.getFullYear(), 'sensor-pull');
    window.alert('Latest sensor data pulled and applied. All modules are now refreshed.');
  };

  const options = useMemo(() => (dataType === 'others' ? allTypedFields : fieldOptions[dataType]), [dataType]);

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
      {statusMsg && <p className="muted">{statusMsg}</p>}

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
          <button className="btn btn-light" onClick={applySmartFillDefaults}>Auto Fill Missing Values</button>
          <button className="btn" onClick={saveManual}>Save Data</button>
        </div>
      )}

      {tab === 'File Upload' && (
        <div className="stack-lg">
          <div
            className={`upload-zone ${isDraggingFile ? 'upload-zone-active' : ''}`}
            onDragOver={onUploadDragOver}
            onDragLeave={onUploadDragLeave}
            onDrop={onUploadDrop}
            onClick={openFilePicker}
            onKeyDown={onUploadZoneKeyDown}
            role="button"
            tabIndex={0}
            aria-label="Upload data file"
          >
            <input
              ref={fileInputRef}
              className="file-input-hidden"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={onFileInputChange}
            />
            <p>{isDraggingFile ? 'Drop file to upload' : 'Drag and drop CSV or Excel file, or click here to browse'}</p>
            {selectedFileName && <small className="muted">Selected: {selectedFileName}</small>}
          </div>

          <div className="row gap wrap">
            <label>Data Type</label>
            <select className="input" value={dataType} onChange={(e) => setDataType(e.target.value)}>
              <option value="environmental">Environmental</option>
              <option value="social">Social</option>
              <option value="governance">Governance</option>
              <option value="others">Others</option>
            </select>
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
                    {uploadData.rows.slice(0, 6).map((row, idx) => (
                      <tr key={idx}>{uploadData.columns.map((c) => <td key={c}>{String(row[c])}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="btn" onClick={importData} disabled={autoImporting}>{autoImporting ? 'Auto Importing...' : 'Confirm and Import'}</button>
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
                      <button className="btn btn-light" onClick={() => pullSensorData(s.id)}>Manual Pull Data</button>
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
