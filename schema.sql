-- Ejecutar esto en el SQL Editor de Supabase
-- Ve a: https://supabase.com -> SQL Editor -> New Query

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE empleados (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  telefono TEXT DEFAULT '',
  email TEXT DEFAULT '',
  contraseña TEXT DEFAULT '',
  sector TEXT DEFAULT '',
  observaciones TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_sim TEXT UNIQUE NOT NULL,
  operador TEXT DEFAULT '',
  estado TEXT DEFAULT 'disponible' CHECK (estado IN ('disponible', 'asignado', 'inactivo')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE asignaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chip_id UUID REFERENCES chips(id) ON DELETE RESTRICT,
  empleado_id UUID REFERENCES empleados(id) ON DELETE RESTRICT,
  fecha_asignacion DATE DEFAULT CURRENT_DATE,
  fecha_devolucion DATE,
  celular_asignado BOOLEAN DEFAULT FALSE,
  modelo_celular TEXT DEFAULT '',
  observaciones TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_asignaciones_chip_id ON asignaciones(chip_id);
CREATE INDEX idx_asignaciones_empleado_id ON asignaciones(empleado_id);
CREATE INDEX idx_chips_estado ON chips(estado);

-- Para RLS (opcional): permitir todo en modo desarrollo
ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;
ALTER TABLE chips ENABLE ROW LEVEL SECURITY;
ALTER TABLE asignaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir todo a anon" ON empleados FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a anon" ON chips FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a anon" ON asignaciones FOR ALL USING (true) WITH CHECK (true);
