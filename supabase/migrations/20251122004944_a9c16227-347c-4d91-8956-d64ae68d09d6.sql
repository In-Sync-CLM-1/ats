-- Drop inventory and vendor related tables
DROP TABLE IF EXISTS inventory_allocations CASCADE;
DROP TABLE IF EXISTS inventory_audit_log CASCADE;
DROP TABLE IF EXISTS inventory_items CASCADE;
DROP VIEW IF EXISTS inventory_summary_stats CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;

-- Drop inventory audit function
DROP FUNCTION IF EXISTS log_inventory_audit() CASCADE;
DROP FUNCTION IF EXISTS log_allocation_audit() CASCADE;

-- Remove erp_vendor column from demandcom table
ALTER TABLE demandcom DROP COLUMN IF EXISTS erp_vendor CASCADE;

-- Remove erp_vendor column from master table
ALTER TABLE master DROP COLUMN IF EXISTS erp_vendor CASCADE;