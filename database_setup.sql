CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    industry VARCHAR(150) NOT NULL,
    size INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS environmental_data (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    carbon_emissions_tonnes DOUBLE PRECISION NOT NULL,
    energy_kwh DOUBLE PRECISION NOT NULL,
    water_litres DOUBLE PRECISION NOT NULL,
    waste_kg DOUBLE PRECISION NOT NULL,
    recycled_waste_kg DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, month, year)
);

CREATE TABLE IF NOT EXISTS social_data (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    total_employees INTEGER NOT NULL,
    female_employees INTEGER NOT NULL,
    safety_incidents INTEGER NOT NULL,
    training_hours DOUBLE PRECISION NOT NULL,
    community_investment DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, month, year)
);

CREATE TABLE IF NOT EXISTS governance_data (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    board_members INTEGER NOT NULL,
    independent_directors INTEGER NOT NULL,
    audit_meetings INTEGER NOT NULL,
    has_whistleblower_policy BOOLEAN NOT NULL,
    data_breaches INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, month, year)
);

CREATE TABLE IF NOT EXISTS auditor_comments (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    data_type VARCHAR(50) NOT NULL,
    data_id INTEGER NOT NULL,
    comment TEXT NOT NULL,
    flagged BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sensor_connections (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    sensor_name VARCHAR(150) NOT NULL,
    api_endpoint VARCHAR(600) NOT NULL,
    api_key VARCHAR(255) NOT NULL,
    data_type VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Supporting tables required for auditor workflow, report history and alerts.
CREATE TABLE IF NOT EXISTS submissions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    data_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    submission_date TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS generated_reports (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    generated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    severity VARCHAR(20) NOT NULL,
    message VARCHAR(600) NOT NULL,
    source_key VARCHAR(255) NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(company_id, source_key)
);
