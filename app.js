let supabase;

function getSupabaseConfig() {
  const saved = localStorage.getItem('supabase_config');
  if (saved) {
    try { return JSON.parse(saved); } catch (e) { return null; }
  }
  return null;
}

function saveSupabaseConfig(url, key) {
  localStorage.setItem('supabase_config', JSON.stringify({ url, key }));
}

function showSetupScreen() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:var(--bg,#f1f5f9);font-family:system-ui,sans-serif">
      <div style="background:white;padding:40px;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.1);max-width:500px;width:90%">
        <div style="font-size:48px;margin-bottom:16px;text-align:center">🔧</div>
        <h1 style="font-size:20px;margin-bottom:4px;text-align:center">Conectar con Supabase</h1>
        <p style="color:#64748b;margin-bottom:24px;text-align:center;font-size:14px">Ingresá las credenciales de tu proyecto Supabase</p>
        <div style="text-align:left;background:#f8fafc;padding:12px 16px;border-radius:8px;font-size:13px;margin-bottom:24px">
          <strong style="display:block;margin-bottom:4px">¿Dónde encuentro esto?</strong>
          <ol style="margin:0 0 0 16px;line-height:1.8">
            <li>Creá un proyecto en <a href="https://supabase.com" target="_blank" style="color:#0a6e6e">supabase.com</a> (gratis)</li>
            <li>Andá a <strong>Settings → API</strong></li>
            <li>Copiá <strong>Project URL</strong> y <strong>anon public key</strong></li>
            <li>Ejecutá <code>schema.sql</code> en el SQL Editor</li>
          </ol>
        </div>
        <div style="margin-bottom:16px">
          <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">Supabase URL</label>
          <input type="text" id="setup-url" placeholder="https://xyz.supabase.co" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px">
        </div>
        <div style="margin-bottom:24px">
          <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">Anon Public Key</label>
          <input type="text" id="setup-key" placeholder="eyJhbGciOiJIUzI1NiIs..." style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px">
        </div>
        <button id="btn-setup" style="width:100%;padding:10px;background:#0a6e6e;color:white;border:none;border-radius:6px;font-size:15px;font-weight:600;cursor:pointer">Conectar</button>
        <p id="setup-error" style="color:#dc2626;font-size:13px;margin-top:8px;display:none"></p>
      </div>
    </div>
  `;
  document.getElementById('btn-setup').addEventListener('click', async () => {
    const url = document.getElementById('setup-url').value.trim();
    const key = document.getElementById('setup-key').value.trim();
    if (!url || !key) {
      document.getElementById('setup-error').textContent = 'Completá ambos campos';
      document.getElementById('setup-error').style.display = 'block';
      return;
    }
    try {
      const testClient = supabaseJs.createClient(url, key, { auth: { persistSession: false } });
      const { error } = await testClient.from('empleados').select('id', { count: 'exact', head: true });
      saveSupabaseConfig(url, key);
      window.location.reload();
    } catch (e) {
      document.getElementById('setup-error').textContent = 'Error: ' + e.message;
      document.getElementById('setup-error').style.display = 'block';
    }
  });
}

function initSupabase() {
  const config = getSupabaseConfig();
  if (!config) {
    showSetupScreen();
    return;
  }
  supabase = supabaseJs.createClient(config.url, config.key, {
    auth: { persistSession: false }
  });
  init();
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
    const [empRes, chipsRes, asigRes] = await Promise.all([
      supabase.from('empleados').select('*', { count: 'exact', head: true }),
      supabase.from('chips').select('estado'),
      supabase.from('asignaciones').select('*', { count: 'exact', head: true })
    ]);
    const totalEmpleados = empRes.count || 0;
    const chips = chipsRes.data || [];
    const totalChips = chips.length;
    const disponibles = chips.filter(c => c.estado === 'disponible').length;
    const asignados = chips.filter(c => c.estado === 'asignado').length;
    const inactivos = chips.filter(c => c.estado === 'inactivo').length;
    const totalAsig = asigRes.count || 0;

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
    let query = supabase.from('empleados').select('*');
    if (search) query = query.ilike('nombre', `%${search}%`);
    if (sector) query = query.eq('sector', sector);
    query = query.order('nombre');
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">📋</div><p>No hay empleados registrados</p></div></td></tr>';
      return;
    }
    tbody.innerHTML = data.map(e => `
      <tr>
        <td><strong>${escapeHtml(e.nombre)}</strong></td>
        <td>${escapeHtml(e.telefono)}</td>
        <td>${escapeHtml(e.email)}</td>
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
      await supabase.from('empleados').update(data).eq('id', id);
      showToast('Empleado actualizado correctamente');
    } else {
      await supabase.from('empleados').insert(data);
      showToast('Empleado creado correctamente');
    }
    closeModal(document.getElementById('empleado-modal'));
    loadEmpleados();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

function editEmpleado(id) {
  supabase.from('empleados').select('*').eq('id', id).single().then(({ data, error }) => {
    if (error || !data) { showToast('Error al cargar empleado', 'error'); return; }
    document.getElementById('empleado-id').value = data.id;
    document.getElementById('emp-nombre').value = data.nombre || '';
    document.getElementById('emp-telefono').value = data.telefono || '';
    document.getElementById('emp-email').value = data.email || '';
    document.getElementById('emp-contraseña').value = data.contraseña || '';
    document.getElementById('emp-sector').value = data.sector || '';
    document.getElementById('emp-observaciones').value = data.observaciones || '';
    document.getElementById('modal-empleado-title').textContent = 'Editar Empleado';
    openModal('empleado-modal');
  });
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
    await supabase.from('empleados').delete().eq('id', id);
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
    let query = supabase.from('chips').select('*');
    if (search) query = query.ilike('numero_sim', `%${search}%`);
    if (estado) query = query.eq('estado', estado);
    query = query.order('created_at', { ascending: false });
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) {
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
        <td>${formatDate(c.created_at)}</td>
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
      await supabase.from('chips').update(data).eq('id', id);
      showToast('Chip actualizado correctamente');
    } else {
      await supabase.from('chips').insert(data);
      showToast('Chip registrado correctamente');
    }
    closeModal(document.getElementById('chip-modal'));
    loadChips();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

function editChip(id) {
  supabase.from('chips').select('*').eq('id', id).single().then(({ data, error }) => {
    if (error || !data) { showToast('Error al cargar chip', 'error'); return; }
    document.getElementById('chip-id').value = data.id;
    document.getElementById('chip-numero').value = data.numero_sim || '';
    document.getElementById('chip-operador').value = data.operador || '';
    document.getElementById('chip-estado').value = data.estado || 'disponible';
    document.getElementById('modal-chip-title').textContent = 'Editar Chip';
    openModal('chip-modal');
  });
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
    await supabase.from('chips').delete().eq('id', id);
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
    const [empRes, chipRes] = await Promise.all([
      supabase.from('empleados').select('id, nombre').order('nombre'),
      supabase.from('chips').select('id, numero_sim').eq('estado', 'disponible').order('numero_sim')
    ]);
    const empSelect = document.getElementById('asig-empleado');
    const chipSelect = document.getElementById('asig-chip');
    empSelect.innerHTML = '<option value="">Seleccionar...</option>' +
      (empRes.data || []).map(e => `<option value="${e.id}">${escapeHtml(e.nombre)}</option>`).join('');
    chipSelect.innerHTML = '<option value="">Seleccionar...</option>' +
      (chipRes.data || []).map(c => `<option value="${c.id}">${escapeHtml(c.numero_sim)}</option>`).join('');
    document.getElementById('asignar-disponibles').textContent = (chipRes.data || []).length;
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
    const { error: asigError } = await supabase.from('asignaciones').insert({
      chip_id, empleado_id, celular_asignado: celular, modelo_celular: modelo, observaciones,
      fecha_asignacion: new Date().toISOString().split('T')[0]
    });
    if (asigError) throw asigError;
    const { error: updError } = await supabase.from('chips').update({ estado: 'asignado' }).eq('id', chip_id);
    if (updError) throw updError;
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
    const { data, error } = await supabase
      .from('asignaciones')
      .select('*, empleados!inner(nombre), chips!inner(numero_sim)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">📄</div><p>No hay asignaciones aún</p></div></td></tr>';
      return;
    }
    tbody.innerHTML = data.map(a => `
      <tr>
        <td>${escapeHtml(a.empleados?.nombre || '—')}</td>
        <td><strong>${escapeHtml(a.chips?.numero_sim || '—')}</strong></td>
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
    await supabase.from('asignaciones').update({
      fecha_devolucion: new Date().toISOString().split('T')[0]
    }).eq('id', asigId);
    await supabase.from('chips').update({ estado: 'disponible' }).eq('id', chipId);
    showToast('Chip devuelto correctamente');
    loadAsignaciones();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function deleteAsignacion(id) {
  if (!confirm('¿Eliminar esta asignación del historial?')) return;
  try {
    await supabase.from('asignaciones').delete().eq('id', id);
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
      const { error } = await supabase.from('empleados').insert(
        { nombre: String(nombre).trim(), telefono: String(telefono).trim(), email: String(email).trim(), contraseña: String(contraseña).trim(), sector: String(sector).trim(), observaciones: String(observaciones).trim() }
      );
      if (error) {
        if (error.code === '23505') { importados++; }
        else { errores++; }
      } else { importados++; }
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

document.addEventListener('DOMContentLoaded', initSupabase);
