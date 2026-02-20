import os
import subprocess
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

BASE_DIR = "/sdcard/Alfred"
MODEL = f"{BASE_DIR}/cerebro/Alfred_Model_gguf.gguf"
VOICE = f"{BASE_DIR}/voz/es_ES-low.onnx"
ENGINE = f"{BASE_DIR}/cerebro/llama-cli"

def hablar(texto):
    # Alfred habla por altavoz
    os.system(f'echo "{texto}" | piper --model {VOICE} --output_file {BASE_DIR}/voz/temp.wav')
    os.system(f'mpv {BASE_DIR}/voz/temp.wav')

@app.route('/')
def index(): return render_template('index.html')

@app.route('/ask', methods=['POST'])
def ask():
    msg = request.json.get("msg")
    # Ejecución local
    cmd = [ENGINE, "-m", MODEL, "-p", f"### Sistema: Eres Alfred, la IA de Yeison. \n### Usuario: {msg} \n### Alfred:", "-n", "128"]
    res = subprocess.check_output(cmd).decode('utf-8').split("### Alfred:")[-1].strip()
    hablar(res)
    return jsonify({"response": res})

@app.route('/borrar', methods=['POST'])
def borrar():
    os.system(f"rm {BASE_DIR}/voz/*.wav")
    return jsonify({"status": "Trazas borradas"})

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=8080)
