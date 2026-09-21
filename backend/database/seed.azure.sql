
-- ============================================
-- SEED: Categorías iniciales
-- ============================================

IF NOT EXISTS (SELECT 1 FROM categorias WHERE nombre = 'Herramientas')
BEGIN
    INSERT INTO categorias (nombre, descripcion)
    VALUES ('Herramientas', 'Herramientas manuales y eléctricas');
END

IF NOT EXISTS (SELECT 1 FROM categorias WHERE nombre = 'Pintura')
BEGIN
    INSERT INTO categorias (nombre, descripcion)
    VALUES ('Pintura', 'Pinturas, brochas y accesorios');
END


IF NOT EXISTS (SELECT 1 FROM categorias WHERE nombre = 'Plomería')
BEGIN
    INSERT INTO categorias (nombre, descripcion)
    VALUES ('Plomería', 'Tuberías, conexiones y accesorios de plomería');
END


IF NOT EXISTS (SELECT 1 FROM categorias WHERE nombre = 'Electricidad')
BEGIN
    INSERT INTO categorias (nombre, descripcion)
    VALUES ('Electricidad', 'Materiales y accesorios eléctricos');
END


IF NOT EXISTS (SELECT 1 FROM categorias WHERE nombre = 'Construcción')
BEGIN
    INSERT INTO categorias (nombre, descripcion)
    VALUES ('Construcción', 'Materiales para construcción y obra');
END


IF NOT EXISTS (SELECT 1 FROM categorias WHERE nombre = 'Jardín')
BEGIN
    INSERT INTO categorias (nombre, descripcion)
    VALUES ('Jardín', 'Herramientas y accesorios para jardinería');
END



-- ============================================
-- SEED: Productos iniciales
-- ============================================

IF NOT EXISTS (SELECT 1 FROM productos WHERE codigo = 'HER-001')
BEGIN
    INSERT INTO productos (
        nombre,
        descripcion,
        codigo,
        precio,
        imagen_url,
        stock_actual,
        stock_minimo,
        id_categoria,
        estado
    )
    VALUES (
        'Taladro Inalámbrico',
        'Taladro inalámbrico ideal para perforación y atornillado.',
        'HER-001',
        89.99,
        '/products/taladro-inalambrico.jpg',
        18,
        5,
        (SELECT id_categoria FROM categorias WHERE nombre = 'Herramientas'),
        1
    );
END


IF NOT EXISTS (SELECT 1 FROM productos WHERE codigo = 'HER-002')
BEGIN
    INSERT INTO productos (
        nombre,
        descripcion,
        codigo,
        precio,
        imagen_url,
        stock_actual,
        stock_minimo,
        id_categoria,
        estado
    )
    VALUES (
        'Martillo Profesional',
        'Martillo profesional con mango ergonómico.',
        'HER-002',
        24.50,
        '/products/martillo-profesional.jpg',
        30,
        8,
        (SELECT id_categoria FROM categorias WHERE nombre = 'Herramientas'),
        1
    );
END


IF NOT EXISTS (SELECT 1 FROM productos WHERE codigo = 'HER-003')
BEGIN
    INSERT INTO productos (
        nombre,
        descripcion,
        codigo,
        precio,
        imagen_url,
        stock_actual,
        stock_minimo,
        id_categoria,
        estado
    )
    VALUES (
        'Sierra Circular',
        'Sierra circular para cortes precisos en madera.',
        'HER-003',
        145.00,
        '/products/sierra-circular.jpg',
        9,
        4,
        (SELECT id_categoria FROM categorias WHERE nombre = 'Herramientas'),
        1
    );
END


IF NOT EXISTS (SELECT 1 FROM productos WHERE codigo = 'HER-004')
BEGIN
    INSERT INTO productos (
        nombre,
        descripcion,
        codigo,
        precio,
        imagen_url,
        stock_actual,
        stock_minimo,
        id_categoria,
        estado
    )
    VALUES (
        'Juego de Destornilladores',
        'Juego de destornilladores planos y Phillips.',
        'HER-004',
        18.99,
        '/products/destornilladores.jpg',
        25,
        6,
        (SELECT id_categoria FROM categorias WHERE nombre = 'Herramientas'),
        1
    );
END


IF NOT EXISTS (SELECT 1 FROM productos WHERE codigo = 'HER-005')
BEGIN
    INSERT INTO productos (
        nombre,
        descripcion,
        codigo,
        precio,
        imagen_url,
        stock_actual,
        stock_minimo,
        id_categoria,
        estado
    )
    VALUES (
        'Llave Ajustable 12 pulgadas',
        'Llave ajustable de acero para trabajos de mantenimiento.',
        'HER-005',
        15.75,
        '/products/llave-ajustable.jpg',
        14,
        5,
        (SELECT id_categoria FROM categorias WHERE nombre = 'Herramientas'),
        1
    );
END


IF NOT EXISTS (SELECT 1 FROM productos WHERE codigo = 'HER-006')
BEGIN
    INSERT INTO productos (
        nombre,
        descripcion,
        codigo,
        precio,
        imagen_url,
        stock_actual,
        stock_minimo,
        id_categoria,
        estado
    )
    VALUES (
        'Cinta Métrica 5m',
        'Cinta métrica retráctil de cinco metros.',
        'HER-006',
        8.50,
        '/products/cinta-metrica.jpg',
        40,
        10,
        (SELECT id_categoria FROM categorias WHERE nombre = 'Herramientas'),
        1
    );
END


IF NOT EXISTS (SELECT 1 FROM productos WHERE codigo = 'PIN-001')
BEGIN
    INSERT INTO productos (
        nombre,
        descripcion,
        codigo,
        precio,
        imagen_url,
        stock_actual,
        stock_minimo,
        id_categoria,
        estado
    )
    VALUES (
        'Pintura Blanca 1 Galón',
        'Pintura blanca para interiores de alto rendimiento.',
        'PIN-001',
        32.00,
        '/products/pintura-blanca.jpg',
        12,
        5,
        (SELECT id_categoria FROM categorias WHERE nombre = 'Pintura'),
        1
    );
END


IF NOT EXISTS (SELECT 1 FROM productos WHERE codigo = 'PLO-001')
BEGIN
    INSERT INTO productos (
        nombre,
        descripcion,
        codigo,
        precio,
        imagen_url,
        stock_actual,
        stock_minimo,
        id_categoria,
        estado
    )
    VALUES (
        'Tubo PVC 1/2 pulgada',
        'Tubo PVC para instalaciones hidráulicas.',
        'PLO-001',
        6.25,
        '/products/tubo-pvc.jpg',
        50,
        15,
        (SELECT id_categoria FROM categorias WHERE nombre = 'Plomería'),
        1
    );
END


IF NOT EXISTS (SELECT 1 FROM productos WHERE codigo = 'ELE-001')
BEGIN
    INSERT INTO productos (
        nombre,
        descripcion,
        codigo,
        precio,
        imagen_url,
        stock_actual,
        stock_minimo,
        id_categoria,
        estado
    )
    VALUES (
        'Cable Eléctrico THHN',
        'Cable eléctrico THHN para instalaciones residenciales.',
        'ELE-001',
        21.50,
        '/products/cable-electrico.jpg',
        7,
        10,
        (SELECT id_categoria FROM categorias WHERE nombre = 'Electricidad'),
        1
    );
END


IF NOT EXISTS (SELECT 1 FROM productos WHERE codigo = 'CON-001')
BEGIN
    INSERT INTO productos (
        nombre,
        descripcion,
        codigo,
        precio,
        imagen_url,
        stock_actual,
        stock_minimo,
        id_categoria,
        estado
    )
    VALUES (
        'Cemento Gris 42.5 kg',
        'Bolsa de cemento gris para trabajos generales de construcción.',
        'CON-001',
        9.75,
        '/products/cemento-gris.jpg',
        35,
        12,
        (SELECT id_categoria FROM categorias WHERE nombre = 'Construcción'),
        1
    );
END


IF NOT EXISTS (SELECT 1 FROM productos WHERE codigo = 'JAR-001')
BEGIN
    INSERT INTO productos (
        nombre,
        descripcion,
        codigo,
        precio,
        imagen_url,
        stock_actual,
        stock_minimo,
        id_categoria,
        estado
    )
    VALUES (
        'Pala de Jardín',
        'Pala resistente para jardinería y trabajos de exterior.',
        'JAR-001',
        19.99,
        '/products/pala-jardin.jpg',
        3,
        5,
        (SELECT id_categoria FROM categorias WHERE nombre = 'Jardín'),
        1
    );
END



-- ============================================
-- Verificación
-- ============================================

SELECT * FROM categorias;


SELECT * FROM productos;
