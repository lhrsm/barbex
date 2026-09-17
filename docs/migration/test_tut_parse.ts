import * as fs from 'fs';
import { parseCsvRows } from './csv_parser_helper';

const manifest = JSON.parse(fs.readFileSync('docs/migration/evidence/phase17c_m7f_public_secure_snapshot_manifest.json', 'utf8'));
const tutPath = manifest.tables.find((t: any) => t.table === 'tutorials').raw_file_path;
const tutCsv = fs.readFileSync(tutPath, 'utf8');

const count = parseCsvRows(tutCsv);
console.log('Parsed tutorials count with proper quotes:', count);
