# FILE: strongswan_api.py

# -*- coding: utf-8 -*-
from flask import Flask, request, jsonify, abort
from flask_cors import CORS
import subprocess
import os
import re
import json
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)

SWANCTL_CONF_DIR = "/etc/swanctl/conf.d/"
SWANCTL_SECRETS_DIR = "/etc/swanctl/secrets.d/"
UPLOAD_FOLDER = '/tmp/certs'
os.makedirs(SWANCTL_SECRETS_DIR, exist_ok=True)
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def run_command(command):
    """Hàm helper để chạy lệnh shell và trả về kết quả."""
    try:
        result = subprocess.run(
            command, shell=True, check=True, capture_output=True, text=True
        )
        return {"success": True, "output": result.stdout.strip()}
    except subprocess.CalledProcessError as e:
        return {"success": False, "error": e.stderr.strip()}

def generate_s2s_ikev2_cert_conf(data):
    """Tạo nội dung file .conf cho kịch bản Site-to-Site IKEv2 Certificate."""
    conn_name = data.get('name')
    if not conn_name: return ""
    metadata = {"category": data.get("category"), "auth_method": data.get("auth_method")}
    content = f"# METADATA: {json.dumps(metadata)}\n\n"
    content += f"connections {{\n  \"{conn_name}\" {{\n"
    ike_version = data.get('ike_version', 'any')
    if ike_version == 'ikev1': content += "    version = 1\n"
    elif ike_version == 'ikev2': content += "    version = 2\n"
    else: content += "    version = 0\n"
    if data.get('active_initiator'): content += "    auto = start\n"
    else: content += "    auto = add\n"
    if data.get('server_address'): content += f"    local_addrs = {data['server_address']}\n"
    if data.get('remote_address'): content += f"    remote_addrs = {data['remote_address']}\n"
    content += "    local {{\n      auth = pubkey\n"
    if data.get('server_certificate_name'): content += f"      certs = {data['server_certificate_name']}\n"
    if data.get('local_identity'): content += f"      id = \"{data['local_identity']}\"\n"
    content += "    }}\n"
    content += "    remote {{\n      auth = pubkey\n"
    if not data.get('auto_ca_select') and data.get('ca_certificate_name'):
        content += f"      cacerts = {data['ca_certificate_name']}\n"
    if not data.get('use_server_value') and data.get('peer_identity'):
        content += f"      id = \"{data['peer_identity']}\"\n"
    content += "    }}\n"
    content += "    children {{\n"
    content += f"      \"{conn_name}-child\" {{\n"
    content += f"        local_ts = {data.get('local_traffic_selector') or '0.0.0.0/0'}\n"
    content += f"        remote_ts = {data.get('remote_traffic_selector') or '0.0.0.0/0'}\n"
    content += f"        start_action = {data.get('start_action', 'none')}\n"
    content += "      }}\n    }}\n"
    content += "  }}\n}}\n"
    return content

def generate_s2s_psk_conf(data):
    """Tạo nội dung file .conf cho kịch bản Site-to-Site PSK."""
    conn_name = data.get('name')
    if not conn_name: return ""
    metadata = {"category": data.get("category"), "auth_method": data.get("auth_method")}
    content = f"# METADATA: {json.dumps(metadata)}\n\n"
    content += f"connections {{\n  \"{conn_name}\" {{\n"
    content += "    local_addrs = %any\n"
    if data.get('remote_address'): content += f"    remote_addrs = {data['remote_address']}\n"
    content += "    local {{\n      auth = psk\n"
    if data.get('local_identity'): content += f"      id = {data['local_identity']}\n"
    content += "    }}\n"
    content += "    remote {{\n      auth = psk\n"
    if data.get('remote_identity'): content += f"      id = {data['remote_identity']}\n"
    content += "    }}\n"
    content += "    children {{\n"
    content += f"      \"{conn_name}-child\" {{\n"
    content += f"        local_ts = {data.get('local_traffic_selector') or '0.0.0.0/0'}\n"
    content += f"        remote_ts = {data.get('remote_traffic_selector') or '0.0.0.0/0'}\n"
    content += "        start_action = trap\n"
    content += "      }}\n    }}\n"
    content += "    version = 0\n" # Any IKE version
    content += "    mobike = no\n"
    content += "    auto = add\n"
    content += "  }}\n}}\n"
    return content

def parse_connection_file(filepath):
    """Đọc và phân tích file .conf để lấy thông tin chi tiết."""
    # ... (Hàm này giữ nguyên như trước) ...
    try:
        with open(filepath, 'r') as f:
            content = f.read()
            metadata_str = re.search(r'# METADATA: (.*)', content)
            metadata = json.loads(metadata_str.group(1)) if metadata_str else {}
            name_match = re.search(r'connections\s*\{\s*"([^"]+)"', content)
            server_match = re.search(r'local_addrs\s*=\s*([^\s\n]+)', content)
            return {
                "name": name_match.group(1) if name_match else os.path.splitext(os.path.basename(filepath))[0],
                "server": server_match.group(1) if server_match else "Default",
                "auth_type": metadata.get("auth_method", "Unknown"),
                "conn_type": metadata.get("category", "Unknown"),
            }
    except Exception as e:
        print(f"Error parsing file {filepath}: {e}")
        return {"name": os.path.splitext(os.path.basename(filepath))[0], "server": "Parse Error"}

# ==============================================================================
# API ENDPOINTS
# ==============================================================================

@app.route('/api/connections', methods=['GET'])
def get_all_connections():
    # ... (Hàm này giữ nguyên như trước) ...
    sas_result = run_command("sudo swanctl --list-sas")
    active_sas = {}
    if sas_result["success"]:
        for line in sas_result["output"].splitlines():
            if ":" in line and ("ESTABLISHED" in line or "CONNECTING" in line):
                name = line.split(':')[0].strip()
                state = "ESTABLISHED" if "ESTABLISHED" in line else "CONNECTING"
                active_sas[name] = state
    connections = []
    if os.path.exists(SWANCTL_CONF_DIR):
        for filename in os.listdir(SWANCTL_CONF_DIR):
            if filename.endswith('.conf'):
                filepath = os.path.join(SWANCTL_CONF_DIR, filename)
                conn_data = parse_connection_file(filepath)
                conn_data["id"] = conn_data["name"]
                conn_data["state"] = active_sas.get(conn_data["name"], "Idle")
                connections.append(conn_data)
    return jsonify(connections)

@app.route('/api/connections', methods=['POST'])
def save_connection():
    data = request.get_json()
    if not isinstance(data, dict) or not data.get('name'):
        abort(400, "Invalid JSON data or missing 'name' field.")

    conn_name = data['name']
    auth_method = data.get('auth_method')
    conf_content = ""

    if auth_method == 'ikev2-psk':
        conf_content = generate_s2s_psk_conf(data)
        secrets_content = f'ike-psk-{conn_name} {{\n'
        secrets_content += f'    id = {data.get("local_identity")}\n'
        secrets_content += f'    secret = "{data.get("pre_shared_key")}"\n'
        secrets_content += '}}\n'
        secrets_file_path = os.path.join(SWANCTL_SECRETS_DIR, f"{conn_name}.secrets.conf")
        secrets_write_cmd = f"echo '{secrets_content}' | sudo tee {secrets_file_path}"
        run_command(secrets_write_cmd)
    elif auth_method == 'ikev2-cert':
        conf_content = generate_s2s_ikev2_cert_conf(data)
    else:
        abort(400, f"Unsupported auth_method: {auth_method}")

    file_path = os.path.join(SWANCTL_CONF_DIR, f"{conn_name}.conf")
    write_cmd = f"echo '{conf_content}' | sudo tee {file_path}"
    write_result = run_command(write_cmd)

    if not write_result["success"]:
        return jsonify({"error": "Failed to write config file", "details": write_result["error"]}), 500

    if data.get('andUpdate', False):
        load_cmd = "sudo swanctl --load-secrets && sudo swanctl --load-all"
        load_result = run_command(load_cmd)
        if not load_result["success"]:
            return jsonify({"error": "Failed to reload config", "details": load_result["error"]}), 500

    return jsonify({"message": f"Connection '{conn_name}' saved successfully!"}), 201


# ... các API khác (upload, delete) giữ nguyên như cũ ...

@app.route('/api/connections/<string:conn_name>', methods=['PUT'])
def update_connection(conn_name):
    return create_connection()

@app.route('/api/connections/<string:conn_name>', methods=['DELETE'])
def delete_connection(conn_name):
    file_path = os.path.join(SWANCTL_CONF_DIR, f"{conn_name}.conf")
    if not os.path.exists(file_path):
        return jsonify({"error": "Connection not found"}), 404
    delete_cmd = f"sudo rm {file_path}"
    delete_result = run_command(delete_cmd)
    if not delete_result["success"]:
        return jsonify({"error": "Failed to delete config file", "details": delete_result["error"]}), 500
    load_result = run_command("sudo swanctl --load-all")
    if not load_result["success"]:
        return jsonify({"error": "Failed to reload config", "details": load_result["error"]}), 500
    return '', 204

@app.route('/api/certificates/upload', methods=['POST'])
def upload_certificate():
    if 'file' not in request.files: return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '': return jsonify({"error": "No selected file"}), 400
    if file:
        original_filename = secure_filename(file.filename)
        filename, extension = os.path.splitext(original_filename)
        filepath = os.path.join(UPLOAD_FOLDER, original_filename)
        counter = 1
        while os.path.exists(filepath):
            new_name = f"{filename}({counter}){extension}"
            filepath = os.path.join(UPLOAD_FOLDER, new_name)
            counter += 1
        file.save(filepath)
        final_filename = os.path.basename(filepath)
        identities = []
        cert_type = 'cert'
        if 'key.pem' in original_filename.lower():
            cert_type = 'key'
            name_part = original_filename.lower().replace('key.pem', '')
            identities = [f"CN={name_part}", f"DNS:{name_part}.example.com"]
        return jsonify({
            "id": final_filename, "name": final_filename, "type": cert_type,
            "identities": identities, "subject": f"CN={original_filename}"
        }), 201

@app.route('/api/certificates', methods=['GET'])
def get_certificates():
    """Đọc danh sách file certificate thật từ thư mục upload."""
    certs = []
    if os.path.exists(UPLOAD_FOLDER):
        for filename in os.listdir(UPLOAD_FOLDER):
            identities = []
            cert_type = 'cert'
            if 'key.pem' in filename.lower():
                cert_type = 'key'
                name_part = filename.lower().replace('key.pem', '')
                identities = [f"CN={name_part}", f"DNS:{name_part}.example.com"]
            certs.append({
                "id": filename,
                "name": filename,
                "type": cert_type,
                "identities": identities
            })
    return jsonify(certs)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
