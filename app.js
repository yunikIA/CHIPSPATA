let db, storage;

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDIF9gKLFtKdXES3t6nMYj1qzWZSIpL4Wc",
  authDomain: "patagonia-d046b.firebaseapp.com",
  projectId: "patagonia-d046b",
  storageBucket: "patagonia-d046b.firebasestorage.app",
  messagingSenderId: "406123605994",
  appId: "1:406123605994:web:698156df39e793ec46cc93"
};

function initFirebase() {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();
    db.settings({ merge: true });
    storage = firebase.storage();
    const emailCfg = getEmailConfig();
    if (emailCfg && typeof emailjs !== 'undefined') {
      emailjs.init(emailCfg.publicKey);
    }
    init();
  } catch (e) {
    document.getElementById('app').innerHTML = `<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui,sans-serif;color:#dc2626">Error al conectar con Firebase: ${e.message}</div>`;
  }
}

// ========== EMAILJS ==========

function getEmailConfig() {
  const saved = localStorage.getItem('emailjs_config');
  if (saved) {
    try { return JSON.parse(saved); } catch { return null; }
  }
  return null;
}

function saveEmailConfig(config) {
  localStorage.setItem('emailjs_config', JSON.stringify(config));
}

function abrirConfigEmail() {
  const cfg = getEmailConfig() || {};
  document.getElementById('cfg-emailjs-key').value = cfg.publicKey || '';
  document.getElementById('cfg-emailjs-service').value = cfg.serviceId || '';
  document.getElementById('cfg-emailjs-template').value = cfg.templateId || '';
  openModal('config-email-modal');
}

function guardarConfigEmail() {
  const cfg = {
    publicKey: document.getElementById('cfg-emailjs-key').value.trim(),
    serviceId: document.getElementById('cfg-emailjs-service').value.trim(),
    templateId: document.getElementById('cfg-emailjs-template').value.trim()
  };
  if (!cfg.publicKey || !cfg.serviceId || !cfg.templateId) {
    showToast('Completá todos los campos de EmailJS', 'error');
    return;
  }
  saveEmailConfig(cfg);
  emailjs.init(cfg.publicKey);
  closeModal(document.getElementById('config-email-modal'));
  showToast('Configuración de Email guardada');
}

async function enviarEmailAsignacion(empleado, chipsData, asigData) {
  const cfg = getEmailConfig();
  if (!cfg) return;
  try {
    if (typeof emailjs === 'undefined') return;
    const chipList = chipsData.map(c => c.chip_numero).join(', ');
    const chipModels = chipsData.filter(c => c.modelo_celular).map(c => `${c.chip_numero}: ${c.modelo_celular}`).join('; ');
    await emailjs.send(cfg.serviceId, cfg.templateId, {
      to_email: empleado.email || '',
      empleado_nombre: empleado.nombre || '',
      chip_numero: chipList,
      telefono: empleado.telefono || '',
      celular: chipsData.some(c => c.celular_asignado) ? 'Sí' : 'No',
      modelo_celular: chipModels || '—',
      control_parental: asigData.control_parental ? 'Sí' : 'No',
      cp_email: asigData.cp_email || '',
      cp_pass: asigData.cp_pass || '',
      fecha: new Date().toLocaleDateString('es-AR'),
      sector: empleado.sector || ''
    });
  } catch (err) {
    console.warn('EmailJS error:', err);
  }
}

async function getEmpleados(opts = {}) {
  const snapshot = await db.collection('empleados').get();
  let data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  if (opts.search) {
    const s = opts.search.toLowerCase();
    data = data.filter(e => (e.nombre || '').toLowerCase().includes(s));
  }
  if (opts.sector) data = data.filter(e => e.sector === opts.sector);
  const dir = opts.orderDir === 'desc' ? -1 : 1;
  const field = opts.orderBy || 'nombre';
  data.sort((a, b) => {
    const va = a[field], vb = b[field];
    if (!va && !vb) return 0;
    if (!va) return 1;
    if (!vb) return -1;
    return va < vb ? -dir : va > vb ? dir : 0;
  });
  return data;
}

async function getChips(opts = {}) {
  const snapshot = await db.collection('chips').get();
  let chips = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  if (opts.search) {
    const s = opts.search.toLowerCase();
    chips = chips.filter(c => (c.numero_sim || '').toLowerCase().includes(s));
  }
  if (opts.estado) chips = chips.filter(c => c.estado === opts.estado);
  const dir = opts.orderDir === 'asc' ? 1 : -1;
  const field = opts.orderBy || 'createdAt';
  chips.sort((a, b) => {
    const va = a[field], vb = b[field];
    if (!va && !vb) return 0;
    if (!va) return 1;
    if (!vb) return -1;
    return va < vb ? -dir : va > vb ? dir : 0;
  });
  return chips;
}

async function getAsignaciones() {
  const snapshot = await db.collection('asignaciones').orderBy('createdAt', 'desc').limit(100).get();
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

let currentSection = 'dashboard';

document.addEventListener('input', e => {
  if (e.target.matches('input[type="text"]:not(.no-upper), input[type="email"]:not(.no-upper), input[type="search"]:not(.no-upper)')) {
    const start = e.target.selectionStart;
    const end = e.target.selectionEnd;
    if (e.target.value !== e.target.value.toUpperCase()) {
      e.target.value = e.target.value.toUpperCase();
      e.target.setSelectionRange(start, end);
    }
  }
});

async function init() {
  await cargarSectoresDefecto();
  await llenarSelectSectores('filter-sector', '', 'Todos los sectores');
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
  document.getElementById('btn-nuevo-empleado').addEventListener('click', async () => { await resetEmpleadoForm(); openModal('empleado-modal'); });
  document.getElementById('btn-salvar-empleado').addEventListener('click', saveEmpleado);
  document.getElementById('btn-nuevo-chip').addEventListener('click', () => { resetChipForm(); openModal('chip-modal'); });
  document.getElementById('btn-salvar-chip').addEventListener('click', saveChip);
  document.getElementById('btn-asignar').addEventListener('click', asignarChip);
  document.getElementById('btn-add-chip').addEventListener('click', addChipRow);
  document.getElementById('asig-chips-rows').addEventListener('click', function(e) {
    if (e.target.closest('.btn-remove-chip')) {
      const rows = this.querySelectorAll('.asig-chip-row');
      if (rows.length > 1) {
        e.target.closest('.asig-chip-row').remove();
      }
    }
  });
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
  document.getElementById('btn-nuevo-sector').addEventListener('click', () => { resetSectorForm(); openModal('sector-modal'); });
  document.getElementById('btn-salvar-sector').addEventListener('click', saveSector);
  document.getElementById('sector-color').addEventListener('input', function() {
    document.getElementById('sector-color-val').textContent = this.value;
  });
  document.getElementById('btn-guardar-config-email').addEventListener('click', guardarConfigEmail);

  // Acta upload handlers
  document.getElementById('acta-upload-area').addEventListener('click', e => {
    if (e.target === document.getElementById('btn-quitar-acta')) return;
    document.getElementById('acta-file').click();
  });
  document.getElementById('acta-file').addEventListener('change', function() {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('acta-img').src = e.target.result;
      document.getElementById('acta-placeholder').style.display = 'none';
      document.getElementById('acta-preview').style.display = '';
    };
    reader.readAsDataURL(file);
  });
  document.getElementById('btn-quitar-acta').addEventListener('click', function(e) {
    e.stopPropagation();
    document.getElementById('acta-file').value = '';
    document.getElementById('acta-preview').style.display = 'none';
    document.getElementById('acta-placeholder').style.display = '';
  });

  // Employee search in asignacion form
  let searchTimeout;
  document.getElementById('asig-nombre').addEventListener('input', function() {
    clearTimeout(searchTimeout);
    if (document.getElementById('asig-empleado-id').value) return;
    const val = this.value.trim();
    searchTimeout = setTimeout(() => buscarEmpleados(val), 300);
  });
  document.getElementById('asig-empleado-suggest').addEventListener('click', function(e) {
    const item = e.target.closest('.suggest-item');
    if (item) seleccionarEmpleadoSugerido(item);
  });
  document.getElementById('btn-cambiar-empleado').addEventListener('click', function() {
    resetAsignacionEmpleadoForm();
    document.getElementById('asig-nombre').focus();
  });

  // Control parental toggle
  document.getElementById('asig-control-parental').addEventListener('change', function() {
    const fields = document.getElementById('asig-cp-fields');
    if (this.checked) {
      fields.style.display = 'grid';
    } else {
      fields.style.display = 'none';
      document.getElementById('asig-cp-email').value = '';
      document.getElementById('asig-cp-pass').value = '';
    }
  });

  // Event delegation for historial buttons
  document.getElementById('historial-tbody').addEventListener('click', function(e) {
    const verBtn = e.target.closest('.ver-acta-btn');
    if (verBtn) { verActa(verBtn.dataset.url); return; }
    const devBtn = e.target.closest('.devolver-btn');
    if (devBtn) { devolverChip(devBtn.dataset.asig, devBtn.dataset.chip); return; }
    const delBtn = e.target.closest('.delete-asig-btn');
    if (delBtn) { deleteAsignacion(delBtn.dataset.id); return; }
  });

  // Close suggest on outside click
  document.addEventListener('click', function(e) {
    if (!e.target.closest('#asig-nombre') && !e.target.closest('#asig-empleado-suggest')) {
      document.getElementById('asig-empleado-suggest').style.display = 'none';
    }
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
    case 'sectores': loadSectores(); break;
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
  tbody.innerHTML = '<tr><td colspan="7" class="loading">Cargando...</td></tr>';
  try {
    const search = document.getElementById('search-empleados').value.trim();
    const sector = document.getElementById('filter-sector').value;
    const data = await getEmpleados({ search: search || undefined, sector: sector || undefined, orderBy: 'nombre' });
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📋</div><p>No hay empleados registrados</p></div></td></tr>';
      return;
    }
    tbody.innerHTML = data.map(e => `
      <tr>
        <td><strong>${escapeHtml(e.nombre)}</strong></td>
        <td>${escapeHtml(e.telefono || '')}</td>
        <td>${escapeHtml(e.email || '')}</td>
        <td><span class="badge badge-info">${escapeHtml(e.sector || 'Sin sector')}</span></td>
        <td>${escapeHtml(e.observaciones || '')}</td>
        <td>${e.cp_email ? '<span class="badge badge-info">CP: ' + escapeHtml(e.cp_email) + '</span>' : '—'}</td>
        <td>
          <div class="table-actions">
            <button class="btn-icon" onclick="editEmpleado('${e.id}')" title="Editar">✏️</button>
            <button class="btn-icon" onclick="deleteEmpleado('${e.id}')" title="Eliminar">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><p>Error: ${err.message}</p></div></td></tr>`;
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
    observaciones: document.getElementById('emp-observaciones').value.trim(),
    cp_email: document.getElementById('emp-cp-email').value.trim(),
    cp_pass: document.getElementById('emp-cp-pass').value.trim()
  };
  if (!data.nombre) { showToast('El nombre es obligatorio', 'error'); return; }
  try {
    if (id) {
      await db.collection('empleados').doc(id).update(data);
      // Update employee name/sector/cp in all related asignaciones
      const asigSnap = await db.collection('asignaciones').where('empleado_id', '==', id).get();
      if (!asigSnap.empty) {
        const batch = db.batch();
        asigSnap.docs.forEach(doc => {
          batch.update(doc.ref, { empleado_nombre: data.nombre, empleado_sector: data.sector || '', cp_email: data.cp_email, cp_pass: data.cp_pass });
        });
        await batch.commit();
      }
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
    document.getElementById('emp-observaciones').value = data.observaciones || '';
    document.getElementById('emp-cp-email').value = data.cp_email || '';
    document.getElementById('emp-cp-pass').value = data.cp_pass || '';
    await llenarSelectSectores('emp-sector', data.sector || '');
    document.getElementById('modal-empleado-title').textContent = 'Editar Empleado';
    openModal('empleado-modal');
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function resetEmpleadoForm() {
  document.getElementById('empleado-id').value = '';
  document.getElementById('emp-nombre').value = '';
  document.getElementById('emp-telefono').value = '';
  document.getElementById('emp-email').value = '';
  document.getElementById('emp-contraseña').value = '';
  document.getElementById('emp-observaciones').value = '';
  document.getElementById('emp-cp-email').value = '';
  document.getElementById('emp-cp-pass').value = '';
  await llenarSelectSectores('emp-sector');
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
  const operador = document.getElementById('chip-operador').value.trim();
  const estado = document.getElementById('chip-estado').value;
  const rawNums = document.getElementById('chip-numero').value.trim();

  if (!rawNums) { showToast('Ingresá al menos un número SIM', 'error'); return; }

  const numeros = rawNums.split('\n').map(s => s.trim()).filter(Boolean);

  if (numeros.length === 0) { showToast('Ingresá al menos un número SIM', 'error'); return; }

  try {
    if (id) {
      // Edit existing single chip — check another chip doesn't have this number
      const dup = await db.collection('chips')
        .where('numero_sim', '==', numeros[0])
        .limit(2).get();
      const dups = dup.docs.filter(d => d.id !== id);
      if (dups.length > 0) {
        showToast(`El número ${numeros[0]} ya está registrado en otro chip`, 'error');
        return;
      }
      await db.collection('chips').doc(id).update({
        numero_sim: numeros[0],
        operador,
        estado
      });
      showToast('Chip actualizado correctamente');
    } else {
      // Bulk create — check duplicates first
      const existingNums = new Set();
      // Firestore 'in' max 10 items, so chunk
      for (let i = 0; i < numeros.length; i += 10) {
        const chunk = numeros.slice(i, i + 10);
        const snap = await db.collection('chips')
          .where('numero_sim', 'in', chunk)
          .get();
        snap.docs.forEach(d => existingNums.add(d.data().numero_sim));
      }
      const duplicados = numeros.filter(n => existingNums.has(n));
      const nuevos = numeros.filter(n => !existingNums.has(n));

      if (duplicados.length > 0) {
        showToast(`${duplicados.length} número(s) ya existen: ${duplicados.join(', ')}`, 'warning');
      }

      if (nuevos.length === 0) {
        showToast('No hay números nuevos para registrar', 'error');
        return;
      }

      const batch = db.batch();
      const now = new Date().toISOString();
      for (const num of nuevos) {
        const ref = db.collection('chips').doc();
        batch.set(ref, { numero_sim: num, operador, estado, createdAt: now });
      }
      await batch.commit();
      showToast(`${nuevos.length} chip(s) registrado(s) correctamente`);
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

// ========== SECTORES ==========

const SECTORES_DEFECTO = [
  'SWAT', 'GÉNESIS', 'FÁBRICA', 'INSTALADORES', 'COMERCIALES',
  'COORDINACIÓN', 'BONA', 'REDES', 'IMAGEN', 'ASISTENTES',
  'CONTADURÍA', 'FOUNDERS', 'SEGURIDAD', 'SERVICIO TÉCNICO'
];

async function cargarSectoresDefecto() {
  try {
    const snap = await db.collection('sectores').limit(1).get();
    if (!snap.empty) return;
    const batch = db.batch();
    for (const nombre of SECTORES_DEFECTO) {
      const ref = db.collection('sectores').doc();
      batch.set(ref, { nombre, color: '#64748b', createdAt: new Date().toISOString() });
    }
    await batch.commit();
  } catch (e) {
    console.warn('Error al crear sectores por defecto:', e);
  }
}

async function getSectores() {
  const snap = await db.collection('sectores').orderBy('nombre').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadSectores() {
  const tbody = document.getElementById('sectores-tbody');
  tbody.innerHTML = '<tr><td colspan="4" class="loading">Cargando...</td></tr>';
  try {
    const data = await getSectores();
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">🏷️</div><p>No hay sectores creados</p></div></td></tr>';
      return;
    }
    tbody.innerHTML = data.map(s => `
      <tr>
        <td><span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:${escapeHtml(s.color || '#64748b')};vertical-align:middle;margin-right:8px"></span></td>
        <td><strong>${escapeHtml(s.nombre)}</strong></td>
        <td>${formatDate(s.createdAt)}</td>
        <td>
          <div class="table-actions">
            <button class="btn-icon" onclick="editSector('${s.id}')" title="Editar">✏️</button>
            <button class="btn-icon" onclick="deleteSector('${s.id}')" title="Eliminar">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><p>Error: ${err.message}</p></div></td></tr>`;
    showToast('Error al cargar sectores', 'error');
  }
}

async function saveSector() {
  const btn = document.getElementById('btn-salvar-sector');
  btn.disabled = true;
  btn.textContent = 'Guardando...';
  const id = document.getElementById('sector-id').value;
  const data = {
    nombre: document.getElementById('sector-nombre').value.trim().toUpperCase(),
    color: document.getElementById('sector-color').value
  };
  if (!data.nombre) { showToast('El nombre es obligatorio', 'error'); btn.disabled = false; btn.textContent = 'Guardar'; return; }
  try {
    if (id) {
      await db.collection('sectores').doc(id).update(data);
      showToast('Sector actualizado');
    } else {
      data.createdAt = new Date().toISOString();
      await db.collection('sectores').add(data);
      showToast('Sector creado');
    }
    closeModal(document.getElementById('sector-modal'));
    loadSectores();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
  btn.disabled = false;
  btn.textContent = 'Guardar';
}

async function editSector(id) {
  try {
    const doc = await db.collection('sectores').doc(id).get();
    if (!doc.exists) return;
    const d = doc.data();
    document.getElementById('sector-id').value = doc.id;
    document.getElementById('sector-nombre').value = d.nombre || '';
    document.getElementById('sector-color').value = d.color || '#64748b';
    document.getElementById('sector-color-val').textContent = d.color || '#64748b';
    document.getElementById('modal-sector-title').textContent = 'Editar Sector';
    openModal('sector-modal');
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

function resetSectorForm() {
  document.getElementById('sector-id').value = '';
  document.getElementById('sector-nombre').value = '';
  document.getElementById('sector-color').value = '#64748b';
  document.getElementById('sector-color-val').textContent = '#64748b';
  document.getElementById('modal-sector-title').textContent = 'Nuevo Sector';
}

async function deleteSector(id) {
  if (!confirm('¿Eliminar este sector?')) return;
  try {
    await db.collection('sectores').doc(id).delete();
    showToast('Sector eliminado');
    loadSectores();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function llenarSelectSectores(selectId, selected, emptyLabel) {
  const select = document.getElementById(selectId);
  emptyLabel = emptyLabel || 'Sin sector';
  try {
    const data = await getSectores();
    select.innerHTML = `<option value="">${escapeHtml(emptyLabel)}</option>` +
      data.map(s => `<option value="${escapeHtml(s.nombre)}" ${s.nombre === selected ? 'selected' : ''}>${escapeHtml(s.nombre)}</option>`).join('');
  } catch (e) {
    select.innerHTML = `<option value="">${escapeHtml(emptyLabel)}</option>`;
  }
}

// ========== ASIGNACIONES ==========

async function loadAsignaciones() {
  await Promise.all([
    loadAsignacionForm(),
    loadAsignacionHistorial(),
    llenarSelectSectores('asig-sector')
  ]);
}

function addChipRow() {
  const container = document.getElementById('asig-chips-rows');
  const template = container.querySelector('.asig-chip-row');
  const newRow = template.cloneNode(true);
  // Copy options from first select (they're all the same)
  const firstSelect = template.querySelector('.asig-chip-select');
  newRow.querySelector('.asig-chip-select').innerHTML = firstSelect.innerHTML;
  newRow.querySelector('.asig-chip-select').value = '';
  newRow.querySelector('.asig-chip-celular').checked = false;
  newRow.querySelector('.asig-chip-modelo').value = '';
  container.appendChild(newRow);
}

// Mutex for chip selects via event delegation — remove taken chips from other selects
document.getElementById('asig-chips-rows').addEventListener('change', function(e) {
  const sel = e.target.closest('.asig-chip-select');
  if (!sel) return;
  const selects = this.querySelectorAll('.asig-chip-select');
  // Collect taken values (excluding the current select's own value)
  const taken = [];
  selects.forEach(s => { if (s !== sel && s.value) taken.push(s.value); });
  // Rebuild each select removing taken chips
  selects.forEach(s => {
    const currentVal = s.value;
    // Keep only options not in taken (or the currently selected one)
    const options = Array.from(s.options).filter(opt => {
      return !opt.value || opt.value === currentVal || !taken.includes(opt.value);
    });
    s.innerHTML = options.map(opt => opt.outerHTML).join('');
    if (currentVal) s.value = currentVal;
  });
});

async function loadAsignacionForm() {
  try {
    const [chipSnap, asigSnap] = await Promise.all([
      db.collection('chips').get(),
      db.collection('asignaciones').where('fecha_devolucion', '==', null).get()
    ]);
    const assignedIds = new Set(asigSnap.docs.map(d => d.data().chip_id));
    // Also check chips array in older documents
    asigSnap.docs.forEach(d => {
      const data = d.data();
      if (data.chips) data.chips.forEach(c => assignedIds.add(c.chip_id));
    });
    const chips = chipSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(c => c.estado === 'disponible' && !assignedIds.has(c.id));
    chips.sort((a, b) => (a.numero_sim || '').localeCompare(b.numero_sim || ''));
    const chipOpts = chips.map(c => `<option value="${c.id}">${escapeHtml(c.numero_sim)}</option>`).join('');
    document.getElementById('asignar-disponibles').textContent = chips.length;

    // Populate all chip selects (preserves current values)
    const allSelects = document.querySelectorAll('.asig-chip-select');
    allSelects.forEach(sel => {
      const currentVal = sel.value;
      sel.innerHTML = '<option value="">Seleccionar...</option>' + chipOpts;
      if (currentVal) sel.value = currentVal;
    });

    // Reset employee form and acta upload
    resetAsignacionEmpleadoForm();

    // Reset acta upload
    document.getElementById('acta-file').value = '';
    document.getElementById('acta-preview').style.display = 'none';
    document.getElementById('acta-placeholder').style.display = '';

  } catch (err) {
    showToast('Error al cargar formulario', 'error');
  }
}

function resetAsignacionEmpleadoForm() {
  document.getElementById('asig-empleado-id').value = '';
  document.getElementById('asig-nombre').value = '';
  document.getElementById('asig-dni').value = '';
  document.getElementById('asig-telefono').value = '';
  document.getElementById('asig-email').value = '';
  document.getElementById('asig-contraseña').value = '';
  document.getElementById('asig-sector').value = '';
  document.getElementById('asig-empleado-selected').style.display = 'none';
  document.getElementById('asig-empleado-suggest').style.display = 'none';
  document.getElementById('asig-empleado-suggest').innerHTML = '';
  enableEmpleadoFields(true);
}

function enableEmpleadoFields(editable) {
  ['asig-nombre', 'asig-dni', 'asig-telefono', 'asig-email', 'asig-contraseña'].forEach(id => document.getElementById(id).readOnly = !editable);
  document.getElementById('asig-sector').disabled = !editable;
}

async function buscarEmpleados(query) {
  if (!query || query.length < 2) {
    document.getElementById('asig-empleado-suggest').style.display = 'none';
    return;
  }
  try {
    const snap = await db.collection('empleados')
      .where('nombre', '>=', query)
      .where('nombre', '<=', query + '\uf8ff')
      .orderBy('nombre')
      .limit(8)
      .get();
    const suggest = document.getElementById('asig-empleado-suggest');
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (items.length === 0) {
      suggest.style.display = 'none';
      return;
    }
    suggest.innerHTML = items.map(e =>
      `<div class="suggest-item" data-id="${e.id}" data-nombre="${escapeHtml(e.nombre)}" data-telefono="${escapeHtml(e.telefono || '')}" data-email="${escapeHtml(e.email || '')}" data-contraseña="${escapeHtml(e.contraseña || '')}" data-sector="${escapeHtml(e.sector || '')}" data-cp-email="${escapeHtml(e.cp_email || '')}" data-cp-pass="${escapeHtml(e.cp_pass || '')}">
        <strong>${escapeHtml(e.nombre)}</strong>
        ${e.sector ? '<span style="font-size:11px;color:var(--text-muted)"> — ' + escapeHtml(e.sector) + '</span>' : ''}
      </div>`
    ).join('');
    suggest.style.display = 'block';
  } catch (e) {
    // ignore search errors
  }
}

function seleccionarEmpleadoSugerido(el) {
  document.getElementById('asig-empleado-id').value = el.dataset.id;
  document.getElementById('asig-nombre').value = el.dataset.nombre;
  document.getElementById('asig-telefono').value = el.dataset.telefono;
  document.getElementById('asig-email').value = el.dataset.email;
  document.getElementById('asig-contraseña').value = el.dataset.contraseña;
  document.getElementById('asig-sector').value = el.dataset.sector;
  document.getElementById('asig-cp-email').value = el.dataset.cpEmail;
  document.getElementById('asig-cp-pass').value = el.dataset.cpPass;
  document.getElementById('asig-empleado-suggest').style.display = 'none';
  document.getElementById('asig-empleado-selected-nombre').textContent = el.dataset.nombre;
  document.getElementById('asig-empleado-selected').style.display = 'block';
  enableEmpleadoFields(false);
}

async function asignarChip() {
  const rows = document.querySelectorAll('.asig-chip-row');
  const chipsData = [];
  for (const row of rows) {
    const chip_id = row.querySelector('.asig-chip-select').value;
    if (!chip_id) continue;
    const chip_numero = row.querySelector('.asig-chip-select').selectedOptions[0]?.textContent || '';
    const celular_asignado = row.querySelector('.asig-chip-celular').checked;
    const modelo_celular = row.querySelector('.asig-chip-modelo').value.trim();
    chipsData.push({ chip_id, chip_numero, celular_asignado, modelo_celular });
  }
  if (chipsData.length === 0) { showToast('Seleccioná al menos un chip', 'error'); return; }
  const observaciones = document.getElementById('asig-observaciones').value.trim();
  const actaFile = document.getElementById('acta-file').files[0];

  // Check duplicates
  for (const c of chipsData) {
    const existingAsig = await db.collection('asignaciones')
      .where('chip_id', '==', c.chip_id)
      .where('fecha_devolucion', '==', null)
      .limit(1).get();
    if (!existingAsig.empty) {
      const who = existingAsig.docs[0].data().empleado_nombre || 'otro empleado';
      showToast(`El chip ${c.chip_numero} ya está asignado a ${who}`, 'error');
      return;
    }
  }

  let empleado_id = document.getElementById('asig-empleado-id').value;
  const empNombre = document.getElementById('asig-nombre').value.trim();
  if (!empNombre) { showToast('Ingresá el nombre del empleado', 'error'); return; }

  const btn = document.getElementById('btn-asignar');
  btn.disabled = true;
  btn.textContent = 'Asignando...';

  try {
    if (!empleado_id) {
      const cpEmail = document.getElementById('asig-cp-email').value.trim();
      const cpPass = document.getElementById('asig-cp-pass').value.trim();
      const cpChecked = document.getElementById('asig-control-parental').checked;
      const empData = {
        nombre: empNombre,
        dni: document.getElementById('asig-dni').value.trim(),
        telefono: document.getElementById('asig-telefono').value.trim(),
        email: document.getElementById('asig-email').value.trim(),
        contraseña: document.getElementById('asig-contraseña').value.trim(),
        sector: document.getElementById('asig-sector').value,
        cp_email: cpChecked ? cpEmail : '',
        cp_pass: cpChecked ? cpPass : '',
        createdAt: new Date().toISOString()
      };
      const empRef = await db.collection('empleados').add(empData);
      empleado_id = empRef.id;
    }

    const empDoc = await db.collection('empleados').doc(empleado_id).get();
    if (!empDoc.exists) { showToast('Empleado no encontrado', 'error'); btn.disabled = false; btn.textContent = '✓ Asignar Chip'; return; }
    const empData = empDoc.data();

    const cpChecked = document.getElementById('asig-control-parental').checked;
    const cpEmail = document.getElementById('asig-cp-email').value.trim();
    const cpPass = document.getElementById('asig-cp-pass').value.trim();
    const fecha = new Date().toISOString().split('T')[0];
    const timestamp = new Date().toISOString();

    let firstAsigId = null;

    for (const chip of chipsData) {
      await db.collection('chips').doc(chip.chip_id).update({ estado: 'asignado' });
      const asigRef = await db.collection('asignaciones').add({
        chip_id: chip.chip_id,
        chip_numero: chip.chip_numero,
        empleado_id,
        empleado_nombre: empData.nombre,
        empleado_sector: empData.sector || '',
        celular_asignado: chip.celular_asignado,
        modelo_celular: chip.modelo_celular,
        control_parental: cpChecked,
        cp_email: cpEmail,
        cp_pass: cpPass,
        observaciones,
        fecha_asignacion: fecha,
        fecha_devolucion: null,
        createdAt: timestamp
      });
      if (!firstAsigId) firstAsigId = asigRef.id;

      // Attach acta to first chip entry only
      if (actaFile && firstAsigId === asigRef.id) {
        const ext = actaFile.name.split('.').pop() || 'jpg';
        const actaPath = `actas/${asigRef.id}.${ext}`;
        const ref = storage.ref(actaPath);
        const snap = await ref.put(actaFile);
        const acta_url = await snap.ref.getDownloadURL();
        await asigRef.update({ acta_url, acta_path: actaPath });
      }
    }

    // Persist control parental data in employee record
    await db.collection('empleados').doc(empleado_id).update({
      cp_email: cpChecked ? cpEmail : '',
      cp_pass: cpChecked ? cpPass : ''
    });

    enviarEmailAsignacion(empData, chipsData, { control_parental: cpChecked, cp_email: cpEmail, cp_pass: cpPass });
    showToast('Chip(es) asignado(s) correctamente');
    resetAsignacionForm();
    loadAsignaciones();
  } catch (err) {
    const msg = err.message.toLowerCase();
    if (msg.includes('permission') || msg.includes('unauthorized')) {
      showToast('Permiso denegado: activá las reglas públicas en Firebase Console > Storage > Reglas', 'error');
    } else {
      showToast('Error: ' + err.message, 'error');
    }
  }
  btn.disabled = false;
  btn.textContent = '✓ Asignar Chip';
}

function resetAsignacionForm() {
  // Remove all chip rows except the first one
  const container = document.getElementById('asig-chips-rows');
  const rows = container.querySelectorAll('.asig-chip-row');
  for (let i = 1; i < rows.length; i++) rows[i].remove();
  // Reset first row
  const firstRow = container.querySelector('.asig-chip-row');
  if (firstRow) {
    firstRow.querySelector('.asig-chip-select').value = '';
    firstRow.querySelector('.asig-chip-celular').checked = false;
    firstRow.querySelector('.asig-chip-modelo').value = '';
  }
  document.getElementById('asig-control-parental').checked = false;
  document.getElementById('asig-cp-fields').style.display = 'none';
  document.getElementById('asig-cp-email').value = '';
  document.getElementById('asig-cp-pass').value = '';
  document.getElementById('asig-observaciones').value = '';
  document.getElementById('acta-file').value = '';
  document.getElementById('acta-preview').style.display = 'none';
  document.getElementById('acta-placeholder').style.display = '';
  resetAsignacionEmpleadoForm();
}

async function loadAsignacionHistorial() {
  const tbody = document.getElementById('historial-tbody');
  tbody.innerHTML = '<tr><td colspan="9" class="loading">Cargando...</td></tr>';
  try {
    const data = await getAsignaciones();
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">📄</div><p>No hay asignaciones aún</p></div></td></tr>';
      return;
    }
    tbody.innerHTML = data.map(a => {
      const actaBtn = a.acta_url
        ? `<button class="btn btn-sm btn-outline ver-acta-btn" data-url="${escapeHtml(a.acta_url)}">📄 Ver acta</button>`
        : '—';
      const cpInfo = a.control_parental
        ? `<span class="badge badge-info" title="CP: ${escapeHtml(a.cp_email || '')}">🔒 ${escapeHtml(a.cp_email || 'Sí')}</span>`
        : '—';
      return `<tr>
        <td>${escapeHtml(a.empleado_nombre || '—')}</td>
        <td>${a.empleado_sector ? '<span class="badge badge-info">' + escapeHtml(a.empleado_sector) + '</span>' : '—'}</td>
        <td><strong>${escapeHtml(a.chip_numero || '—')}</strong></td>
        <td>${formatDate(a.fecha_asignacion)}</td>
        <td>${a.fecha_devolucion ? formatDate(a.fecha_devolucion) : '<span class="badge badge-warning">Activo</span>'}</td>
        <td>${a.celular_asignado ? '✅ Sí' + (a.modelo_celular ? ' (' + escapeHtml(a.modelo_celular) + ')' : '') : '❌ No'}</td>
        <td>${cpInfo}</td>
        <td>${actaBtn}</td>
        <td>
          <div class="table-actions">
            ${!a.fecha_devolucion ? `<button class="btn btn-sm btn-warning devolver-btn" data-asig="${a.id}" data-chip="${a.chip_id}">↩ Devolver</button>` : ''}
            <button class="btn-icon delete-asig-btn" data-id="${a.id}" title="Eliminar">🗑️</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><p>Error: ${err.message}</p></div></td></tr>`;
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
    const doc = await db.collection('asignaciones').doc(id).get();
    if (doc.exists) {
      const d = doc.data();
      const actaPath = d.acta_path;
      if (actaPath) {
        try { await storage.ref(actaPath).delete(); } catch (e) { /* already gone */ }
      }
      try { await db.collection('chips').doc(d.chip_id).update({ estado: 'disponible' }); } catch (e) {}
    }
    await db.collection('asignaciones').doc(id).delete();
    showToast('Asignación eliminada del historial');
    loadAsignaciones();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

function verActa(url) {
  document.getElementById('acta-modal-img').src = url;
  openModal('acta-modal');
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
