document.addEventListener('DOMContentLoaded', () => {
    // Mapeo del DOM para interacciones de UI
    const ui = {
        sList: document.getElementById('sessionList'), 
        cWindow: document.getElementById('chatWindow'),
        inputArea: document.getElementById('inputSection'), 
        input: document.getElementById('chatInput'),
        send: document.getElementById('sendBtn'), 
        record: document.getElementById('recordBtn'),
        bNew: document.getElementById('btnNewSession'), 
        bArch: document.getElementById('btnArchive'),
        bDel: document.getElementById('btnDelete'), 
        tActive: document.getElementById('tabActive'),
        tArchived: document.getElementById('tabArchived'), 
        title: document.getElementById('currentTitle'),
        emojiToggle: document.getElementById('emojiToggle'), 
        emojiPicker: document.getElementById('emojiPicker'),
        themeToggle: document.getElementById('themeToggle')
    };

    // Estado reactivo y variables globales
    let state = { sessions: [], currentId: null, viewArchived: false };
    let mediaRecorder = null; 
    let audioChunks = [];
    
    // Disparador de sincronización entre múltiples pestañas del navegador
    const emitSync = () => localStorage.setItem('v_sync', Date.now().toString());

    // --- MODO NOCHE/DÍA CON PERSISTENCIA ---
    const currentTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    ui.themeToggle.innerText = currentTheme === 'dark' ? '☀️' : '🌙';

    ui.themeToggle.onclick = () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const newTheme = isDark ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        ui.themeToggle.innerText = newTheme === 'dark' ? '☀️' : '🌙';
    };

    // --- CARGA Y RENDERIZADO DE LA BARRA LATERAL ---
    const loadSessions = async () => {
        try {
            const res = await fetch('/api/sessions');
            if (res.ok) {
                state.sessions = await res.json();
                renderSidebar();
            } else {
                console.error("Error al cargar la lista de sesiones del servidor.");
            }
        } catch (error) {
            console.error("Error de red al intentar cargar sesiones.", error);
        }
    };

    const renderSidebar = () => {
        const filtered = state.sessions.filter(s => s.archived === state.viewArchived);
        ui.sList.innerHTML = filtered.map(s => `
            <div class="session-item ${s.id === state.currentId ? 'active' : ''}" onclick="selectSession('${s.id}')">
                <b>${s.title}</b><br>
                <small>${new Date(s.updated_at).toLocaleDateString()}</small>
            </div>`).join('');
    };

    // --- SELECCIÓN Y CARGA DE HILO DE CHAT ---
    window.selectSession = async (id) => {
        state.currentId = id;
        const target = state.sessions.find(s => s.id === id);
        
        if (!target) return;

        // Añade el indicador visual de que el título es editable
        ui.title.innerHTML = `${target.title} <span style="font-size: 0.8em; opacity: 0.5; margin-left: 5px;">✏️</span>`;
        
        // Ajuste de interfaz según estado de archivo
        ui.bArch.innerText = target.archived ? "📤 Desarchivar" : "📥 Archivar";
        ui.bArch.classList.remove('hidden'); 
        ui.bDel.classList.remove('hidden');
        ui.inputArea.classList.toggle('hidden', target.archived);
        
        try {
            const res = await fetch(`/api/chat/sync/${id}`);
            if (res.ok) {
                const msgs = await res.json();
                renderChat(msgs);
            } else {
                console.error("Fallo al sincronizar historial de la sesión.");
            }
        } catch (error) {
            console.error("Error de red al sincronizar chat.", error);
        }
        
        renderSidebar();
    };

    const renderChat = (msgs) => {
        ui.cWindow.innerHTML = msgs.map(m => {
            const text = m.parts.find(p => p.text)?.text || '';
            const audio = m.parts.find(p => p.inlineData);
            
            // Reemplazo de saltos de línea para renderizado HTML
            const formattedText = text.replace(/\n/g, '<br>');
            
            let h = `<div class="message ${m.role === 'user' ? 'user' : 'model'}"><div>${formattedText}</div>`;
            if (audio) {
                h += `<audio controls src="data:audio/webm;base64,${audio.inlineData.data}" style="margin-top: 10px; border-radius: 5px;"></audio>`;
            }
            return h + `</div>`;
        }).join('');
        ui.cWindow.scrollTop = ui.cWindow.scrollHeight;
    };

    // --- LÓGICA DE INFERENCIA CON BLOQUEO ANTI-SPAM ---
    const sendMessage = async (text, audioB64 = null) => {
        // Candado estricto: Si el botón ya está deshabilitado, aborta (previene spam de Enter)
        if (ui.send.disabled) return; 
        
        if (!text.trim() && !audioB64) return;
        if (!state.currentId) {
            alert("Selecciona o crea una sesión primero.");
            return;
        }

        // Bloquear UI y limpiar input
        ui.send.disabled = true;
        ui.input.value = ''; 
        
        const tempId = 'typing-' + Date.now();
        const formattedUserText = text.replace(/\n/g, '<br>');
        
        // Renderizado optimista del mensaje del usuario y burbuja de carga
        let optimisticHtml = `<div class="message user"><div>${formattedUserText}</div>`;
        if (audioB64) optimisticHtml += `<div style="font-size: 0.8em; font-style: italic; margin-top: 5px;">[Audio Adjunto]</div>`;
        optimisticHtml += `</div><div id="${tempId}" class="typing-indicator"><span></span><span></span><span></span></div>`;
        
        ui.cWindow.innerHTML += optimisticHtml;
        ui.cWindow.scrollTop = ui.cWindow.scrollHeight;

        try {
            const response = await fetch('/api/chat/message', {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: state.currentId, text: text, audio_b64: audioB64 })
            });
            
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.err || `Error HTTP ${response.status}`);
            }
        } catch (error) {
            // Intercepta cuota expirada o fallos de conexión y alerta al usuario sin romper la UI
            alert(`Inferencia Fallida o Cuota Agotada:\n\n${error.message}\n\nEspera 60 segundos antes de reintentar.`);
        } finally {
            // Independientemente del resultado, sincroniza estado con disco, limpia UI, y desbloquea el envío
            await loadSessions(); 
            selectSession(state.currentId); 
            emitSync();
            ui.send.disabled = false;
            ui.input.focus();
        }
    };

    // --- OPERACIONES DESTRUCTIVAS Y DE METADATOS ---
    ui.bDel.onclick = async () => {
        if (!confirm("¿Purgar permanentemente esta sesión? Los datos serán borrados del disco.")) return;
        
        try {
            ui.bDel.disabled = true;
            const response = await fetch(`/api/sessions/${state.currentId}`, { method: 'DELETE' });
            
            if (response.ok) {
                state.currentId = null; 
                ui.cWindow.innerHTML = ''; 
                ui.title.innerText = "Selecciona una sesión";
                ui.inputArea.classList.add('hidden'); 
                ui.bArch.classList.add('hidden'); 
                ui.bDel.classList.add('hidden');
                await loadSessions(); 
                emitSync();
            } else {
                alert("Falla de integridad estructural al intentar purgar en el servidor.");
            }
        } catch (e) {
            alert(`Error de red ejecutando la purga: ${e.message}`);
        } finally {
            ui.bDel.disabled = false;
        }
    };

    ui.bArch.onclick = async () => {
        const target = state.sessions.find(s => s.id === state.currentId);
        if (!target) return;
        
        const willArchive = !target.archived;
        
        try {
            ui.bArch.disabled = true;
            const res = await fetch(`/api/sessions/${state.currentId}`, { 
                method: 'PATCH', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ archived: willArchive }) 
            });
            
            if (res.ok) {
                state.viewArchived = willArchive;
                ui.tArchived.classList.toggle('active', willArchive);
                ui.tActive.classList.toggle('active', !willArchive);
                await loadSessions(); 
                selectSession(state.currentId);
                emitSync();
            } else {
                alert("Error mutando el estado de archivo.");
            }
        } catch (e) {
            alert(`Error de red al archivar: ${e.message}`);
        } finally {
            ui.bArch.disabled = false;
        }
    };

    window.renameSession = async () => {
        if (!state.currentId) return;
        const target = state.sessions.find(s => s.id === state.currentId);
        const newTitle = prompt("Define la nueva identidad de la sesión:", target.title);
        
        if (newTitle && newTitle.trim() !== "" && newTitle !== target.title) {
            try {
                const res = await fetch(`/api/sessions/${state.currentId}`, { 
                    method: 'PATCH', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ title: newTitle.trim() }) 
                });
                
                if (res.ok) {
                    await loadSessions(); 
                    selectSession(state.currentId);
                    emitSync();
                } else {
                    alert("Error en el servidor al intentar renombrar.");
                }
            } catch (e) {
                alert(`Error de red al renombrar: ${e.message}`);
            }
        }
    };

    // --- GESTIÓN DE EVENTOS DE ENTRADA ---
    ui.send.onclick = () => sendMessage(ui.input.value);
    
    ui.input.onkeypress = (e) => { 
        if(e.key === 'Enter' && !e.shiftKey) { 
            e.preventDefault(); 
            sendMessage(ui.input.value); 
        } 
    };

    ui.bNew.onclick = async () => {
        try {
            ui.bNew.disabled = true;
            const res = await fetch('/api/sessions', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                state.viewArchived = false; 
                ui.tActive.classList.add('active'); 
                ui.tArchived.classList.remove('active');
                await loadSessions(); 
                selectSession(data.id); 
                emitSync();
                ui.input.focus();
            } else {
                alert("Error al instanciar nueva sesión en el servidor.");
            }
        } catch (e) {
            alert(`Error de red: ${e.message}`);
        } finally {
            ui.bNew.disabled = false;
        }
    };

    // --- CONTROLADOR DE MEDIOS (GRABACIÓN DE VOZ) ---
    ui.record.onclick = async () => {
        if (mediaRecorder && mediaRecorder.state === "recording") { 
            mediaRecorder.stop(); 
            ui.record.style.color = ""; // Remover feedback visual
            ui.record.classList.remove('recording-pulse');
            return; 
        }
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream); 
            audioChunks = [];
            
            // Añadir feedback visual de grabación
            ui.record.style.color = "var(--accent)";
            ui.record.classList.add('recording-pulse');
            
            mediaRecorder.ondataavailable = e => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };
            
            mediaRecorder.onstop = async () => {
                const blob = new Blob(audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64data = reader.result.split(',')[1];
                    sendMessage(ui.input.value, base64data);
                };
                reader.readAsDataURL(blob);
                
                // Limpieza estricta de hardware para liberar el micrófono en Windows
                stream.getTracks().forEach(track => track.stop());
            };
            
            mediaRecorder.start();
        } catch (err) {
            alert(`Acceso a hardware de audio denegado o no disponible: ${err.message}`);
        }
    };

    // --- MANEJO DE PESTAÑAS Y EMOJIS ---
    ui.tActive.onclick = () => { 
        state.viewArchived = false; 
        ui.tActive.classList.add('active'); 
        ui.tArchived.classList.remove('active'); 
        renderSidebar(); 
    };
    
    ui.tArchived.onclick = () => { 
        state.viewArchived = true; 
        ui.tArchived.classList.add('active'); 
        ui.tActive.classList.remove('active'); 
        renderSidebar(); 
    };
    
    ui.emojiToggle.onclick = () => ui.emojiPicker.classList.toggle('hidden');
    
    ui.emojiPicker.onclick = e => { 
        if(e.target.tagName === 'SPAN') { 
            ui.input.value += e.target.innerText; 
            ui.input.focus(); 
        } 
    };

    // Listener para concurrencia multi-pestaña usando LocalStorage
    window.onstorage = (e) => {
        if (e.key === 'v_sync') {
            loadSessions().then(() => {
                if (state.currentId && state.sessions.find(s => s.id === state.currentId)) {
                    selectSession(state.currentId);
                } else {
                    // Si la sesión activa fue purgada en otra pestaña, limpiar el lienzo
                    state.currentId = null; 
                    ui.cWindow.innerHTML = ''; 
                    ui.title.innerText = "Selecciona una sesión";
                    ui.inputArea.classList.add('hidden');
                }
            });
        }
    };

    // Ejecución inicial
    loadSessions();
});