build-HelloWorldFunction:
	GOOS=linux GOARCH=arm64 go build -o bootstrap main.go
	cp ./bootstrap $(ARTIFACTS_DIR)/.