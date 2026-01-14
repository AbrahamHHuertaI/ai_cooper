# API REST - Clasificador de Intenciones

API REST desarrollada en Node.js para clasificar intenciones de texto usando procesamiento de lenguaje natural.

## Características

- Clasificación de intenciones basada en similitud de texto
- Algoritmos de similitud: Jaccard y Levenshtein
- Normalización de texto (sin acentos, caracteres especiales)
- Endpoints RESTful para clasificación individual y por lotes
- Configuración flexible de umbrales de confianza

## Instalación

1. Instalar las dependencias:
```bash
npm install
```

## Uso

### Iniciar el servidor

```bash
npm start
```

O en modo desarrollo (con nodemon):
```bash
npm run dev
```

El servidor se iniciará en `http://localhost:3000` por defecto.

### Endpoints disponibles

#### `GET /`
Información general de la API.

**Ejemplo:**
```bash
curl http://localhost:3000/
```

#### `GET /health`
Verifica el estado del servidor.

**Ejemplo:**
```bash
curl http://localhost:3000/health
```

#### `GET /intents`
Obtiene la lista de intents disponibles.

**Ejemplo:**
```bash
curl http://localhost:3000/intents
```

#### `POST /classify`
Clasifica la intención de un texto.

**Request Body:**
```json
{
  "text": "Quiero mi recibo",
  "intents": {
    "greeting": ["Hola", "Buenas tardes", "/start"],
    "thanks": ["Gracias", "Muchas gracias"],
    "check_balance": ["Quiero revisar mi saldo", "saldo"],
    "receipt": ["Quiero mi recibo", "Necesito mi recibo"]
  },
  "threshold": 0.62,
  "minMargin": 0.06
}
```

**Parámetros:**
- `text` (requerido): El texto a clasificar
- `intents` (opcional): Objeto con los intents y sus ejemplos. Si no se proporciona, usa los intents predefinidos
- `threshold` (opcional): Umbral mínimo de confianza (default: 0.62)
- `minMargin` (opcional): Diferencia mínima vs segundo lugar (default: 0.06)

**Ejemplo con intents personalizados:**
```bash
curl -X POST http://localhost:3000/classify \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Quiero mi recibo",
    "intents": {
      "greeting": ["Hola", "Buenas tardes"],
      "receipt": ["Quiero mi recibo", "Necesito mi recibo"]
    }
  }'
```

**Ejemplo sin intents (usa predefinidos):**
```bash
curl -X POST http://localhost:3000/classify \
  -H "Content-Type: application/json" \
  -d '{"text": "Quiero mi recibo"}'
```

**Response:**
```json
{
  "text": "Quiero mi recibo",
  "result": {
    "intent": "receipt",
    "confidence": 0.85,
    "matchedExample": "Quiero mi recibo"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### `POST /classify/batch`
Clasifica múltiples textos a la vez.

**Request Body:**
```json
{
  "texts": [
    "Quiero mi recibo",
    "hola buen día",
    "muchísimas gracias!!"
  ],
  "intents": {
    "greeting": ["Hola", "Buenas tardes"],
    "thanks": ["Gracias", "Muchas gracias"],
    "receipt": ["Quiero mi recibo"]
  },
  "threshold": 0.62,
  "minMargin": 0.06
}
```

**Parámetros:**
- `texts` (requerido): Array de textos a clasificar
- `intents` (opcional): Objeto con los intents y sus ejemplos. Si no se proporciona, usa los intents predefinidos
- `threshold` (opcional): Umbral mínimo de confianza (default: 0.62)
- `minMargin` (opcional): Diferencia mínima vs segundo lugar (default: 0.06)

**Ejemplo:**
```bash
curl -X POST http://localhost:3000/classify/batch \
  -H "Content-Type: application/json" \
  -d '{"texts": ["Quiero mi recibo", "hola buen día"]}'
```

**Response:**
```json
{
  "results": [
    {
      "text": "Quiero mi recibo",
      "result": {
        "intent": "receipt",
        "confidence": 0.85,
        "matchedExample": "Quiero mi recibo"
      }
    },
    {
      "text": "hola buen día",
      "result": {
        "intent": "greeting",
        "confidence": 0.78,
        "matchedExample": "Hola buen dia"
      }
    }
  ],
  "total": 2,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Intents Disponibles

- `greeting`: Saludos
- `thanks`: Agradecimientos
- `check_balance`: Consulta de saldo
- `receipt`: Solicitud de recibo
- `unknown`: Intención no reconocida

## Pruebas

Puedes probar la API usando el archivo de ejemplo con axios:

```bash
# Asegúrate de que el servidor esté corriendo en otra terminal
npm start

# En otra terminal, ejecuta las pruebas
node test-api.js
```

El archivo `test-api.js` incluye ejemplos de:
- Clasificación individual con intents personalizados
- Clasificación por lotes
- Uso de opciones personalizadas (threshold, minMargin)
- Uso de intents predefinidos

## Personalización

Puedes enviar tus propios intents en el body de las peticiones `POST /classify` o `POST /classify/batch`. Si no envías intents, la API usará los intents predefinidos en `server.js`.

**Formato de intents:**
```json
{
  "nombre_intent": ["ejemplo 1", "ejemplo 2", "ejemplo 3"],
  "otro_intent": ["ejemplo a", "ejemplo b"]
}
```

## Tecnologías

- Node.js
- Express.js
- Natural (NLP library)

## Licencia

ISC
