<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import Handlebars from 'handlebars'
import { sampleData, Source } from '#shared/constants'

// should change ad to have a global record of the available sources

const props = defineProps({
  initialScript: {
    type: String,
    default: ''
  },
  inputSource:{
    type: String,
    default: Source.GenericWebhook
  }
})

const emit = defineEmits(['save', 'close'])

const scriptContent = ref('')
const jsonPayload = ref('')
// change so it shows a concrete payload examplo according to the input selected


watch(
  () => props.inputSource,
  (source) => {
    const data = sampleData[source as Source] ?? sampleData[Source.GenericWebhook]
    jsonPayload.value = JSON.stringify(data.payload, null, 2)

    if (!props.initialScript ||props.initialScript==='') {
      scriptContent.value = data.script
    } else {
      scriptContent.value = props.initialScript
    }
  },
  { immediate: true }   // ← runs on mount too, replaces onMounted
)

const errorMensaje = ref('')
const previewData = computed(() => {
  if (!scriptContent.value || scriptContent.value.trim() === '') {
    return { text: 'Formatted message will appear here...', error: null }
  }

  let parsedPayload = {}
  try {
    parsedPayload = JSON.parse(jsonPayload.value)
  } catch (err) {
    return { text: '', error: "Error in JSON: " + (err as Error).message }
  }

  try {
    const template = Handlebars.compile(scriptContent.value)
    return { text: template(parsedPayload).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'), error: null }
  } catch (err) {
    return { text: '', error: "Error in Handlebars: " + (err as Error).message }
  }
})


const save = () => {
  emit('save', scriptContent.value)
}

const close = () => {
  emit('close')
}
</script>

<template>
  <div class="editor-overlay" @click.self="close">
    <div class="editor-window">
      
      <div class="window-header">
        <div class="header-titles">
          <h3>Custom Format Editor</h3>
          <p>Configure the message that users will receive on Olvid</p>
        </div>
        <button class="btn-close-icon" @click="close">✕</button>
      </div>

      <div class="window-body">
        
        <div class="code-column">
          
          <div class="code-block">
            <div class="code-header">
              <span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span>
              <span class="code-title">script.hbs (Handlebars)</span>
            </div>
            <textarea 
              v-model="scriptContent" 
              class="editor-textarea hbs-color" 
              spellcheck="false"
            ></textarea>
          </div>

          <div class="code-block">
            <div class="code-header">
              <span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span>
              <span class="code-title">payload.json (Test Data)</span>
            </div>
            <textarea 
              :value="jsonPayload" 
              class="editor-textarea json-color" 
              readonly
              spellcheck="false"
            ></textarea>
          </div>

        </div>

        <div class="preview-column">
          <div class="chat-header">
            📱 Preview on device
          </div>
          
          <div class="chat-background">
            
            <div v-if="previewData.error" class="error-bubble">
              ⚠️ {{ previewData.error }}
            </div>

            <div v-else class="chat-bubble">
              <div class="bubble-sender">Alerting Bot</div>
              <div class="bubble-text" v-html="previewData.text"></div>
              <div class="bubble-time">now</div>
            </div>

          </div>
        </div>

      </div>

      <div class="window-footer">
        <button type="button" class="btn-cancel" @click="close">Cancel</button>
        <button type="button" class="btn-save" @click="save">Save Script</button>
      </div>

    </div>
  </div>
</template>

<style scoped>

/* 1. Fondo principal */
.editor-overlay {
  position: fixed;
  top: 0; left: 0; width: 100vw; height: 100vh;
  background-color: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(5px);
  display: flex; justify-content: center; align-items: center;
  z-index: 10500; /* 🌟 SUBIDO: Para que pase por encima del z-index: 9999 del formulario */
  font-family: system-ui, -apple-system, sans-serif;
  /* Eliminado object-fit: contain; porque no hace efecto en divs */
}

/* 2. La Ventana Modal Gigante */
.editor-window {
  background: #ffffff;
  width: 98vw; /* 🌟 AMPLIADO: Ocupa el 98% del ancho de la pantalla */
  max-width: 1600px; /* 🌟 AMPLIADO: Límite máximo enorme para pantallas Ultra-Wide */
  height: 96vh; /* 🌟 AMPLIADO: Casi el 100% de la altura disponible */
  border-radius: 12px;
  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
  display: flex; flex-direction: column;
  overflow: hidden;
}

/* 1. Fondo principal 
.editor-overlay {
  position: fixed;
  top: 0; left: 0; width: 100vw; height: 100vh;
  background-color: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(5px);
  display: flex; justify-content: center; align-items: center;
  z-index: 2000;
  font-family: system-ui, -apple-system, sans-serif;
  object-fit: contain;
}

.editor-window {
  background: #ffffff;
  width: 95%; max-width: 1200px; height: 90vh;
  border-radius: 12px;
  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.3);
  display: flex; flex-direction: column;
  overflow: hidden;
}
*/

.window-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 20px 30px;
  border-bottom: 1px solid #e2e8f0;
}

.header-titles h3 { margin: 0; color: #0f172a; font-size: 20px; font-weight: 700; }
.header-titles p { margin: 4px 0 0 0; color: #64748b; font-size: 14px; }

.btn-close-icon {
  background: transparent; border: none; color: #94a3b8; font-size: 20px;
  cursor: pointer; transition: color 0.2s;
}
.btn-close-icon:hover { color: #ef4444; }

/* 3. El Cuerpo (Grid de 2 columnas) */
.window-body {
  display: grid;
  grid-template-columns: 1fr 1fr; /* 50% - 50% */
  background: #f1f5f9; /* Gris muy clarito y elegante */
  flex-grow: 1;
  overflow: hidden;
}

.code-column {
  padding: 20px;
  display: flex; flex-direction: column; gap: 20px;
  overflow-y: auto;
  border-right: 1px solid #e2e8f0;
}

/* 4. Estilo de los editores de código (Estilo Mac/VSCode) */
.code-block {
  background: #1e1e1e; /* Color oscuro real de IDE */
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
  display: flex; flex-direction: column;
  flex-shrink: 0;
}

.code-header {
  background: #2d2d2d;
  padding: 10px 15px;
  display: flex; align-items: center; gap: 8px;
}

/* Botoncitos estilo Mac */
.dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
.red { background: #ff5f56; } .yellow { background: #ffbd2e; } .green { background: #27c93f; }

.code-title {
  color: #a3a3a3; font-size: 13px; font-family: monospace; margin-left: 10px;
}

.editor-textarea {
  width: 100%;
  padding: 15px;
  background: #1e1e1e;
  border: none; outline: none;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 14px; line-height: 1.5;
  resize: vertical;
  box-sizing: border-box;
}

.hbs-color { color: #dcdcaa; min-height: 150px; } /* Amarillo pálido tipo JS */
.json-color { color: #9cdcfe; min-height: 250px; } /* Azul claro tipo JSON */

/* Esconder scrollbars feas en editores */
.editor-textarea::-webkit-scrollbar { width: 8px; }
.editor-textarea::-webkit-scrollbar-thumb { background: #4b4b4b; border-radius: 4px; }

/* 5. El Chat de Olvid (Vista Previa) */
.preview-column {
  display: flex; flex-direction: column;
  background: #e5e5ea; /* Fondo típico de app de mensajería (WhatsApp iOS) */
}

.chat-header {
  background: #f8fafc;
  padding: 15px;
  text-align: center;
  font-weight: bold; color: #475569;
  border-bottom: 1px solid #cbd5e1;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.chat-background {
  padding: 20px;
  flex-grow: 1;
  overflow-y: auto;
  /* Fondo con patrón sutil si lo deseas, aquí lo dejamos liso y limpio */
}

/* Burbuja del mensaje! */
.chat-bubble {
  background: #ffffff;
  max-width: 85%;
  padding: 12px 16px;
  border-radius: 0 16px 16px 16px; /* Pico de bocadillo arriba a la izquierda */
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
  margin-bottom: 15px;
  position: relative;
}

.bubble-sender {
  color: #2563eb; font-weight: 700; font-size: 13px; margin-bottom: 5px;
}

.bubble-text {
  margin: 0;
  font-family: inherit; font-size: 15px; color: #111827;
  white-space: pre-wrap; line-height: 1.4;
}

.bubble-time {
  text-align: right; color: #9ca3af; font-size: 11px; margin-top: 5px;
}

/* Burbuja de error */
.error-bubble {
  background: #fef2f2; color: #991b1b;
  max-width: 85%; padding: 12px 16px;
  border-radius: 16px; border: 1px solid #f87171;
  font-family: monospace; font-size: 13px; white-space: pre-wrap;
}

/* 6. Pie de la ventana */
.window-footer {
  padding: 15px 30px;
  background: #ffffff;
  border-top: 1px solid #e2e8f0;
  display: flex; justify-content: flex-end; gap: 15px;
}

.btn-cancel {
  background: #f1f5f9; color: #475569;
  border: none; padding: 10px 20px; border-radius: 8px;
  font-weight: 600; cursor: pointer; transition: background-color 0.2s;
}
.btn-cancel:hover { background: #e2e8f0; }

.btn-save {
  background: #2563eb; color: white;
  border: none; padding: 10px 24px; border-radius: 8px;
  font-weight: 600; cursor: pointer; transition: background-color 0.2s;
}
.btn-save:hover { background: #1d4ed8; }
</style>