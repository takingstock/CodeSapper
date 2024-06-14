from flask import Flask, render_template, jsonify

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/data/nodes')
def nodes():

    data = [
        { "method_nm": "Method1", "method_begin": 1, "method_end": 5, "snippet": "def method1() { ... }" },
        { "method_nm": "Method2", "method_begin": 6, "method_end": 10, "snippet": "def method2() { ... }" }
    ]
    
    return jsonify(data)

@app.route('/data/links')
def links():

    data = [
        { "method_nm": "Method1", "global_uses": ["Method2"], "local_uses": [] }
    ]
    return jsonify(data)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=6999)

