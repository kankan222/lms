ALTER TABLE fee_installments
  ADD COLUMN fee_mode ENUM('amount_based','status_only') NOT NULL DEFAULT 'amount_based'
  AFTER installment_name;

ALTER TABLE student_fees
  ADD COLUMN fee_mode ENUM('amount_based','status_only') NOT NULL DEFAULT 'amount_based'
  AFTER fee_type;
