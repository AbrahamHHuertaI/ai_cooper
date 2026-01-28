const express = require("express");
const { NlpManager } = require("node-nlp");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(express.json());

// Cache de managers entrenados por configuración de intents
const managerCache = new Map();

/**
 * Crea o recupera un NlpManager entrenado para los intents dados
 */
async function getTrainedManager(intents) {
  // Crear una clave única basada en los intents
  const cacheKey = JSON.stringify(intents);
  
  // Si ya existe en cache, retornarlo
  if (managerCache.has(cacheKey)) {
    return managerCache.get(cacheKey);
  }

  // Crear nuevo manager
  const manager = new NlpManager({ languages: ['es'], forceNER: true });
  
  // Agregar documentos (ejemplos) para cada intent
  for (const [intentName, examples] of Object.entries(intents)) {
    for (const example of examples) {
      manager.addDocument('es', example, intentName);
    }
    // Agregar una respuesta genérica para cada intent
    manager.addAnswer('es', intentName, `Respuesta para ${intentName}`);
  }

  // Entrenar el modelo
  await manager.train();
  // No guardamos en disco ya que usamos cache en memoria
  // manager.save();

  // Guardar en cache
  managerCache.set(cacheKey, manager);
  
  return manager;
}

/**
 * Clasifica la intención de un texto usando node-nlp
 */
async function classifyIntent(text, intents, options = {}) {
  const {
    threshold = 0.3,     // si baja de esto => unknown
    minMargin = 0.06      // diferencia mínima vs el segundo lugar
  } = options;

  // Normalizar texto para atajos
  const inputNorm = (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  // Atajos de comandos
  if (inputNorm === "/start") {
    return { intent: "greeting", confidence: 1, matchedExample: "/start" };
  }

  try {
    // Obtener manager entrenado
    const manager = await getTrainedManager(intents);
    
    // Procesar el texto
    const result = await manager.process('es', text);

    // Extraer la mejor intención y confianza
    const bestIntent = result.intent || 'unknown';
    const bestConfidence = result.score || 0;
    
    // Encontrar el ejemplo más cercano (usar el primer ejemplo del intent si está disponible)
    const matchedExample = intents[bestIntent] && intents[bestIntent].length > 0 
      ? intents[bestIntent][0] 
      : null;

    // Calcular el segundo mejor resultado
    // node-nlp puede devolver clasificaciones alternativas en classifications
    let secondConfidence = 0;
    if (result.classifications && result.classifications.length > 1) {
      // Ordenar por score descendente y tomar el segundo
      const sorted = result.classifications
        .filter(c => c.intent !== bestIntent)
        .sort((a, b) => b.score - a.score);
      if (sorted.length > 0) {
        secondConfidence = sorted[0].score || 0;
      }
    }

    const margin = bestConfidence - secondConfidence;
    
    // Aplicar umbrales
    if (bestConfidence < threshold || margin < minMargin) {
      return { 
        intent: "unknown", 
        confidence: bestConfidence, 
        matchedExample: matchedExample 
      };
    }

    return {
      intent: bestIntent,
      confidence: bestConfidence,
      matchedExample: matchedExample
    };
  } catch (error) {
    console.error("Error en classifyIntent:", error);
    return {
      intent: "unknown",
      confidence: 0,
      matchedExample: null
    };
  }
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
app.post("/classify", async (req, res) => {
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

    // Opciones personalizadas si se proporcionan
    const options = {};
    if (threshold !== undefined) options.threshold = threshold;
    if (minMargin !== undefined) options.minMargin = minMargin;

    // Clasificar la intención usando node-nlp
    const result = await classifyIntent(text, intentsToUse, options);

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
app.post("/classify/batch", async (req, res) => {
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

    // Opciones personalizadas si se proporcionan
    const options = {};
    if (threshold !== undefined) options.threshold = threshold;
    if (minMargin !== undefined) options.minMargin = minMargin;

    // Clasificar cada texto usando Promise.all para procesamiento paralelo
    const results = await Promise.all(
      texts.map(async (text) => ({
        text: text,
        result: await classifyIntent(text, intentsToUse, options)
      }))
    );

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
