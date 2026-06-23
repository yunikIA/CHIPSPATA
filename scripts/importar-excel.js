/**
 * Script para importar datos desde Excel a Supabase.
 * 
 * Modo de uso:
 * 1. Configurar SUPABASE_URL y SUPABASE_ANON_KEY en el entorno
 * 2. npm install
 * 3. node scripts/importar-excel.js
 *
 * Importa los archivos Excel del directorio actual
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('ERROR: Debes configurar SUPABASE_URL y SUPABASE_ANON_KEY');
  console.error('Ej: SUPABASE_URL=https://xyz.supabase.co SUPABASE_ANON_KEY=eyJhbG... node scripts/importar-excel.js');
  process.exit(1);
}

async function supabaseFetch(path, options = {}) {
  const url = new URL(path, SUPABASE_URL.replace(/\/$/, ''));
  const method = options.method || 'GET';
  const body = options.body;
  
  const data = JSON.stringify(body);
  
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    };
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(data);

    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(data);
    req.end();
  });
}

async function importFromExcel(filePath, sheetName) {
  try {
    const XLSX = require('xlsx');
    if (!fs.existsSync(filePath)) {
      console.log(`  ⚠ Archivo no encontrado: ${filePath}`);
      return { importados: 0, errores: 0 };
    }
    
    const workbook = XLSX.readFile(filePath);
    const sheet = sheetName ? workbook.Sheets[sheetName] : workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) {
      console.log(`  ⚠ Hoja "${sheetName}" no encontrada en ${filePath}`);
      return { importados: 0, errores: 0 };
    }
    
    const json = XLSX.utils.sheet_to_json(sheet);
    console.log(`  📄 ${json.length} registros encontrados en ${filePath}${sheetName ? ` / ${sheetName}` : ''}`);
    
    let importados = 0, errores = 0;
    
    for (const row of json) {
      try {
        const nombre = String(row['Nombre'] || row['NOMBRE'] || row['Nombre completo'] || row['nombre'] || '').trim();
        const telefono = String(row['Numero de telefono'] || row['NUMERO'] || row['Número'] || row['telefono'] || '').trim();
        const email = String(row['Mail'] || row['MAIL'] || row['mail'] || row['Email'] || '').trim();
        const contraseña = String(row['Contraseña'] || row['CONTRASEÑA'] || row['contraseña'] || '').trim();
        const sector = String(row['SECTOR'] || row['Sector'] || row['sector'] || '').trim();
        const observaciones = String(row['Observaciones'] || row['observaciones'] || '').trim();
        
        if (!nombre) { errores++; continue; }
        
        const res = await supabaseFetch('/rest/v1/empleados', {
          method: 'POST',
          body: {
            nombre,
            telefono: telefono || null,
            email: email || null,
            contraseña: contraseña || null,
            sector: sector || null,
            observaciones: observaciones || null
          }
        });
        
        if (res.status === 201 || res.status === 200) {
          importados++;
        } else {
          // Si es duplicado, intentar upsert
          if (res.status === 409) {
            const upsertRes = await supabaseFetch('/rest/v1/empleados?on_conflict=nombre', {
              method: 'POST',
              body: {
                nombre,
                telefono: telefono || null,
                email: email || null,
                contraseña: contraseña || null,
                sector: sector || null,
                observaciones: observaciones || null
              },
              headers: {
                'Prefer': 'resolution=merge-duplicates'
              }
            });
            if (upsertRes.status < 300) importados++;
            else { errores++; }
          } else {
            errores++;
            console.log(`    ✗ Error con "${nombre}": ${JSON.stringify(res.data)}`);
          }
        }
      } catch (e) {
        errores++;
      }
    }
    
    return { importados, errores };
  } catch (err) {
    console.error(`  ✗ Error al procesar ${filePath}: ${err.message}`);
    return { importados: 0, errores: 0 };
  }
}

async function importChipsFromSwatData(filePath) {
  try {
    const XLSX = require('xlsx');
    if (!fs.existsSync(filePath)) {
      console.log(`  ⚠ Archivo no encontrado: ${filePath}`);
      return { importados: 0, errores: 0 };
    }
    
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets['SWAT DATA'];
    if (!sheet) {
      console.log('  ⚠ Hoja SWAT DATA no encontrada');
      return { importados: 0, errores: 0 };
    }
    
    const json = XLSX.utils.sheet_to_json(sheet);
    console.log(`  📄 ${json.length} registros encontrados en SWAT DATA`);
    
    let importados = 0, errores = 0;
    
    for (const row of json) {
      try {
        const nombre = String(row['NOMBRE'] || '').trim();
        const celular = String(row['CELULAR'] || '').trim().toUpperCase();
        
        // Solo crear chips si la persona tiene celular asignado
        if (celular !== 'SI') continue;
        
        const numero_sim = String(row['NUMERO'] || '').trim();
        const modelo = String(row['MODELO'] || '').trim();
        
        if (!numero_sim) continue;
        
        const res = await supabaseFetch('/rest/v1/chips', {
          method: 'POST',
          body: {
            numero_sim,
            operador: '',
            estado: 'asignado'
          }
        });
        
        if (res.status === 201 || res.status === 200) {
          // Buscar empleado por nombre para asignarle el chip
          const empRes = await supabaseFetch(`/rest/v1/empleados?nombre=eq.${encodeURIComponent(nombre)}`);
          if (empRes.data && empRes.data.length > 0) {
            const empleadoId = empRes.data[0].id;
            const chipId = res.data.id;
            
            await supabaseFetch('/rest/v1/asignaciones', {
              method: 'POST',
              body: {
                chip_id: chipId,
                empleado_id: empleadoId,
                celular_asignado: true,
                modelo_celular: modelo || null,
                fecha_asignacion: new Date().toISOString().split('T')[0]
              }
            });
            console.log(`    ✓ Chip ${numero_sim} asignado a ${nombre}`);
          }
          importados++;
        } else {
          if (res.status !== 409) {
            errores++;
            console.log(`    ✗ Error con chip ${numero_sim}: ${JSON.stringify(res.data)}`);
          }
        }
      } catch (e) {
        errores++;
      }
    }
    
    return { importados, errores };
  } catch (err) {
    console.error(`  ✗ Error al procesar chips: ${err.message}`);
    return { importados: 0, errores: 0 };
  }
}

async function main() {
  console.log('\n🚀 Iniciando importación de datos...\n');
  
  const baseDir = path.resolve(__dirname, '..');
  const files = [
    { file: path.join(baseDir, 'Informacion Global Patagonia Flooring SISTEMAS.xlsx'), sheet: 'GLOBAL' },
    { file: path.join(baseDir, 'Flota Swat - Instaladores SOHO.xlsx'), sheet: 'SWAT DATA' }
  ];
  
  let totalImportados = 0, totalErrores = 0;
  
  // Importar empleados desde GLOBAL
  console.log('📋 Importando empleados desde GLOBAL...');
  const empResult1 = await importFromExcel(files[0].file, files[0].sheet);
  totalImportados += empResult1.importados;
  totalErrores += empResult1.errores;
  
  console.log('\n📋 Importando empleados desde SWAT DATA...');
  const empResult2 = await importFromExcel(files[1].file, files[1].sheet);
  totalImportados += empResult2.importados;
  totalErrores += empResult2.errores;
  
  console.log('\n📋 Importando empleados desde NUEVOS...');
  const empResult3 = await importFromExcel(files[0].file, 'NUEVOS');
  totalImportados += empResult3.importados;
  totalErrores += empResult3.errores;
  
  // Importar chips desde SWAT DATA  
  console.log('\n📱 Importando chips desde SWAT DATA...');
  const chipResult = await importChipsFromSwatData(files[1].file);
  totalImportados += chipResult.importados;
  totalErrores += chipResult.errores;
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN FINAL');
  console.log('='.repeat(50));
  console.log(`  ✅ Importados: ${totalImportados}`);
  console.log(`  ❌ Errores: ${totalErrores}`);
  console.log(`  📁 Archivos procesados: ${files.map(f => path.basename(f.file)).join(', ')}`);
  console.log('='.repeat(50) + '\n');
}

main().catch(err => { console.error('Error general:', err); process.exit(1); });
