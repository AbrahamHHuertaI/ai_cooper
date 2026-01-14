// intent-classifier.js
const natural = require("natural");

function normalize(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[^\p{L}\p{N}\s/.-]/gu, " ") // deja letras/numeros/espacios y / . -
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  // tokens simples, puedes mejorar con stopwords si quieres
  return normalize(text).split(" ").filter(Boolean);
}

function jaccard(tokensA, tokensB) {
  const A = new Set(tokensA);
  const B = new Set(tokensB);
  const inter = [...A].filter(x => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return union === 0 ? 0 : inter / union;
}

function levenshteinSim(a, b) {
  if (!a && !b) return 1;
  const dist = natural.LevenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length) || 1;
  return 1 - dist / maxLen; // 0..1
}

/**
 * Construye un índice a partir de ejemplos.
 * - Pre-calcula tokens y texto normalizado para speed.
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
 * Score combinado:
 * - token overlap (jaccard) ayuda cuando cambian palabras/orden
 * - levenshtein ayuda en frases cortas y typos
 * - bonus por "contiene" para cosas como "saldo" o "/start"
 */
function score(inputNorm, inputTokens, example) {
  const jac = jaccard(inputTokens, example.tokens);
  const lev = levenshteinSim(inputNorm, example.norm);

  // bonus si un ejemplo es substring del input o viceversa (frases tipo "saldo")
  const contains =
    inputNorm.includes(example.norm) || example.norm.includes(inputNorm) ? 1 : 0;

  // pesos (ajústalos con pruebas reales)
  return 0.55 * jac + 0.35 * lev + 0.10 * contains;
}

function classifyIntent(text, index, options = {}) {
  const {
    threshold = 0.62,     // si baja de esto => unknown
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

// ------------------ EJEMPLO DE USO ------------------

// Puedes pegar tal cual tus líneas separadas por "|"
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

const index = buildIndex(intents);

// Demo:
const tests = [
  "Quiero mi recibo",
  "hola buen día",
  "muchísimas gracias!!",
  "cuanto debo de agua?",
  "1.- saldo",
  "quiero ver mi recibo por favor"
];

for (const t of tests) {
  const r = classifyIntent(t, index);
  console.log(t, "=>", r);
}

module.exports = { buildIndex, classifyIntent };
