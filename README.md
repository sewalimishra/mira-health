# MIRA – Medical Intelligence Robotic Automation

A health prediction web application built with Python (Flask) backend and HTML/CSS/JavaScript frontend. Patient blood test results are analysed using the Claude AI API to generate intelligent health risk remarks.

## Features

- Full CRUD for patient records (Create, Read, Update, Delete)
- AI-powered health remarks generated via Claude API
- Input validation: email format, future DOB blocked, numeric blood values enforced
- Colour-coded badges: normal / high / low for each blood marker
- Live search by name or email
- Dashboard stats: total patients, high glucose count, average cholesterol

## Tech Stack

| Layer    | Technology                  |
|----------|-----------------------------|
| Backend  | Python 3.10+, Flask         |
| Frontend | HTML5, CSS3, Vanilla JS     |
| Database | SQLite                      |
| AI API   | Anthropic Claude Sonnet     |

## Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/sewalimishra/mira-health.git
cd mira-health
```

### 2. Create a virtual environment

```bash
python -m venv venv
venv\Scripts\activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment variables

```bash
cp .env.example .env
```

Add your Anthropic API key inside .env:
### 5. Run the application

```bash
python app.py
```

Open your browser at http://localhost:5000

## Project Structure
mira-health/
├── app.py
├── requirements.txt
├── .env.example
├── .gitignore
├── templates/
│   └── index.html
└── static/
├── css/style.css
└── js/app.js

## Author

Sewali Mishra
GitHub: https://github.com/sewalimishra
