-- Migration: Add serial_number to medicine_master
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'medicine_master' 
          AND column_name = 'serial_number'
    ) THEN
        ALTER TABLE medicine_master ADD COLUMN serial_number VARCHAR(50);
        
        -- Backfill existing medicines with sequential serial numbers
        WITH numbered AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY id ASC) as row_num
            FROM medicine_master
        )
        UPDATE medicine_master mm
        SET serial_number = 'MED-' || LPAD(numbered.row_num::text, 5, '0')
        FROM numbered
        WHERE mm.id = numbered.id;

        ALTER TABLE medicine_master ADD CONSTRAINT uq_medicine_master_serial UNIQUE (serial_number);
    END IF;
END $$;
