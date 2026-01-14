const axios = require("axios");

const API_URL = "http://localhost:3000";

// Intents personalizados para probar
const customIntents = {
  greeting: [
    "Hola",
    "Buenas tardes",
    "Hola SAPAL",
    "Que tal sapal",
    "Buena tarde",
    "Hola buen dia",
    "Hola buenos dias",
    "Hola buenas noches",
    "Que tal",
    "/start"
  ],
  thanks: [
    "Muchas gracias",
    "Gracias",
    "Agradezco",
    "muchisimas gracias",
    "te agradezco",
    "muchas gracias"
  ],
  check_balance: [
    "Quiero revisar mi saldo",
    "Quiero saber cual es mi saldo",
    "Conocer mi saldo",
    "Saber mi saldo",
    "cuanto debo de agua",
    "Cuanto debo",
    "saldo",
    "1.- Saldo",
    "Necesito comprobar cuánto dinero tengo.",
    "Me gustaría verificar el saldo de mi cuenta.",
    "consultar mi saldo actual"
  ],
  receipt: [
    "Quiero mi recibo",
    "Necesito mi recibo",
    "Descargar mi recibo",
    "Quiero el recibo"
  ]
};

// Función para probar el endpoint de clasificación individual
async function testClassify() {
  console.log("\n=== Probando POST /classify ===\n");

  try {
    const response = await axios.post(`${API_URL}/classify`, {
      text: "buenas tardes necesito saber cuando debo pagar este mes",
      intents: customIntents
    });

    console.log("✅ Clasificación exitosa:");
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
  }
}

// Función para probar el endpoint de clasificación por lotes
async function testClassifyBatch() {
  console.log("\n=== Probando POST /classify/batch ===\n");

  try {
    const response = await axios.post(`${API_URL}/classify/batch`, {
      texts: [
        "Quiero mi recibo",
        "hola buen día",
        "muchísimas gracias!!",
        "cuanto debo de agua?",
        "1.- saldo",
        "quiero ver mi recibo por favor"
      ],
      intents: customIntents
    });

    console.log("✅ Clasificación por lotes exitosa:");
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
  }
}

// Función para probar con opciones personalizadas
async function testClassifyWithOptions() {
  console.log("\n=== Probando POST /classify con opciones personalizadas ===\n");

  try {
    const response = await axios.post(`${API_URL}/classify`, {
      text: "hola",
      intents: customIntents,
      threshold: 0.5,
      minMargin: 0.05
    });

    console.log("✅ Clasificación con opciones personalizadas:");
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
  }
}

// Función para probar sin enviar intents (usa los predefinidos)
async function testClassifyWithoutIntents() {
  console.log("\n=== Probando POST /classify sin intents (usa predefinidos) ===\n");

  try {
    const response = await axios.post(`${API_URL}/classify`, {
      text: "Quiero mi recibo"
    });

    console.log("✅ Clasificación con intents predefinidos:");
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
  }
}

// Función para verificar el estado del servidor
async function testHealth() {
  console.log("\n=== Probando GET /health ===\n");

  try {
    const response = await axios.get(`${API_URL}/health`);
    console.log("✅ Servidor saludable:");
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
  }
}

// Función principal que ejecuta todas las pruebas
async function runTests() {
  console.log("🚀 Iniciando pruebas de la API...");
  console.log(`📍 URL base: ${API_URL}\n`);

  // Verificar que el servidor esté corriendo
  try {
    await axios.get(`${API_URL}/health`);
    console.log("✅ Servidor está corriendo\n");
  } catch (error) {
    console.error("❌ El servidor no está corriendo. Por favor inicia el servidor con: npm start");
    process.exit(1);
  }

  // Ejecutar todas las pruebas
  await testHealth();
  await testClassify();
  await testClassifyBatch();
  await testClassifyWithOptions();
  await testClassifyWithoutIntents();

  console.log("\n✨ Pruebas completadas!");
}

// Ejecutar las pruebas
runTests().catch(console.error);
