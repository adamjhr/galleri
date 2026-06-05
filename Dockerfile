FROM python:3.12-slim

RUN apt-get update -qq && apt-get install -y --no-install-recommends libmagic1 && rm -rf /var/lib/apt/lists/*

WORKDIR /srv/galleri

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["python", "-m", "flask", "--app", "wsgi:app", "run", "--host", "0.0.0.0", "--port", "5000", "--debug"]
