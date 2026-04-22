import os
import time
import uuid
import json
import requests
from datetime import datetime, timezone
from flask import Flask, request, jsonify, render_template

app = Flask(__name__)

# ==========================================
# CONFIGURACIÓN CRÍTICA Y ESCUDOS
# ==========================================
# ==========================================
# CONFIGURACIÓN CRÍTICA
# ==========================================
API_KEY = "AIzaSyDQL35KuXIKXsqsP5Jdyl6hdSyia-5ny_A" 
DB_FILE = "data_store.json"

# MODO IA ACTIVADO
OFFLINE_MODE = False 
USE_SMART_TITLES = False

# LA RUTA CORRECTA Y AUTORIZADA POR TU LLAVE
MODEL_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
sesiones_global = {}

def guardar_en_disco():
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(sesiones_global, f, indent=4)

def cargar_desde_disco():
    global sesiones_global
    if os.path.exists(DB_FILE):
        with open(DB_FILE, "r", encoding="utf-8") as f:
            sesiones_global = json.load(f)
    else:
        # Seeding determinista (Al menos 5 ejemplos exigidos por protocolo)
        temas = [
            ("Cálculo: Integrales", False), 
            ("Setup RTX 3050", False), 
            ("Café Premium Cali", True),
            ("Algoritmos O(n log n)", False),
            ("Arquitectura REST", True)
        ]
        base_t = datetime(2026, 4, 20, 12, 0, 0, tzinfo=timezone.utc).timestamp()
        for i, (tit, arch) in enumerate(temas):
            s_id = f"sess_{uuid.uuid4().hex[:8]}"
            t_iso = datetime.fromtimestamp(base_t + (i * 1800), timezone.utc).isoformat()
            sesiones_global[s_id] = {
                "titulo": tit, "updated_at": t_iso, "archived": arch,
                "mensajes": [{"id": f"m_{uuid.uuid4().hex[:6]}", "role": "model", "parts": [{"text": f"Contexto {tit} inicializado."}], "timestamp": t_iso}]
            }
        guardar_en_disco()

def generar_titulo_ia(primer_msg):
    if not USE_SMART_TITLES or OFFLINE_MODE: 
        return primer_msg[:20] + "..."
    try:
        payload = {"contents": [{"parts": [{"text": f"Resume en 3 palabras: {primer_msg}"}]}]}
        res = requests.post(f"{MODEL_ENDPOINT}?key={API_KEY}", json=payload, timeout=4)
        if res.status_code == 200:
            return res.json()['candidates'][0]['content']['parts'][0]['text'].strip()
    except Exception as e:
        print(f"Error silencioso en autotitulado: {e}")
    return primer_msg[:20] + "..."

@app.route('/')
def index(): 
    return render_template('chat.html')

@app.route('/api/sessions', methods=['GET', 'POST'])
def handle_sessions():
    if request.method == 'GET':
        lista = [{"id": k, "title": v["titulo"], "updated_at": v["updated_at"], "archived": v["archived"]} for k, v in sesiones_global.items()]
        lista.sort(key=lambda x: (x['updated_at'], x['id']), reverse=True)
        return jsonify(lista)
    if request.method == 'POST':
        n_id = f"sess_{uuid.uuid4().hex[:8]}"
        sesiones_global[n_id] = {"titulo": "Nueva Reflexión", "updated_at": datetime.now(timezone.utc).isoformat(), "archived": False, "mensajes": []}
        guardar_en_disco()
        return jsonify({"id": n_id}), 201

@app.route('/api/sessions/<id_s>', methods=['DELETE', 'PATCH'])
def mutar_sesion(id_s):
    if id_s not in sesiones_global: 
        return jsonify({"err": "Sesión no encontrada"}), 404
    
    if request.method == 'DELETE':
        del sesiones_global[id_s]
        guardar_en_disco()
        return jsonify({"status": "ok"}), 200
        
    if request.method == 'PATCH':
        datos = request.get_json(silent=True) or {}
        if 'archived' in datos: 
            sesiones_global[id_s]['archived'] = datos['archived']
        if 'title' in datos: 
            sesiones_global[id_s]['titulo'] = datos['title'].strip() or "Sesión sin nombre"
        
        sesiones_global[id_s]['updated_at'] = datetime.now(timezone.utc).isoformat()
        guardar_en_disco()
        return jsonify({"status": "ok"}), 200

@app.route('/api/chat/sync/<id_s>', methods=['GET'])
def sincronizar_chat(id_s):
    if id_s not in sesiones_global: 
        return jsonify({"err": "Sesión no accesible"}), 404
    return jsonify(sorted(sesiones_global[id_s]['mensajes'], key=lambda x: (x['timestamp'], x['id'])))

@app.route('/api/chat/message', methods=['POST'])
def procesar_mensaje():
    req = request.get_json()
    id_s = req.get("session_id")
    texto = req.get("text", "").strip()
    audio_b64 = req.get("audio_b64")
    
    if id_s not in sesiones_global: return jsonify({"err": "Sesión inválida"}), 400
    if not texto and not audio_b64: return jsonify({"err": "Payload vacío"}), 400

    t_now = datetime.now(timezone.utc).isoformat()
    if len(sesiones_global[id_s]['mensajes']) == 0 and texto:
        sesiones_global[id_s]['titulo'] = generar_titulo_ia(texto)

    u_parts = []
    if texto: u_parts.append({"text": texto})
    if audio_b64: u_parts.append({"inlineData": {"mimeType": "audio/webm", "data": audio_b64}})

    msg_u = {"id": f"m_{uuid.uuid4().hex[:6]}", "role": "user", "parts": u_parts, "timestamp": t_now}
    sesiones_global[id_s]['mensajes'].append(msg_u)

    # ==========================================
    # EJECUCIÓN DEL MOCK DE INGENIERÍA (OFFLINE)
    # ==========================================
    if OFFLINE_MODE:
        time.sleep(1.5) # Simulación determinista de latencia
        
        # Simula el procesamiento del audio si existe
        respuesta_mock = "Mensaje procesado correctamente. La arquitectura local y la persistencia en JSON operan al 100%."
        if audio_b64:
            respuesta_mock = "He recibido y procesado el flujo de audio en Base64 con éxito. El sistema de subida es estable."
            
        t_bot = datetime.now(timezone.utc).isoformat()
        msg_b = {"id": f"m_{uuid.uuid4().hex[:6]}", "role": "model", "parts": [{"text": respuesta_mock}], "timestamp": t_bot}
        
        sesiones_global[id_s]['mensajes'].append(msg_b)
        sesiones_global[id_s]['updated_at'] = t_bot
        guardar_en_disco()
        return jsonify({"user_msg": msg_u, "model_msg": msg_b}), 200

    # ==========================================
    # FLUJO NORMAL DE IA (Desactivado)
    # ==========================================
    historial = []
    for m in sesiones_global[id_s]['mensajes']:
        p_clean = [{"text": p["text"]} for p in m["parts"] if "text" in p]
        if p_clean: historial.append({"role": m["role"], "parts": p_clean})

    try:
        r = requests.post(f"{MODEL_ENDPOINT}?key={API_KEY}", json={"contents": historial}, timeout=30)
        res_data = r.json()
        
        if r.status_code != 200:
            sesiones_global[id_s]['mensajes'] = [m for m in sesiones_global[id_s]['mensajes'] if m['id'] != msg_u['id']]
            error_msg = res_data.get('error', {}).get('message', 'Error desconocido de API')
            return jsonify({"err": error_msg}), r.status_code

        candidatos = res_data.get('candidates', [])
        if not candidatos:
            raise Exception("Respuesta bloqueada por filtros de Google.")
            
        bot_txt = candidatos[0].get('content', {}).get('parts', [{}])[0].get('text', '')
        t_bot = datetime.now(timezone.utc).isoformat()
        msg_b = {"id": f"m_{uuid.uuid4().hex[:6]}", "role": "model", "parts": [{"text": bot_txt}], "timestamp": t_bot}
        
        sesiones_global[id_s]['mensajes'].append(msg_b)
        sesiones_global[id_s]['updated_at'] = t_bot
        guardar_en_disco()
        
        return jsonify({"user_msg": msg_u, "model_msg": msg_b}), 200
        
    except Exception as e:
        sesiones_global[id_s]['mensajes'] = [m for m in sesiones_global[id_s]['mensajes'] if m['id'] != msg_u['id']]
        return jsonify({"err": f"Error al parsear la respuesta: {str(e)}"}), 500

cargar_desde_disco()

if __name__ == '__main__': 
    app.run(host='0.0.0.0', port=5000, debug=True)