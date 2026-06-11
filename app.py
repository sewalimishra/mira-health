from flask import Flask, render_template, request, jsonify
import sqlite3
import os
import re
from datetime import datetime, date
import anthropic

app = Flask(__name__)
DB_PATH = "mira.db"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS patients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                dob TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                glucose REAL NOT NULL,
                haemoglobin REAL NOT NULL,
                cholesterol REAL NOT NULL,
                remarks TEXT DEFAULT '',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()

def get_ai_prediction(full_name, dob, glucose, haemoglobin, cholesterol):
    try:
        client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
        birth = datetime.strptime(dob, "%Y-%m-%d")
        age = (date.today() - birth.date()).days // 365
        prompt = f"""You are a medical AI assistant. Analyze the following patient blood test results and provide a brief health risk assessment.

Patient: {full_name}, Age: {age}
Blood Test Results:
- Glucose: {glucose} mg/dL (Normal: 70-100 fasting)
- Haemoglobin: {haemoglobin} g/dL (Normal: Men 13.5-17.5, Women 12-15.5)
- Cholesterol: {cholesterol} mg/dL (Normal: <200 desirable)

Provide a concise 2-3 sentence health risk remark covering:
1. Whether each value is normal, low, or high
2. Possible health conditions suggested by these values
3. A brief recommendation

Keep it professional, clear, and under 80 words. Do not use bullet points."""

        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}]
        )
        return message.content[0].text.strip()
    except Exception as e:
        return f"Prediction unavailable: {str(e)}"

def validate_patient(data):
    errors = []
    if not data.get("full_name", "").strip():
        errors.append("Full name is required.")
    if not data.get("email", "").strip() or not re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', data["email"]):
        errors.append("Valid email address is required.")
    try:
        dob = datetime.strptime(data["dob"], "%Y-%m-%d").date()
        if dob >= date.today():
            errors.append("Date of birth cannot be today or a future date.")
    except:
        errors.append("Valid date of birth is required.")
    for field in ["glucose", "haemoglobin", "cholesterol"]:
        try:
            val = float(data.get(field, ""))
            if val <= 0:
                errors.append(f"{field.capitalize()} must be a positive number.")
        except:
            errors.append(f"{field.capitalize()} must be a valid numeric value.")
    return errors

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/patients", methods=["GET"])
def get_patients():
    search = request.args.get("search", "").strip()
    with get_db() as conn:
        if search:
            rows = conn.execute(
                "SELECT * FROM patients WHERE full_name LIKE ? OR email LIKE ? ORDER BY created_at DESC",
                (f"%{search}%", f"%{search}%")
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM patients ORDER BY created_at DESC").fetchall()
    return jsonify([dict(r) for r in rows])

@app.route("/api/patients/<int:pid>", methods=["GET"])
def get_patient(pid):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM patients WHERE id=?", (pid,)).fetchone()
    if not row:
        return jsonify({"error": "Patient not found"}), 404
    return jsonify(dict(row))

@app.route("/api/patients", methods=["POST"])
def create_patient():
    data = request.json
    errors = validate_patient(data)
    if errors:
        return jsonify({"errors": errors}), 400
    remarks = get_ai_prediction(
        data["full_name"], data["dob"],
        float(data["glucose"]), float(data["haemoglobin"]), float(data["cholesterol"])
    )
    try:
        with get_db() as conn:
            conn.execute(
                "INSERT INTO patients (full_name, dob, email, glucose, haemoglobin, cholesterol, remarks) VALUES (?,?,?,?,?,?,?)",
                (data["full_name"].strip(), data["dob"], data["email"].strip().lower(),
                 float(data["glucose"]), float(data["haemoglobin"]), float(data["cholesterol"]), remarks)
            )
            conn.commit()
        return jsonify({"message": "Patient added successfully.", "remarks": remarks}), 201
    except sqlite3.IntegrityError:
        return jsonify({"errors": ["A patient with this email already exists."]}), 400

@app.route("/api/patients/<int:pid>", methods=["PUT"])
def update_patient(pid):
    data = request.json
    errors = validate_patient(data)
    if errors:
        return jsonify({"errors": errors}), 400
    remarks = get_ai_prediction(
        data["full_name"], data["dob"],
        float(data["glucose"]), float(data["haemoglobin"]), float(data["cholesterol"])
    )
    try:
        with get_db() as conn:
            result = conn.execute(
                "UPDATE patients SET full_name=?, dob=?, email=?, glucose=?, haemoglobin=?, cholesterol=?, remarks=? WHERE id=?",
                (data["full_name"].strip(), data["dob"], data["email"].strip().lower(),
                 float(data["glucose"]), float(data["haemoglobin"]), float(data["cholesterol"]), remarks, pid)
            )
            conn.commit()
            if result.rowcount == 0:
                return jsonify({"error": "Patient not found"}), 404
        return jsonify({"message": "Patient updated successfully.", "remarks": remarks})
    except sqlite3.IntegrityError:
        return jsonify({"errors": ["A patient with this email already exists."]}), 400

@app.route("/api/patients/<int:pid>", methods=["DELETE"])
def delete_patient(pid):
    with get_db() as conn:
        result = conn.execute("DELETE FROM patients WHERE id=?", (pid,))
        conn.commit()
        if result.rowcount == 0:
            return jsonify({"error": "Patient not found"}), 404
    return jsonify({"message": "Patient deleted successfully."})

if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)
