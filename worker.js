/**
 * Cápsulas del Tiempo — Cloudflare Worker
 *
 * Bindings requeridos (configúralos en wrangler.toml o en el dashboard):
 *   - KV2      : KV Namespace   -> guarda los metadatos de cada cápsula
 *   - RB       : R2 Bucket      -> guarda canciones y fotos
 *   - USER     : Secret (texto) -> usuario de acceso a /admin
 *   - PASS     : Secret (texto) -> contraseña de acceso a /admin
 *   - SESSION_SECRET : Secret (texto) -> clave para firmar la cookie de sesión
 *
 * Estructura de datos en KV2:
 *   key: "capsule:DD/MM/AAAA"
 *   value: JSON {
 *     date, recipientName, letterTitle, letterBody, letterSignature,
 *     songKey (ruta en R2), photoKeys: [k0, k1, k2]
 *   }
 *
 *   key: "capsule_index"
 *   value: JSON array de fechas, para poder listar sin usar KV.list (más rápido/barato)
 */

// ============================================================
// Los siguientes tres imports son en realidad los archivos de
// frontend, incrustados como strings al momento de construir
// el worker final. Ver la sección "PLANTILLAS EMBEBIDAS" abajo.
// ============================================================

const PUBLIC_SHELL_HTML = "<!DOCTYPE html>\n<html lang=\"es\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, maximum-scale=1.0\">\n    <title>__PAGE_TITLE__</title>\n\n    <script src=\"https://cdn.tailwindcss.com\"></script>\n    <link href=\"https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400&family=Caveat:wght@400;700&display=swap\" rel=\"stylesheet\">\n\n    <style>\n        :root {\n            --metal-light: #9ca3af;\n            --metal-mid: #4b5563;\n            --metal-dark: #1f2937;\n            --metal-edge: #d1d5db;\n            --bg-dark: #0f172a;\n        }\n\n        * { box-sizing: border-box; }\n\n        html, body {\n            background-color: var(--bg-dark);\n            color: #d1d5db;\n            font-family: 'Courier Prime', monospace;\n            overflow: hidden;\n            height: 100vh;\n            height: 100dvh;\n            margin: 0;\n            display: flex;\n            align-items: center;\n            justify-content: center;\n            perspective: 1500px;\n            /* FIX: overflow-x lock para evitar scroll horizontal fantasma en mobile */\n            position: fixed;\n            top: 0;\n            left: 0;\n            width: 100vw;\n            width: 100dvw;\n        }\n\n        #newspaper-bg {\n            position: absolute;\n            inset: 0;\n            background-image: linear-gradient(rgba(230, 213, 184, 0.85), rgba(212, 186, 143, 0.9)), url('https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=2000');\n            background-size: cover;\n            background-position: center;\n            opacity: 0;\n            z-index: 0;\n            transition: opacity 2.5s ease-in-out;\n            pointer-events: none;\n        }\n\n        body.is-lit #newspaper-bg { opacity: 1; }\n\n        #main-stage {\n            position: absolute;\n            z-index: 10;\n            display: flex;\n            align-items: center;\n            justify-content: center;\n            gap: 20px;\n            transition: transform 1s ease, opacity 1s ease;\n            width: 100%;\n            max-width: 600px;\n            padding: 20px;\n            /* FIX: en pantallas angostas la caja + vinilo no cabían lado a lado */\n            flex-wrap: wrap;\n        }\n\n        #box-container {\n            position: relative;\n            width: 260px;\n            height: 200px;\n            transform-style: preserve-3d;\n            cursor: pointer;\n            transition: transform 0.2s;\n            flex-shrink: 0;\n        }\n        #box-container:hover { transform: scale(1.02); }\n\n        .box-half {\n            position: absolute;\n            width: 100%;\n            height: 50%;\n            left: 0;\n            transition: transform 1.5s cubic-bezier(0.25, 0.1, 0.25, 1);\n            background: linear-gradient(135deg, var(--metal-mid) 0%, var(--metal-dark) 100%);\n            box-shadow: inset 0 0 20px rgba(0,0,0,0.8), 0 10px 20px rgba(0,0,0,0.5);\n            display: flex;\n            align-items: center;\n            justify-content: center;\n            background-image: repeating-linear-gradient(\n                90deg, transparent, transparent 2px,\n                rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px\n            );\n        }\n\n        .box-top {\n            top: 0;\n            border-radius: 8px 8px 0 0;\n            border: 3px solid var(--metal-edge);\n            border-bottom: 2px solid #111;\n            transform-origin: top center;\n        }\n\n        .box-bottom {\n            bottom: 0;\n            border-radius: 0 0 8px 8px;\n            border: 3px solid var(--metal-edge);\n            border-top: 2px solid #111;\n        }\n\n        .rivet {\n            position: absolute;\n            width: 8px;\n            height: 8px;\n            background: #9ca3af;\n            border-radius: 50%;\n            box-shadow: inset -1px -1px 3px rgba(0,0,0,0.6), 1px 1px 2px rgba(255,255,255,0.3);\n        }\n        .box-top .rivet:nth-child(1) { top: 10px; left: 10px; }\n        .box-top .rivet:nth-child(2) { top: 10px; right: 10px; }\n        .box-bottom .rivet:nth-child(1) { bottom: 10px; left: 10px; }\n        .box-bottom .rivet:nth-child(2) { bottom: 10px; right: 10px; }\n\n        .latch {\n            position: absolute;\n            width: 40px;\n            height: 50px;\n            background: linear-gradient(to bottom, #d1d5db, #9ca3af);\n            bottom: -25px;\n            border-radius: 4px;\n            border: 2px solid #374151;\n            box-shadow: 0 4px 6px rgba(0,0,0,0.4);\n            display: flex;\n            justify-content: center;\n            align-items: center;\n            z-index: 5;\n        }\n        .keyhole {\n            width: 10px;\n            height: 18px;\n            background: #111;\n            border-radius: 50% 50% 2px 2px;\n        }\n\n        /* FIX: vinilo agrandado (antes 180px) y con nombre en cursivo dentro de la etiqueta */\n        #vinyl-container {\n            position: relative;\n            width: 220px;\n            height: 220px;\n            max-width: 42vw;\n            max-height: 42vw;\n            cursor: pointer;\n            transition: transform 0.2s;\n            flex-shrink: 0;\n        }\n        #vinyl-container:hover { transform: scale(1.05); }\n\n        .vinyl {\n            width: 100%;\n            height: 100%;\n            border-radius: 50%;\n            background-color: #111;\n            box-shadow: 0 15px 25px rgba(0,0,0,0.6), 0 0 0 4px #222;\n            background-image: repeating-radial-gradient(\n                circle at 50% 50%, #111 0px, #222 2px, #111 4px\n            );\n            display: flex;\n            align-items: center;\n            justify-content: center;\n            position: relative;\n        }\n\n        .vinyl-label {\n            width: 92px;\n            height: 92px;\n            background: #b91c1c;\n            border-radius: 50%;\n            border: 2px solid #444;\n            display: flex;\n            flex-direction: column;\n            align-items: center;\n            justify-content: center;\n            text-align: center;\n            padding: 6px;\n            overflow: hidden;\n        }\n\n        .vinyl-name {\n            font-family: 'Caveat', cursive;\n            font-weight: 700;\n            font-size: 1.15rem;\n            line-height: 1.15;\n            color: #fef3c7;\n            text-shadow: 0 1px 2px rgba(0,0,0,0.5);\n            word-break: break-word;\n            max-width: 100%;\n        }\n\n        .vinyl-hole {\n            width: 10px;\n            height: 10px;\n            background: #d1d5db;\n            border-radius: 50%;\n            box-shadow: inset 0 2px 4px rgba(0,0,0,0.8);\n            margin-top: 4px;\n        }\n\n        @keyframes spin { 100% { transform: rotate(360deg); } }\n        .is-open.playing .vinyl { animation: spin 3s linear infinite; }\n\n        .is-open .box-top { transform: translateY(-150px); opacity: 0; }\n        .is-open .box-bottom { transform: translateY(150px); opacity: 0; }\n        .is-open #main-stage {\n            transform: translateY(35vh) scale(0.6);\n            opacity: 0.8;\n            pointer-events: none;\n        }\n\n        /* FIX: content-container ahora es scrollable en su propio eje en mobile,\n           ya que height:70vh + flex-direction:column con dos bloques grandes\n           se cortaba en pantallas cortas */\n        #content-container {\n            position: absolute;\n            top: 50%;\n            left: 50%;\n            transform: translate(-50%, -50%);\n            width: 95vw;\n            max-width: 1000px;\n            height: 82vh;\n            z-index: 20;\n            pointer-events: none;\n            display: flex;\n            flex-direction: column;\n            gap: 16px;\n            opacity: 0;\n            transition: opacity 1s ease 1.5s;\n            overflow-y: auto;\n            overflow-x: hidden;\n            padding-bottom: 10px;\n        }\n\n        @media (min-width: 768px) {\n            #content-container {\n                flex-direction: row;\n                height: 64vh;\n                top: 46%;\n                overflow-y: visible;\n            }\n        }\n\n        .is-open.playing #content-container {\n            opacity: 1;\n            pointer-events: auto;\n        }\n\n        #photo-slider {\n            width: 100%;\n            display: flex;\n            overflow-x: auto;\n            overflow-y: visible;\n            scroll-snap-type: x mandatory;\n            gap: 16px;\n            padding: 32px 20px 48px 20px;\n            scrollbar-width: none;\n            -ms-overflow-style: none;\n            scroll-behavior: smooth;\n            align-items: center;\n            flex-shrink: 0;\n        }\n        #photo-slider::-webkit-scrollbar { display: none; }\n\n        @media (min-width: 768px) {\n            #photo-slider { width: 45%; height: 100%; }\n        }\n\n        .photo-slide {\n            scroll-snap-align: center;\n            flex: 0 0 100%;\n            display: flex;\n            justify-content: center;\n        }\n\n        .polaroid {\n            background: white;\n            padding: 10px 10px 34px 10px;\n            box-shadow: 0 15px 35px rgba(0,0,0,0.3);\n            border-radius: 2px;\n            width: 200px;\n            max-width: 78vw;\n            transform: rotate(-2deg);\n            transition: transform 0.3s;\n        }\n        .photo-slide:nth-child(even) .polaroid { transform: rotate(3deg); }\n        .polaroid:hover { transform: scale(1.05) rotate(0deg); }\n\n        .polaroid img {\n            width: 100%;\n            height: 180px;\n            object-fit: cover;\n            border: 1px solid #ddd;\n            filter: sepia(0.6) contrast(1.1);\n            display: block;\n        }\n\n        .polaroid p {\n            font-family: 'Caveat', cursive;\n            text-align: center;\n            margin-top: 12px;\n            font-size: 1.25rem;\n            color: #222;\n        }\n\n        /* FIX: puntos indicadores para que en mobile se sepa que hay 3 fotos,\n           ya que el swipe-hint solo se ve una vez */\n        #photo-dots {\n            display: flex;\n            justify-content: center;\n            gap: 8px;\n            padding-bottom: 4px;\n            flex-shrink: 0;\n        }\n        .photo-dot {\n            width: 7px;\n            height: 7px;\n            border-radius: 50%;\n            background: rgba(255,255,255,0.3);\n            transition: background 0.3s;\n        }\n        .photo-dot.active { background: #fbbf24; }\n\n        @media (min-width: 768px) {\n            #photo-dots { display: none; }\n        }\n\n        #letter-container {\n            width: 100%;\n            background-color: rgba(255, 255, 255, 0.95);\n            box-shadow: 0 20px 40px rgba(0,0,0,0.2);\n            padding: 26px;\n            border-radius: 4px;\n            color: #1f2937;\n            overflow-y: auto;\n            position: relative;\n            background-image: repeating-linear-gradient(transparent, transparent 24px, rgba(0,0,0,0.05) 25px);\n            line-height: 25px;\n            flex-shrink: 0;\n        }\n        @media (min-width: 768px) {\n            #letter-container { width: 55%; padding: 40px; height: 100%; flex-shrink: 1; }\n        }\n\n        .typewriter-text {\n            font-size: 1.05rem;\n            white-space: pre-wrap;\n            word-break: break-word;\n        }\n        .cursor {\n            display: inline-block;\n            width: 10px;\n            height: 1.2em;\n            background-color: #1f2937;\n            vertical-align: middle;\n            animation: blink 1s step-end infinite;\n        }\n        @keyframes blink { 50% { opacity: 0; } }\n\n        #date-modal {\n            position: absolute;\n            top: 50%;\n            left: 50%;\n            transform: translate(-50%, -50%) scale(0.8);\n            background: rgba(15, 23, 42, 0.95);\n            border: 2px solid var(--metal-light);\n            padding: 25px;\n            border-radius: 8px;\n            z-index: 50;\n            opacity: 0;\n            pointer-events: none;\n            transition: all 0.3s ease;\n            box-shadow: 0 0 30px rgba(0, 0, 0, 0.8);\n            text-align: center;\n            width: 90vw;\n            max-width: 340px;\n        }\n        #date-modal.active {\n            opacity: 1;\n            transform: translate(-50%, -50%) scale(1);\n            pointer-events: auto;\n        }\n        .date-input {\n            background: transparent;\n            border: none;\n            border-bottom: 2px solid var(--metal-light);\n            color: white;\n            font-size: 24px;\n            text-align: center;\n            width: 160px;\n            outline: none;\n            font-family: 'Courier Prime', monospace;\n            margin: 20px 0;\n            letter-spacing: 2px;\n        }\n\n        /* Overlay de carga mientras el audio buffer-ea */\n        #loading-overlay {\n            position: absolute;\n            inset: 0;\n            z-index: 60;\n            background: var(--bg-dark);\n            display: none;\n            align-items: center;\n            justify-content: center;\n            flex-direction: column;\n            gap: 16px;\n        }\n        #loading-overlay.active { display: flex; }\n        .loading-spinner {\n            width: 42px;\n            height: 42px;\n            border: 3px solid rgba(255,255,255,0.15);\n            border-top-color: #fbbf24;\n            border-radius: 50%;\n            animation: spin 1s linear infinite;\n        }\n        #loading-text {\n            font-size: 0.85rem;\n            letter-spacing: 2px;\n            text-transform: uppercase;\n            color: var(--metal-light);\n        }\n        #loading-bar-track {\n            width: 220px;\n            max-width: 70vw;\n            height: 6px;\n            background: rgba(255,255,255,0.1);\n            border-radius: 999px;\n            overflow: hidden;\n        }\n        #loading-bar-fill {\n            height: 100%;\n            width: 0%;\n            background: #fbbf24;\n            border-radius: 999px;\n            transition: width 0.35s ease;\n        }\n        #loading-percent {\n            font-size: 0.75rem;\n            color: var(--metal-light);\n            letter-spacing: 1px;\n        }\n\n        #error-modal {\n            position: absolute;\n            top: 50%;\n            left: 50%;\n            transform: translate(-50%, -50%);\n            background: rgba(30, 10, 10, 0.97);\n            border: 2px solid #b91c1c;\n            padding: 25px;\n            border-radius: 8px;\n            z-index: 70;\n            display: none;\n            text-align: center;\n            width: 90vw;\n            max-width: 340px;\n        }\n        #error-modal.active { display: block; }\n\n        #explosion-overlay {\n            position: fixed;\n            inset: 0;\n            background: rgba(255, 0, 0, 0.8);\n            z-index: 100;\n            opacity: 0;\n            pointer-events: none;\n            transition: opacity 0.1s;\n            mix-blend-mode: overlay;\n        }\n        @keyframes shake {\n            0%, 100% { transform: translate(0, 0) rotate(0deg); }\n            10% { transform: translate(-10px, -10px) rotate(-2deg); }\n            20% { transform: translate(10px, 10px) rotate(2deg); }\n            30% { transform: translate(-10px, 10px) rotate(-2deg); }\n            40% { transform: translate(10px, -10px) rotate(2deg); }\n            50% { transform: translate(-15px, 0px) rotate(-1deg); }\n            60% { transform: translate(15px, 0px) rotate(1deg); }\n            70% { transform: translate(-10px, -10px) rotate(-2deg); }\n            80% { transform: translate(10px, 10px) rotate(2deg); }\n            90% { transform: translate(-5px, 5px) rotate(-1deg); }\n        }\n        .exploding { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }\n        .exploding-screen { opacity: 1 !important; animation: flashRed 1.5s ease-out forwards; }\n        @keyframes flashRed {\n            0% { opacity: 1; background: rgba(255, 0, 0, 1); }\n            100% { opacity: 0; background: rgba(255, 0, 0, 0); }\n        }\n\n        /* FIX: pantallas muy bajas (landscape mobile) - reducir tamaño de caja/vinilo */\n        @media (max-height: 500px) {\n            #box-container { width: 190px; height: 150px; }\n            #vinyl-container { width: 160px; height: 160px; }\n            .vinyl-label { width: 68px; height: 68px; }\n        }\n    </style>\n</head>\n<body>\n\n    <div id=\"newspaper-bg\"></div>\n    <div id=\"explosion-overlay\"></div>\n\n    <div id=\"main-stage\">\n        <div id=\"box-container\" onclick=\"askForDate()\">\n            <div class=\"box-half box-top\">\n                <div class=\"rivet\"></div>\n                <div class=\"rivet\"></div>\n                <div class=\"latch\"><div class=\"keyhole\"></div></div>\n            </div>\n            <div class=\"box-half box-bottom\">\n                <div class=\"rivet\"></div>\n                <div class=\"rivet\"></div>\n            </div>\n        </div>\n\n        <div id=\"vinyl-container\" onclick=\"askForDate()\">\n            <div class=\"vinyl\">\n                <div class=\"vinyl-label\">\n                    <div class=\"vinyl-name\" id=\"vinyl-name-target\"></div>\n                    <div class=\"vinyl-hole\"></div>\n                </div>\n            </div>\n        </div>\n    </div>\n\n    <div id=\"content-container\">\n        <div class=\"relative w-full md:w-5/12 flex flex-col items-center justify-center\">\n            <div id=\"photo-slider\"></div>\n            <div id=\"photo-dots\"></div>\n            <div class=\"swipe-hint md:hidden\" style=\"position:static;color:rgba(255,255,255,0.5);font-size:0.8rem;margin-top:2px;\">&larr; Desliza las fotos &rarr;</div>\n        </div>\n\n        <div id=\"letter-container\">\n            <div class=\"border-b-2 border-gray-400 pb-2 mb-6\">\n                <h2 class=\"text-2xl font-bold tracking-widest text-gray-800 uppercase\" id=\"letter-title-target\"></h2>\n            </div>\n            <div class=\"typewriter-text\" id=\"tw-target\"></div><span class=\"cursor\" id=\"tw-cursor\" style=\"display: none;\"></span>\n        </div>\n    </div>\n\n    <div id=\"date-modal\">\n        <h3 class=\"text-xl font-bold text-gray-200 mb-2 uppercase tracking-widest\">Código de Acceso</h3>\n        <p class=\"text-sm text-gray-400 mb-4\">Ingresa la fecha de origen para abrir la bóveda.</p>\n        <input type=\"text\" id=\"date-input\" inputmode=\"numeric\" class=\"date-input\" placeholder=\"DD/MM/AAAA\" maxlength=\"10\" onkeyup=\"formatDate(event)\">\n        <div class=\"mt-6 flex justify-center gap-4\">\n            <button onclick=\"closeModal()\" class=\"px-4 py-2 text-gray-400 hover:text-white transition\">Cancelar</button>\n            <button onclick=\"verifyDate()\" class=\"px-6 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-500 text-white rounded font-bold shadow-lg transition\">ABRIR</button>\n        </div>\n    </div>\n\n    <div id=\"loading-overlay\">\n        <div class=\"loading-spinner\"></div>\n        <div id=\"loading-text\">Descodificando la cápsula...</div>\n        <div id=\"loading-bar-track\">\n            <div id=\"loading-bar-fill\"></div>\n        </div>\n        <div id=\"loading-percent\">0%</div>\n    </div>\n\n    <div id=\"error-modal\">\n        <h3 class=\"text-lg font-bold text-red-400 mb-2 uppercase tracking-widest\">Bóveda no encontrada</h3>\n        <p class=\"text-sm text-gray-300 mb-4\" id=\"error-message\">Esa fecha no corresponde a ninguna cápsula.</p>\n        <button onclick=\"document.getElementById('error-modal').classList.remove('active')\" class=\"px-6 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-500 text-white rounded font-bold shadow-lg transition\">Cerrar</button>\n    </div>\n\n    <audio id=\"capsule-audio\" preload=\"auto\" playsinline></audio>\n\n    <script>\n    __CLIENT_SCRIPT__\n    </script>\n</body>\n</html>\n";
const PUBLIC_CLIENT_JS = "const mainStage = document.getElementById('main-stage');\nconst dateModal = document.getElementById('date-modal');\nconst dateInput = document.getElementById('date-input');\nconst explosionOverlay = document.getElementById('explosion-overlay');\nconst twTarget = document.getElementById('tw-target');\nconst twCursor = document.getElementById('tw-cursor');\nconst loadingOverlay = document.getElementById('loading-overlay');\nconst errorModal = document.getElementById('error-modal');\nconst errorMessage = document.getElementById('error-message');\nconst audioEl = document.getElementById('capsule-audio');\nconst photoSlider = document.getElementById('photo-slider');\nconst photoDots = document.getElementById('photo-dots');\nconst vinylNameTarget = document.getElementById('vinyl-name-target');\nconst letterTitleTarget = document.getElementById('letter-title-target');\n\nlet isOpen = false;\nlet isLoading = false;\nlet currentCapsule = null;\n\nfunction askForDate() {\n    if (isOpen || isLoading) return;\n    dateModal.classList.add('active');\n    dateInput.value = '';\n    dateInput.focus();\n}\n\nfunction closeModal() {\n    dateModal.classList.remove('active');\n}\n\nfunction formatDate(e) {\n    let val = e.target.value.replace(/\\D/g, '');\n    if (val.length > 8) val = val.substring(0, 8);\n\n    if (val.length > 4) {\n        e.target.value = val.substring(0, 2) + '/' + val.substring(2, 4) + '/' + val.substring(4, 8);\n    } else if (val.length > 2) {\n        e.target.value = val.substring(0, 2) + '/' + val.substring(2, 4);\n    } else {\n        e.target.value = val;\n    }\n\n    if (e.key === 'Enter') {\n        verifyDate();\n    }\n}\n\nasync function verifyDate() {\n    const input = dateInput.value;\n    if (input.length !== 10) {\n        return;\n    }\n    closeModal();\n    await loadCapsule(input);\n}\n\nfunction triggerExplosion() {\n    document.body.classList.add('exploding');\n    explosionOverlay.classList.add('exploding-screen');\n    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);\n\n    setTimeout(() => {\n        document.body.classList.remove('exploding');\n        explosionOverlay.classList.remove('exploding-screen');\n    }, 1500);\n}\n\nfunction showError(message) {\n    errorMessage.textContent = message;\n    errorModal.classList.add('active');\n    triggerExplosion();\n}\n\nfunction updateLoadingProgress(doneSteps, totalSteps) {\n    const pct = Math.round((doneSteps / totalSteps) * 100);\n    const fillEl = document.getElementById('loading-bar-fill');\n    const percentEl = document.getElementById('loading-percent');\n    if (fillEl) fillEl.style.width = pct + '%';\n    if (percentEl) percentEl.textContent = pct + '%';\n}\n\nfunction withTimeout(promise, ms) {\n    return Promise.race([\n        promise,\n        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))\n    ]);\n}\n\nasync function loadCapsule(dateStr) {\n    isLoading = true;\n    loadingOverlay.classList.add('active');\n    updateLoadingProgress(0, 1);\n\n    try {\n        const res = await fetch('/api/capsule/' + encodeURIComponent(dateStr));\n\n        if (res.status === 404) {\n            loadingOverlay.classList.remove('active');\n            isLoading = false;\n            showError('Esa fecha no corresponde a ninguna cápsula. Verifica el código e intenta de nuevo.');\n            return;\n        }\n\n        if (!res.ok) {\n            loadingOverlay.classList.remove('active');\n            isLoading = false;\n            showError('Ocurrió un problema al buscar la cápsula. Intenta nuevamente en un momento.');\n            return;\n        }\n\n        const capsule = await res.json();\n        currentCapsule = capsule;\n\n        const photoUrls = (capsule.photoUrls || []).slice(0, 3);\n        const totalSteps = 1 + photoUrls.length;\n        let doneSteps = 0;\n\n        const markStepDone = () => {\n            doneSteps++;\n            updateLoadingProgress(doneSteps, totalSteps);\n        };\n\n        const audioPromise = withTimeout(preloadAudio(capsule.songUrl), 25000).then(markStepDone);\n        const photoPromises = photoUrls.map(url =>\n            withTimeout(preloadImage(url), 25000).then(markStepDone)\n        );\n\n        await Promise.all([audioPromise, ...photoPromises]);\n\n        loadingOverlay.classList.remove('active');\n        isLoading = false;\n\n        buildCapsuleContent(capsule);\n        openCapsule();\n    } catch (err) {\n        loadingOverlay.classList.remove('active');\n        isLoading = false;\n        showError('No se pudo cargar la música o las fotos de esta cápsula. Revisa tu conexión e intenta de nuevo.');\n    }\n}\n\nfunction preloadAudio(url) {\n    return new Promise((resolve, reject) => {\n        audioEl.src = url;\n        audioEl.loop = true;\n\n        const onReady = () => {\n            audioEl.removeEventListener('canplaythrough', onReady);\n            audioEl.removeEventListener('error', onError);\n            resolve();\n        };\n        const onError = () => {\n            audioEl.removeEventListener('canplaythrough', onReady);\n            audioEl.removeEventListener('error', onError);\n            reject(new Error('audio-load-failed'));\n        };\n\n        audioEl.addEventListener('canplaythrough', onReady, { once: true });\n        audioEl.addEventListener('error', onError, { once: true });\n        audioEl.load();\n    });\n}\n\nfunction preloadImage(url) {\n    return new Promise((resolve, reject) => {\n        const img = new Image();\n        img.onload = () => resolve();\n        img.onerror = () => reject(new Error('image-load-failed'));\n        img.src = url;\n    });\n}\n\nfunction buildCapsuleContent(capsule) {\n    // Nombre en cursivo en el disco de vinilo\n    vinylNameTarget.textContent = capsule.recipientName || '';\n\n    // Título de la carta\n    letterTitleTarget.textContent = capsule.letterTitle || ('Cápsula ' + capsule.date);\n\n    // Fotos\n    photoSlider.innerHTML = '';\n    photoDots.innerHTML = '';\n    const photos = capsule.photoUrls || [];\n    photos.forEach((url, idx) => {\n        const slide = document.createElement('div');\n        slide.className = 'photo-slide';\n        slide.innerHTML = '<div class=\"polaroid\"><img src=\"' + url + '\" alt=\"Recuerdo ' + (idx + 1) + '\"></div>';\n        photoSlider.appendChild(slide);\n\n        const dot = document.createElement('div');\n        dot.className = 'photo-dot' + (idx === 0 ? ' active' : '');\n        photoDots.appendChild(dot);\n    });\n\n    // Sincronizar puntitos con el scroll del carrusel en mobile\n    if (photos.length > 1) {\n        let scrollTimeout;\n        photoSlider.addEventListener('scroll', () => {\n            clearTimeout(scrollTimeout);\n            scrollTimeout = setTimeout(() => {\n                const slideWidth = photoSlider.clientWidth;\n                const idx = Math.round(photoSlider.scrollLeft / slideWidth);\n                document.querySelectorAll('.photo-dot').forEach((d, i) => {\n                    d.classList.toggle('active', i === idx);\n                });\n            }, 80);\n        });\n    }\n}\n\nfunction openCapsule() {\n    if (isOpen) return;\n    isOpen = true;\n\n    document.body.classList.add('is-open');\n\n    setTimeout(() => {\n        document.body.classList.add('is-lit');\n        document.body.classList.add('playing');\n\n        audioEl.play().catch(() => {\n            // Si el navegador bloquea autoplay con sonido, reintenta al primer toque\n            const resumeOnInteract = () => {\n                audioEl.play().catch(() => {});\n                document.removeEventListener('click', resumeOnInteract);\n                document.removeEventListener('touchstart', resumeOnInteract);\n            };\n            document.addEventListener('click', resumeOnInteract, { once: true });\n            document.addEventListener('touchstart', resumeOnInteract, { once: true });\n        });\n\n        setTimeout(() => startTypewriter(currentCapsule), 1500);\n    }, 500);\n}\n\nfunction startTypewriter(capsule) {\n    const letterText = buildLetterText(capsule);\n    twCursor.style.display = 'inline-block';\n    let i = 0;\n\n    function typeChar() {\n        if (i < letterText.length) {\n            twTarget.textContent += letterText.charAt(i);\n            i++;\n\n            let speed = Math.random() * 30 + 20;\n            if (letterText.charAt(i - 1) === '.' || letterText.charAt(i - 1) === ',') {\n                speed += 400;\n            }\n\n            const container = document.getElementById('letter-container');\n            container.scrollTop = container.scrollHeight;\n\n            setTimeout(typeChar, speed);\n        } else {\n            twCursor.style.animation = 'none';\n            twCursor.style.opacity = '0';\n        }\n    }\n\n    typeChar();\n}\n\nfunction buildLetterText(capsule) {\n    let text = capsule.letterBody || '';\n    if (capsule.letterSignature) {\n        text += '\\n\\n' + capsule.letterSignature;\n    }\n    return text;\n}\n";
const ADMIN_LOGIN_HTML = "<!DOCTYPE html>\n<html lang=\"es\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <title>Admin · Cápsulas del Tiempo</title>\n    <script src=\"https://cdn.tailwindcss.com\"></script>\n    <link href=\"https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700&display=swap\" rel=\"stylesheet\">\n    <style>\n        body { font-family: 'Courier Prime', monospace; background: #0f172a; }\n        .panel-input {\n            background: #1e293b;\n            border: 1px solid #334155;\n            color: #e2e8f0;\n        }\n        .panel-input:focus { outline: none; border-color: #fbbf24; }\n    </style>\n</head>\n<body class=\"min-h-screen flex items-center justify-center p-4\">\n    <div class=\"w-full max-w-sm bg-slate-800 border border-slate-700 rounded-lg p-8 shadow-2xl\">\n        <h1 class=\"text-xl font-bold text-slate-100 mb-1 uppercase tracking-widest text-center\">Acceso Admin</h1>\n        <p class=\"text-slate-400 text-sm text-center mb-6\">Panel de cápsulas del tiempo</p>\n\n        __ERROR_BLOCK__\n\n        <form method=\"POST\" action=\"/admin/login\" class=\"space-y-4\">\n            <div>\n                <label class=\"block text-xs text-slate-400 mb-1 uppercase tracking-wide\">Usuario</label>\n                <input type=\"text\" name=\"username\" required autofocus class=\"panel-input w-full px-3 py-2 rounded\">\n            </div>\n            <div>\n                <label class=\"block text-xs text-slate-400 mb-1 uppercase tracking-wide\">Contraseña</label>\n                <input type=\"password\" name=\"password\" required class=\"panel-input w-full px-3 py-2 rounded\">\n            </div>\n            <button type=\"submit\" class=\"w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-2 rounded transition uppercase tracking-wide text-sm\">\n                Entrar\n            </button>\n        </form>\n    </div>\n</body>\n</html>\n";
const ADMIN_PANEL_HTML = "<!DOCTYPE html>\n<html lang=\"es\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <title>Admin · Cápsulas del Tiempo</title>\n    <script src=\"https://cdn.tailwindcss.com\"></script>\n    <link href=\"https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700&display=swap\" rel=\"stylesheet\">\n    <style>\n        body { font-family: 'Courier Prime', monospace; background: #0f172a; }\n        .panel-input, .panel-textarea {\n            background: #1e293b;\n            border: 1px solid #334155;\n            color: #e2e8f0;\n        }\n        .panel-input:focus, .panel-textarea:focus { outline: none; border-color: #fbbf24; }\n\n        .dropzone {\n            border: 2px dashed #475569;\n            transition: all 0.2s;\n            cursor: pointer;\n        }\n        .dropzone.drag-over {\n            border-color: #fbbf24;\n            background: rgba(251, 191, 36, 0.08);\n        }\n        .dropzone.has-file {\n            border-style: solid;\n            border-color: #22c55e;\n        }\n\n        .photo-slot {\n            aspect-ratio: 1;\n        }\n        .photo-slot img {\n            width: 100%;\n            height: 100%;\n            object-fit: cover;\n        }\n\n        .progress-bar-wrap {\n            display: none;\n        }\n        .progress-bar-wrap.active { display: block; }\n        .progress-bar-fill {\n            transition: width 0.2s ease;\n        }\n\n        .capsule-row:hover { background: #1e293b; }\n\n        #toast {\n            position: fixed;\n            bottom: 20px;\n            left: 50%;\n            transform: translateX(-50%) translateY(20px);\n            opacity: 0;\n            transition: all 0.3s;\n            pointer-events: none;\n            z-index: 100;\n        }\n        #toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }\n    </style>\n</head>\n<body class=\"min-h-screen text-slate-200 pb-20\">\n\n    <header class=\"border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-20\">\n        <div class=\"max-w-5xl mx-auto px-4 py-4 flex items-center justify-between\">\n            <h1 class=\"text-lg font-bold uppercase tracking-widest text-amber-400\">Cápsulas del Tiempo</h1>\n            <form method=\"POST\" action=\"/admin/logout\">\n                <button type=\"submit\" class=\"text-sm text-slate-400 hover:text-red-400 transition\">Cerrar sesión</button>\n            </form>\n        </div>\n    </header>\n\n    <main class=\"max-w-5xl mx-auto px-4 py-8 space-y-10\">\n\n        <!-- Listado -->\n        <section>\n            <div class=\"flex items-center justify-between mb-4\">\n                <h2 class=\"text-base font-bold uppercase tracking-wide text-slate-300\">Cápsulas creadas</h2>\n                <button onclick=\"showForm()\" id=\"new-capsule-btn\" class=\"bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-4 py-2 rounded text-sm uppercase tracking-wide transition\">\n                    + Nueva cápsula\n                </button>\n            </div>\n            <div id=\"capsule-list\" class=\"border border-slate-800 rounded-lg divide-y divide-slate-800 overflow-hidden\">\n                <div class=\"p-6 text-center text-slate-500 text-sm\" id=\"list-empty-state\">Cargando...</div>\n            </div>\n        </section>\n\n        <!-- Formulario -->\n        <section id=\"form-section\" class=\"hidden\">\n            <div class=\"border border-slate-800 rounded-lg p-6 bg-slate-900/40\">\n                <div class=\"flex items-center justify-between mb-6\">\n                    <h2 class=\"text-base font-bold uppercase tracking-wide text-slate-300\" id=\"form-title\">Nueva cápsula</h2>\n                    <button onclick=\"hideForm()\" class=\"text-slate-500 hover:text-slate-300 text-sm\">✕ Cancelar</button>\n                </div>\n\n                <form id=\"capsule-form\" class=\"space-y-6\" onsubmit=\"return false;\">\n                    <input type=\"hidden\" id=\"original-date\" value=\"\">\n\n                    <div class=\"grid grid-cols-1 md:grid-cols-2 gap-4\">\n                        <div>\n                            <label class=\"block text-xs text-slate-400 mb-1 uppercase tracking-wide\">Fecha de acceso (DD/MM/AAAA)</label>\n                            <input type=\"text\" id=\"f-date\" inputmode=\"numeric\" maxlength=\"10\" placeholder=\"10/10/2010\" class=\"panel-input w-full px-3 py-2 rounded\" oninput=\"formatAdminDate(event)\">\n                            <p class=\"text-xs text-slate-500 mt-1\">Esta fecha es el código que el destinatario debe ingresar para abrir su cápsula.</p>\n                        </div>\n                        <div>\n                            <label class=\"block text-xs text-slate-400 mb-1 uppercase tracking-wide\">Nombre del destinatario</label>\n                            <input type=\"text\" id=\"f-recipient\" placeholder=\"María\" class=\"panel-input w-full px-3 py-2 rounded\">\n                            <p class=\"text-xs text-slate-500 mt-1\">Aparecerá en cursivo sobre el disco de vinilo.</p>\n                        </div>\n                    </div>\n\n                    <div>\n                        <label class=\"block text-xs text-slate-400 mb-1 uppercase tracking-wide\">Título de la carta</label>\n                        <input type=\"text\" id=\"f-letter-title\" placeholder=\"Cápsula 10/10/2010\" class=\"panel-input w-full px-3 py-2 rounded\">\n                    </div>\n\n                    <div>\n                        <label class=\"block text-xs text-slate-400 mb-1 uppercase tracking-wide\">Cuerpo de la carta</label>\n                        <textarea id=\"f-letter-body\" rows=\"8\" placeholder=\"Hola. Si la música suena y estás leyendo esto...\" class=\"panel-textarea w-full px-3 py-2 rounded resize-y\"></textarea>\n                    </div>\n\n                    <div>\n                        <label class=\"block text-xs text-slate-400 mb-1 uppercase tracking-wide\">Firma</label>\n                        <input type=\"text\" id=\"f-letter-signature\" placeholder=\"Con cariño, tus amigos de siempre.\" class=\"panel-input w-full px-3 py-2 rounded\">\n                    </div>\n\n                    <!-- Canción -->\n                    <div>\n                        <label class=\"block text-xs text-slate-400 mb-2 uppercase tracking-wide\">Canción</label>\n                        <div id=\"song-dropzone\" class=\"dropzone rounded-lg p-6 text-center\">\n                            <input type=\"file\" id=\"song-input\" accept=\"audio/*\" class=\"hidden\">\n                            <div id=\"song-empty\">\n                                <p class=\"text-slate-400 text-sm\">Arrastra un archivo de audio aquí, o haz clic para seleccionar</p>\n                                <p class=\"text-slate-600 text-xs mt-1\">MP3, WAV, OGG, M4A</p>\n                            </div>\n                            <div id=\"song-filled\" class=\"hidden\">\n                                <p class=\"text-green-400 text-sm mb-2\">🎵 <span id=\"song-filename\"></span></p>\n                                <audio id=\"song-preview\" controls class=\"w-full max-w-sm mx-auto\"></audio>\n                                <button type=\"button\" onclick=\"clearSong(event)\" class=\"block mx-auto mt-2 text-xs text-red-400 hover:text-red-300\">Quitar canción</button>\n                            </div>\n                        </div>\n                        <div class=\"progress-bar-wrap mt-2\" id=\"song-progress-wrap\">\n                            <div class=\"w-full bg-slate-800 rounded-full h-1.5 overflow-hidden\">\n                                <div class=\"progress-bar-fill bg-amber-400 h-full\" id=\"song-progress-fill\" style=\"width:0%\"></div>\n                            </div>\n                        </div>\n                    </div>\n\n                    <!-- Fotos -->\n                    <div>\n                        <label class=\"block text-xs text-slate-400 mb-2 uppercase tracking-wide\">Fotos (3 requeridas)</label>\n                        <div class=\"grid grid-cols-3 gap-3\">\n                            <div class=\"dropzone photo-slot rounded-lg flex items-center justify-center relative overflow-hidden\" data-slot=\"0\">\n                                <input type=\"file\" accept=\"image/*\" class=\"hidden photo-input\" data-slot=\"0\">\n                                <span class=\"photo-placeholder text-slate-500 text-xs text-center px-2\">Foto 1</span>\n                                <img class=\"hidden\" data-slot=\"0\">\n                                <button type=\"button\" class=\"photo-remove hidden absolute top-1 right-1 bg-red-600 hover:bg-red-500 text-white rounded-full w-6 h-6 text-xs leading-none\" data-slot=\"0\" onclick=\"clearPhoto(event, 0)\">✕</button>\n                            </div>\n                            <div class=\"dropzone photo-slot rounded-lg flex items-center justify-center relative overflow-hidden\" data-slot=\"1\">\n                                <input type=\"file\" accept=\"image/*\" class=\"hidden photo-input\" data-slot=\"1\">\n                                <span class=\"photo-placeholder text-slate-500 text-xs text-center px-2\">Foto 2</span>\n                                <img class=\"hidden\" data-slot=\"1\">\n                                <button type=\"button\" class=\"photo-remove hidden absolute top-1 right-1 bg-red-600 hover:bg-red-500 text-white rounded-full w-6 h-6 text-xs leading-none\" data-slot=\"1\" onclick=\"clearPhoto(event, 1)\">✕</button>\n                            </div>\n                            <div class=\"dropzone photo-slot rounded-lg flex items-center justify-center relative overflow-hidden\" data-slot=\"2\">\n                                <input type=\"file\" accept=\"image/*\" class=\"hidden photo-input\" data-slot=\"2\">\n                                <span class=\"photo-placeholder text-slate-500 text-xs text-center px-2\">Foto 3</span>\n                                <img class=\"hidden\" data-slot=\"2\">\n                                <button type=\"button\" class=\"photo-remove hidden absolute top-1 right-1 bg-red-600 hover:bg-red-500 text-white rounded-full w-6 h-6 text-xs leading-none\" data-slot=\"2\" onclick=\"clearPhoto(event, 2)\">✕</button>\n                            </div>\n                        </div>\n                    </div>\n\n                    <div id=\"form-error\" class=\"hidden text-red-400 text-sm bg-red-950/40 border border-red-900 rounded p-3\"></div>\n\n                    <div class=\"flex items-center gap-3 pt-2\">\n                        <button type=\"button\" onclick=\"submitCapsule()\" id=\"submit-btn\" class=\"bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-6 py-2.5 rounded uppercase tracking-wide text-sm transition disabled:opacity-50 disabled:cursor-not-allowed\">\n                            Guardar cápsula\n                        </button>\n                        <span id=\"submit-status\" class=\"text-sm text-slate-400\"></span>\n                    </div>\n                </form>\n            </div>\n        </section>\n    </main>\n\n    <div id=\"toast\" class=\"bg-slate-800 border border-slate-700 text-slate-200 px-4 py-2.5 rounded-lg shadow-xl text-sm\"></div>\n\n    <script>\n    __ADMIN_SCRIPT__\n    </script>\n</body>\n</html>\n";
const ADMIN_CLIENT_JS = "let songFile = null;\nlet photoFiles = [null, null, null];\nlet isEditing = false;\n\n// ---------- Utilidades UI ----------\n\nfunction showToast(msg) {\n    const toast = document.getElementById('toast');\n    toast.textContent = msg;\n    toast.classList.add('show');\n    setTimeout(() => toast.classList.remove('show'), 2500);\n}\n\nfunction showForm(capsule) {\n    document.getElementById('form-section').classList.remove('hidden');\n    document.getElementById('new-capsule-btn').classList.add('hidden');\n    document.getElementById('form-section').scrollIntoView({ behavior: 'smooth', block: 'start' });\n\n    if (capsule) {\n        isEditing = true;\n        document.getElementById('form-title').textContent = 'Editar cápsula · ' + capsule.date;\n        document.getElementById('original-date').value = capsule.date;\n        document.getElementById('f-date').value = capsule.date;\n        document.getElementById('f-recipient').value = capsule.recipientName || '';\n        document.getElementById('f-letter-title').value = capsule.letterTitle || '';\n        document.getElementById('f-letter-body').value = capsule.letterBody || '';\n        document.getElementById('f-letter-signature').value = capsule.letterSignature || '';\n\n        if (capsule.songUrl) {\n            document.getElementById('song-empty').classList.add('hidden');\n            document.getElementById('song-filled').classList.remove('hidden');\n            document.getElementById('song-dropzone').classList.add('has-file');\n            document.getElementById('song-filename').textContent = 'Canción actual (sin cambios)';\n            document.getElementById('song-preview').src = capsule.songUrl;\n        }\n\n        (capsule.photoUrls || []).forEach((url, idx) => {\n            const slot = document.querySelector('.photo-slot[data-slot=\"' + idx + '\"]');\n            const img = slot.querySelector('img');\n            const placeholder = slot.querySelector('.photo-placeholder');\n            const removeBtn = slot.querySelector('.photo-remove');\n            img.src = url;\n            img.classList.remove('hidden');\n            placeholder.classList.add('hidden');\n            removeBtn.classList.remove('hidden');\n        });\n    } else {\n        isEditing = false;\n        document.getElementById('form-title').textContent = 'Nueva cápsula';\n        document.getElementById('original-date').value = '';\n    }\n}\n\nfunction hideForm() {\n    document.getElementById('form-section').classList.add('hidden');\n    document.getElementById('new-capsule-btn').classList.remove('hidden');\n    resetForm();\n}\n\nfunction resetForm() {\n    document.getElementById('capsule-form').reset();\n    document.getElementById('f-date').value = '';\n    songFile = null;\n    photoFiles = [null, null, null];\n    isEditing = false;\n\n    document.getElementById('song-empty').classList.remove('hidden');\n    document.getElementById('song-filled').classList.add('hidden');\n    document.getElementById('song-dropzone').classList.remove('has-file');\n    document.getElementById('song-preview').src = '';\n\n    document.querySelectorAll('.photo-slot').forEach(slot => {\n        const img = slot.querySelector('img');\n        const placeholder = slot.querySelector('.photo-placeholder');\n        const removeBtn = slot.querySelector('.photo-remove');\n        img.src = '';\n        img.classList.add('hidden');\n        placeholder.classList.remove('hidden');\n        removeBtn.classList.add('hidden');\n    });\n\n    document.getElementById('form-error').classList.add('hidden');\n    document.getElementById('song-progress-wrap').classList.remove('active');\n}\n\nfunction formatAdminDate(e) {\n    let val = e.target.value.replace(/\\D/g, '');\n    if (val.length > 8) val = val.substring(0, 8);\n    if (val.length > 4) {\n        e.target.value = val.substring(0, 2) + '/' + val.substring(2, 4) + '/' + val.substring(4, 8);\n    } else if (val.length > 2) {\n        e.target.value = val.substring(0, 2) + '/' + val.substring(2, 4);\n    } else {\n        e.target.value = val;\n    }\n}\n\n// ---------- Canción: drag & drop + preview ----------\n\nconst songDropzone = document.getElementById('song-dropzone');\nconst songInput = document.getElementById('song-input');\n\nsongDropzone.addEventListener('click', () => songInput.click());\nsongInput.addEventListener('change', (e) => {\n    if (e.target.files[0]) handleSongFile(e.target.files[0]);\n});\n\n['dragover', 'dragenter'].forEach(evt => {\n    songDropzone.addEventListener(evt, (e) => {\n        e.preventDefault();\n        songDropzone.classList.add('drag-over');\n    });\n});\n['dragleave', 'drop'].forEach(evt => {\n    songDropzone.addEventListener(evt, (e) => {\n        e.preventDefault();\n        songDropzone.classList.remove('drag-over');\n    });\n});\nsongDropzone.addEventListener('drop', (e) => {\n    const file = e.dataTransfer.files[0];\n    if (file && file.type.startsWith('audio/')) {\n        handleSongFile(file);\n    } else if (file) {\n        showToast('Ese archivo no parece ser audio.');\n    }\n});\n\nfunction handleSongFile(file) {\n    songFile = file;\n    document.getElementById('song-empty').classList.add('hidden');\n    document.getElementById('song-filled').classList.remove('hidden');\n    songDropzone.classList.add('has-file');\n    document.getElementById('song-filename').textContent = file.name;\n    document.getElementById('song-preview').src = URL.createObjectURL(file);\n}\n\nfunction clearSong(e) {\n    e.stopPropagation();\n    songFile = null;\n    songInput.value = '';\n    document.getElementById('song-empty').classList.remove('hidden');\n    document.getElementById('song-filled').classList.add('hidden');\n    songDropzone.classList.remove('has-file');\n    document.getElementById('song-preview').src = '';\n}\n\n// ---------- Fotos: drag & drop + preview por slot ----------\n\ndocument.querySelectorAll('.photo-slot').forEach(slot => {\n    const idx = parseInt(slot.dataset.slot, 10);\n    const input = slot.querySelector('.photo-input');\n\n    slot.addEventListener('click', (e) => {\n        if (e.target.classList.contains('photo-remove')) return;\n        input.click();\n    });\n    input.addEventListener('change', (e) => {\n        if (e.target.files[0]) handlePhotoFile(idx, e.target.files[0]);\n    });\n\n    ['dragover', 'dragenter'].forEach(evt => {\n        slot.addEventListener(evt, (e) => {\n            e.preventDefault();\n            slot.classList.add('drag-over');\n        });\n    });\n    ['dragleave', 'drop'].forEach(evt => {\n        slot.addEventListener(evt, (e) => {\n            e.preventDefault();\n            slot.classList.remove('drag-over');\n        });\n    });\n    slot.addEventListener('drop', (e) => {\n        const file = e.dataTransfer.files[0];\n        if (file && file.type.startsWith('image/')) {\n            handlePhotoFile(idx, file);\n        } else if (file) {\n            showToast('Ese archivo no parece ser una imagen.');\n        }\n    });\n});\n\nfunction handlePhotoFile(idx, file) {\n    photoFiles[idx] = file;\n    const slot = document.querySelector('.photo-slot[data-slot=\"' + idx + '\"]');\n    const img = slot.querySelector('img');\n    const placeholder = slot.querySelector('.photo-placeholder');\n    const removeBtn = slot.querySelector('.photo-remove');\n\n    img.src = URL.createObjectURL(file);\n    img.classList.remove('hidden');\n    placeholder.classList.add('hidden');\n    removeBtn.classList.remove('hidden');\n}\n\nfunction clearPhoto(e, idx) {\n    e.stopPropagation();\n    photoFiles[idx] = null;\n    const slot = document.querySelector('.photo-slot[data-slot=\"' + idx + '\"]');\n    const img = slot.querySelector('img');\n    const placeholder = slot.querySelector('.photo-placeholder');\n    const removeBtn = slot.querySelector('.photo-remove');\n\n    img.src = '';\n    img.classList.add('hidden');\n    placeholder.classList.remove('hidden');\n    removeBtn.classList.add('hidden');\n}\n\n// ---------- Listado ----------\n\nasync function loadCapsuleList() {\n    const listEl = document.getElementById('capsule-list');\n    try {\n        const res = await fetch('/admin/api/capsules');\n        if (res.status === 401) {\n            window.location.href = '/admin';\n            return;\n        }\n        const data = await res.json();\n        renderCapsuleList(data.capsules || []);\n    } catch (err) {\n        listEl.innerHTML = '<div class=\"p-6 text-center text-red-400 text-sm\">No se pudo cargar el listado.</div>';\n    }\n}\n\nfunction renderCapsuleList(capsules) {\n    const listEl = document.getElementById('capsule-list');\n    if (capsules.length === 0) {\n        listEl.innerHTML = '<div class=\"p-6 text-center text-slate-500 text-sm\">Aún no hay cápsulas creadas.</div>';\n        return;\n    }\n\n    listEl.innerHTML = capsules.map(c => `\n        <div class=\"capsule-row flex items-center justify-between px-4 py-3 transition\">\n            <div>\n                <p class=\"font-bold text-slate-200 text-sm\">${escapeHtml(c.date)} <span class=\"text-slate-500 font-normal\">— ${escapeHtml(c.recipientName || 'Sin nombre')}</span></p>\n                <p class=\"text-xs text-slate-500 mt-0.5\">${escapeHtml(c.letterTitle || '')}</p>\n            </div>\n            <div class=\"flex items-center gap-2 flex-shrink-0\">\n                <a href=\"/?date=${encodeURIComponent(c.date)}\" target=\"_blank\" class=\"text-xs text-slate-400 hover:text-amber-400 px-2 py-1 transition\">Ver</a>\n                <button onclick=\"editCapsule('${escapeJs(c.date)}')\" class=\"text-xs text-slate-400 hover:text-amber-400 px-2 py-1 transition\">Editar</button>\n                <button onclick=\"deleteCapsule('${escapeJs(c.date)}')\" class=\"text-xs text-slate-400 hover:text-red-400 px-2 py-1 transition\">Eliminar</button>\n            </div>\n        </div>\n    `).join('');\n}\n\nfunction escapeHtml(str) {\n    const div = document.createElement('div');\n    div.textContent = str == null ? '' : String(str);\n    return div.innerHTML;\n}\n\nfunction escapeJs(str) {\n    return String(str).replace(/\\\\/g, '\\\\\\\\').replace(/'/g, \"\\\\'\");\n}\n\nasync function editCapsule(date) {\n    try {\n        const res = await fetch('/admin/api/capsules/' + encodeURIComponent(date));\n        if (!res.ok) {\n            showToast('No se pudo cargar la cápsula.');\n            return;\n        }\n        const capsule = await res.json();\n        showForm(capsule);\n    } catch (err) {\n        showToast('Error al cargar la cápsula.');\n    }\n}\n\nasync function deleteCapsule(date) {\n    if (!confirm('¿Eliminar la cápsula de la fecha ' + date + '? Esta acción no se puede deshacer.')) return;\n\n    try {\n        const res = await fetch('/admin/api/capsules/' + encodeURIComponent(date), { method: 'DELETE' });\n        if (!res.ok) {\n            showToast('No se pudo eliminar la cápsula.');\n            return;\n        }\n        showToast('Cápsula eliminada.');\n        loadCapsuleList();\n    } catch (err) {\n        showToast('Error al eliminar.');\n    }\n}\n\n// ---------- Guardar (crear / editar) ----------\n\nfunction validateForm() {\n    const date = document.getElementById('f-date').value;\n    const recipient = document.getElementById('f-recipient').value.trim();\n    const letterBody = document.getElementById('f-letter-body').value.trim();\n\n    if (!/^\\d{2}\\/\\d{2}\\/\\d{4}$/.test(date)) {\n        return 'La fecha debe tener el formato DD/MM/AAAA.';\n    }\n    if (!recipient) {\n        return 'Falta el nombre del destinatario.';\n    }\n    if (!letterBody) {\n        return 'Falta el cuerpo de la carta.';\n    }\n    if (!isEditing && !songFile) {\n        return 'Falta subir la canción.';\n    }\n    if (!isEditing && photoFiles.filter(f => f).length < 3) {\n        return 'Debes subir las 3 fotos.';\n    }\n    return null;\n}\n\nasync function submitCapsule() {\n    const errorEl = document.getElementById('form-error');\n    errorEl.classList.add('hidden');\n\n    const validationError = validateForm();\n    if (validationError) {\n        errorEl.textContent = validationError;\n        errorEl.classList.remove('hidden');\n        return;\n    }\n\n    const submitBtn = document.getElementById('submit-btn');\n    const statusEl = document.getElementById('submit-status');\n    submitBtn.disabled = true;\n    statusEl.textContent = 'Subiendo archivos, no cierres esta ventana...';\n\n    const formData = new FormData();\n    formData.append('date', document.getElementById('f-date').value);\n    formData.append('originalDate', document.getElementById('original-date').value);\n    formData.append('recipientName', document.getElementById('f-recipient').value.trim());\n    formData.append('letterTitle', document.getElementById('f-letter-title').value.trim());\n    formData.append('letterBody', document.getElementById('f-letter-body').value.trim());\n    formData.append('letterSignature', document.getElementById('f-letter-signature').value.trim());\n\n    if (songFile) formData.append('song', songFile);\n    photoFiles.forEach((file, idx) => {\n        if (file) formData.append('photo' + idx, file);\n    });\n\n    try {\n        const res = await fetch('/admin/api/capsules', {\n            method: 'POST',\n            body: formData\n        });\n\n        if (res.status === 401) {\n            window.location.href = '/admin';\n            return;\n        }\n\n        if (!res.ok) {\n            const data = await res.json().catch(() => ({}));\n            errorEl.textContent = data.error || 'Ocurrió un error al guardar. Intenta de nuevo.';\n            errorEl.classList.remove('hidden');\n            submitBtn.disabled = false;\n            statusEl.textContent = '';\n            return;\n        }\n\n        showToast('Cápsula guardada correctamente.');\n        hideForm();\n        loadCapsuleList();\n    } catch (err) {\n        errorEl.textContent = 'Error de conexión. Intenta de nuevo.';\n        errorEl.classList.remove('hidden');\n    } finally {\n        submitBtn.disabled = false;\n        statusEl.textContent = '';\n    }\n}\n\nloadCapsuleList();\n";

const SESSION_COOKIE_NAME = "capsule_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 horas de sesión activa

// ============================================================
// Utilidades de firma (HMAC-SHA256) para la cookie de sesión.
// No usamos JWT completo por simplicidad, pero el patrón es
// equivalente: payload.signature, verificado con Web Crypto.
// ============================================================

async function getSigningKey(secret) {
    const enc = new TextEncoder();
    return crypto.subtle.importKey(
        "raw",
        enc.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"]
    );
}

function toBase64Url(bytes) {
    let str = btoa(String.fromCharCode(...new Uint8Array(bytes)));
    return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str) {
    str = str.replace(/-/g, "+").replace(/_/g, "/");
    while (str.length % 4) str += "=";
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

async function createSessionToken(env, username) {
    const payload = JSON.stringify({
        u: username,
        exp: Date.now() + SESSION_TTL_SECONDS * 1000
    });
    const payloadB64 = toBase64Url(new TextEncoder().encode(payload));

    const key = await getSigningKey(env.SESSION_SECRET);
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
    const sigB64 = toBase64Url(sig);

    return payloadB64 + "." + sigB64;
}

async function verifySessionToken(env, token) {
    if (!token || !token.includes(".")) return null;
    const [payloadB64, sigB64] = token.split(".");
    if (!payloadB64 || !sigB64) return null;

    try {
        const key = await getSigningKey(env.SESSION_SECRET);
        const expectedSig = fromBase64Url(sigB64);
        const valid = await crypto.subtle.verify(
            "HMAC",
            key,
            expectedSig,
            new TextEncoder().encode(payloadB64)
        );
        if (!valid) return null;

        const payloadJson = new TextDecoder().decode(fromBase64Url(payloadB64));
        const payload = JSON.parse(payloadJson);

        if (!payload.exp || Date.now() > payload.exp) return null;

        return payload;
    } catch (err) {
        return null;
    }
}

function parseCookies(request) {
    const cookieHeader = request.headers.get("Cookie") || "";
    const cookies = {};
    cookieHeader.split(";").forEach(pair => {
        const idx = pair.indexOf("=");
        if (idx === -1) return;
        const key = pair.slice(0, idx).trim();
        const value = pair.slice(idx + 1).trim();
        if (key) cookies[key] = decodeURIComponent(value);
    });
    return cookies;
}

async function isAuthenticated(request, env) {
    const cookies = parseCookies(request);
    const token = cookies[SESSION_COOKIE_NAME];
    if (!token) return false;
    const payload = await verifySessionToken(env, token);
    return !!payload;
}

// Comparación en tiempo constante para evitar timing attacks en el login
function timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}

// ============================================================
// Helpers de KV / R2
// ============================================================

const INDEX_KEY = "capsule_index";

function normalizeDate(dateStr) {
    // Espera DD/MM/AAAA, valida formato básico
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return null;
    return dateStr;
}

function capsuleKvKey(date) {
    return "capsule:" + date;
}

async function getCapsuleIndex(env) {
    const raw = await env.KV2.get(INDEX_KEY);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        return [];
    }
}

async function saveCapsuleIndex(env, index) {
    await env.KV2.put(INDEX_KEY, JSON.stringify(index));
}

async function addToIndex(env, date) {
    const index = await getCapsuleIndex(env);
    if (!index.includes(date)) {
        index.push(date);
        await saveCapsuleIndex(env, index);
    }
}

async function removeFromIndex(env, date) {
    const index = await getCapsuleIndex(env);
    const filtered = index.filter(d => d !== date);
    await saveCapsuleIndex(env, filtered);
}

async function getCapsuleRecord(env, date) {
    const raw = await env.KV2.get(capsuleKvKey(date));
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch (err) {
        return null;
    }
}

async function saveCapsuleRecord(env, date, record) {
    await env.KV2.put(capsuleKvKey(date), JSON.stringify(record));
}

async function deleteCapsuleRecord(env, date, record) {
    // Limpieza de objetos R2 asociados
    const keysToDelete = [];
    if (record.songKey) keysToDelete.push(record.songKey);
    if (Array.isArray(record.photoKeys)) {
        record.photoKeys.forEach(k => { if (k) keysToDelete.push(k); });
    }
    await Promise.all(keysToDelete.map(k => env.RB.delete(k).catch(() => {})));
    await env.KV2.delete(capsuleKvKey(date));
    await removeFromIndex(env, date);
}

function sanitizeFilenameSegment(name) {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

function dateToSlug(date) {
    return date.replace(/\//g, "-");
}

async function storeFileInR2(env, date, file, kind, extraSlot) {
    const slug = dateToSlug(date);
    const ext = (file.name && file.name.includes(".")) ? file.name.split(".").pop() : "bin";
    const safeExt = sanitizeFilenameSegment(ext);
    const uniqueSuffix = crypto.randomUUID().slice(0, 8);
    const slotPart = extraSlot !== undefined ? ("-" + extraSlot) : "";
    const key = `capsules/${slug}/${kind}${slotPart}-${uniqueSuffix}.${safeExt}`;

    const arrayBuffer = await file.arrayBuffer();
    await env.RB.put(key, arrayBuffer, {
        httpMetadata: {
            contentType: file.type || "application/octet-stream"
        }
    });

    return key;
}

// R2 se sirve a través de esta misma ruta del Worker (no hace falta bucket público)
function r2PublicUrl(key) {
    return "/media/" + encodeURIComponent(key).replace(/%2F/g, "/");
}

// ============================================================
// Respuestas HTML auxiliares
// ============================================================

function htmlResponse(body, status = 200, extraHeaders = {}) {
    return new Response(body, {
        status,
        headers: {
            "Content-Type": "text/html; charset=UTF-8",
            ...extraHeaders
        }
    });
}

function jsonResponse(obj, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: {
            "Content-Type": "application/json; charset=UTF-8",
            ...extraHeaders
        }
    });
}

function buildPublicPage() {
    let html = PUBLIC_SHELL_HTML.replace("__CLIENT_SCRIPT__", PUBLIC_CLIENT_JS);
    html = html.replace("__PAGE_TITLE__", "Tiempo");
    return html;
}

function buildAdminLoginPage(errorMsg) {
    const errorBlock = errorMsg
        ? `<div class="mb-4 text-sm text-red-400 bg-red-950/40 border border-red-900 rounded p-3">${escapeHtmlServer(errorMsg)}</div>`
        : "";
    return ADMIN_LOGIN_HTML.replace("__ERROR_BLOCK__", errorBlock);
}

function buildAdminPanelPage() {
    return ADMIN_PANEL_HTML.replace("__ADMIN_SCRIPT__", ADMIN_CLIENT_JS);
}

function escapeHtmlServer(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// ============================================================
// Handlers de rutas
// ============================================================

async function handlePublicCapsuleApi(request, env, date) {
    const normalized = normalizeDate(date);
    if (!normalized) {
        return jsonResponse({ error: "Formato de fecha inválido." }, 400);
    }

    const record = await getCapsuleRecord(env, normalized);
    if (!record) {
        return jsonResponse({ error: "Cápsula no encontrada." }, 404);
    }

    return jsonResponse({
        date: record.date,
        recipientName: record.recipientName,
        letterTitle: record.letterTitle,
        letterBody: record.letterBody,
        letterSignature: record.letterSignature,
        songUrl: record.songKey ? r2PublicUrl(record.songKey) : null,
        photoUrls: (record.photoKeys || []).filter(Boolean).map(r2PublicUrl)
    });
}

async function handleMediaRequest(request, env, key) {
    const object = await env.RB.get(key);
    if (!object) {
        return new Response("No encontrado", { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("Accept-Ranges", "bytes");

    // Soporte de range requests para que el <audio> pueda hacer seek/streaming
    const range = request.headers.get("Range");
    if (range) {
        const match = range.match(/bytes=(\d+)-(\d+)?/);
        if (match) {
            const size = object.size;
            const start = parseInt(match[1], 10);
            const end = match[2] ? parseInt(match[2], 10) : size - 1;

            const rangedObject = await env.RB.get(key, {
                range: { offset: start, length: end - start + 1 }
            });

            if (rangedObject) {
                const rangedHeaders = new Headers();
                rangedObject.writeHttpMetadata(rangedHeaders);
                rangedHeaders.set("Content-Range", `bytes ${start}-${end}/${size}`);
                rangedHeaders.set("Accept-Ranges", "bytes");
                rangedHeaders.set("Cache-Control", "public, max-age=31536000, immutable");
                return new Response(rangedObject.body, { status: 206, headers: rangedHeaders });
            }
        }
    }

    return new Response(object.body, { headers });
}

async function handleAdminLoginSubmit(request, env) {
    const formData = await request.formData();
    const username = (formData.get("username") || "").toString();
    const password = (formData.get("password") || "").toString();

    // Si los secrets USER/PASS no están configurados en el Worker, nunca se
    // permite el login (evita que credenciales vacías "." vacías == válidas).
    const secretsConfigured = !!env.USER && !!env.PASS;

    const validUser = secretsConfigured && username.length > 0 && timingSafeEqual(username, env.USER);
    const validPass = secretsConfigured && password.length > 0 && timingSafeEqual(password, env.PASS);

    if (!secretsConfigured || !validUser || !validPass) {
        return htmlResponse(buildAdminLoginPage("Usuario o contraseña incorrectos."), 401);
    }

    const token = await createSessionToken(env, username);

    return new Response(null, {
        status: 302,
        headers: {
            "Location": "/admin",
            "Set-Cookie": `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax`
        }
    });
}

function handleAdminLogout() {
    return new Response(null, {
        status: 302,
        headers: {
            "Location": "/admin",
            "Set-Cookie": `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
        }
    });
}

async function handleAdminApiListCapsules(env) {
    const index = await getCapsuleIndex(env);
    const records = await Promise.all(index.map(date => getCapsuleRecord(env, date)));
    const capsules = records
        .filter(Boolean)
        .map(r => ({
            date: r.date,
            recipientName: r.recipientName,
            letterTitle: r.letterTitle
        }))
        .sort((a, b) => {
            // Ordena por fecha DD/MM/AAAA de más reciente a más antigua
            const [da, ma, ya] = a.date.split("/").map(Number);
            const [db, mb, yb] = b.date.split("/").map(Number);
            return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime();
        });

    return jsonResponse({ capsules });
}

async function handleAdminApiGetCapsule(env, date) {
    const normalized = normalizeDate(date);
    if (!normalized) return jsonResponse({ error: "Fecha inválida." }, 400);

    const record = await getCapsuleRecord(env, normalized);
    if (!record) return jsonResponse({ error: "No encontrada." }, 404);

    return jsonResponse({
        date: record.date,
        recipientName: record.recipientName,
        letterTitle: record.letterTitle,
        letterBody: record.letterBody,
        letterSignature: record.letterSignature,
        songUrl: record.songKey ? r2PublicUrl(record.songKey) : null,
        photoUrls: (record.photoKeys || []).filter(Boolean).map(r2PublicUrl)
    });
}

async function handleAdminApiSaveCapsule(request, env) {
    let formData;
    try {
        formData = await request.formData();
    } catch (err) {
        return jsonResponse({ error: "No se pudo leer el formulario enviado." }, 400);
    }

    const date = (formData.get("date") || "").toString();
    const originalDate = (formData.get("originalDate") || "").toString();
    const recipientName = (formData.get("recipientName") || "").toString().trim();
    const letterTitle = (formData.get("letterTitle") || "").toString().trim();
    const letterBody = (formData.get("letterBody") || "").toString().trim();
    const letterSignature = (formData.get("letterSignature") || "").toString().trim();

    const normalizedDate = normalizeDate(date);
    if (!normalizedDate) {
        return jsonResponse({ error: "La fecha debe tener el formato DD/MM/AAAA." }, 400);
    }
    if (!recipientName) {
        return jsonResponse({ error: "Falta el nombre del destinatario." }, 400);
    }
    if (!letterBody) {
        return jsonResponse({ error: "Falta el cuerpo de la carta." }, 400);
    }

    const isEditing = !!originalDate;
    const dateChanged = isEditing && originalDate !== normalizedDate;

    // Si es edición, parte del registro existente para no perder archivos que no se reemplazan
    let existingRecord = null;
    if (isEditing) {
        existingRecord = await getCapsuleRecord(env, originalDate);
        if (!existingRecord) {
            return jsonResponse({ error: "La cápsula original ya no existe." }, 404);
        }
    }

    // Si es cápsula nueva (o cambia de fecha) y esa fecha ya está ocupada, evita pisar otra cápsula
    if (!isEditing || dateChanged) {
        const collision = await getCapsuleRecord(env, normalizedDate);
        if (collision) {
            return jsonResponse({ error: "Ya existe una cápsula con esa fecha." }, 409);
        }
    }

    const songFile = formData.get("song");
    const photo0 = formData.get("photo0");
    const photo1 = formData.get("photo1");
    const photo2 = formData.get("photo2");

    if (!isEditing) {
        if (!(songFile instanceof File) || songFile.size === 0) {
            return jsonResponse({ error: "Falta subir la canción." }, 400);
        }
        if (![photo0, photo1, photo2].every(p => p instanceof File && p.size > 0)) {
            return jsonResponse({ error: "Debes subir las 3 fotos." }, 400);
        }
    }

    let songKey = existingRecord ? existingRecord.songKey : null;
    let photoKeys = existingRecord ? [...(existingRecord.photoKeys || [null, null, null])] : [null, null, null];

    try {
        if (songFile instanceof File && songFile.size > 0) {
            const newSongKey = await storeFileInR2(env, normalizedDate, songFile, "song");
            if (existingRecord && existingRecord.songKey) {
                await env.RB.delete(existingRecord.songKey).catch(() => {});
            }
            songKey = newSongKey;
        }

        const photoInputs = [photo0, photo1, photo2];
        for (let i = 0; i < 3; i++) {
            const f = photoInputs[i];
            if (f instanceof File && f.size > 0) {
                const newPhotoKey = await storeFileInR2(env, normalizedDate, f, "photo", i);
                if (existingRecord && existingRecord.photoKeys && existingRecord.photoKeys[i]) {
                    await env.RB.delete(existingRecord.photoKeys[i]).catch(() => {});
                }
                photoKeys[i] = newPhotoKey;
            }
        }
    } catch (err) {
        return jsonResponse({ error: "Ocurrió un error subiendo los archivos. Intenta de nuevo." }, 500);
    }

    const record = {
        date: normalizedDate,
        recipientName,
        letterTitle,
        letterBody,
        letterSignature,
        songKey,
        photoKeys
    };

    await saveCapsuleRecord(env, normalizedDate, record);
    await addToIndex(env, normalizedDate);

    // Si cambió la fecha, elimina el registro viejo del índice y KV (los archivos ya migraron)
    if (dateChanged) {
        await env.KV2.delete(capsuleKvKey(originalDate));
        await removeFromIndex(env, originalDate);
    }

    return jsonResponse({ success: true, date: normalizedDate });
}

async function handleAdminApiDeleteCapsule(env, date) {
    const normalized = normalizeDate(date);
    if (!normalized) return jsonResponse({ error: "Fecha inválida." }, 400);

    const record = await getCapsuleRecord(env, normalized);
    if (!record) return jsonResponse({ error: "No encontrada." }, 404);

    await deleteCapsuleRecord(env, normalized, record);
    return jsonResponse({ success: true });
}

// ============================================================
// Router principal
// ============================================================

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        try {
            // ---------- Página pública ----------
            if (path === "/" && method === "GET") {
                return htmlResponse(buildPublicPage());
            }

            // ---------- API pública de cápsula (por fecha) ----------
            if (path.startsWith("/api/capsule/") && method === "GET") {
                const date = decodeURIComponent(path.replace("/api/capsule/", ""));
                return await handlePublicCapsuleApi(request, env, date);
            }

            // ---------- Archivos servidos desde R2 ----------
            if (path.startsWith("/media/") && method === "GET") {
                const key = decodeURIComponent(path.replace("/media/", ""));
                return await handleMediaRequest(request, env, key);
            }

            // ---------- Login de admin ----------
            if (path === "/admin/login" && method === "POST") {
                return await handleAdminLoginSubmit(request, env);
            }
            if (path === "/admin/logout" && method === "POST") {
                return handleAdminLogout();
            }

            // ---------- Panel de admin (requiere sesión) ----------
            if (path === "/admin" && method === "GET") {
                const authed = await isAuthenticated(request, env);
                if (!authed) {
                    return htmlResponse(buildAdminLoginPage(null));
                }
                return htmlResponse(buildAdminPanelPage());
            }

            // ---------- API de admin (requiere sesión) ----------
            if (path.startsWith("/admin/api/")) {
                const authed = await isAuthenticated(request, env);
                if (!authed) {
                    return jsonResponse({ error: "No autenticado." }, 401);
                }

                if (path === "/admin/api/capsules" && method === "GET") {
                    return await handleAdminApiListCapsules(env);
                }
                if (path === "/admin/api/capsules" && method === "POST") {
                    return await handleAdminApiSaveCapsule(request, env);
                }
                if (path.startsWith("/admin/api/capsules/") && method === "GET") {
                    const date = decodeURIComponent(path.replace("/admin/api/capsules/", ""));
                    return await handleAdminApiGetCapsule(env, date);
                }
                if (path.startsWith("/admin/api/capsules/") && method === "DELETE") {
                    const date = decodeURIComponent(path.replace("/admin/api/capsules/", ""));
                    return await handleAdminApiDeleteCapsule(env, date);
                }

                return jsonResponse({ error: "Ruta no encontrada." }, 404);
            }

            return new Response("No encontrado", { status: 404 });
        } catch (err) {
            return jsonResponse({ error: "Error interno del servidor.", detail: String(err && err.message ? err.message : err) }, 500);
        }
    }
};
