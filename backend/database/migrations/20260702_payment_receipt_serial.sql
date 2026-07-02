ALTER TABLE payments
  ADD COLUMN receipt_serial VARCHAR(50) NULL AFTER id,
  ADD UNIQUE KEY uq_payments_receipt_serial (receipt_serial);

UPDATE payments
SET receipt_serial = CONCAT('PAY-', LPAD(id, 6, '0'))
WHERE receipt_serial IS NULL;
