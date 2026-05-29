-- Add foreign key constraint for master.matched_mandate_id
ALTER TABLE master
ADD CONSTRAINT fk_master_matched_mandate
FOREIGN KEY (matched_mandate_id)
REFERENCES mandates(id)
ON DELETE SET NULL;