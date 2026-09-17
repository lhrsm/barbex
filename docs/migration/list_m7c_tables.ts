import * as fs from 'fs';
const data = JSON.parse(fs.readFileSync('docs/migration/evidence/phase17c_m7c_table_import_manifest.json', 'utf8'));
console.log('Tables in M7C manifest count:', data.tables.length);
data.tables.forEach((t: any, i: number) => console.log(`${i+1}. ${t.table} (${t.row_count_before})`));
