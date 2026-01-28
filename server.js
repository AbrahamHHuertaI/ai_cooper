const express = require("express");
const natural = require("natural");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(express.json());

// Función para normalizar texto
function normalize(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[^\p{L}\p{N}\s/.-]/gu, " ") // deja letras/numeros/espacios y / . -
    .replace(/\s+/g, " ")
    .trim();
}

// Función para tokenizar texto
function tokenize(text) {
  return normalize(text).split(" ").filter(Boolean);
}

// Función para calcular similitud de Jaccard
function jaccard(tokensA, tokensB) {
  const A = new Set(tokensA);
  const B = new Set(tokensB);
  const inter = [...A].filter(x => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return union === 0 ? 0 : inter / union;
}

// Función para calcular similitud de Levenshtein
function levenshteinSim(a, b) {
  if (!a && !b) return 1;
  const dist = natural.LevenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length) || 1;
  return 1 - dist / maxLen; // 0..1
}

/**
 * Construye un índice a partir de ejemplos.
 */
function buildIndex(intents) {
  return Object.entries(intents).map(([intentName, examples]) => {
    const items = examples.map(ex => {
      const norm = normalize(ex);
      return { raw: ex, norm, tokens: tokenize(ex) };
    });
    return { intentName, items };
  });
}

/**
 * Calcula el score combinado de similitud
 */
function score(inputNorm, inputTokens, example) {
  const jac = jaccard(inputTokens, example.tokens);
  const lev = levenshteinSim(inputNorm, example.norm);

  // bonus si un ejemplo es substring del input o viceversa
  const contains =
    inputNorm.includes(example.norm) || example.norm.includes(inputNorm) ? 1 : 0;

  // pesos
  return 0.55 * jac + 0.35 * lev + 0.10 * contains;
}

/**
 * Clasifica la intención de un texto
 */
function classifyIntent(text, index, options = {}) {
  const {
    threshold = 0.3,     // si baja de esto => unknown
    minMargin = 0.06      // diferencia mínima vs el segundo lugar
  } = options;

  const inputNorm = normalize(text);
  const inputTokens = tokenize(text);

  // atajos de comandos
  if (inputNorm === "/start") {
    return { intent: "greeting", confidence: 1, matchedExample: "/start" };
  }

  let best = { intent: "unknown", confidence: 0, matchedExample: null };
  let second = { confidence: 0 };

  for (const intent of index) {
    for (const ex of intent.items) {
      const s = score(inputNorm, inputTokens, ex);
      if (s > best.confidence) {
        second = best;
        best = { intent: intent.intentName, confidence: s, matchedExample: ex.raw };
      } else if (s > second.confidence) {
        second = { intent: intent.intentName, confidence: s, matchedExample: ex.raw };
      }
    }
  }

  const margin = best.confidence - second.confidence;
  if (best.confidence < threshold || margin < minMargin) {
    return { intent: "unknown", confidence: best.confidence, matchedExample: best.matchedExample };
  }
  return best;
}

// Intents predefinidos (puedes moverlos a un archivo de configuración)
const intents = {
  greeting: [
    "Hola", "Buenas tardes", "Hola SAPAL", "Que tal sapal", "Buena tarde",
    "Hola buen dia", "Hola buenos dias", "Hola buenas noches", "Que tal", "/start"
  ],
  thanks: [
    "Muchas gracias", "Gracias", "Agradezco", "muchisimas gracias", "te agradezco", "muchas gracias"
  ],
  check_balance: [
    "Quiero revisar mi saldo", "Quiero saber cual es mi saldo", "Conocer mi saldo",
    "Saber mi saldo", "cuanto debo de agua", "Cuanto debo", "saldo", "1.- Saldo",
    "Necesito comprobar cuánto dinero tengo.", "Me gustaría verificar el saldo de mi cuenta.",
    "consultar mi saldo actual"
  ],
  receipt: [
    "Quiero mi recibo", "Necesito mi recibo", "Descargar mi recibo", "Quiero el recibo"
  ]
};

// Construir el índice al iniciar
const index = buildIndex(intents);

// ==================== ENDPOINTS ====================

// Endpoint raíz
app.get("/", (req, res) => {
  res.json({
    message: "API de Clasificación de Intenciones",
    version: "1.0.0",
    endpoints: {
      "POST /classify": "Clasifica la intención de un texto (acepta intents en el body)",
      "POST /classify/batch": "Clasifica múltiples textos (acepta intents en el body)",
      "GET /intents": "Obtiene la lista de intents disponibles",
      "GET /health": "Verifica el estado del servidor"
    }
  });
});

// Endpoint de salud
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Endpoint para obtener los intents disponibles
app.get("/intents", (req, res) => {
  res.json({
    intents: Object.keys(intents),
    total: Object.keys(intents).length
  });
});

// Endpoint principal: clasificar intención
app.post("/classify", (req, res) => {
  try {
    const { text, intents: customIntents, threshold, minMargin } = req.body;

    // Validar que se proporcione el texto
    if (!text || typeof text !== "string") {
      return res.status(400).json({
        error: "El campo 'text' es requerido y debe ser una cadena de texto"
      });
    }

    // Usar intents del body si se proporcionan, sino usar los predefinidos
    const intentsToUse = customIntents || intents;
    
    // Validar formato de intents si se proporcionan
    if (customIntents) {
      if (typeof customIntents !== "object" || Array.isArray(customIntents)) {
        return res.status(400).json({
          error: "El campo 'intents' debe ser un objeto donde cada clave es un intent y su valor es un array de ejemplos"
        });
      }
      
      // Validar que cada intent sea un array
      for (const [intentName, examples] of Object.entries(customIntents)) {
        if (!Array.isArray(examples)) {
          return res.status(400).json({
            error: `El intent '${intentName}' debe ser un array de ejemplos`
          });
        }
      }
    }

    // Construir el índice con los intents proporcionados
    const indexToUse = buildIndex(intentsToUse);

    // Opciones personalizadas si se proporcionan
    const options = {};
    if (threshold !== undefined) options.threshold = threshold;
    if (minMargin !== undefined) options.minMargin = minMargin;

    // Clasificar la intención
    const result = classifyIntent(text, indexToUse, options);

    res.json({
      text: text,
      result: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error al clasificar:", error);
    res.status(500).json({
      error: "Error interno del servidor",
      message: error.message
    });
  }
});

// Endpoint para clasificar múltiples textos a la vez
app.post("/classify/batch", (req, res) => {
  try {
    const { texts, intents: customIntents, threshold, minMargin } = req.body;

    // Validar que se proporcione un array de textos
    if (!Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({
        error: "El campo 'texts' es requerido y debe ser un array no vacío"
      });
    }

    // Usar intents del body si se proporcionan, sino usar los predefinidos
    const intentsToUse = customIntents || intents;
    
    // Validar formato de intents si se proporcionan
    if (customIntents) {
      if (typeof customIntents !== "object" || Array.isArray(customIntents)) {
        return res.status(400).json({
          error: "El campo 'intents' debe ser un objeto donde cada clave es un intent y su valor es un array de ejemplos"
        });
      }
      
      // Validar que cada intent sea un array
      for (const [intentName, examples] of Object.entries(customIntents)) {
        if (!Array.isArray(examples)) {
          return res.status(400).json({
            error: `El intent '${intentName}' debe ser un array de ejemplos`
          });
        }
      }
    }

    // Construir el índice con los intents proporcionados
    const indexToUse = buildIndex(intentsToUse);

    // Opciones personalizadas si se proporcionan
    const options = {};
    if (threshold !== undefined) options.threshold = threshold;
    if (minMargin !== undefined) options.minMargin = minMargin;

    // Clasificar cada texto
    const results = texts.map(text => ({
      text: text,
      result: classifyIntent(text, indexToUse, options)
    }));

    res.json({
      results: results,
      total: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error al clasificar batch:", error);
    res.status(500).json({
      error: "Error interno del servidor",
      message: error.message
    });
  }
});

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    error: "Ruta no encontrada",
    message: `La ruta ${req.method} ${req.path} no existe`
  });
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error("Error no manejado:", err);
  res.status(500).json({
    error: "Error interno del servidor",
    message: err.message
  });
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📝 Endpoints disponibles:`);
  console.log(`   GET  / - Información de la API`);
  console.log(`   GET  /health - Estado del servidor`);
  console.log(`   GET  /intents - Lista de intents`);
  console.log(`   POST /classify - Clasificar un texto`);
  console.log(`   POST /classify/batch - Clasificar múltiples textos`);
});

module.exports = app;
