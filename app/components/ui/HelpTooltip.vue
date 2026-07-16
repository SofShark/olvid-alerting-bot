<script setup lang = "ts">

const props = defineProps<{
  message: string
}>();

</script>
<template>
  <button type="button" class="tooltip-container" :aria-label="message">
    
    <div class="help-tooltip-icon">?</div>
    
    <span class="tooltip-bubble" role="tooltip">
      {{ message }}
    </span>
  </button>
</template>
<style>
.tooltip-container {
    position: relative; /* 👈 CRUCIAL: Permite posicionar la burbuja respecto al icono */
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    padding: 0;
    margin-left: var(--space-2);
    cursor: help; /* Cambia el cursor a una interrogación al pasar por encima */
}

.help-tooltip-icon{
    /* 1. Activamos Flexbox e indicamos alineación total */
    display: inline-flex;
    align-items: center;
    justify-content: center;

    /* 2. Dimensiones (subido a 14px para que respire mejor) */
    width: 11px;
    height: 11px;
    border-radius: 50%; 

    /* 3. Estilos de texto y colores */
    background-color: var(--color-accent-soft);
    border: 1px solid var(--color-accent);
    color: var(--color-accent);

    /* Reducimos un poco el font-size y quitamos el line-height heredado */
    font-size: 9px;
    font-weight: 400;
    line-height: 1; 

    /* Evita que el navegador intente aplicar text-align clásico */
    text-align: center;
}

.help-tooltip-icon:hover{
    cursor: help;
}

/* La burbuja (oculta por defecto) */
.tooltip-bubble {
    position: absolute;
    top: -6px;            /* 👈 Lo sitúa un poco por arriba del centro del icono */
    left: 100%;           /* 👈 Lo coloca completamente a la derecha del icono */
    margin-left: 8px;     /* 👈 Espacio de separación entre el icono y el bocadillo */

    /* Eliminamos el translateX(-50%) viejo para que no se mueva a la izquierda */
    transform: translateY(4px); 

    /* Estilos visuales de la burbuja */
    background-color: var(--color-accent-soft); 
    color: var(--text-primary);
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: normal;
    text-transform: none; 
    white-space: nowrap; 
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);

    /* Transición suave para el efecto de fade-in */
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.2s ease, transform 0.2s ease;
    pointer-events: none; 
    z-index: 50; 
}

/* Flecha apuntando a la izquierda (hacia el icono de origen) */
.tooltip-bubble::after {
    content: "";
    position: absolute;
    top: 45%;             /* 👈 Centra el pico verticalmente en el lateral del bocadillo */
    right: 100%;          /* 👈 Lo saca por el lado izquierdo del bocadillo */
    transform: translateY(-50%); /* 👈 Ajuste perfecto de centrado vertical del pico */
    
    border-width: 5px;
    border-bottom: 2px;
    border-style: solid;
    /* 👈 Cambiado: Ahora el color está en el lado derecho para que el triángulo apunte a la izquierda */
    border-color: transparent var(--color-accent-soft) transparent transparent; 
}

/* --- EFECTO HOVER --- */
.tooltip-container:hover .tooltip-bubble,
.tooltip-container:focus-within .tooltip-bubble {
    opacity: 1;
    visibility: visible;
    transform: translateY(-10px); /* 👈 Hace el sutil efecto de deslizamiento hacia su posición final */
}

</style>