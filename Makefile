.PHONY: test test-ts test-py install install-ts install-py

# ─── Install ──────────────────────────────────────────────────────────────────

install: install-ts install-py

install-ts:
	cd sdk-ts && npm install

install-py:
	cd sdk-py && pip install -e .

# ─── Tests ────────────────────────────────────────────────────────────────────

test: test-ts test-py

test-ts:
	@echo "\n>>> TypeScript SDK — local"
	cd sdk-ts && npx ts-node test/test_find_tools_local.ts
	@echo "\n>>> TypeScript SDK — remote (HTTP)"
	cd sdk-ts && npx ts-node test/test_find_tools_remote.ts --http --repo=default "refactor my pull request"; \
		code=$$?; [ $$code -eq 0 ] || [ $$code -eq 2 ] || exit $$code

test-py:
	@echo "\n>>> Python SDK — local"
	cd sdk-py && python test/test_find_tools_local.py
	@echo "\n>>> Python SDK — remote (HTTP)"
	cd sdk-py && python test/test_find_tools_remote.py --http --repo=default "refactor my pull request"; \
		code=$$?; [ $$code -eq 0 ] || [ $$code -eq 2 ] || exit $$code
