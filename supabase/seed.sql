-- ============================================================
--  Datos iniciales (seed) para el Programa Escolar de Artesanos
--  Ejecuta este archivo después de schema.sql
-- ============================================================

-- Información del programa
INSERT INTO program_info (section, title, content) VALUES
('history', 'Nuestra Historia', 'El Programa Escolar de Artesanos nació en los talleres de nuestra escuela con la misión de rescatar y celebrar las tradiciones artesanales de Puerto Rico. Desde entonces, hemos formado a cientos de jóvenes en oficios como la cerámica, el tejido, la talla en madera y el arte del coquí.'),
('objectives', 'Objetivos', 'Fomentar el amor por el trabajo manual, preservar saberes ancestrales y desarrollar habilidades emprendedoras en los estudiantes mediante talleres prácticos y mentoría con artesanos locales.'),
('benefits', 'Beneficios para los estudiantes', 'Los participantes desarrollan creatividad, disciplina y autoestima. Además, obtienen experiencia en ferias, certificados de participación y la oportunidad de vender sus creaciones.'),
('activities', 'Actividades que realizamos', 'Talleres semanales, visitas a comunidades artesanales, ferias escolares, exposiciones y proyectos colaborativos con artistas puertorriqueños.');

-- Requisitos
INSERT INTO requirements (category, title, description, sort_order) VALUES
('documents', 'Solicitud firmada', 'Formulario de inscripción completado y firmado por el estudiante y un tutor.', 1),
('documents', 'Certificado de matrícula', 'Constancia de matrícula vigente de la escuela.', 2),
('criteria', 'Interés por las artes', 'Demostrar interés y compromiso con las actividades artesanales.', 1),
('criteria', 'Disponibilidad', 'Contar con disponibilidad para asistir a los talleres programados.', 2),
('dates', 'Inscripción abierta', 'Las inscripciones permanecen abiertas del 1 de septiembre al 30 de octubre.', 1),
('dates', 'Inicio de talleres', 'Los talleres inician la primera semana de noviembre.', 2);

-- Artesanos actuales
INSERT INTO artisans (name, specialty, description, photo) VALUES
('María López', 'Cerámica', 'Especialista en alfarería tradicional y diseño de vasijas criollas.', 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=400&q=80'),
('José Rivera', 'Talla en madera', 'Talla figuras del coquí y santos de palo con técnicas heredadas de su abuelo.', 'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=400&q=80'),
('Carmen Santos', 'Tejido', 'Crea hamacas y manteles con telares artesanales de fibras naturales.', 'https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?w=400&q=80');

-- Artesanos anteriores
INSERT INTO alumni (name, year, description, photo) VALUES
('Luis Colón', 2021, 'Hoy dirige su propio taller de joyería en San Juan.', 'https://images.unsplash.com/photo-1535551951406-a19828b0a76b?w=400&q=80'),
('Ana Pérez', 2020, 'Ilustradora y artesana del papel reciclado.', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80'),
('Pedro Díaz', 2019, 'Maestro tallador reconocido en ferias nacionales.', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80');

-- Galería
INSERT INTO gallery (title, image) VALUES
('Taller de cerámica', 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=600&q=80'),
('Feria escolar', 'https://images.unsplash.com/photo-1531058020387-3be344556be6?w=600&q=80'),
('Tejido a mano', 'https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?w=600&q=80'),
('Exposición de madera', 'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=600&q=80');

-- Próxima feria
INSERT INTO craft_fair (title, event_date, event_time, location, map_url, description, requirements) VALUES
('Feria de Artesanías Escolares 2026', '2026-11-15', '10:00 AM', 'Plaza del Mercado, Old San Juan, Puerto Rico',
 'https://www.google.com/maps?q=Old+San+Juan,+Puerto+Rico&output=embed',
 'Gran encuentro de artesanos escolares con venta de piezas únicas, música y comida típica puertorriqueña.',
 'Traer identificación escolar, mesa propia y productos etiquetados.');

-- Avisos de artesanos
INSERT INTO artisan_notices (title, body, is_urgent) VALUES
('Reunión de organización', 'Recordatorio: reunión este viernes a las 3:00 PM en el taller principal.', FALSE),
('Entrega de materiales', 'Último día para retirar materiales subsidiados es el miércoles.', TRUE);

-- Actividades (calendario)
INSERT INTO activities (title, activity_date, description) VALUES
('Taller de cerámica', '2026-09-12', 'Introducción a la alfarería.'),
('Visita a comunidad artesanal', '2026-10-03', 'Recorrido por Vega Alta.'),
('Preparación de feria', '2026-11-01', 'Montaje y logística.');

-- Documentos (archivos de ejemplo servidos como estáticos desde /uploads)
INSERT INTO documents (title, filename) VALUES
('Guía del artesano', 'uploads/guia-artesano.pdf'),
('Formulario de inscripción', 'uploads/formulario.pdf');
