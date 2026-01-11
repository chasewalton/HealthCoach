### Run the Flask app

- **Create and activate a virtual environment:**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

- **Install dependencies:**
```bash
pip install -r requirements.txt
```

- **Run the server** (change `app.py` if your entry file is different):
```bash
export FLASK_APP=main_flask.py
export FLASK_ENV=development  # optional: enables auto-reload
flask run -h 0.0.0.0 -p 5000
```

- **Stop and deactivate when done:**
```bash
# Press Ctrl+C in the terminal running Flask
deactivate
```

### Production (optional)

- **Run with Gunicorn** (replace `app:app` if your module or app name differs):
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:8000 app:app
```

### Model selection and OpenAI (optional)

- In the chat UI, use the "Model" dropdown to choose between local Ollama and OpenAI ChatGPT.
- To use OpenAI:
  - Set your API key in the environment before running:
    ```bash
    export OPENAI_API_KEY=sk-...
    ```
  - Optionally set the default provider/model:
    ```bash
    export LLM_PROVIDER=openai
    export OPENAI_MODEL=gpt-5.2
    ```
  - Install the OpenAI SDK if not already installed:
    ```bash
    pip install openai
    ```

