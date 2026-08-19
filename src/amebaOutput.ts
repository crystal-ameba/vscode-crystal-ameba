export interface AmebaSummary {
  issues_count: number;
  target_sources_count: number;
}

export interface AmebaLocation {
  line: number;
  column: number;
}

export interface AmebaIssue {
  message: string;
  rule_name: string;
  location: AmebaLocation;
  end_location: AmebaLocation;
  severity: string;
}

export interface AmebaFile {
  path: string;
  issues: Array<AmebaIssue>;
}

export interface AmebaMetadata {
  ameba_version: string;
  crystal_version: string;
}

export interface AmebaOutput {
  metadata: AmebaMetadata;
  sources: Array<AmebaFile>;
  summary: AmebaSummary;
}
