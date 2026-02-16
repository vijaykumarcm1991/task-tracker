#!/usr/bin/bash
docker compose down -v
docker compose build --no-cache
rm -rf logs.txt
docker compose up > logs.txt
