# Citadel Chat - Arquitectura de Inferencia Resiliente (Gemini API)

Repositorio oficial del sistema de chat multimodal desarrollado para la asignatura Estructura de Datos 2. Este sistema destaca por su capacidad de mantener la integridad de los datos ante fallos de red externos.

## 🏛️ Arquitectura y Decisiones de Diseño (Fase 5)
* **Persistencia Determinista:** Almacenamiento en data_store.json con acceso (1)$ y ordenamiento garantizado por IDs únicos (UUID) y tie-breakers.
* **Gestión de Inferencia:** Integración con **Gemini 2.5 Flash** mediante una capa de abstracción en el backend (Flask), protegiendo la seguridad de la API Key.
* **Resiliencia (Circuit Breaker):** Implementación de un modo offline que permite la operatividad del sistema y la validación de estados incluso ante la inestabilidad del proveedor de IA.
* **Sincronización Multi-instancia:** Uso de listeners de LocalStorage para asegurar la consistencia de la "verdad de los datos" entre pestañas.

## 🛠️ Instalación y Despliegue
1. Clonar: `git clone https://github.com/jaguark11/Chat-Propio---Gemini-API.git`
2. Crear entorno virtual: `python -m venv venv`
3. Activar: `.\venv\Scripts\activate`
4. Instalar dependencias: `pip install -r requirements.txt`
5. Configurar su API Key en la línea 13 de `app.py`.
6. Ejecutar: `python app.py`
