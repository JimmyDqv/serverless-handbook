# Custom build: vendors the canonical shared atlas_client from shared/python/.
# Requires `build_in_source: true` in samconfig.yaml (see orchestrator Makefile).
build-VectorSearchToolFunction:
	cp *.py "$(ARTIFACTS_DIR)"
	cp ../../../shared/python/atlas_client.py "$(ARTIFACTS_DIR)"
	# Target Lambda's platform explicitly: a plain pip install on macOS ships
	# Mach-O .so files (e.g. psycopg2) that crash on Lambda with ImportModuleError.
	python3 -m pip install -r requirements.txt -t "$(ARTIFACTS_DIR)" \
		--platform manylinux2014_aarch64 --platform manylinux_2_17_aarch64 \
		--platform manylinux_2_28_aarch64 --implementation cp \
		--python-version 3.13 --only-binary=:all: --upgrade
