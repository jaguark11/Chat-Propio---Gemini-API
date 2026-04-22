# Chat Multimodal - Gemini API

Sistema de chat desarrollado con Flask y la API de Google Gemini (2.5 Flash) para la asignatura Estructura de Datos 2.

## Funcionalidades
* **Inferencia de IA:** Integración con Gemini API para procesamiento de texto y audio.
* **Persistencia:** Almacenamiento de sesiones en archivos JSON local (data_store.json).
* **Soporte Multimodal:** Manejo de audio serializado en Base64.
* **Sincronización:** Consistencia de datos entre pestañas mediante LocalStorage.
* **Modo Offline:** Mecanismo de contingencia para operar sin conexión a la API.

## Guía de instalación
1. Clonar repositorio: `git clone https://github.com/jaguark11/Chat-Propio---Gemini-API.git`
2. Crear entorno virtual: `python -m venv venv`
3. Activar entorno: `.\venv\Scripts\activate`
4. Instalar librerías: `pip install -r requirements.txt`
5. Configurar API_KEY en la línea 13 de `app.py`.
6. Ejecutar: `python app.py`

## Detalles de implementación
* **Estructuras:** Uso de diccionarios y listas con IDs únicos (UUID).
* **Fechas:** Estándar ISO 8601 en toda la persistencia.
* **Seguridad:** API Key gestionada exclusivamente en el backend.
