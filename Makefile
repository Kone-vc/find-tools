.PHONY: test test-all test-ts test-py lint-tools install install-ts install-py

# ─── Install ──────────────────────────────────────────────────────────────────

install: install-ts install-py

install-ts:
	cd sdk-ts && npm install

install-py:
	cd sdk-py && pip install -e .

# ─── Tests ────────────────────────────────────────────────────────────────────
#
#   make test       — local + tools.json (--quiet) + remote; short log
#   make lint-tools — tools.json only: one [PASS] line per catalog entry (TS + Python)
#   make test-all   — test + lint-tools (full matrix including verbose catalog pass)
#

test: test-ts test-py

test-all: test lint-tools

lint-tools:
	@echo "\n>>> tools.json (TS)"
	cd sdk-ts && npx ts-node test/test_tools_json.ts
	@echo "\n>>> tools.json (Python)"
	cd sdk-py && python test/test_tools_json.py

test-ts:
	@echo "\n>>> TypeScript SDK — local"
	cd sdk-ts && npx ts-node test/test_find_tools_local.ts
	@echo "\n>>> TypeScript SDK — tools.json"
	cd sdk-ts && npx ts-node test/test_tools_json.ts --quiet
	@echo "\n>>> TypeScript SDK — remote (HTTP)"
	cd sdk-ts && npx ts-node test/test_find_tools_remote.ts --http --repo=default "refactor my pull request"; \
		code=$$?; [ $$code -eq 0 ] || [ $$code -eq 2 ] || exit $$code

test-py:
	@echo "\n>>> Python SDK — local"
	cd sdk-py && python test/test_find_tools_local.py
	@echo "\n>>> Python SDK — tools.json"
	cd sdk-py && python test/test_tools_json.py --quiet
	@echo "\n>>> Python SDK — remote (HTTP)"
	cd sdk-py && python test/test_find_tools_remote.py --http --repo=default "refactor my pull request"; \
		code=$$?; [ $$code -eq 0 ] || [ $$code -eq 2 ] || exit $$code
