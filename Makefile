.PHONY: up down logs shell seed-admin psql

up:
	docker compose --env-file .env.local up --build

down:
	docker compose down

logs:
	docker compose logs -f app

shell:
	docker compose exec app bash

# Create the first admin user. Usage: make seed-admin EMAIL=you@example.com USERNAME=admin PASSWORD=yourpassword
seed-admin:
	docker compose exec app python scripts/seed_admin.py "$(EMAIL)" "$(USERNAME)" "$(PASSWORD)"

psql:
	docker compose exec postgres psql -U galleri_app -d galleri
