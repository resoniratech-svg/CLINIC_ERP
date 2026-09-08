-- Migration: Add Master Ailments table for Patient Problems & Homeopathy Complaints
CREATE TABLE IF NOT EXISTS master_ailments (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL UNIQUE,
    status      user_status DEFAULT 'active',
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Seed initial common ailments relevant to Homeopathy & General Clinic OPD
INSERT INTO master_ailments (name) VALUES
    ('Fever'),
    ('Cold, Cough & Flu'),
    ('Allergic Rhinitis / Sneezing'),
    ('Sinusitis & Nasal Block'),
    ('Bronchial Asthma'),
    ('Tonsillitis & Sore Throat'),
    ('Migraine & Chronic Headache'),
    ('Acidity, GERD & Heartburn'),
    ('Gastritis & Indigestion'),
    ('Constipation & Piles'),
    ('Irritable Bowel Syndrome (IBS)'),
    ('Rheumatoid Arthritis & Joint Pains'),
    ('Osteoarthritis'),
    ('Cervical & Lumbar Spondylosis'),
    ('Sciatica & Backache'),
    ('Skin Allergies & Urticaria'),
    ('Eczema & Atopic Dermatitis'),
    ('Psoriasis'),
    ('Fungal Infections & Ringworm'),
    ('Acne & Pimples'),
    ('Hair Fall & Alopecia'),
    ('Dandruff & Scalp Conditions'),
    ('Anxiety, Stress & Insomnia'),
    ('Depression & Mood Swings'),
    ('PCOS / PCOD & Irregular Menses'),
    ('Thyroid Disorders (Hypo/Hyper)'),
    ('Renal Calculi (Kidney Stones)'),
    ('Urinary Tract Infection (UTI)'),
    ('Hypertension (High BP)'),
    ('General Weakness & Fatigue')
ON CONFLICT (name) DO NOTHING;
