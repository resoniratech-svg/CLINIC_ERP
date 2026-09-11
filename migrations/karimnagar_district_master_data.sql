-- Migration: karimnagar_district_master_data.sql
-- Purpose: Complete official Karimnagar district master registry (16 Mandals & 198 Villages)
-- Idempotent upsert: Safe to run multiple times without duplicating or corrupting existing records.

-- 1. Ensure master_mandals and master_villages tables exist
CREATE TABLE IF NOT EXISTS master_mandals (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    status user_status DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS master_villages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    mandal_id INTEGER,
    status user_status DEFAULT 'active'
);

-- 2. Clean up any historical variants to official naming
DO $$
BEGIN
    -- Rename Pothugal to Pothugal (Submerged) under Karimnagar mandal
    UPDATE master_villages SET name = 'Pothugal (Submerged)'
    WHERE LOWER(TRIM(name)) = 'pothugal' 
      AND mandal_id IN (SELECT id FROM master_mandals WHERE LOWER(TRIM(name)) = 'karimnagar');

    -- Rename Hasnapur to Hasnapur (Submerged) under Karimnagar mandal
    UPDATE master_villages SET name = 'Hasnapur (Submerged)'
    WHERE LOWER(TRIM(name)) = 'hasnapur' 
      AND mandal_id IN (SELECT id FROM master_mandals WHERE LOWER(TRIM(name)) = 'karimnagar');

    -- Rename UpparaMallial to Uppara Mallial under Gangadhara mandal
    UPDATE master_villages SET name = 'Uppara Mallial'
    WHERE LOWER(TRIM(name)) = 'upparamallial' 
      AND mandal_id IN (SELECT id FROM master_mandals WHERE LOWER(TRIM(name)) = 'gangadhara');
END $$;

-- 3. Idempotent Mandals & Villages Upsert
DO $$
DECLARE
    v_mandal_id INTEGER;
BEGIN

    -- Mandal: Karimnagar
    SELECT id INTO v_mandal_id FROM master_mandals WHERE LOWER(TRIM(name)) = LOWER(TRIM('Karimnagar')) LIMIT 1;
    IF v_mandal_id IS NULL THEN
        INSERT INTO master_mandals (name, status) VALUES ('Karimnagar', 'active') RETURNING id INTO v_mandal_id;
    ELSE
        UPDATE master_mandals SET status = 'active' WHERE id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Karimnagar')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Karimnagar', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Karimnagar')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Pothugal (Submerged)')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Pothugal (Submerged)', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Pothugal (Submerged)')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Hasnapur (Submerged)')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Hasnapur (Submerged)', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Hasnapur (Submerged)')) AND mandal_id = v_mandal_id;
    END IF;

    -- Mandal: Kothapally
    SELECT id INTO v_mandal_id FROM master_mandals WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kothapally')) LIMIT 1;
    IF v_mandal_id IS NULL THEN
        INSERT INTO master_mandals (name, status) VALUES ('Kothapally', 'active') RETURNING id INTO v_mandal_id;
    ELSE
        UPDATE master_mandals SET status = 'active' WHERE id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Malkapur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Malkapur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Malkapur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kothapalli (Haveli)')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Kothapalli (Haveli)', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kothapalli (Haveli)')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Laxmipur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Laxmipur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Laxmipur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Sitarampur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Sitarampur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Sitarampur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Rekurthi')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Rekurthi', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Rekurthi')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Nagulamallial')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Nagulamallial', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Nagulamallial')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Chinthakunta')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Chinthakunta', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Chinthakunta')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Khazipur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Khazipur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Khazipur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Asifnagar')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Asifnagar', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Asifnagar')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Elgandal')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Elgandal', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Elgandal')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Baddipalli')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Baddipalli', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Baddipalli')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kamanpur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Kamanpur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kamanpur')) AND mandal_id = v_mandal_id;
    END IF;

    -- Mandal: Karimnagar Rural
    SELECT id INTO v_mandal_id FROM master_mandals WHERE LOWER(TRIM(name)) = LOWER(TRIM('Karimnagar Rural')) LIMIT 1;
    IF v_mandal_id IS NULL THEN
        INSERT INTO master_mandals (name, status) VALUES ('Karimnagar Rural', 'active') RETURNING id INTO v_mandal_id;
    ELSE
        UPDATE master_mandals SET status = 'active' WHERE id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Nagunur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Nagunur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Nagunur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Jublinagar')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Jublinagar', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Jublinagar')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Fakeerpet')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Fakeerpet', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Fakeerpet')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Chamanpalli')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Chamanpalli', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Chamanpalli')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Taharakondapur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Taharakondapur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Taharakondapur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Cherlabuthkur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Cherlabuthkur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Cherlabuthkur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Maqdumpur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Maqdumpur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Maqdumpur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Irukulla')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Irukulla', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Irukulla')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Elbotharam')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Elbotharam', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Elbotharam')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Vallampahad')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Vallampahad', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Vallampahad')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Durshed')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Durshed', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Durshed')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Chegurthi')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Chegurthi', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Chegurthi')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Bommakal')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Bommakal', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Bommakal')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Arepalli')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Arepalli', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Arepalli')) AND mandal_id = v_mandal_id;
    END IF;

    -- Mandal: Manakondur
    SELECT id INTO v_mandal_id FROM master_mandals WHERE LOWER(TRIM(name)) = LOWER(TRIM('Manakondur')) LIMIT 1;
    IF v_mandal_id IS NULL THEN
        INSERT INTO master_mandals (name, status) VALUES ('Manakondur', 'active') RETURNING id INTO v_mandal_id;
    ELSE
        UPDATE master_mandals SET status = 'active' WHERE id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Lingapur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Lingapur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Lingapur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Veldi')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Veldi', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Veldi')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Vegurupalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Vegurupalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Vegurupalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Utoor')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Utoor', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Utoor')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Pachunur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Pachunur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Pachunur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Maddikunta')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Maddikunta', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Maddikunta')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kelledu')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Kelledu', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kelledu')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Devampalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Devampalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Devampalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Lalithapur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Lalithapur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Lalithapur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Annaram')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Annaram', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Annaram')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Manakondur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Manakondur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Manakondur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Munjampalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Munjampalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Munjampalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Edulagattepalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Edulagattepalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Edulagattepalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Chenjerla')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Chenjerla', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Chenjerla')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Gattududdenapalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Gattududdenapalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Gattududdenapalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Vannaram')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Vannaram', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Vannaram')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Gangipalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Gangipalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Gangipalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kondapalkala')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Kondapalkala', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kondapalkala')) AND mandal_id = v_mandal_id;
    END IF;

    -- Mandal: Thimmapur
    SELECT id INTO v_mandal_id FROM master_mandals WHERE LOWER(TRIM(name)) = LOWER(TRIM('Thimmapur')) LIMIT 1;
    IF v_mandal_id IS NULL THEN
        INSERT INTO master_mandals (name, status) VALUES ('Thimmapur', 'active') RETURNING id INTO v_mandal_id;
    ELSE
        UPDATE master_mandals SET status = 'active' WHERE id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Vachunur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Vachunur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Vachunur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Thimmapur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Thimmapur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Thimmapur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Porandla')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Porandla', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Porandla')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Mannempalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Mannempalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Mannempalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Nustulapur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Nustulapur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Nustulapur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Nedunur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Nedunur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Nedunur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Renikunta')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Renikunta', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Renikunta')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kothapalle (P.N)')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Kothapalle (P.N)', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kothapalle (P.N)')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Nallagonda')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Nallagonda', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Nallagonda')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Mallapur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Mallapur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Mallapur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Polampalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Polampalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Polampalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Parlapalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Parlapalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Parlapalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Mogilipalem')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Mogilipalem', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Mogilipalem')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Alugunur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Alugunur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Alugunur')) AND mandal_id = v_mandal_id;
    END IF;

    -- Mandal: Ganneruvaram
    SELECT id INTO v_mandal_id FROM master_mandals WHERE LOWER(TRIM(name)) = LOWER(TRIM('Ganneruvaram')) LIMIT 1;
    IF v_mandal_id IS NULL THEN
        INSERT INTO master_mandals (name, status) VALUES ('Ganneruvaram', 'active') RETURNING id INTO v_mandal_id;
    ELSE
        UPDATE master_mandals SET status = 'active' WHERE id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Ganneruvaram')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Ganneruvaram', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Ganneruvaram')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Paruvella')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Paruvella', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Paruvella')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kashimpet')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Kashimpet', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kashimpet')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Madhapur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Madhapur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Madhapur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Mailaram')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Mailaram', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Mailaram')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Jangapalli')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Jangapalli', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Jangapalli')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Sangem')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Sangem', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Sangem')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Gopalpur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Gopalpur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Gopalpur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Gunukula Kondapur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Gunukula Kondapur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Gunukula Kondapur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Yaswada')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Yaswada', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Yaswada')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Panthul Kondapur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Panthul Kondapur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Panthul Kondapur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Cherlapur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Cherlapur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Cherlapur')) AND mandal_id = v_mandal_id;
    END IF;

    -- Mandal: Gangadhara
    SELECT id INTO v_mandal_id FROM master_mandals WHERE LOWER(TRIM(name)) = LOWER(TRIM('Gangadhara')) LIMIT 1;
    IF v_mandal_id IS NULL THEN
        INSERT INTO master_mandals (name, status) VALUES ('Gangadhara', 'active') RETURNING id INTO v_mandal_id;
    ELSE
        UPDATE master_mandals SET status = 'active' WHERE id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Venkataipalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Venkataipalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Venkataipalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Ryalapalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Ryalapalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Ryalapalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kachireddipalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Kachireddipalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kachireddipalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kondaipalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Kondaipalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kondaipalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Burgupalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Burgupalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Burgupalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Narasimhulapalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Narasimhulapalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Narasimhulapalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Sarvareddipalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Sarvareddipalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Sarvareddipalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Nagireddipur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Nagireddipur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Nagireddipur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Gangadhara')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Gangadhara', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Gangadhara')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Narayanpur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Narayanpur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Narayanpur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Islampur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Islampur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Islampur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Mallapur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Mallapur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Mallapur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Uppara Mallial')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Uppara Mallial', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Uppara Mallial')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kurikial')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Kurikial', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kurikial')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Nyalakondapalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Nyalakondapalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Nyalakondapalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Gattuboothkur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Gattuboothkur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Gattuboothkur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Garsekurthi')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Garsekurthi', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Garsekurthi')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Achampalli')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Achampalli', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Achampalli')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Oddyaram')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Oddyaram', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Oddyaram')) AND mandal_id = v_mandal_id;
    END IF;

    -- Mandal: Ramadugu
    SELECT id INTO v_mandal_id FROM master_mandals WHERE LOWER(TRIM(name)) = LOWER(TRIM('Ramadugu')) LIMIT 1;
    IF v_mandal_id IS NULL THEN
        INSERT INTO master_mandals (name, status) VALUES ('Ramadugu', 'active') RETURNING id INTO v_mandal_id;
    ELSE
        UPDATE master_mandals SET status = 'active' WHERE id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Thirmalapur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Thirmalapur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Thirmalapur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Sriramulapalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Sriramulapalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Sriramulapalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Chippakurthi')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Chippakurthi', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Chippakurthi')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Gundi')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Gundi', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Gundi')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Laxmipur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Laxmipur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Laxmipur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Dathojipet')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Dathojipet', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Dathojipet')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Ramadugu')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Ramadugu', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Ramadugu')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Shanagar')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Shanagar', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Shanagar')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Fakeerpet')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Fakeerpet', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Fakeerpet')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Gopalraopet')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Gopalraopet', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Gopalraopet')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Koratpalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Koratpalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Koratpalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Rudraram')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Rudraram', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Rudraram')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Mothe')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Mothe', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Mothe')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kistapur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Kistapur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kistapur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Vedira')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Vedira', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Vedira')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Velichal')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Velichal', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Velichal')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Deshrajpalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Deshrajpalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Deshrajpalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kokkerakunta')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Kokkerakunta', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kokkerakunta')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Vannaram')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Vannaram', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Vannaram')) AND mandal_id = v_mandal_id;
    END IF;

    -- Mandal: Choppadandi
    SELECT id INTO v_mandal_id FROM master_mandals WHERE LOWER(TRIM(name)) = LOWER(TRIM('Choppadandi')) LIMIT 1;
    IF v_mandal_id IS NULL THEN
        INSERT INTO master_mandals (name, status) VALUES ('Choppadandi', 'active') RETURNING id INTO v_mandal_id;
    ELSE
        UPDATE master_mandals SET status = 'active' WHERE id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Ragampeta')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Ragampeta', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Ragampeta')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Chityalpalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Chityalpalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Chityalpalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Arnakonda')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Arnakonda', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Arnakonda')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Choppadandi')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Choppadandi', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Choppadandi')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Gumlapur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Gumlapur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Gumlapur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Katnepalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Katnepalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Katnepalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Konerupalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Konerupalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Konerupalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Rukmapur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Rukmapur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Rukmapur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kolimikunta')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Kolimikunta', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kolimikunta')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Chakunta')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Chakunta', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Chakunta')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Vedurughattu')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Vedurughattu', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Vedurughattu')) AND mandal_id = v_mandal_id;
    END IF;

    -- Mandal: Chigurumamidi
    SELECT id INTO v_mandal_id FROM master_mandals WHERE LOWER(TRIM(name)) = LOWER(TRIM('Chigurumamidi')) LIMIT 1;
    IF v_mandal_id IS NULL THEN
        INSERT INTO master_mandals (name, status) VALUES ('Chigurumamidi', 'active') RETURNING id INTO v_mandal_id;
    ELSE
        UPDATE master_mandals SET status = 'active' WHERE id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Mudimanikyam')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Mudimanikyam', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Mudimanikyam')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Ramancha')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Ramancha', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Ramancha')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Mulkanoor')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Mulkanoor', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Mulkanoor')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Chigurumamidi')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Chigurumamidi', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Chigurumamidi')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Rekonda')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Rekonda', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Rekonda')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Bommanapalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Bommanapalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Bommanapalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Sundaragiri')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Sundaragiri', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Sundaragiri')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Indurthi')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Indurthi', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Indurthi')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Nawabpeta')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Nawabpeta', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Nawabpeta')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kondapur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Kondapur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kondapur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Ullampalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Ullampalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Ullampalle')) AND mandal_id = v_mandal_id;
    END IF;

    -- Mandal: Veenavanka
    SELECT id INTO v_mandal_id FROM master_mandals WHERE LOWER(TRIM(name)) = LOWER(TRIM('Veenavanka')) LIMIT 1;
    IF v_mandal_id IS NULL THEN
        INSERT INTO master_mandals (name, status) VALUES ('Veenavanka', 'active') RETURNING id INTO v_mandal_id;
    ELSE
        UPDATE master_mandals SET status = 'active' WHERE id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Mamidalapalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Mamidalapalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Mamidalapalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Elbaka')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Elbaka', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Elbaka')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Bonthupalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Bonthupalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Bonthupalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Challoor')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Challoor', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Challoor')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Ghanmukula')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Ghanmukula', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Ghanmukula')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Korkal (Jangampalle)')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Korkal (Jangampalle)', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Korkal (Jangampalle)')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kondapaka')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Kondapaka', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kondapaka')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Pothireddipalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Pothireddipalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Pothireddipalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Reddipalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Reddipalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Reddipalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Brahmanpalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Brahmanpalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Brahmanpalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Veenavanka')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Veenavanka', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Veenavanka')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kanparthi')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Kanparthi', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kanparthi')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Bethigal')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Bethigal', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Bethigal')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Valbapur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Valbapur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Valbapur')) AND mandal_id = v_mandal_id;
    END IF;

    -- Mandal: V. Saidapur
    SELECT id INTO v_mandal_id FROM master_mandals WHERE LOWER(TRIM(name)) = LOWER(TRIM('V. Saidapur')) LIMIT 1;
    IF v_mandal_id IS NULL THEN
        INSERT INTO master_mandals (name, status) VALUES ('V. Saidapur', 'active') RETURNING id INTO v_mandal_id;
    ELSE
        UPDATE master_mandals SET status = 'active' WHERE id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Eklaspur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Eklaspur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Eklaspur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Somaram')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Somaram', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Somaram')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Vennampalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Vennampalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Vennampalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Ramchandrapur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Ramchandrapur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Ramchandrapur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Elabotharam')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Elabotharam', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Elabotharam')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Godisala')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Godisala', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Godisala')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Saidapur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Saidapur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Saidapur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Venkepalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Venkepalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Venkepalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Duddenapalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Duddenapalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Duddenapalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Akunur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Akunur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Akunur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Ghanpur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Ghanpur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Ghanpur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Raikal')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Raikal', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Raikal')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Bommakal')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Bommakal', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Bommakal')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Ammanagurthi')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Ammanagurthi', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Ammanagurthi')) AND mandal_id = v_mandal_id;
    END IF;

    -- Mandal: Shankarapatnam
    SELECT id INTO v_mandal_id FROM master_mandals WHERE LOWER(TRIM(name)) = LOWER(TRIM('Shankarapatnam')) LIMIT 1;
    IF v_mandal_id IS NULL THEN
        INSERT INTO master_mandals (name, status) VALUES ('Shankarapatnam', 'active') RETURNING id INTO v_mandal_id;
    ELSE
        UPDATE master_mandals SET status = 'active' WHERE id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Yeradpalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Yeradpalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Yeradpalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Arkandla')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Arkandla', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Arkandla')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Gaddapaka')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Gaddapaka', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Gaddapaka')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kalvala')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Kalvala', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kalvala')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kachapur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Kachapur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kachapur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Rajapur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Rajapur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Rajapur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Dharmaram')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Dharmaram', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Dharmaram')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kannapur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Kannapur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kannapur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Mutharam')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Mutharam', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Mutharam')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Thadikal')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Thadikal', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Thadikal')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Ambalpur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Ambalpur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Ambalpur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kareempet')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Kareempet', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kareempet')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Keshavapatnam')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Keshavapatnam', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Keshavapatnam')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kothagattu')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Kothagattu', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kothagattu')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Molangur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Molangur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Molangur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Amudalapalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Amudalapalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Amudalapalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Metpalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Metpalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Metpalle')) AND mandal_id = v_mandal_id;
    END IF;

    -- Mandal: Huzurabad
    SELECT id INTO v_mandal_id FROM master_mandals WHERE LOWER(TRIM(name)) = LOWER(TRIM('Huzurabad')) LIMIT 1;
    IF v_mandal_id IS NULL THEN
        INSERT INTO master_mandals (name, status) VALUES ('Huzurabad', 'active') RETURNING id INTO v_mandal_id;
    ELSE
        UPDATE master_mandals SET status = 'active' WHERE id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Singapur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Singapur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Singapur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Sirsapalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Sirsapalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Sirsapalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Pothireddipet')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Pothireddipet', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Pothireddipet')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Chelpur')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Chelpur', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Chelpur')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Jupaka')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Jupaka', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Jupaka')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Huzurabad')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Huzurabad', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Huzurabad')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Thummanapalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Thummanapalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Thummanapalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Bornapalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Bornapalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Bornapalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Katrepalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Katrepalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Katrepalle')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kandugula')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Kandugula', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kandugula')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kanukulagidda')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Kanukulagidda', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kanukulagidda')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Dharmarajupalle')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Dharmarajupalle', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Dharmarajupalle')) AND mandal_id = v_mandal_id;
    END IF;

    -- Mandal: Jammikunta
    SELECT id INTO v_mandal_id FROM master_mandals WHERE LOWER(TRIM(name)) = LOWER(TRIM('Jammikunta')) LIMIT 1;
    IF v_mandal_id IS NULL THEN
        INSERT INTO master_mandals (name, status) VALUES ('Jammikunta', 'active') RETURNING id INTO v_mandal_id;
    ELSE
        UPDATE master_mandals SET status = 'active' WHERE id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Jammikunta')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Jammikunta', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Jammikunta')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Korapalli')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Korapalli', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Korapalli')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Saidabad')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Saidabad', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Saidabad')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Vilasagar')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Vilasagar', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Vilasagar')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Thanugula')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Thanugula', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Thanugula')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Bijigirisharif')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Bijigirisharif', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Bijigirisharif')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Vavilala')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Vavilala', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Vavilala')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Dharmaram (P_B)')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Dharmaram (P_B)', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Dharmaram (P_B)')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Madipalli')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Madipalli', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Madipalli')) AND mandal_id = v_mandal_id;
    END IF;

    -- Mandal: Ellandakunta
    SELECT id INTO v_mandal_id FROM master_mandals WHERE LOWER(TRIM(name)) = LOWER(TRIM('Ellandakunta')) LIMIT 1;
    IF v_mandal_id IS NULL THEN
        INSERT INTO master_mandals (name, status) VALUES ('Ellandakunta', 'active') RETURNING id INTO v_mandal_id;
    ELSE
        UPDATE master_mandals SET status = 'active' WHERE id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Ellandakunta')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Ellandakunta', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Ellandakunta')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Chinnakomatpalli')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Chinnakomatpalli', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Chinnakomatpalli')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Vanthadupula')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Vanthadupula', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Vanthadupula')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Bujunoor')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Bujunoor', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Bujunoor')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Rachapalli')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Rachapalli', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Rachapalli')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Tekurthy')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Tekurthy', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Tekurthy')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Sirsed')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Sirsed', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Sirsed')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Patharlapalli')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Patharlapalli', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Patharlapalli')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Mallial')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Mallial', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Mallial')) AND mandal_id = v_mandal_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM master_villages 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kanagarthy')) AND mandal_id = v_mandal_id
    ) THEN
        INSERT INTO master_villages (name, mandal_id, status) VALUES ('Kanagarthy', v_mandal_id, 'active');
    ELSE
        UPDATE master_villages SET status = 'active' 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM('Kanagarthy')) AND mandal_id = v_mandal_id;
    END IF;

END $$;

-- 4. Create helpful composite indexes if not present
CREATE INDEX IF NOT EXISTS idx_master_villages_mandal_id ON master_villages(mandal_id);
CREATE INDEX IF NOT EXISTS idx_master_villages_lower_name ON master_villages(LOWER(TRIM(name)));
CREATE INDEX IF NOT EXISTS idx_master_mandals_lower_name ON master_mandals(LOWER(TRIM(name)));
