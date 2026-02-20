import os
import subprocess
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Rutas locales dentro de la tablet
BASE_DIR = "/sdcard/Alfred"
MODEL_PATH = f"{BASE_DIR}/cerebro/model.gguf"
ENGINE_PATH = f"{BASE_DIR}/cerebro/llama-cli"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/ask', methods=['POST'])
def ask():
    user_msg = request.json.get("msg")
    
    # Ejecución local: usa 4 hilos para que sea rápido sin internet
    cmd = [
        ENGINE_PATH, "-m", MODEL_PATH,
        "-p", f"### Sistema: Eres Alfred, la IA offline de Yeison. \n### Usuario: {user_msg} \n### Alfred:",
        "-n", "128", "-t", "4", "--temp", "0.4"
    ]
    
    try:
        raw_output = subprocess.check_output(cmd).decode('utf-8')
        respuesta = raw_output.split("### Alfred:")[-1].strip()
    except:
        respuesta = "Error en el núcleo local, señor Yeison."
        
    return jsonify({"response": respuesta})

@app.route('/borrar_trazas', methods=['POST'])
def borrar():
    return jsonify({"status": "Consola purgada localmente."})

if __name__ == '__main__':
    # '127.0.0.1' es la clave para que funcione SIN WIFI
    app.run(host='127.0.0.1', port=8080)
