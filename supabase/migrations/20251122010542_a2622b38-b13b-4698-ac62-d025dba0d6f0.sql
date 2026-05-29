-- Drop project-related tables that are being removed
DROP TABLE IF EXISTS project_tasks CASCADE;
DROP TABLE IF EXISTS project_files CASCADE;
DROP TABLE IF EXISTS project_quotations CASCADE;
DROP TABLE IF EXISTS project_digicom_checklist CASCADE;
DROP TABLE IF EXISTS project_livecom_checklist CASCADE;
DROP TABLE IF EXISTS project_demandcom_checklist CASCADE;