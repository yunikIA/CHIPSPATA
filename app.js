let db;

function getFirebaseConfig() {
  const saved = localStorage.getItem('firebase_config');
  if (saved) {
    try { return JSON.parse(saved); } catch (e) { return null; }
  }
  return null;
}

function saveFirebaseConfig(config) {
  localStorage.setItem('firebase_config', JSON.stringify(config));
}

function showSetupScreen() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f1f5f9;font-family:system-ui,sans-serif">
      <div style="background:white;padding:40px;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.1);max-width:540px;width:90%">
        <div style="font-size:48px;margin-bottom:16px;text-align:center">🔧</div>
        <h1 style="font-size:20px;margin-bottom:4px;text-align:center">Conectar con Firebase</h1>
        <p style="color:#64748b;margin-bottom:24px;text-align:center;font-size:14px">Pegá la configuración de tu proyecto Firebase</p>
        <div style="text-align:left;background:#f8fafc;padding:12px 16px;border-radius:8px;font-size:13px;margin-bottom:24px">
          <strong style="display:block;margin-bottom:4px">¿Dónde encuentro esto?</strong>
          <ol style="margin:0 0 0 16px;line-height:1.8">
            <li>Andá a <a href="https://console.firebase.google.com" target="_blank" style="color:#0a6e6e">console.firebase.google.com</a></li>
            <li>Creá un proyecto o usá uno existente</li>
            <li>Andá a <strong>Configuración del proyecto → General → Tus apps → Web</strong></li>
            <li>Copiá el objeto de configuración (firebaseConfig)</li>
            <li>Activá <strong>Firestore Database</strong> en modo prueba</li>
          </ol>
        </div>
        <div style="margin-bottom:16px">
          <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">Configuración de Firebase (JSON)</label>
          <textarea id="setup-config" rows="6" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;font-family:monospace;resize:vertical" placeholder='Pegá acá el objeto firebaseConfig, ej:&#10;{"apiKey":"AIzaSy...","authDomain":"...","projectId":"..."}'></textarea>
        </div>
        <button id="btn-setup" style="width:100%;padding:10px;background:#0a6e6e;color:white;border:none;border-radius:6px;font-size:15px;font-weight:600;cursor:pointer">Conectar</button>
        <p id="setup-error" style="color:#dc2626;font-size:13px;margin-top:8px;display:none"></p>
      </div>
    </div>
  `;
  document.getElementById('btn-setup').addEventListener('click', async () => {
    const val = document.getElementById('setup-config').value.trim();
    if (!val) {
      document.getElementById('setup-error').textContent = 'Pegá la configuración de Firebase';
      document.getElementById('setup-error').style.display = 'block';
      return;
    }
    try {
      const config = JSON.parse(val);
      if (!config.apiKey || !config.projectId) {
        document.getElementById('setup-error').textContent = 'El JSON debe contener al menos apiKey y projectId';
        document.getElementById('setup-error').style.display = 'block';
        return;
      }
      firebase.initializeApp(config);
      const testDb = firebase.firestore();
      await testDb.collection('_test').doc('_test').set({ test: true });
      await testDb.collection('_test').doc('_test').delete();
      saveFirebaseConfig(config);
      window.location.reload();
    } catch (e) {
      document.getElementById('setup-error').textContent = 'Error: ' + e.message;
      document.getElementById('setup-error').style.display = 'block';
    }
  });
}

function initFirebase() {
  const config = getFirebaseConfig();
  if (!config) {
    showSetupScreen();
    return;
  }
  try {
    firebase.initializeApp(config);
    db = firebase.firestore();
    db.settings({ merge: true });
    init();
  } catch (e) {
    showSetupScreen();
  }
}

async function getEmpleados(opts = {}) {
  let ref = db.collection('empleados');
  if (opts.search) {
    const s = opts.search;
    ref = ref.where('nombre', '>=', s).where('nombre', '<=', s + '\uf8ff');
  }
  if (opts.sector) ref = ref.where('sector', '==', opts.sector);
  if (opts.orderBy) ref = ref.orderBy(opts.orderBy, opts.orderDir || 'asc');
  else ref = ref.orderBy('nombre');
  const snapshot = await ref.get();
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getChips(opts = {}) {
  let ref = db.collection('chips');
  if (opts.search) {
    const s = opts.search;
    ref = ref.where('numero_sim', '>=', s).where('numero_sim', '<=', s + '\uf8ff');
  }
  if (opts.estado) ref = ref.where('estado', '==', opts.estado);
  if (opts.orderBy) ref = ref.orderBy(opts.orderBy, opts.orderDir || 'asc');
  else ref = ref.orderBy('createdAt', 'desc');
  const snapshot = await ref.get();
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getAsignaciones() {
  const snapshot = await db.collection('asignaciones').orderBy('createdAt', 'desc').limit(100).get();
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

let currentSection = 'dashboard';

async function init() {
  setupNavigation();
  loadSection('dashboard');
}

function setupNavigation() {
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const section = link.dataset.section;
      loadSection(section);
      document.querySelectorAll('.nav-links a').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });
  document.getElementById('btn-nuevo-empleado').addEventListener('click', () => { resetEmpleadoForm(); openModal('empleado-modal'); });
  document.getElementById('btn-salvar-empleado').addEventListener('click', saveEmpleado);
  document.getElementById('btn-nuevo-chip').addEventListener('click', () => { resetChipForm(); openModal('chip-modal'); });
  document.getElementById('btn-salvar-chip').addEventListener('click', saveChip);
  document.getElementById('btn-asignar').addEventListener('click', asignarChip);
  document.getElementById('btn-importar').addEventListener('click', importarExcel);
  document.getElementById('btn-limpiar-todo').addEventListener('click', limpiarTodo);
  document.getElementById('file-input').addEventListener('change', previewExcel);
  document.getElementById('import-area').addEventListener('click', () => document.getElementById('file-input').click());
  document.getElementById('search-empleados').addEventListener('input', () => loadEmpleados());
  document.getElementById('filter-sector').addEventListener('change', () => loadEmpleados());
  document.getElementById('search-chips').addEventListener('input', () => loadChips());
  document.getElementById('filter-chip-estado').addEventListener('change', () => loadChips());
  document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.closest('.modal-overlay')));
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay); });
  });
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function loadSection(section) {
  currentSection = section;
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(`section-${section}`).classList.add('active');
  switch (section) {
    case 'dashboard': loadDashboard(); break;
    case 'empleados': loadEmpleados(); break;
    case 'chips': loadChips(); break;
    case 'asignaciones': loadAsignaciones(); break;
    case 'importar': break;
  }
}

async function loadDashboard() {
  try {
    const [empSnap, chipSnap, asigSnap] = await Promise.all([
      db.collection('empleados').get(),
      db.collection('chips').get(),
      db.collection('asignaciones').get()
    ]);
    const totalEmpleados = empSnap.size;
    const chips = chipSnap.docs.map(d => d.data());
    const totalChips = chips.length;
    const disponibles = chips.filter(c => c.estado === 'disponible').length;
    const asignados = chips.filter(c => c.estado === 'asignado').length;
    const inactivos = chips.filter(c => c.estado === 'inactivo').length;
    const totalAsig = asigSnap.size;

    document.getElementById('stat-empleados').textContent = totalEmpleados;
    document.getElementById('stat-chips-total').textContent = totalChips;
    document.getElementById('stat-disponibles').textContent = disponibles;
    document.getElementById('stat-asignados').textContent = asignados;
    document.getElementById('stat-inactivos').textContent = inactivos;
    document.getElementById('stat-asignaciones').textContent = totalAsig;
  } catch (err) {
    console.error(err);
    showToast('Error al cargar dashboard: ' + err.message, 'error');
  }
}

// ========== EMPLEADOS ==========

async function loadEmpleados() {
  const tbody = document.getElementById('empleados-tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="loading">Cargando...</td></tr>';
  try {
    const search = document.getElementById('search-empleados').value.trim();
    const sector = document.getElementById('filter-sector').value;
    const data = await getEmpleados({ search: search || undefined, sector: sector || undefined, orderBy: 'nombre' });
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">📋</div><p>No hay empleados registrados</p></div></td></tr>';
      return;
    }
    tbody.innerHTML = data.map(e => `
      <tr>
        <td><strong>${escapeHtml(e.nombre)}</strong></td>
        <td>${escapeHtml(e.telefono || '')}</td>
        <td>${escapeHtml(e.email || '')}</td>
        <td><span class="badge badge-info">${escapeHtml(e.sector || 'Sin sector')}</span></td>
        <td>${escapeHtml(e.observaciones || '')}</td>
        <td>
          <div class="table-actions">
            <button class="btn-icon" onclick="editEmpleado('${e.id}')" title="Editar">✏️</button>
            <button class="btn-icon" onclick="deleteEmpleado('${e.id}')" title="Eliminar">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><p>Error: ${err.message}</p></div></td></tr>`;
    showToast('Error al cargar empleados', 'error');
  }
}

async function saveEmpleado() {
  const id = document.getElementById('empleado-id').value;
  const data = {
    nombre: document.getElementById('emp-nombre').value.trim(),
    telefono: document.getElementById('emp-telefono').value.trim(),
    email: document.getElementById('emp-email').value.trim(),
    contraseña: document.getElementById('emp-contraseña').value.trim(),
    sector: document.getElementById('emp-sector').value.trim(),
    observaciones: document.getElementById('emp-observaciones').value.trim()
  };
  if (!data.nombre) { showToast('El nombre es obligatorio', 'error'); return; }
  try {
    if (id) {
      await db.collection('empleados').doc(id).update(data);
      showToast('Empleado actualizado correctamente');
    } else {
      data.createdAt = new Date().toISOString();
      await db.collection('empleados').add(data);
      showToast('Empleado creado correctamente');
    }
    closeModal(document.getElementById('empleado-modal'));
    loadEmpleados();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function editEmpleado(id) {
  try {
    const doc = await db.collection('empleados').doc(id).get();
    if (!doc.exists) { showToast('Error al cargar empleado', 'error'); return; }
    const data = doc.data();
    document.getElementById('empleado-id').value = doc.id;
    document.getElementById('emp-nombre').value = data.nombre || '';
    document.getElementById('emp-telefono').value = data.telefono || '';
    document.getElementById('emp-email').value = data.email || '';
    document.getElementById('emp-contraseña').value = data.contraseña || '';
    document.getElementById('emp-sector').value = data.sector || '';
    document.getElementById('emp-observaciones').value = data.observaciones || '';
    document.getElementById('modal-empleado-title').textContent = 'Editar Empleado';
    openModal('empleado-modal');
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

function resetEmpleadoForm() {
  document.getElementById('empleado-id').value = '';
  document.getElementById('emp-nombre').value = '';
  document.getElementById('emp-telefono').value = '';
  document.getElementById('emp-email').value = '';
  document.getElementById('emp-contraseña').value = '';
  document.getElementById('emp-sector').value = '';
  document.getElementById('emp-observaciones').value = '';
  document.getElementById('modal-empleado-title').textContent = 'Nuevo Empleado';
}

async function deleteEmpleado(id) {
  if (!confirm('¿Estás seguro de eliminar este empleado?')) return;
  try {
    await db.collection('empleados').doc(id).delete();
    showToast('Empleado eliminado');
    loadEmpleados();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ========== CHIPS ==========

async function loadChips() {
  const tbody = document.getElementById('chips-tbody');
  tbody.innerHTML = '<tr><td colspan="5" class="loading">Cargando...</td></tr>';
  try {
    const search = document.getElementById('search-chips').value.trim();
    const estado = document.getElementById('filter-chip-estado').value;
    const data = await getChips({ search: search || undefined, estado: estado || undefined, orderBy: 'createdAt', orderDir: 'desc' });
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">📱</div><p>No hay chips registrados</p></div></td></tr>';
      return;
    }
    tbody.innerHTML = data.map(c => `
      <tr>
        <td><strong>${escapeHtml(c.numero_sim)}</strong></td>
        <td>${escapeHtml(c.operador || '—')}</td>
        <td>
          <span class="badge badge-${c.estado === 'disponible' ? 'success' : c.estado === 'asignado' ? 'warning' : 'danger'}">
            <span class="status-dot ${c.estado}"></span>${capitalize(c.estado)}
          </span>
        </td>
        <td>${formatDate(c.createdAt)}</td>
        <td>
          <div class="table-actions">
            <button class="btn-icon" onclick="editChip('${c.id}')" title="Editar">✏️</button>
            <button class="btn-icon" onclick="deleteChip('${c.id}')" title="Eliminar">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><p>Error: ${err.message}</p></div></td></tr>`;
    showToast('Error al cargar chips', 'error');
  }
}

async function saveChip() {
  const id = document.getElementById('chip-id').value;
  const data = {
    numero_sim: document.getElementById('chip-numero').value.trim(),
    operador: document.getElementById('chip-operador').value.trim(),
    estado: document.getElementById('chip-estado').value
  };
  if (!data.numero_sim) { showToast('El número SIM es obligatorio', 'error'); return; }
  try {
    if (id) {
      await db.collection('chips').doc(id).update(data);
      showToast('Chip actualizado correctamente');
    } else {
      data.createdAt = new Date().toISOString();
      await db.collection('chips').add(data);
      showToast('Chip registrado correctamente');
    }
    closeModal(document.getElementById('chip-modal'));
    loadChips();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function editChip(id) {
  try {
    const doc = await db.collection('chips').doc(id).get();
    if (!doc.exists) { showToast('Error al cargar chip', 'error'); return; }
    const data = doc.data();
    document.getElementById('chip-id').value = doc.id;
    document.getElementById('chip-numero').value = data.numero_sim || '';
    document.getElementById('chip-operador').value = data.operador || '';
    document.getElementById('chip-estado').value = data.estado || 'disponible';
    document.getElementById('modal-chip-title').textContent = 'Editar Chip';
    openModal('chip-modal');
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

function resetChipForm() {
  document.getElementById('chip-id').value = '';
  document.getElementById('chip-numero').value = '';
  document.getElementById('chip-operador').value = '';
  document.getElementById('chip-estado').value = 'disponible';
  document.getElementById('modal-chip-title').textContent = 'Nuevo Chip';
}

async function deleteChip(id) {
  if (!confirm('¿Estás seguro de eliminar este chip?')) return;
  try {
    await db.collection('chips').doc(id).delete();
    showToast('Chip eliminado');
    loadChips();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ========== ASIGNACIONES ==========

async function loadAsignaciones() {
  await loadAsignacionForm();
  await loadAsignacionHistorial();
}

async function loadAsignacionForm() {
  try {
    const [empSnap, chipSnap] = await Promise.all([
      db.collection('empleados').orderBy('nombre').get(),
      db.collection('chips').where('estado', '==', 'disponible').orderBy('numero_sim').get()
    ]);
    const empleados = empSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const chips = chipSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const empSelect = document.getElementById('asig-empleado');
    const chipSelect = document.getElementById('asig-chip');
    empSelect.innerHTML = '<option value="">Seleccionar...</option>' +
      empleados.map(e => `<option value="${e.id}">${escapeHtml(e.nombre)}</option>`).join('');
    chipSelect.innerHTML = '<option value="">Seleccionar...</option>' +
      chips.map(c => `<option value="${c.id}">${escapeHtml(c.numero_sim)}</option>`).join('');
    document.getElementById('asignar-disponibles').textContent = chips.length;
  } catch (err) {
    showToast('Error al cargar formulario', 'error');
  }
}

async function asignarChip() {
  const empleado_id = document.getElementById('asig-empleado').value;
  const chip_id = document.getElementById('asig-chip').value;
  const celular = document.getElementById('asig-celular').checked;
  const modelo = document.getElementById('asig-modelo').value.trim();
  const observaciones = document.getElementById('asig-observaciones').value.trim();
  if (!empleado_id || !chip_id) { showToast('Seleccioná empleado y chip', 'error'); return; }
  try {
    const [empDoc, chipDoc] = await Promise.all([
      db.collection('empleados').doc(empleado_id).get(),
      db.collection('chips').doc(chip_id).get()
    ]);
    if (!empDoc.exists || !chipDoc.exists) { showToast('Empleado o chip no encontrado', 'error'); return; }
    const empData = empDoc.data();
    const chipData = chipDoc.data();
    await db.collection('asignaciones').add({
      chip_id,
      chip_numero: chipData.numero_sim,
      empleado_id,
      empleado_nombre: empData.nombre,
      celular_asignado: celular,
      modelo_celular: modelo,
      observaciones,
      fecha_asignacion: new Date().toISOString().split('T')[0],
      fecha_devolucion: null,
      createdAt: new Date().toISOString()
    });
    await db.collection('chips').doc(chip_id).update({ estado: 'asignado' });
    showToast('Chip asignado correctamente');
    document.getElementById('asig-empleado').value = '';
    document.getElementById('asig-chip').value = '';
    document.getElementById('asig-celular').checked = false;
    document.getElementById('asig-modelo').value = '';
    document.getElementById('asig-observaciones').value = '';
    loadAsignaciones();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function loadAsignacionHistorial() {
  const tbody = document.getElementById('historial-tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="loading">Cargando...</td></tr>';
  try {
    const data = await getAsignaciones();
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">📄</div><p>No hay asignaciones aún</p></div></td></tr>';
      return;
    }
    tbody.innerHTML = data.map(a => `
      <tr>
        <td>${escapeHtml(a.empleado_nombre || '—')}</td>
        <td><strong>${escapeHtml(a.chip_numero || '—')}</strong></td>
        <td>${formatDate(a.fecha_asignacion)}</td>
        <td>${a.fecha_devolucion ? formatDate(a.fecha_devolucion) : '<span class="badge badge-warning">Activo</span>'}</td>
        <td>${a.celular_asignado ? '✅ Sí' + (a.modelo_celular ? ' (' + escapeHtml(a.modelo_celular) + ')' : '') : '❌ No'}</td>
        <td>
          <div class="table-actions">
            ${!a.fecha_devolucion ? `<button class="btn btn-sm btn-warning" onclick="devolverChip('${a.id}', '${a.chip_id}')">↩ Devolver</button>` : ''}
            <button class="btn-icon" onclick="deleteAsignacion('${a.id}')" title="Eliminar">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><p>Error: ${err.message}</p></div></td></tr>`;
  }
}

async function devolverChip(asigId, chipId) {
  if (!confirm('¿Confirmás la devolución de este chip?')) return;
  try {
    await db.collection('asignaciones').doc(asigId).update({
      fecha_devolucion: new Date().toISOString().split('T')[0]
    });
    await db.collection('chips').doc(chipId).update({ estado: 'disponible' });
    showToast('Chip devuelto correctamente');
    loadAsignaciones();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function deleteAsignacion(id) {
  if (!confirm('¿Eliminar esta asignación del historial?')) return;
  try {
    await db.collection('asignaciones').doc(id).delete();
    showToast('Asignación eliminada del historial');
    loadAsignaciones();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ========== IMPORTAR EXCEL ==========

function previewExcel(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const data = new Uint8Array(ev.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet);
      if (json.length === 0) { showToast('El archivo está vacío', 'error'); return; }
      window._importData = json;
      const html = `
        <div style="max-height:300px;overflow:auto;font-size:13px">
          <p style="margin-bottom:8px;color:var(--text-muted)">${json.length} registros encontrados. Vista previa:</p>
          <table>
            <thead><tr>${Object.keys(json[0]).map(k => `<th>${escapeHtml(k)}</th>`).join('')}</tr></thead>
            <tbody>${json.slice(0, 10).map(row =>
              `<tr>${Object.values(row).map(v => `<td>${escapeHtml(String(v || ''))}</td>`).join('')}</tr>`
            ).join('')}</tbody>
          </table>
          ${json.length > 10 ? `<p style="margin-top:8px;color:var(--text-muted)">... y ${json.length - 10} más</p>` : ''}
        </div>
      `;
      document.getElementById('import-preview').innerHTML = html;
      document.getElementById('import-preview').style.display = 'block';
      document.getElementById('btn-importar').style.display = 'inline-flex';
      showToast(`Archivo cargado: ${json.length} registros`, 'info');
    } catch (err) { showToast('Error al leer archivo: ' + err.message, 'error'); }
  };
  reader.readAsArrayBuffer(file);
}

async function importarExcel() {
  const data = window._importData;
  if (!data || data.length === 0) { showToast('No hay datos para importar', 'error'); return; }
  const btn = document.getElementById('btn-importar');
  btn.disabled = true;
  btn.textContent = 'Importando...';
  let importados = 0;
  let errores = 0;
  for (const row of data) {
    try {
      const nombre = row['Nombre'] || row['NOMBRE'] || row['Nombre completo'] || row['nombre'] || '';
      const telefono = row['Numero de telefono'] || row['NUMERO'] || row['Número'] || row['telefono'] || '';
      const email = row['Mail'] || row['MAIL'] || row['mail'] || row['Email'] || '';
      const contraseña = row['Contraseña'] || row['CONTRASEÑA'] || row['contraseña'] || '';
      const sector = row['SECTOR'] || row['Sector'] || row['sector'] || '';
      const observaciones = row['Observaciones'] || row['observaciones'] || '';
      if (!nombre) { errores++; continue; }
      const existing = await db.collection('empleados')
        .where('nombre', '==', String(nombre).trim()).get();
      if (existing.empty) {
        await db.collection('empleados').add({
          nombre: String(nombre).trim(),
          telefono: String(telefono).trim(),
          email: String(email).trim(),
          contraseña: String(contraseña).trim(),
          sector: String(sector).trim(),
          observaciones: String(observaciones).trim(),
          createdAt: new Date().toISOString()
        });
      } else {
        await db.collection('empleados').doc(existing.docs[0].id).update({
          telefono: String(telefono).trim(),
          email: String(email).trim(),
          contraseña: String(contraseña).trim(),
          sector: String(sector).trim(),
          observaciones: String(observaciones).trim()
        });
      }
      importados++;
    } catch (e) { errores++; }
  }
  showToast(`Importación completada: ${importados} importados, ${errores} errores`, errores > 0 ? 'warning' : 'success');
  btn.disabled = false;
  btn.textContent = 'Importar Datos';
  window._importData = null;
  document.getElementById('import-preview').innerHTML = '';
  document.getElementById('import-preview').style.display = 'none';
  document.getElementById('btn-importar').style.display = 'none';
  document.getElementById('file-input').value = '';
}

// ========== LIMPIAR TODO ==========

async function limpiarTodo() {
  if (!confirm('¿Estás SEGURO de eliminar TODOS los datos?\n\nEmpleados, chips y asignaciones se borrarán permanentemente.')) return;
  if (!confirm('⚠️ Confirmación final:\n\nEsta acción NO se puede deshacer. ¿Eliminar todo?')) return;

  const btn = document.getElementById('btn-limpiar-todo');
  const progress = document.getElementById('limpiar-progress');
  btn.disabled = true;
  progress.style.display = 'inline';

  try {
    const colecciones = ['asignaciones', 'chips', 'empleados'];
    let total = 0;
    for (const nombre of colecciones) {
      const snapshot = await db.collection(nombre).get();
      const batch = db.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      total += snapshot.size;
    }
    showToast(`✅ Todos los datos eliminados (${total} documentos)`);
    loadDashboard();
  } catch (err) {
    showToast('Error al limpiar datos: ' + err.message, 'error');
  }

  btn.disabled = false;
  progress.style.display = 'none';
}

// ========== UTILIDADES ==========

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDate(date) {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleDateString('es-AR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('show');
}

function closeModal(modal) {
  if (modal) modal.classList.remove('show');
}

document.addEventListener('DOMContentLoaded', initFirebase);
