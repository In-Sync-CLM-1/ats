-- Add foreign key constraint for candidates.matched_mandate_id
ALTER TABLE candidates
ADD CONSTRAINT fk_candidates_matched_mandate
FOREIGN KEY (matched_mandate_id)
REFERENCES mandates(id)
ON DELETE SET NULL;