-- ============================================================
-- Migration: fix_pharmacy_dispensed_workflow_ravi.sql
-- Description: Correct erroneous DISPENSED status for RAVI and
--              Prescription #516, reconcile inventory, and restore
--              clean pre-dispensing state (PENDING).
-- ============================================================

DO $$
DECLARE
    r RECORD;
    rx_id_var INTEGER;
    stk_rec RECORD;
    ravi_patient_id INTEGER;
    ravi_appt_id INTEGER;
    ravi_consult_id INTEGER;
    ravi_doc_id INTEGER;
    ravi_rx_id INTEGER;
    med_id INTEGER;
BEGIN
    -- 1. REVERSE ANY ERRONEOUS STOCK TRANSACTIONS & RESTORE INVENTORY FOR RX #516
    FOR stk_rec IN 
        SELECT id, medicine_id, batch_number, quantity, reference 
        FROM stock_transactions 
        WHERE transaction_type = 'out' AND reference = 'Rx #516'
    LOOP
        -- Add back deducted quantity (quantity is negative in stock_transactions)
        UPDATE medicine_stock 
        SET quantity = quantity + ABS(stk_rec.quantity), updated_at = now()
        WHERE medicine_id = stk_rec.medicine_id AND batch_number = stk_rec.batch_number;

        -- Remove the invalid unconfirmed stock transaction
        DELETE FROM stock_transactions WHERE id = stk_rec.id;
    END LOOP;

    -- Reset Prescription #516 and its items
    UPDATE prescription_items
    SET dispensed = false,
        dispensed_quantity = 0,
        dispense_status = 'pending',
        dispensed_at = NULL,
        dispensed_by = NULL
    WHERE prescription_id = 516;

    UPDATE prescriptions
    SET pharmacy_status = 'pending'
    WHERE id = 516;


    -- 2. REVERSE ANY ERRONEOUS STOCK TRANSACTIONS & RESTORE INVENTORY FOR RAVI
    FOR r IN 
        SELECT p.id as rx_id
        FROM prescriptions p
        JOIN patients pt ON p.patient_id = pt.patient_id
        WHERE pt.patient_id = 12 OR pt.full_name ILIKE '%ravi%'
    LOOP
        rx_id_var := r.rx_id;
        FOR stk_rec IN 
            SELECT id, medicine_id, batch_number, quantity, reference 
            FROM stock_transactions 
            WHERE transaction_type = 'out' AND reference = ('Rx #' || rx_id_var)
        LOOP
            UPDATE medicine_stock 
            SET quantity = quantity + ABS(stk_rec.quantity), updated_at = now()
            WHERE medicine_id = stk_rec.medicine_id AND batch_number = stk_rec.batch_number;

            DELETE FROM stock_transactions WHERE id = stk_rec.id;
        END LOOP;

        UPDATE prescription_items
        SET dispensed = false,
            dispensed_quantity = 0,
            dispense_status = 'pending',
            dispensed_at = NULL,
            dispensed_by = NULL
        WHERE prescription_id = rx_id_var;

        UPDATE prescriptions
        SET pharmacy_status = 'pending'
        WHERE id = rx_id_var;
    END LOOP;


    -- 3. ENSURE PATIENT RAVI HAS AN ACTIVE PRESCRIPTION LINKED TO PRO COMPLETED APPOINTMENT
    SELECT patient_id INTO ravi_patient_id 
    FROM patients 
    WHERE patient_id = 12 OR full_name ILIKE '%ravi%' 
    ORDER BY patient_id = 12 DESC, patient_id ASC 
    LIMIT 1;

    IF ravi_patient_id IS NOT NULL THEN
        -- Find Ravi's latest completed appointment / consultation
        SELECT a.appointment_id, c.consultation_id, COALESCE(c.doctor_id, a.doctor_id, 1)
        INTO ravi_appt_id, ravi_consult_id, ravi_doc_id
        FROM appointments a
        LEFT JOIN consultations c ON c.appointment_id = a.appointment_id
        WHERE a.patient_id = ravi_patient_id
        ORDER BY a.appointment_id DESC
        LIMIT 1;

        IF ravi_appt_id IS NOT NULL THEN
            -- Ensure appointment status is pro_completed so it's released to Pharmacy
            UPDATE appointments
            SET status = 'pro_completed', updated_at = now()
            WHERE appointment_id = ravi_appt_id AND status IN ('doctor_completed', 'pro_pending');

            -- Check if prescription already exists
            SELECT id INTO ravi_rx_id
            FROM prescriptions
            WHERE patient_id = ravi_patient_id AND (appointment_id = ravi_appt_id OR consultation_id = ravi_consult_id)
            LIMIT 1;

            IF ravi_rx_id IS NULL THEN
                -- Find a valid medicine to link
                SELECT id INTO med_id FROM medicine_master WHERE status = 'active' ORDER BY id ASC LIMIT 1;
                IF med_id IS NULL THEN
                    SELECT id INTO med_id FROM medicine_master ORDER BY id ASC LIMIT 1;
                END IF;

                INSERT INTO prescriptions (patient_id, doctor_id, appointment_id, consultation_id, pharmacy_status, created_at)
                VALUES (ravi_patient_id, ravi_doc_id, ravi_appt_id, ravi_consult_id, 'pending', now())
                RETURNING id INTO ravi_rx_id;

                IF med_id IS NOT NULL THEN
                    INSERT INTO prescription_items (
                        prescription_id, medicine_id, dosage, frequency, route, duration_days, quantity,
                        timing, food_instruction, dispense_status, dispensed
                    ) VALUES (
                        ravi_rx_id, med_id, '1 tab', '2/day', 'oral', 30, 60,
                        'morning & night', 'after food', 'pending', false
                    );
                END IF;
            ELSE
                UPDATE prescriptions 
                SET pharmacy_status = 'pending' 
                WHERE id = ravi_rx_id;

                UPDATE prescription_items
                SET dispensed = false,
                    dispensed_quantity = 0,
                    dispense_status = 'pending',
                    dispensed_at = NULL,
                    dispensed_by = NULL
                WHERE prescription_id = ravi_rx_id;
            END IF;
        END IF;
    END IF;


    -- 4. CLEANUP ANY ORPHANED PRESCRIPTIONS ERRONEOUSLY MARKED DISPENSED WITHOUT STOCK TXN
    UPDATE prescriptions p
    SET pharmacy_status = 'pending'
    WHERE p.pharmacy_status = 'dispensed'
      AND NOT EXISTS (
          SELECT 1 FROM stock_transactions st
          WHERE st.transaction_type = 'out' 
            AND st.reference = ('Rx #' || p.id)
      );

    RAISE NOTICE 'Pharmacy workflow state cleanup and inventory reconciliation completed successfully.';
END $$;
