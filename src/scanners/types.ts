export interface ScanResult {
  source: string;
  source_id: string;
  company: string;
  position: string;
  location: string;
  employment_type: string;
  company_size?: string;
  employee_count?: number;
  raw_url: string;
  deadline?: string;
  salary_text?: string;
  listing_text: string;
  raw_text?: string;
  questions?: string[];
}

export interface ScannerConfig {
  keywords: string[];
  location_codes: string[];
  exclude_keywords: string[];
}

export interface Scanner {
  name: string;
  scan(config: ScannerConfig): Promise<ScanResult[]>;
  fetchDetail?(result: ScanResult): Promise<string | null>;
}
