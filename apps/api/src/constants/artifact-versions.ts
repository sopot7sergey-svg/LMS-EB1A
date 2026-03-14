/**
 * Schema/format versions for persisted artifacts.
 * Increment when the structure of stored data changes so future upgrades can handle legacy formats.
 */

/** Compile artifact optionsHash / packet plan format version */
export const ARTIFACT_SCHEMA_VERSION = 1;

/** Audit report structure version (stored in artifact.optionsHash.savedAuditReport) */
export const AUDIT_REPORT_SCHEMA_VERSION = 1;
